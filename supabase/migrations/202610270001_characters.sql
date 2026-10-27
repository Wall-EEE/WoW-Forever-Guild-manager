-- Milestone 3, idempotent extension of the existing owned characters table.
alter table public.characters add column if not exists race_name text;
alter table public.characters add column if not exists raid_role text not null default 'flex';
alter table public.characters drop constraint if exists characters_race_name_length;
alter table public.characters add constraint characters_race_name_length check (race_name is null or char_length(race_name) between 2 and 40);
alter table public.characters drop constraint if exists characters_raid_role_valid;
alter table public.characters add constraint characters_raid_role_valid check (raid_role in ('tank', 'healer', 'dps', 'flex'));

-- Security invoker: ownership remains enforced by existing character RLS.
-- Advisory lock serializes main swaps without requiring profile UPDATE privilege.
create or replace function public.set_my_main_character(target_character uuid)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended((select auth.uid())::text, 0));
  if not exists (select 1 from public.characters where id = target_character and owner_id = (select auth.uid())) then
    raise exception 'Character not found';
  end if;
  update public.characters set is_main = false where owner_id = (select auth.uid()) and is_main;
  update public.characters set is_main = true where id = target_character and owner_id = (select auth.uid());
end;
$$;
revoke all on function public.set_my_main_character(uuid) from public;
grant execute on function public.set_my_main_character(uuid) to authenticated;
grant select, insert, update, delete on public.characters to authenticated;
