-- Phase 5: idempotent sync RPCs for the offline event log. Each checks
-- processed_events (idempotency), enforces access, upserts on the unique key,
-- and records the event. SECURITY DEFINER (must write processed_events); access
-- enforced internally via can_enter_line / can_load_line.

create or replace function public.sync_attendance(p_event_id uuid, p_payload jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare v_line uuid; v_factory uuid;
begin
  if exists (select 1 from public.processed_events where event_id = p_event_id) then return; end if;
  v_line := (p_payload->>'lineId')::uuid;
  if not public.can_enter_line(v_line) then raise exception 'not authorized for line %', v_line using errcode='42501'; end if;
  select factory_id into v_factory from public.lines where id = v_line;
  insert into public.attendance (factory_id, line_id, date, operators, helpers, pressmen, checkers, submitted_by, submitted_at)
  values (v_factory, v_line, (p_payload->>'date')::date,
          (p_payload->>'operators')::int, (p_payload->>'helpers')::int, (p_payload->>'pressmen')::int, (p_payload->>'checkers')::int,
          public.current_user_id(), now())
  on conflict (line_id, date) do update set
    operators = excluded.operators, helpers = excluded.helpers, pressmen = excluded.pressmen, checkers = excluded.checkers,
    submitted_by = excluded.submitted_by, submitted_at = now(), updated_at = now();
  insert into public.processed_events(event_id, action) values (p_event_id, 'SAVE_ATTENDANCE');
end; $$;

create or replace function public.sync_production(p_event_id uuid, p_payload jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare v_line uuid; v_factory uuid; v_floor uuid; v_unit uuid; v_id uuid;
begin
  if exists (select 1 from public.processed_events where event_id = p_event_id) then return; end if;
  v_line := (p_payload->>'lineId')::uuid;
  if not public.can_enter_line(v_line) then raise exception 'not authorized for line %', v_line using errcode='42501'; end if;
  select factory_id, floor_id, unit_id into v_factory, v_floor, v_unit from public.lines where id = v_line;
  v_id := coalesce((p_payload->>'id')::uuid, gen_random_uuid());
  insert into public.production_hourly (id, factory_id, line_id, floor_id, unit_id, style_id, date, hour_slot,
                                        good_qty, defective_pcs, total_defects, entered_by, entered_at)
  values (v_id, v_factory, v_line, v_floor, v_unit, (p_payload->>'styleId')::uuid,
          (p_payload->>'date')::date, p_payload->>'hourSlot',
          (p_payload->>'goodQty')::int, (p_payload->>'defectivePcs')::int, (p_payload->>'totalDefects')::int,
          public.current_user_id(), now())
  on conflict (line_id, date, hour_slot) do update set
    good_qty = excluded.good_qty, defective_pcs = excluded.defective_pcs, total_defects = excluded.total_defects,
    style_id = excluded.style_id, entered_by = excluded.entered_by, updated_at = now();
  insert into public.processed_events(event_id, action) values (p_event_id, 'ADD_HOURLY_PRODUCTION');
end; $$;

create or replace function public.sync_downtime(p_event_id uuid, p_payload jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare v_line uuid; v_factory uuid; v_id uuid;
begin
  if exists (select 1 from public.processed_events where event_id = p_event_id) then return; end if;
  v_line := (p_payload->>'lineId')::uuid;
  if not public.can_enter_line(v_line) then raise exception 'not authorized for line %', v_line using errcode='42501'; end if;
  select factory_id into v_factory from public.lines where id = v_line;
  v_id := coalesce((p_payload->>'id')::uuid, gen_random_uuid());
  insert into public.downtime_events (id, factory_id, line_id, date, start_time, end_time, reason_id, note, entered_by)
  values (v_id, v_factory, v_line, (p_payload->>'date')::date,
          (p_payload->>'startTime')::time, (p_payload->>'endTime')::time,
          (p_payload->>'reasonId')::uuid, nullif(p_payload->>'note',''), public.current_user_id())
  on conflict (id) do nothing;
  insert into public.processed_events(event_id, action) values (p_event_id, 'ADD_DOWNTIME');
end; $$;

create or replace function public.sync_load_style(p_event_id uuid, p_payload jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare v_line uuid; v_factory uuid; v_style uuid; v_has_active boolean; v_status public.line_style_status; v_ls uuid;
begin
  if exists (select 1 from public.processed_events where event_id = p_event_id) then return; end if;
  v_line := (p_payload->>'lineId')::uuid;
  if not public.can_load_line(v_line) then raise exception 'not authorized to load line %', v_line using errcode='42501'; end if;
  select factory_id into v_factory from public.lines where id = v_line;
  v_style := (p_payload->>'styleId')::uuid;
  select exists (select 1 from public.line_styles where line_id = v_line and status = 'active') into v_has_active;
  v_status := case when v_has_active then 'queued' else 'active' end;
  insert into public.line_styles (factory_id, line_id, style_id, smv, status, loaded_at, created_by)
  values (v_factory, v_line, v_style, (p_payload->>'smv')::numeric, v_status, now(), public.current_user_id())
  returning id into v_ls;
  insert into public.line_style_costs (line_style_id, cm_per_pc_usd)
  values (v_ls, coalesce((p_payload->>'cmPerPcUsd')::numeric, 0));
  insert into public.processed_events(event_id, action) values (p_event_id, 'LOAD_STYLE');
end; $$;

-- Client-callable (enforce access internally); not anonymous.
do $$
declare fn text;
begin
  foreach fn in array array[
    'public.sync_attendance(uuid,jsonb)',
    'public.sync_production(uuid,jsonb)',
    'public.sync_downtime(uuid,jsonb)',
    'public.sync_load_style(uuid,jsonb)'
  ] loop
    execute format('revoke execute on function %s from public, anon;', fn);
    execute format('grant execute on function %s to authenticated;', fn);
  end loop;
end $$;;
