-- Phase 2 (b): enable RLS on ALL tables; policies for structure/master/config.
-- Entry tables (attendance, production_hourly, downtime_events, line_styles,
-- alerts, processed_events) get RLS enabled here but their policies land in 2c.

alter table public.factories        enable row level security;
alter table public.users             enable row level security;
alter table public.units             enable row level security;
alter table public.floors            enable row level security;
alter table public.lines             enable row level security;
alter table public.line_supervisors  enable row level security;
alter table public.line_chiefs       enable row level security;
alter table public.styles            enable row level security;
alter table public.salary_bank       enable row level security;
alter table public.planned_headcount enable row level security;
alter table public.line_styles       enable row level security;
alter table public.app_settings      enable row level security;
alter table public.shift_config      enable row level security;
alter table public.break_slots       enable row level security;
alter table public.kpi_thresholds    enable row level security;
alter table public.fx_rates          enable row level security;
alter table public.downtime_reasons  enable row level security;
alter table public.attendance        enable row level security;
alter table public.production_hourly enable row level security;
alter table public.downtime_events   enable row level security;
alter table public.alerts            enable row level security;
alter table public.processed_events  enable row level security;

-- factories
create policy sel_factories on public.factories for select to authenticated
  using (public.same_factory(id));
create policy mod_factories on public.factories for all to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());

-- users (self, same-factory, or super admin can read; only super admin writes)
create policy sel_users on public.users for select to authenticated
  using (auth_user_id = auth.uid() or public.same_factory(factory_id) or public.is_super_admin());
create policy mod_users on public.users for all to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());

-- units / floors / lines (read: same factory; write: IE or super admin)
create policy sel_units on public.units for select to authenticated using (public.same_factory(factory_id));
create policy mod_units on public.units for all to authenticated using (public.can_manage_factory(factory_id)) with check (public.can_manage_factory(factory_id));
create policy sel_floors on public.floors for select to authenticated using (public.same_factory(factory_id));
create policy mod_floors on public.floors for all to authenticated using (public.can_manage_factory(factory_id)) with check (public.can_manage_factory(factory_id));
create policy sel_lines on public.lines for select to authenticated using (public.same_factory(factory_id));
create policy mod_lines on public.lines for all to authenticated using (public.can_manage_factory(factory_id)) with check (public.can_manage_factory(factory_id));

-- assignments (read: same factory; write: IE or super admin of the line's factory)
create policy sel_line_supervisors on public.line_supervisors for select to authenticated
  using (exists (select 1 from public.lines l where l.id = line_id and public.same_factory(l.factory_id)));
create policy mod_line_supervisors on public.line_supervisors for all to authenticated
  using (exists (select 1 from public.lines l where l.id = line_id and public.can_manage_factory(l.factory_id)))
  with check (exists (select 1 from public.lines l where l.id = line_id and public.can_manage_factory(l.factory_id)));
create policy sel_line_chiefs on public.line_chiefs for select to authenticated
  using (exists (select 1 from public.lines l where l.id = line_id and public.same_factory(l.factory_id)));
create policy mod_line_chiefs on public.line_chiefs for all to authenticated
  using (exists (select 1 from public.lines l where l.id = line_id and public.can_manage_factory(l.factory_id)))
  with check (exists (select 1 from public.lines l where l.id = line_id and public.can_manage_factory(l.factory_id)));

-- styles (read: same factory; write: IE or super admin)
create policy sel_styles on public.styles for select to authenticated using (public.same_factory(factory_id));
create policy mod_styles on public.styles for all to authenticated using (public.can_manage_factory(factory_id)) with check (public.can_manage_factory(factory_id));

-- salary_bank (read: IE/chief/super only — NOT supervisor; write: IE or super admin)
create policy sel_salary_bank on public.salary_bank for select to authenticated
  using (public.is_super_admin() or (public.same_factory(factory_id) and public.current_user_role() in ('ie','chief')));
create policy mod_salary_bank on public.salary_bank for all to authenticated
  using (public.can_manage_factory(factory_id)) with check (public.can_manage_factory(factory_id));

-- planned_headcount (read: same factory; write: IE or super admin)
create policy sel_planned on public.planned_headcount for select to authenticated using (public.same_factory(factory_id));
create policy mod_planned on public.planned_headcount for all to authenticated using (public.can_manage_factory(factory_id)) with check (public.can_manage_factory(factory_id));

-- per-factory config (read: same factory; write: IE or super admin)
create policy sel_app_settings on public.app_settings for select to authenticated using (public.same_factory(factory_id));
create policy mod_app_settings on public.app_settings for all to authenticated using (public.can_manage_factory(factory_id)) with check (public.can_manage_factory(factory_id));
create policy sel_shift_config on public.shift_config for select to authenticated using (public.same_factory(factory_id));
create policy mod_shift_config on public.shift_config for all to authenticated using (public.can_manage_factory(factory_id)) with check (public.can_manage_factory(factory_id));
create policy sel_break_slots on public.break_slots for select to authenticated using (public.same_factory(factory_id));
create policy mod_break_slots on public.break_slots for all to authenticated using (public.can_manage_factory(factory_id)) with check (public.can_manage_factory(factory_id));
create policy sel_kpi_thresholds on public.kpi_thresholds for select to authenticated using (public.same_factory(factory_id));
create policy mod_kpi_thresholds on public.kpi_thresholds for all to authenticated using (public.can_manage_factory(factory_id)) with check (public.can_manage_factory(factory_id));
create policy sel_downtime_reasons on public.downtime_reasons for select to authenticated using (public.same_factory(factory_id));
create policy mod_downtime_reasons on public.downtime_reasons for all to authenticated using (public.can_manage_factory(factory_id)) with check (public.can_manage_factory(factory_id));

-- fx_rates (global; readable by any authenticated user; writes via service role only)
create policy sel_fx_rates on public.fx_rates for select to authenticated using (true);
;
