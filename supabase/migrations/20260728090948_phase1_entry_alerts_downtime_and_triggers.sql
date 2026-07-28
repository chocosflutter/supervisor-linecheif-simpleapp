-- Phase 1 (c): supervisor entry, downtime events, alerts, offline ledger, freeze trigger

-- ── attendance (upsert per line/day) ─────────────────────────────
create table public.attendance (
  id uuid primary key default gen_random_uuid(),
  factory_id uuid not null references public.factories(id) on delete restrict,
  line_id uuid not null references public.lines(id) on delete restrict,
  date date not null,
  operators integer not null default 0 check (operators >= 0),
  helpers integer not null default 0 check (helpers >= 0),
  pressmen integer not null default 0 check (pressmen >= 0),
  checkers integer not null default 0 check (checkers >= 0),
  submitted_by uuid references public.users(id) on delete set null,
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (line_id, date)
);
create index ix_attendance_line_date on public.attendance(line_id, date);
create index ix_attendance_factory_date on public.attendance(factory_id, date);
create trigger trg_attendance_updated_at before update on public.attendance
  for each row execute function public.set_updated_at();

-- ── production_hourly (one row per line/date/slot; style required) ─────
create table public.production_hourly (
  id uuid primary key default gen_random_uuid(),   -- client-generated UUID (offline idempotency key)
  factory_id uuid not null references public.factories(id) on delete restrict,
  line_id uuid not null references public.lines(id) on delete restrict,
  floor_id uuid not null references public.floors(id) on delete restrict,   -- denormalized for rollups
  unit_id uuid not null references public.units(id) on delete restrict,     -- denormalized for rollups
  style_id uuid not null references public.styles(id) on delete restrict,   -- as-run style; blocked when no active style
  date date not null,
  hour_slot text not null,
  good_qty integer not null default 0 check (good_qty >= 0),
  defective_pcs integer not null default 0 check (defective_pcs >= 0),
  total_defects integer not null default 0 check (total_defects >= 0),
  entered_by uuid references public.users(id) on delete set null,
  entered_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (line_id, date, hour_slot)
);
create index ix_production_line_date on public.production_hourly(line_id, date);
create index ix_production_factory_date on public.production_hourly(factory_id, date);
create index ix_production_floor_date on public.production_hourly(floor_id, date);
create index ix_production_unit_date on public.production_hourly(unit_id, date);
create index ix_production_style on public.production_hourly(style_id);
create trigger trg_production_updated_at before update on public.production_hourly
  for each row execute function public.set_updated_at();

-- ── downtime_events (unplanned; paid; reason + time range) ──────────
create table public.downtime_events (
  id uuid primary key default gen_random_uuid(),
  factory_id uuid not null references public.factories(id) on delete restrict,
  line_id uuid not null references public.lines(id) on delete restrict,
  date date not null,
  start_time time not null,
  end_time time not null,
  reason_id uuid not null references public.downtime_reasons(id) on delete restrict,
  note text,
  entered_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  check (end_time > start_time)
);
create index ix_downtime_line_date on public.downtime_events(line_id, date);
create index ix_downtime_factory_date on public.downtime_events(factory_id, date);

-- ── alerts (IE flags an entry → supervisor resolves) ────────────────
create table public.alerts (
  id uuid primary key default gen_random_uuid(),
  factory_id uuid not null references public.factories(id) on delete restrict,
  line_id uuid not null references public.lines(id) on delete restrict,
  category alert_category not null,
  production_hourly_id uuid references public.production_hourly(id) on delete cascade,  -- production/defects
  ref_date date,                                                                        -- attendance target
  note text not null,
  raised_by uuid references public.users(id) on delete set null,
  raised_at timestamptz not null default now(),
  status alert_status not null default 'open',
  resolved_by uuid references public.users(id) on delete set null,
  resolved_at timestamptz,
  resolution_note text,
  created_at timestamptz not null default now()
);
create index ix_alerts_line_status on public.alerts(line_id, status);
create index ix_alerts_production on public.alerts(production_hourly_id);
create index ix_alerts_factory on public.alerts(factory_id);

-- ── processed_events (offline event-log idempotency ledger) ─────────
create table public.processed_events (
  event_id uuid primary key,
  action text not null,
  processed_at timestamptz not null default now()
);

-- ── CM/SMV freeze: lock once production recorded against a style-load ──
create or replace function public.prevent_locked_line_style_edit()
returns trigger language plpgsql as $$
begin
  if (new.cm_per_pc_usd is distinct from old.cm_per_pc_usd)
     or (new.smv is distinct from old.smv) then
    if exists (
      select 1 from public.production_hourly p
      where p.line_id = old.line_id
        and p.style_id = old.style_id
        and p.entered_at >= old.loaded_at
        and (old.unloaded_at is null or p.entered_at <= old.unloaded_at)
    ) then
      raise exception 'CM/SMV are locked: production already recorded against this style-load (line_style %).', old.id
        using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;

create trigger trg_line_styles_freeze_params before update on public.line_styles
  for each row execute function public.prevent_locked_line_style_edit();
;
