-- Remove EXECUTE from PUBLIC (which anon inherits) on RLS helper functions, and
-- grant only to authenticated (RLS policy evaluation needs it). Clears the anon
-- 'can execute' advisories; unauthenticated users can no longer call them via RPC.
do $$
declare fn text;
begin
  foreach fn in array array[
    'public.current_user_id()',
    'public.current_factory_id()',
    'public.current_user_role()',
    'public.is_super_admin()',
    'public.same_factory(uuid)',
    'public.can_manage_factory(uuid)',
    'public.can_access_line(uuid)',
    'public.can_enter_line(uuid)',
    'public.can_load_line(uuid)'
  ] loop
    execute format('revoke execute on function %s from public, anon;', fn);
    execute format('grant execute on function %s to authenticated;', fn);
  end loop;
end $$;;
