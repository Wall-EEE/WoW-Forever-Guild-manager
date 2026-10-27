-- Milestone 4.3: multi-character availability and officer-confirmed roster.
-- Keep all existing raid events, roster assignments, and their ownership.
-- A player's availability is not a reservation; only leader confirmation reserves a slot.
alter table public.raids add column if not exists lockout_key text;
update public.raids set lockout_key=lower(trim(title)) where lockout_key is null;
alter table public.raids alter column lockout_key set not null;
alter table public.raids alter column lockout_key set default 'unassigned';
alter table public.raids drop constraint if exists raids_lockout_key_format;
alter table public.raids add constraint raids_lockout_key_format check (char_length(lockout_key) between 2 and 80);

create table if not exists public.raid_availability (
 id uuid primary key default gen_random_uuid(),
 raid_id uuid not null references public.raids(id) on delete cascade,
 profile_id uuid not null references public.profiles(id) on delete cascade,
 character_id uuid not null references public.characters(id) on delete cascade,
 created_at timestamptz not null default now(),
 unique(raid_id,character_id)
);
create index if not exists raid_availability_raid on public.raid_availability(raid_id);
create index if not exists raid_availability_profile on public.raid_availability(profile_id);
insert into public.raid_availability(raid_id,profile_id,character_id)
select raid_id,profile_id,character_id from public.raid_signups on conflict do nothing;
alter table public.raid_availability enable row level security;
grant select on public.raid_availability to authenticated;
drop policy if exists "Own offers and officer review" on public.raid_availability;
create policy "Own offers and officer review" on public.raid_availability
for select to authenticated using (profile_id=(select auth.uid()) or (select public.is_officer()));
revoke insert,update,delete on public.raid_signups from authenticated;

CREATE OR REPLACE FUNCTION public.raid_week_start(start_time timestamp with time zone)
 RETURNS date
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
select (start_time at time zone 'Europe/Oslo')::date
 - ((extract(dow from (start_time at time zone 'Europe/Oslo'))::integer+4)%7)
$function$;

CREATE OR REPLACE FUNCTION public.can_lead_raid(target_raid uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select exists(select 1 from public.raids r join public.profiles p on p.id=(select auth.uid())
 where r.id=target_raid and ((r.created_by=p.id and p.role in ('officer','guild_master')) or p.role='guild_master'));
$function$;

CREATE OR REPLACE FUNCTION public.create_raid(raid_title text, raid_description text, local_start text, raid_capacity integer, raid_audience text, needed_tanks integer, needed_healers integer, needed_dps integer, raid_lockout_key text)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare new_id uuid; local_time timestamp; lk text;
begin
 if (select auth.uid()) is null or not (select public.is_officer()) then raise exception 'Officers only'; end if;
 if local_start !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}$' then raise exception 'Invalid date format'; end if;
 local_time:=local_start::timestamp;
 if (local_time at time zone 'Europe/Oslo')<=now() then raise exception 'Raid must be in the future'; end if;
 lk:=lower(trim(coalesce(nullif(trim(raid_lockout_key),''),raid_title)));
 if char_length(lk)<2 or char_length(lk)>80 then raise exception 'Invalid lockout group'; end if;
 insert into public.raids(title,description,starts_at,capacity,audience,created_by,tank_slots,healer_slots,dps_slots,lockout_key)
 values(raid_title,raid_description,local_time at time zone 'Europe/Oslo',raid_capacity,raid_audience,(select auth.uid()),needed_tanks,needed_healers,needed_dps,lk)
 returning id into new_id;
 return new_id;
end; $function$;

CREATE OR REPLACE FUNCTION public.set_raid_availability(target_raid uuid, offered_characters uuid[])
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare r public.raids%rowtype; role_value public.guild_role; approval public.guest_review_status;
begin
 if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
 select * into r from public.raids where id=target_raid for update;
 if not found or r.starts_at<=now() then raise exception 'Raid not found or already started'; end if;
 select role, guest_status into role_value,approval from public.profiles where id=(select auth.uid());
 if not found or (role_value='guest' and approval<>'approved') then raise exception 'Guest approval required'; end if;
 if role_value='guest' and r.audience='guild_only' then raise exception 'Guild only'; end if;
 if offered_characters is null or cardinality(offered_characters)>30 then raise exception 'Invalid offer selection'; end if;
 if (select count(*) from (select distinct unnest(offered_characters)) x)<>cardinality(offered_characters) then raise exception 'Duplicate character'; end if;
 if exists(select 1 from unnest(offered_characters) cid left join public.characters c on c.id=cid
    where c.id is null or c.owner_id<>(select auth.uid()) or c.level<>60) then
   raise exception 'Characters must belong to you and be level 60';
 end if;
 -- Do not silently remove the currently confirmed character: a leader must first unassign.
 if exists(select 1 from public.raid_signups s where s.raid_id=target_raid and s.profile_id=(select auth.uid())
  and not (s.character_id=any(offered_characters))) then raise exception 'Confirmed character cannot be removed until unassigned'; end if;
 delete from public.raid_availability where raid_id=target_raid and profile_id=(select auth.uid());
 insert into public.raid_availability(raid_id,profile_id,character_id)
 select target_raid,(select auth.uid()),cid from unnest(offered_characters) cid;
end; $function$;

CREATE OR REPLACE FUNCTION public.assign_raid_character(target_raid uuid, target_profile uuid, target_character uuid, selected_role text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare r public.raids%rowtype; char_class text; char_level integer; quota integer; p_role public.guild_role; p_status public.guest_review_status;
begin
 if (select auth.uid()) is null or not (select public.can_lead_raid(target_raid)) then raise exception 'Only this raid leader or the Guild Master may assign'; end if;
 -- Coordinate per character first, then lock raid; checks across raids cannot race.
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(target_character::text,42));
 select * into r from public.raids where id=target_raid for update;
 if not found or r.starts_at<=now() then raise exception 'Raid not found or started'; end if;
 if selected_role is null or selected_role not in ('tank','healer','dps') then raise exception 'Invalid role'; end if;
 select role,guest_status into p_role,p_status from public.profiles where id=target_profile;
 if not found or (p_role='guest' and p_status<>'approved') or (p_role='guest' and r.audience='guild_only') then raise exception 'Player not eligible'; end if;
 if not exists(select 1 from public.raid_availability a where a.raid_id=target_raid and a.profile_id=target_profile and a.character_id=target_character) then raise exception 'Character not offered for this raid'; end if;
 select level,class_name into char_level,char_class from public.characters where id=target_character and owner_id=target_profile;
 if not found or char_level<>60 then raise exception 'Invalid character'; end if;
 if selected_role='tank' and char_class not in ('Warrior','Druid','Paladin','Shaman') then raise exception 'Class cannot tank'; end if;
 if selected_role='healer' and char_class not in ('Priest','Druid','Paladin','Shaman') then raise exception 'Class cannot heal'; end if;
 if exists(select 1 from public.raid_signups s join public.raids other on other.id=s.raid_id
  where s.character_id=target_character and s.raid_id<>target_raid and other.lockout_key=r.lockout_key
   and public.raid_week_start(other.starts_at)=public.raid_week_start(r.starts_at)) then
  raise exception 'Character already assigned to this raid lockout this week';
 end if;
 if exists(select 1 from public.raid_signups s join public.raids other on other.id=s.raid_id
   where s.character_id=target_character and s.raid_id<>target_raid
   and abs(extract(epoch from (other.starts_at-r.starts_at)))<14400) then
  raise exception 'Character already assigned to an overlapping raid';
 end if;
 if exists(select 1 from public.raid_signups s join public.raids other on other.id=s.raid_id
   where s.profile_id=target_profile and s.raid_id<>target_raid
   and abs(extract(epoch from (other.starts_at-r.starts_at)))<14400) then
  raise exception 'Player already confirmed for overlapping raid';
 end if;
 delete from public.raid_signups where raid_id=target_raid and profile_id=target_profile;
 if (select count(*) from public.raid_signups where raid_id=target_raid)>=r.capacity then raise exception 'Raid full'; end if;
 quota:=case selected_role when 'tank' then r.tank_slots when 'healer' then r.healer_slots else r.dps_slots end;
 if (select count(*) from public.raid_signups where raid_id=target_raid and signup_role=selected_role)>=quota then raise exception 'Role full'; end if;
 insert into public.raid_signups(raid_id,profile_id,character_id,signup_role) values(target_raid,target_profile,target_character,selected_role);
end; $function$;

CREATE OR REPLACE FUNCTION public.unassign_raid_player(target_raid uuid, target_profile uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 if (select auth.uid()) is null or not (select public.can_lead_raid(target_raid)) then raise exception 'Only this raid leader or the Guild Master may unassign'; end if;
 perform 1 from public.raids where id=target_raid for update;
 if not found then raise exception 'Raid not found'; end if;
 delete from public.raid_signups where raid_id=target_raid and profile_id=target_profile;
end; $function$;

CREATE OR REPLACE FUNCTION public.raid_candidates()
 RETURNS TABLE(raid_id uuid, profile_id uuid, display_name text, character_id uuid, character_name text, class_name text, spec_name text, current_assignment uuid)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 if (select auth.uid()) is null or not (select public.is_officer()) then raise exception 'Officers only'; end if;
 return query select a.raid_id,a.profile_id,p.display_name,a.character_id,c.character_name,c.class_name,
  coalesce(c.spec_name,'Unspecified'),s.character_id
 from public.raid_availability a
 join public.profiles p on p.id=a.profile_id
 join public.characters c on c.id=a.character_id
 join public.raids r on r.id=a.raid_id
 left join public.raid_signups s on s.raid_id=a.raid_id and s.profile_id=a.profile_id
 where r.starts_at>=now()
 order by a.raid_id,p.display_name,c.character_name;
end; $function$;

-- Signed-in players may offer characters, but only creator/GM confirms them.
revoke all on function public.raid_week_start(timestamptz) from public,anon;
grant execute on function public.raid_week_start(timestamptz) to authenticated;
revoke all on function public.can_lead_raid(uuid) from public,anon;
grant execute on function public.can_lead_raid(uuid) to authenticated;
revoke all on function public.create_raid(text,text,text,integer,text,integer,integer,integer,text) from public,anon;
grant execute on function public.create_raid(text,text,text,integer,text,integer,integer,integer,text) to authenticated;
revoke all on function public.set_raid_availability(uuid,uuid[]) from public,anon;
grant execute on function public.set_raid_availability(uuid,uuid[]) to authenticated;
revoke all on function public.assign_raid_character(uuid,uuid,uuid,text) from public,anon;
grant execute on function public.assign_raid_character(uuid,uuid,uuid,text) to authenticated;
revoke all on function public.unassign_raid_player(uuid,uuid) from public,anon;
grant execute on function public.unassign_raid_player(uuid,uuid) to authenticated;
revoke all on function public.raid_candidates() from public,anon;
grant execute on function public.raid_candidates() to authenticated;
-- Disable the obsolete direct-signup API entirely.
drop function if exists public.join_raid(uuid,uuid,text);
drop function if exists public.create_raid(text,text,text,integer,text,integer,integer,integer);
