-- Milestone 4: shared raid calendar and secure signups.
-- Signups are created only via a locking, authorized RPC to protect capacity.
create table if not exists public.raids (
 id uuid primary key default gen_random_uuid(),
 title text not null check (char_length(title) between 3 and 90),
 description text not null default '' check (char_length(description) <= 1000),
 starts_at timestamptz not null,
 capacity integer not null default 40 check (capacity between 1 and 40),
 audience text not null default 'guild_and_guests' check (audience in ('guild_only','guild_and_guests')),
 created_by uuid not null references public.profiles(id),
 created_at timestamptz not null default now()
);
create index if not exists raids_upcoming on public.raids(starts_at);
create table if not exists public.raid_signups (
 id uuid primary key default gen_random_uuid(),
 raid_id uuid not null references public.raids(id) on delete cascade,
 profile_id uuid not null references public.profiles(id) on delete cascade,
 character_id uuid not null references public.characters(id) on delete cascade,
 signed_at timestamptz not null default now(),
 unique(raid_id,profile_id), unique(raid_id,character_id)
);
create index if not exists raid_signups_raid_id on public.raid_signups(raid_id);
alter table public.raids enable row level security;
alter table public.raid_signups enable row level security;
grant select,insert,update,delete on public.raids to authenticated;
grant select,delete on public.raid_signups to authenticated;
revoke insert,update on public.raid_signups from authenticated;
create policy "Signed in users view raids" on public.raids for select to authenticated using (true);
create policy "Officers create raids" on public.raids for insert to authenticated with check ((select public.is_officer()) and created_by=(select auth.uid()));
create policy "Officers update raids" on public.raids for update to authenticated using ((select public.is_officer())) with check ((select public.is_officer()));
create policy "Officers delete raids" on public.raids for delete to authenticated using ((select public.is_officer()));
create policy "Signed in users view signup roster" on public.raid_signups for select to authenticated using (true);
create policy "Users withdraw their signup" on public.raid_signups for delete to authenticated using (profile_id=(select auth.uid()));

create or replace function public.join_raid(target_raid uuid, target_character uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_raid public.raids%rowtype; v_role public.guild_role; v_status public.guest_review_status; v_level integer;
begin
 if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
 select * into v_raid from public.raids where id=target_raid for update;
 if not found then raise exception 'Raid not found'; end if;
 if v_raid.starts_at <= now() then raise exception 'Raid has already started'; end if;
 select role,guest_status into v_role,v_status from public.profiles where id=(select auth.uid());
 if not found or (v_role='guest' and v_status <> 'approved') then raise exception 'Guest approval is required'; end if;
 if v_raid.audience='guild_only' and v_role='guest' then raise exception 'Guild-only raid'; end if;
 select level into v_level from public.characters where id=target_character and owner_id=(select auth.uid());
 if not found or v_level<>60 then raise exception 'An owned level 60 character is required'; end if;
 if exists (select 1 from public.raid_signups where raid_id=target_raid and profile_id=(select auth.uid())) then raise exception 'Already signed up'; end if;
 if (select count(*) from public.raid_signups where raid_id=target_raid)>=v_raid.capacity then raise exception 'Raid is full'; end if;
 insert into public.raid_signups (raid_id,profile_id,character_id) values (target_raid,(select auth.uid()),target_character);
end; $$;
revoke all on function public.join_raid(uuid,uuid) from public;
grant execute on function public.join_raid(uuid,uuid) to authenticated;

create or replace function public.create_raid(raid_title text, raid_description text, local_start text, raid_capacity integer, raid_audience text)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare new_id uuid; local_time timestamp;
begin
 if (select auth.uid()) is null or not (select public.is_officer()) then raise exception 'Officers only'; end if;
 if local_start !~ '^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}$' then raise exception 'Invalid date'; end if;
 local_time := local_start::timestamp;
 if (local_time at time zone 'Europe/Oslo') <= now() then raise exception 'Raid must be in the future'; end if;
 insert into public.raids(title,description,starts_at,capacity,audience,created_by)
 values(raid_title,raid_description,local_time at time zone 'Europe/Oslo',raid_capacity,raid_audience,(select auth.uid()))
 returning id into new_id;
 return new_id;
end; $$;
revoke all on function public.create_raid(text,text,text,integer,text) from public;
grant execute on function public.create_raid(text,text,text,integer,text) to authenticated;
-- Tighten older auth helper grants as well as raid RPC grants.
-- The original auth trigger does not need to be callable as a REST RPC.
revoke all on function public.on_auth_user_created() from public;
revoke execute on function public.on_auth_user_created() from anon, authenticated;
revoke execute on function public.is_officer() from anon;
revoke execute on function public.decide_guest(uuid,public.guest_review_status) from anon;
revoke execute on function public.join_raid(uuid,uuid) from anon;
revoke execute on function public.create_raid(text,text,text,integer,text) from anon;
