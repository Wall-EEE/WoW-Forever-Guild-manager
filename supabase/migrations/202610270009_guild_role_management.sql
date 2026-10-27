-- Guild Master-only role management. Every authorization check runs in the database.
create or replace function public.manage_guild_roles()
returns table(profile_id uuid,display_name text,guild_role text,access_status text,joined_at timestamptz)
language plpgsql stable security definer set search_path='' as $$
begin
 if (select auth.uid()) is null or not exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='guild_master') then
  raise exception 'Guild Master only';
 end if;
 return query select p.id,p.display_name,p.role::text,p.guest_status::text,p.created_at from public.profiles p
 order by case p.role when 'guild_master' then 0 when 'officer' then 1 when 'member' then 2 else 3 end, lower(p.display_name);
end; $$;
create or replace function public.set_guild_role(target_profile uuid,new_role text)
returns void language plpgsql security definer set search_path='' as $$
declare previous_role public.guild_role;
begin
 if (select auth.uid()) is null or not exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='guild_master') then
  raise exception 'Guild Master only';
 end if;
 if new_role not in ('guest','member','officer') then raise exception 'Invalid guild role'; end if;
 if target_profile=(select auth.uid()) then raise exception 'Cannot change your own guild rank'; end if;
 select p.role into previous_role from public.profiles p where p.id=target_profile for update;
 if not found or previous_role='guild_master' then raise exception 'Cannot change Guild Master role'; end if;
 update public.profiles set role=new_role::public.guild_role,guest_status='approved'::public.guest_review_status where id=target_profile;
end; $$;
revoke all on function public.manage_guild_roles() from public,anon;
revoke all on function public.set_guild_role(uuid,text) from public,anon;
grant execute on function public.manage_guild_roles() to authenticated;
grant execute on function public.set_guild_role(uuid,text) to authenticated;
