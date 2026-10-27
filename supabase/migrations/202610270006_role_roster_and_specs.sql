-- Milestone 4 follow-up: role-composition signups and class specialization.
-- Existing characters preserve NULL specialization until their owner edits them.
alter table public.characters add column if not exists spec_name text;
alter table public.raids add column if not exists tank_slots integer not null default 4;
alter table public.raids add column if not exists healer_slots integer not null default 8;
alter table public.raids add column if not exists dps_slots integer not null default 28;
update public.raids set tank_slots=case capacity when 10 then 1 when 20 then 2 else 4 end,
  healer_slots=case capacity when 10 then 2 when 20 then 3 else 8 end,
  dps_slots=case capacity when 10 then 7 when 20 then 15 else 28 end
where tank_slots+healer_slots+dps_slots<>capacity;
alter table public.raids drop constraint if exists raids_role_totals;
alter table public.raids add constraint raids_role_totals check (tank_slots>=0 and healer_slots>=0 and dps_slots>=0 and tank_slots+healer_slots+dps_slots=capacity);
alter table public.raid_signups add column if not exists signup_role text not null default 'dps';
update public.raid_signups s set signup_role=case when c.raid_role in ('tank','healer','dps') then c.raid_role else 'dps' end
from public.characters c where s.character_id=c.id;
alter table public.raid_signups drop constraint if exists raid_signups_role_valid;
alter table public.raid_signups add constraint raid_signups_role_valid check (signup_role in ('tank','healer','dps'));

CREATE OR REPLACE FUNCTION public.create_raid(raid_title text, raid_description text, local_start text, raid_capacity integer, raid_audience text, needed_tanks integer, needed_healers integer, needed_dps integer)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare new_id uuid; local_time timestamp;
begin
 if (select auth.uid()) is null or not (select public.is_officer()) then raise exception 'Officers only'; end if;
 if local_start !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}$' then raise exception 'Invalid date format'; end if;
 local_time:=local_start::timestamp;
 if (local_time at time zone 'Europe/Oslo')<=now() then raise exception 'Raid must be in the future'; end if;
 insert into public.raids(title,description,starts_at,capacity,audience,created_by,tank_slots,healer_slots,dps_slots)
 values(raid_title,raid_description,local_time at time zone 'Europe/Oslo',raid_capacity,raid_audience,(select auth.uid()),needed_tanks,needed_healers,needed_dps)
 returning id into new_id;
 return new_id;
end; $function$;

CREATE OR REPLACE FUNCTION public.join_raid(target_raid uuid, target_character uuid, selected_role text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_raid public.raids%rowtype; v_role public.guild_role; v_status public.guest_review_status; v_level integer; v_class text; v_quota integer;
begin
 if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
 select * into v_raid from public.raids where id=target_raid for update;
 if not found then raise exception 'Raid not found'; end if;
 if v_raid.starts_at<=now() then raise exception 'Raid has already started'; end if;
 select role,guest_status into v_role,v_status from public.profiles where id=(select auth.uid());
 if not found or (v_role='guest' and v_status<>'approved') then raise exception 'Guest approval is required'; end if;
 if v_raid.audience='guild_only' and v_role='guest' then raise exception 'Guild-only raid'; end if;
 select level,class_name into v_level,v_class from public.characters where id=target_character and owner_id=(select auth.uid());
 if not found or v_level<>60 then raise exception 'An owned level 60 character is required'; end if;
 if selected_role not in ('tank','healer','dps') or selected_role is null then raise exception 'Select a valid role'; end if;
 if selected_role='tank' and v_class not in ('Warrior','Druid','Paladin','Shaman') then raise exception 'Class cannot tank'; end if;
 if selected_role='healer' and v_class not in ('Priest','Druid','Paladin','Shaman') then raise exception 'Class cannot heal'; end if;
 if exists(select 1 from public.raid_signups where raid_id=target_raid and profile_id=(select auth.uid())) then raise exception 'Already signed up'; end if;
 if (select count(*) from public.raid_signups where raid_id=target_raid)>=v_raid.capacity then raise exception 'Raid is full'; end if;
 v_quota := case selected_role when 'tank' then v_raid.tank_slots when 'healer' then v_raid.healer_slots else v_raid.dps_slots end;
 if (select count(*) from public.raid_signups where raid_id=target_raid and signup_role=selected_role)>=v_quota then raise exception 'Selected role is full'; end if;
 insert into public.raid_signups(raid_id,profile_id,character_id,signup_role)
 values(target_raid,(select auth.uid()),target_character,selected_role);
end;
$function$;

CREATE OR REPLACE FUNCTION public.raid_roster()
 RETURNS TABLE(raid_id uuid, character_name text, class_name text, spec_name text, signup_role text, display_name text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
 return query select s.raid_id,c.character_name,c.class_name,coalesce(c.spec_name,'Unspecified'),s.signup_role,p.display_name
 from public.raid_signups s join public.characters c on c.id=s.character_id
 join public.profiles p on p.id=s.profile_id
 join public.raids r on r.id=s.raid_id
 where r.starts_at>=now()
 order by s.signed_at;
end; $function$;

CREATE OR REPLACE FUNCTION public.valid_character_spec(class_input text, spec_input text)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
select case class_input
when 'Warrior' then spec_input = any(array['Arms','Fury','Protection'])
when 'Paladin' then spec_input = any(array['Holy','Protection','Retribution'])
when 'Hunter' then spec_input = any(array['Beast Mastery','Marksmanship','Survival'])
when 'Rogue' then spec_input = any(array['Assassination','Combat','Subtlety'])
when 'Priest' then spec_input = any(array['Discipline','Holy','Shadow'])
when 'Shaman' then spec_input = any(array['Elemental','Enhancement','Restoration'])
when 'Mage' then spec_input = any(array['Arcane','Fire','Frost'])
when 'Warlock' then spec_input = any(array['Affliction','Demonology','Destruction'])
when 'Druid' then spec_input = any(array['Balance','Feral','Restoration'])
else false end;
$function$;
alter table public.characters drop constraint if exists characters_spec_class_valid;
alter table public.characters add constraint characters_spec_class_valid check (spec_name is null or public.valid_character_spec(class_name,spec_name));

-- Restrict RPC invocation to signed-in users. The existing auth/RLS checks remain.
revoke all on function public.join_raid(uuid,uuid,text) from public;
grant execute on function public.join_raid(uuid,uuid,text) to authenticated;
drop function if exists public.join_raid(uuid,uuid);
revoke all on function public.create_raid(text,text,text,integer,text,integer,integer,integer) from public;
grant execute on function public.create_raid(text,text,text,integer,text,integer,integer,integer) to authenticated;
drop function if exists public.create_raid(text,text,text,integer,text);
revoke all on function public.raid_roster() from public;
grant execute on function public.raid_roster() to authenticated;

-- Supabase grants EXECUTE to anon explicitly on newly created public functions.
-- Revoke that inherited default independently of the PUBLIC role.
revoke execute on function public.join_raid(uuid,uuid,text) from anon;
revoke execute on function public.create_raid(text,text,text,integer,text,integer,integer,integer) from anon;
revoke execute on function public.raid_roster() from anon;
