-- Milestone 5: read-only guild directory; only approved accounts can browse.
-- SECURITY DEFINER intentionally exposes only guild member display names and
-- player-entered character fields; no email, OAuth IDs or guest details.
create or replace function public.guild_roster()
returns table(profile_id uuid,display_name text,guild_role text,joined_at timestamptz,character_id uuid,character_name text,class_name text,race_name text,spec_name text,raid_role text,is_main boolean)
language sql stable security definer set search_path='' as $$
 select p.id,p.display_name,p.role::text,p.created_at,c.id,c.character_name,c.class_name,c.race_name,c.spec_name,c.raid_role,c.is_main
 from public.profiles p
 left join public.characters c on c.owner_id=p.id
 where exists(select 1 from public.profiles viewer where viewer.id=(select auth.uid())
   and (viewer.role in ('member','officer','guild_master') or (viewer.role='guest' and viewer.guest_status='approved')))
 and p.role in ('member','officer','guild_master')
 order by case p.role when 'guild_master' then 0 when 'officer' then 1 else 2 end,
 lower(p.display_name),c.is_main desc,lower(c.character_name)
$$;
revoke all on function public.guild_roster() from public,anon;
grant execute on function public.guild_roster() to authenticated;
