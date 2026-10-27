-- Officers can accept guests as members; only GM manages other ranks.
CREATE OR REPLACE FUNCTION public.manage_guild_roles()
 RETURNS TABLE(profile_id uuid, display_name text, guild_role text, access_status text, joined_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare viewer_role public.guild_role;
begin
 select p.role into viewer_role from public.profiles p where p.id=(select auth.uid());
 if viewer_role not in ('guild_master','officer') then raise exception 'Officer access required'; end if;
 return query select p.id,p.display_name,p.role::text,p.guest_status::text,p.created_at
 from public.profiles p
 where viewer_role='guild_master' or p.role='guest'
 order by case p.role when 'guild_master' then 0 when 'officer' then 1 when 'member' then 2 else 3 end,lower(p.display_name);
end; $function$;

CREATE OR REPLACE FUNCTION public.set_guild_role(target_profile uuid, new_role text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare viewer_role public.guild_role;
declare previous_role public.guild_role;
begin
 select p.role into viewer_role from public.profiles p where p.id=(select auth.uid());
 if viewer_role not in ('guild_master','officer') then raise exception 'Officer access required'; end if;
 if new_role not in ('guest','member','officer') then raise exception 'Invalid guild role'; end if;
 if target_profile=(select auth.uid()) then raise exception 'Cannot change your own guild rank'; end if;
 select p.role into previous_role from public.profiles p where p.id=target_profile for update;
 if not found or previous_role='guild_master' then raise exception 'Cannot change Guild Master role'; end if;
 if viewer_role='officer' and (previous_role<>'guest' or new_role<>'member') then
  raise exception 'Officers can only accept guests as members';
 end if;
 update public.profiles set role=new_role::public.guild_role,guest_status='approved'::public.guest_review_status where id=target_profile;
end; $function$;
revoke all on function public.manage_guild_roles() from public,anon;
revoke all on function public.set_guild_role(uuid,text) from public,anon;
grant execute on function public.manage_guild_roles() to authenticated;
grant execute on function public.set_guild_role(uuid,text) to authenticated;
