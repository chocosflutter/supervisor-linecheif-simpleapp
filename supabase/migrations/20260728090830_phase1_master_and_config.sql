-- Phase 1 (b): IE master data + per-factory config

-- ── styles (IE master; value stored USD) ───────────────────────────
create table public.styles (
  id uuid primary key default gen_random_uuid(),
  factory_id uuid not null references public.factories(id) on delete restrict,
  code text not null,
  name text not null,
  value_per_pc_usd numeric(12,4) not null default 0 check (value_per_pc_usd >= 0),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  unique (factory_id, code)
);
create index ix_styles_factory on public.styles(factory_id);

-- ── salary_bank (effective-dated; USD) ───────────────────────────────
create table public.salary_bank (
  id uuid primary key default gen_random_uuid(),
  factory_id uuid not null references public.factories(id) on delete restrict,
  worker_class worker_class not null,
  monthly_salary_usd numeric(12,4) not null check (monthly_salary_usd >= 0),
  working_days integer not null check (working_days > 0),
  standard_hours integer not null check (standard_hours > 0),
  effective_from date not null,
  created_at timestamptz not null default now(),
  unique (factory_id, worker_class, effective_from)
);
create index ix_salary_bank_factory on public.salary_bank(factory_id);

-- ── planned_headcount (IE; canonical planned workforce per line/day) ───
create table public.planned_headcount (
  id uuid primary key default gen_random_uuid(),
  factory_id uuid not null references public.factories(id) on delete restrict,
  line_id uuid not null references public.lines(id) on delete restrict,
  date date not null,
  operators integer not null default 0 check (operators >= 0),
  helpers integer not null default 0 check (helpers >= 0),
  pressmen integer not null default 0 check (pressmen >= 0),
  checkers integer not null default 0 check (checkers >= 0),
  entered_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (line_id, date)
);
create index ix_planned_headcount_line_date on public.planned_headcount(line_id, date);

-- ── line_styles (chief loads; CM/SMV; one active per line) ────────────
create table public.line_styles (
  id uuid primary key default gen_random_uuid(),
  factory_id uuid not null references public.factories(id) on delete restrict,
  line_id uuid not null references public.lines(id) on delete restrict,
  style_id uuid not null references public.styles(id) on delete restrict,
  cm_per_pc_usd numeric(12,4) not null default 0 check (cm_per_pc_usd >= 0),
  smv numeric(10,4) not null default 0 check (smv >= 0),
  status line_style_status not null default 'active',
  loaded_at timestamptz not null default now(),
  unloaded_at timestamptz,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index ix_line_styles_line_status on public.line_styles(line_id, status);
create index ix_line_styles_factory on public.line_styles(factory_id);
-- at most one ACTIVE style-load per line
create unique index ux_line_styles_one_active on public.line_styles(line_id) where status = 'active';
create trigger trg_line_styles_updated_at before update on public.line_styles
  for each row execute function public.set_updated_at();

-- ── app_settings (one row per factory) ─────────────────────────────
create table public.app_settings (
  id uuid primary key default gen_random_uuid(),
  factory_id uuid not null unique references public.factories(id) on delete cascade,
  display_currency display_currency not null default 'BDT',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_app_settings_updated_at before update on public.app_settings
  for each row execute function public.set_updated_at();

-- ── shift_config (one row per factory) ────────────────────────────
create table public.shift_config (
  id uuid primary key default gen_random_uuid(),
  factory_id uuid not null unique references public.factories(id) on delete cascade,
  shift_start time not null default '08:00',
  shift_end time not null default '17:00',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_shift_config_updated_at before update on public.shift_config
  for each row execute function public.set_updated_at();

-- ── break_slots (scheduled breaks; null unit/floor = applies to all) ───
create table public.break_slots (
  id uuid primary key default gen_random_uuid(),
  factory_id uuid not null references public.factories(id) on delete cascade,
  name text not null,
  type break_type not null default 'other',
  unit_id uuid references public.units(id) on delete cascade,
  floor_id uuid references public.floors(id) on delete cascade,
  start_time time not null,
  end_time time not null,
  duration_minutes integer not null check (duration_minutes > 0),
  created_at timestamptz not null default now()
);
create index ix_break_slots_factory on public.break_slots(factory_id);

-- ── kpi_thresholds (per factory + kpi) ────────────────────────────
create table public.kpi_thresholds (
  id uuid primary key default gen_random_uuid(),
  factory_id uuid not null references public.factories(id) on delete cascade,
  kpi kpi_key not null,
  good_min numeric(12,4) not null,
  watch_min numeric(12,4) not null,
  direction threshold_direction not null,
  unique (factory_id, kpi)
);
create index ix_kpi_thresholds_factory on public.kpi_thresholds(factory_id);

-- ── fx_rates (USD base; cached daily) ─────────────────────────────
create table public.fx_rates (
  id uuid primary key default gen_random_uuid(),
  base text not null default 'USD',
  currency display_currency not null,
  rate numeric(14,6) not null check (rate > 0),
  fetched_at timestamptz not null default now(),
  rate_date date not null default current_date,
  unique (currency, rate_date)
);

-- ── downtime_reasons (factory-scoped managed dropdown) ───────────────
create table public.downtime_reasons (
  id uuid primary key default gen_random_uuid(),
  factory_id uuid not null references public.factories(id) on delete cascade,
  label text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index ix_downtime_reasons_factory on public.downtime_reasons(factory_id);
;
