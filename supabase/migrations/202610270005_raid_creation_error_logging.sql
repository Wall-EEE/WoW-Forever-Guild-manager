-- Correct the date format check in the Oslo-time raid creation RPC.
-- Previous migration had over-escaped backslashes in the PostgreSQL regex.
create or replace function public.create_raid(raid_title text, raid_description text, local_start text, raid_capacity integer, raid_audience text)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare new_id uuid; local_time timestamp;
begin
 if (select auth.uid()) is null or not (select public.is_officer()) then raise exception 'Officers only'; end if;
 if local_start !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}$' then raise exception 'Invalid date format'; end if;
 local_time := local_start::timestamp;
 if (local_time at time zone 'Europe/Oslo') <= now() then raise exception 'Raid must be in the future'; end if;
 insert into public.raids(title,description,starts_at,capacity,audience,created_by)
 values(raid_title,raid_description,local_time at time zone 'Europe/Oslo',raid_capacity,raid_audience,(select auth.uid()))
 returning id into new_id;
 return new_id;
end;
$$;
revoke execute on function public.create_raid(text,text,text,integer,text) from public, anon;
grant execute on function public.create_raid(text,text,text,integer,text) to authenticated;
