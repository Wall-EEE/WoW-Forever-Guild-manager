-- WoW Forever: first authenticated access milestone.
-- Never use a client-supplied role or guest status as authority.
create type public.guild_role as enum ('guest', 'member', 'officer', 'guild_master');
create type public.guest_review_status as enum ('pending', 'approved', 'rejected');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Adventurer' check (char_length(display_name) between 1 and 80),
  role public.guild_role not null default 'guest',
  guest_status public.guest_review_status not null default 'pending',
  created_at timestamptz not null default now()
);

create table public.guest_decisions (
  id bigint generated always as identity primary key,
  profile_id uuid not null references public.profiles(id),
  actor_id uuid not null references public.profiles(id),
  previous_status public.guest_review_status not null,
  new_status public.guest_review_status not null,
  decided_at timestamptz not null default now()
);

create table public.characters (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  character_name text not null check (char_length(character_name) between 2 and 40),
  realm text not null check (char_length(realm) between 2 and 80),
  class_name text not null check (char_length(class_name) between 2 and 40),
  level integer not null default 1 check (level between 1 and 60),
  is_main boolean not null default false,
  created_at timestamptz not null default now(),
  unique(owner_id, realm, character_name)
);
create unique index characters_one_main_per_player on public.characters(owner_id) where is_main;

create function public.on_auth_user_created()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id, display_name)
  values (new.id, left(coalesce(nullif(new.raw_user_meta_data ->> 'full_name',''), nullif(new.raw_user_meta_data ->> 'name',''), 'Adventurer'),80));
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.on_auth_user_created();

create function public.is_officer()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role in ('officer','guild_master')
  );
$$;
revoke all on function public.is_officer() from public;
grant execute on function public.is_officer() to authenticated;

alter table public.profiles enable row level security;
alter table public.characters enable row level security;
alter table public.guest_decisions enable row level security;

create policy "Profile owner or officer can read"
on public.profiles for select to authenticated
using (id = (select auth.uid()) or (select public.is_officer()));

create policy "Owner reads own characters" on public.characters
for select to authenticated using (owner_id = (select auth.uid()) or (select public.is_officer()));
create policy "Owner inserts own characters" on public.characters
for insert to authenticated with check (owner_id = (select auth.uid()));
create policy "Owner updates own characters" on public.characters
for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "Owner deletes own characters" on public.characters
for delete to authenticated using (owner_id = (select auth.uid()));

create policy "Officers read decisions" on public.guest_decisions
for select to authenticated using ((select public.is_officer()));

-- No direct client UPDATE policy on profiles, and no INSERT policy on guest_decisions.
-- Only the vetted function below can change approval status.
create function public.decide_guest(target_profile uuid, new_status public.guest_review_status)
returns void language plpgsql security definer set search_path = '' as $$
declare
  old_status public.guest_review_status;
begin
  if (select auth.uid()) is null or not (select public.is_officer()) then
    raise exception 'Not authorized';
  end if;
  if new_status not in ('approved','rejected') then
    raise exception 'Invalid decision';
  end if;
  select guest_status into old_status from public.profiles
  where id = target_profile and role = 'guest' for update;
  if not found or old_status <> 'pending' then
    raise exception 'Guest is not pending';
  end if;
  update public.profiles set guest_status = new_status where id = target_profile;
  insert into public.guest_decisions(profile_id, actor_id, previous_status, new_status)
  values (target_profile, (select auth.uid()), old_status, new_status);
end;
$$;
revoke all on function public.decide_guest(uuid, public.guest_review_status) from public;
grant execute on function public.decide_guest(uuid, public.guest_review_status) to authenticated;

-- Bootstrap guild master ONCE, after you have signed in using Discord:
-- UPDATE public.profiles SET role = 'guild_master', guest_status = 'approved'
-- WHERE id = 'COPY-YOUR-AUTH-USER-UUID-HERE';
-- Do this only in Supabase SQL Editor, never from the browser.
