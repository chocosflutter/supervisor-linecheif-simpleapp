-- Phase 1 (a): enums, shared trigger, factories, users, factory structure & assignments

-- ── Enums ─────────────────────────────────────────────────────────────────
create type user_role as enum ('super_admin','ie','chief','supervisor');
create type worker_class as enum ('operator','helper','pressman','checker');
create type display_currency as enum ('INR','BDT');
create type kpi_key as enum ('productivity','cost','efficiency','profit','changeover','absenteeism','defective','dhu');
create type threshold_direction as enum ('higher_is_better','lower_is_better');
create type line_style_status as enum ('active','queued','closed');
create type break_type as enum ('tea','lunch','prayer','other');
create type alert_category as enum ('production','defects','attendance','style');
create type alert_status as enum ('open','resolved');

-- ── Shared updated_at trigger ─────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ── factories (top level; created by super admin) ─────────────────────────
create table public.factories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null unique,
  city text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ── users (app profile; linked to auth.users in Phase 2 via auth_user_id) ──
create table public.users (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique,               -- FK to auth.users added in Phase 2
  name text not null,
  role user_role not null,
  factory_id uuid references public.factories(id) on delete restrict, -- null for super_admin
  lang_pref text not null default 'en',
  created_at timestamptz not null default now(),
  constraint users_factory_required_for_non_super
    check (role = 'super_admin' or factory_id is not null)
);
create index ix_users_factory on public.users(factory_id);

-- ── units → floors → lines (factory-scoped, soft-deletable) ───────────────
create table public.units (
  id uuid primary key default gen_random_uuid(),
  factory_id uuid not null references public.factories(id) on delete restrict,
  name_en text not null,
  name_bn text not null,
  archived_at timestamptz,
  created_at timestamptz not null default now()
);
create index ix_units_factory on public.units(factory_id);

create table public.floors (
  id uuid primary key default gen_random_uuid(),
  factory_id uuid not null references public.factories(id) on delete restrict,
  unit_id uuid not null references public.units(id) on delete restrict,
  name_en text not null,
  name_bn text not null,
  archived_at timestamptz,
  created_at timestamptz not null default now()
);
create index ix_floors_factory on public.floors(factory_id);
create index ix_floors_unit on public.floors(unit_id);

create table public.lines (
  id uuid primary key default gen_random_uuid(),
  factory_id uuid not null references public.factories(id) on delete restrict,
  unit_id uuid not null references public.units(id) on delete restrict,   -- denormalized for rollups
  floor_id uuid not null references public.floors(id) on delete restrict,
  name_en text not null,
  name_bn text not null,
  archived_at timestamptz,
  created_at timestamptz not null default now()
);
create index ix_lines_factory on public.lines(factory_id);
create index ix_lines_floor on public.lines(floor_id);
create index ix_lines_unit on public.lines(unit_id);

-- ── assignments (many-to-many) ────────────────────────────────────────────
create table public.line_supervisors (
  id uuid primary key default gen_random_uuid(),
  line_id uuid not null references public.lines(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (line_id, user_id)
);
create index ix_line_supervisors_user on public.line_supervisors(user_id);

create table public.line_chiefs (
  id uuid primary key default gen_random_uuid(),
  line_id uuid not null references public.lines(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (line_id, user_id)
);
create index ix_line_chiefs_user on public.line_chiefs(user_id);
;
