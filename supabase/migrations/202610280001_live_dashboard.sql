-- Dashboard aggregate counts; never expose profile identities through this RPC.
create or replace function public.dashboard_summary()
returns table(guild_members bigint,approved_guests bigint,pending_guests bigint)
language plpgsql stable security definer set search_path='' as $$
begin
 if (select auth.uid()) is null or not exists(select 1 from public.profiles p where p.id=(select auth.uid())) then
  raise exception 'Authentication required';
 end if;
 return query select
  count(*) filter(where p.role in ('guild_master','officer','member')),
  count(*) filter(where p.role='guest' and p.guest_status='approved'),
  count(*) filter(where p.role='guest' and p.guest_status='pending')
 from public.profiles p;
end; $$;
revoke all on function public.dashboard_summary() from public,anon;
grant execute on function public.dashboard_summary() to authenticated;
