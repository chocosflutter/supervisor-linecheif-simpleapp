-- Internal functions are only invoked inside get_line_kpis / triggers (which run as
-- their definer/owner). Revoke ALL client execute so they are not exposed via RPC.
do $$
declare fn text;
begin
  foreach fn in array array[
    'public.labor_cost_per_hour(uuid,date,int,int,int,int)',
    'public.working_minutes_between(uuid,timestamptz,timestamptz)',
    'public.changeover_stats(uuid,date,date)',
    'public.refresh_line_day_agg(uuid,date,uuid)',
    'public.rebuild_line_day_agg()',
    'public.trg_production_agg()',
    'public.trg_style_value_agg()'
  ] loop
    execute format('revoke execute on function %s from public, anon, authenticated;', fn);
  end loop;
end $$;;
