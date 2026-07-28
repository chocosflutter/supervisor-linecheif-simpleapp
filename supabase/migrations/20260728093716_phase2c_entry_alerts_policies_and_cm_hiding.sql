-- Phase 2 (c): entry tables, line_styles + CM hiding, alerts, sync-ledger lockdown.

-- attendance: read within line visibility; write only supervisor assigned to line.
create policy sel_attendance on public.attendance for select to authenticated using (public.can_access_line(line_id));
create policy mod_attendance on public.attendance for all to authenticated using (public.can_enter_line(line_id)) with check (public.can_enter_line(line_id));

-- production_hourly: same rule.
create policy sel_production on public.production_hourly for select to authenticated using (public.can_access_line(line_id));
create policy mod_production on public.production_hourly for all to authenticated using (public.can_enter_line(line_id)) with check (public.can_enter_line(line_id));

-- downtime_events: same rule.
create policy sel_downtime on public.downtime_events for select to authenticated using (public.can_access_line(line_id));
create policy mod_downtime on public.downtime_events for all to authenticated using (public.can_enter_line(line_id)) with check (public.can_enter_line(line_id));

-- line_styles BASE table: only IE / chief / super may read (they may see CM).
-- Supervisors are DENIED base access and instead read the masked view below.
create policy sel_line_styles on public.line_styles for select to authenticated
  using (public.current_user_role() in ('ie','chief','super_admin') and public.can_access_line(line_id));
-- Write (load/replace style): chief who owns the line, or super admin.
create policy mod_line_styles on public.line_styles for all to authenticated
  using (public.can_load_line(line_id)) with check (public.can_load_line(line_id));

-- CM HIDING (R17): SECURITY DEFINER view that masks cm_per_pc_usd for supervisors.
-- Access is enforced inside via can_access_line; CM is nulled unless IE/chief/super.
create view public.line_styles_safe
with (security_invoker = false) as
select
  id, factory_id, line_id, style_id,
  case when public.current_user_role() in ('ie','chief','super_admin')
       then cm_per_pc_usd else null end as cm_per_pc_usd,
  smv, status, loaded_at, unloaded_at, created_by, created_at, updated_at
from public.line_styles
where public.can_access_line(line_id);

revoke all on public.line_styles_safe from anon;
grant select on public.line_styles_safe to authenticated;

-- alerts: read within line visibility; IE raises; supervisor (own line) resolves.
create policy sel_alerts on public.alerts for select to authenticated using (public.can_access_line(line_id));
create policy ins_alerts on public.alerts for insert to authenticated
  with check (public.is_super_admin() or (public.current_user_role() = 'ie' and public.can_access_line(line_id)));
create policy upd_alerts on public.alerts for update to authenticated
  using (public.can_enter_line(line_id)) with check (public.can_enter_line(line_id));

-- processed_events: no policies → denied to anon/authenticated. Only the SECURITY
-- DEFINER offline-sync RPC (Phase 5) and the service role may write it.
comment on table public.processed_events is 'Offline idempotency ledger. Access only via service role or SECURITY DEFINER sync RPC; RLS denies all direct client access.';
;
