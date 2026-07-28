-- Phase 2 (d): isolate CM into its own RLS-protected table (bulletproof CM hiding,
-- no SECURITY DEFINER view), + advisor fixes (search_path, anon execute revokes).

-- 1) Fix mutable search_path on trigger functions.
create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end; $$;

-- 2) Helper functions are for POLICY use only — revoke direct RPC execute from anon.
revoke execute on function
  public.current_user_id(), public.current_factory_id(), public.current_user_role(),
  public.is_super_admin(), public.same_factory(uuid), public.can_manage_factory(uuid),
  public.can_access_line(uuid), public.can_enter_line(uuid), public.can_load_line(uuid)
from anon;

-- 3) CM isolation table.
create table public.line_style_costs (
  line_style_id uuid primary key references public.line_styles(id) on delete cascade,
  cm_per_pc_usd numeric(12,4) not null default 0 check (cm_per_pc_usd >= 0),
  updated_at timestamptz not null default now()
);
create trigger trg_line_style_costs_updated_at before update on public.line_style_costs
  for each row execute function public.set_updated_at();

insert into public.line_style_costs(line_style_id, cm_per_pc_usd)
  select id, cm_per_pc_usd from public.line_styles;

alter table public.line_style_costs enable row level security;
create policy sel_line_style_costs on public.line_style_costs for select to authenticated
  using (exists (select 1 from public.line_styles ls
                 where ls.id = line_style_id
                   and public.current_user_role() in ('ie','chief','super_admin')
                   and public.can_access_line(ls.line_id)));
create policy mod_line_style_costs on public.line_style_costs for all to authenticated
  using (exists (select 1 from public.line_styles ls where ls.id = line_style_id and public.can_load_line(ls.line_id)))
  with check (exists (select 1 from public.line_styles ls where ls.id = line_style_id and public.can_load_line(ls.line_id)));

-- 4) Remove the definer view + old cm-based freeze trigger, then drop cm column.
drop view if exists public.line_styles_safe;
drop trigger if exists trg_line_styles_freeze_params on public.line_styles;
drop function if exists public.prevent_locked_line_style_edit();
drop policy if exists sel_line_styles on public.line_styles;
alter table public.line_styles drop column cm_per_pc_usd;

-- 5) line_styles now has NO cm → supervisors may read it (smv/status). CM lives in
--    line_style_costs (RLS restricts to IE/chief/super).
create policy sel_line_styles on public.line_styles for select to authenticated
  using (public.can_access_line(line_id));

-- 6) Re-add freeze triggers (search_path locked), split across the two tables.
create or replace function public.prevent_smv_edit_after_production()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.smv is distinct from old.smv then
    if exists (select 1 from public.production_hourly p
               where p.line_id = old.line_id and p.style_id = old.style_id
                 and p.entered_at >= old.loaded_at
                 and (old.unloaded_at is null or p.entered_at <= old.unloaded_at)) then
      raise exception 'SMV is locked: production already recorded against this style-load (%).', old.id using errcode = 'check_violation';
    end if;
  end if;
  return new;
end; $$;
create trigger trg_line_styles_freeze_smv before update on public.line_styles
  for each row execute function public.prevent_smv_edit_after_production();

create or replace function public.prevent_cm_edit_after_production()
returns trigger language plpgsql set search_path = '' as $$
declare ls public.line_styles%rowtype;
begin
  if new.cm_per_pc_usd is distinct from old.cm_per_pc_usd then
    select * into ls from public.line_styles where id = old.line_style_id;
    if exists (select 1 from public.production_hourly p
               where p.line_id = ls.line_id and p.style_id = ls.style_id
                 and p.entered_at >= ls.loaded_at
                 and (ls.unloaded_at is null or p.entered_at <= ls.unloaded_at)) then
      raise exception 'CM is locked: production already recorded against this style-load (%).', old.line_style_id using errcode = 'check_violation';
    end if;
  end if;
  return new;
end; $$;
create trigger trg_line_style_costs_freeze before update on public.line_style_costs
  for each row execute function public.prevent_cm_edit_after_production();

-- 7) Convenience view: line_styles + cm via LEFT JOIN. security_invoker=true means
--    the caller's RLS on line_style_costs applies → supervisors get NULL cm automatically.
create view public.line_styles_v with (security_invoker = true) as
select ls.id, ls.factory_id, ls.line_id, ls.style_id, ls.smv, ls.status,
       ls.loaded_at, ls.unloaded_at, ls.created_by, ls.created_at, ls.updated_at,
       c.cm_per_pc_usd
from public.line_styles ls
left join public.line_style_costs c on c.line_style_id = ls.id;
revoke all on public.line_styles_v from anon;
grant select on public.line_styles_v to authenticated;
;
