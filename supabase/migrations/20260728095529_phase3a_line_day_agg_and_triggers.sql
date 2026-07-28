-- Phase 3 (a): trigger-maintained daily summary at (line_id, date, style_id) grain.
-- Stores production-derived additive fields only; workforce/cost/planned/downtime
-- are joined at read (small tables). Maintained for ALL days including today.

create table public.line_day_agg (
  factory_id uuid not null,
  line_id uuid not null,
  floor_id uuid not null,
  unit_id uuid not null,
  date date not null,
  style_id uuid not null,
  produced_qty integer not null default 0,
  good_qty integer not null default 0,
  defective_pcs integer not null default 0,
  total_defects integer not null default 0,
  slots integer not null default 0,          -- distinct hour_slots (this line/date/style)
  produced_minutes numeric(18,4) not null default 0,  -- produced_qty * smv (as-run load)
  value_usd numeric(18,4) not null default 0,         -- produced_qty * style value/pc
  cm_value_usd numeric(18,4) not null default 0,      -- good_qty * cm/pc (as-run load)
  updated_at timestamptz not null default now(),
  primary key (line_id, date, style_id)
);
create index ix_lda_factory_date on public.line_day_agg(factory_id, date);
create index ix_lda_unit_date on public.line_day_agg(unit_id, date);
create index ix_lda_floor_date on public.line_day_agg(floor_id, date);
create index ix_lda_line_date on public.line_day_agg(line_id, date);
create index ix_lda_style on public.line_day_agg(style_id);

-- RLS on: no policies → only SECURITY DEFINER RPCs (get_line_kpis) and service role read it.
alter table public.line_day_agg enable row level security;
comment on table public.line_day_agg is 'Trigger-maintained KPI summary. Read only via SECURITY DEFINER RPC get_line_kpis; RLS denies direct client access.';

-- Recompute one (line, date, style) summary row from raw production.
create or replace function public.refresh_line_day_agg(p_line_id uuid, p_date date, p_style_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_produced int; v_good int; v_def int; v_defects int; v_slots int; v_last timestamptz;
  v_smv numeric; v_cm numeric; v_value numeric;
  v_factory uuid; v_floor uuid; v_unit uuid;
begin
  select coalesce(sum(good_qty + defective_pcs),0), coalesce(sum(good_qty),0),
         coalesce(sum(defective_pcs),0), coalesce(sum(total_defects),0),
         count(distinct hour_slot), max(entered_at)
    into v_produced, v_good, v_def, v_defects, v_slots, v_last
  from public.production_hourly
  where line_id = p_line_id and date = p_date and style_id = p_style_id;

  if coalesce(v_slots,0) = 0 then
    delete from public.line_day_agg where line_id = p_line_id and date = p_date and style_id = p_style_id;
    return;
  end if;

  -- as-run style-load in effect at the group's latest entry (smv + cm)
  select ls.smv, coalesce(c.cm_per_pc_usd, 0) into v_smv, v_cm
  from public.line_styles ls
  left join public.line_style_costs c on c.line_style_id = ls.id
  where ls.line_id = p_line_id and ls.style_id = p_style_id and ls.loaded_at <= coalesce(v_last, now())
  order by ls.loaded_at desc
  limit 1;
  v_smv := coalesce(v_smv, 0); v_cm := coalesce(v_cm, 0);

  select value_per_pc_usd into v_value from public.styles where id = p_style_id;
  v_value := coalesce(v_value, 0);

  select factory_id, floor_id, unit_id into v_factory, v_floor, v_unit
  from public.lines where id = p_line_id;

  insert into public.line_day_agg(factory_id,line_id,floor_id,unit_id,date,style_id,
    produced_qty,good_qty,defective_pcs,total_defects,slots,produced_minutes,value_usd,cm_value_usd,updated_at)
  values (v_factory,p_line_id,v_floor,v_unit,p_date,p_style_id,
    v_produced,v_good,v_def,v_defects,v_slots, v_produced*v_smv, v_produced*v_value, v_good*v_cm, now())
  on conflict (line_id,date,style_id) do update set
    produced_qty = excluded.produced_qty, good_qty = excluded.good_qty,
    defective_pcs = excluded.defective_pcs, total_defects = excluded.total_defects,
    slots = excluded.slots, produced_minutes = excluded.produced_minutes,
    value_usd = excluded.value_usd, cm_value_usd = excluded.cm_value_usd,
    factory_id = excluded.factory_id, floor_id = excluded.floor_id, unit_id = excluded.unit_id,
    updated_at = now();
end; $$;

-- Trigger: maintain summary on every production write (incl. late/edited rows).
create or replace function public.trg_production_agg()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    perform public.refresh_line_day_agg(old.line_id, old.date, old.style_id);
    return old;
  end if;
  if tg_op = 'UPDATE'
     and (old.line_id, old.date, old.style_id) is distinct from (new.line_id, new.date, new.style_id) then
    perform public.refresh_line_day_agg(old.line_id, old.date, old.style_id);
  end if;
  perform public.refresh_line_day_agg(new.line_id, new.date, new.style_id);
  return new;
end; $$;
create trigger trg_production_hourly_agg
  after insert or update or delete on public.production_hourly
  for each row execute function public.trg_production_agg();

-- Trigger: IE editing a style's value/pc refreshes that style's summary rows.
create or replace function public.trg_style_value_agg()
returns trigger language plpgsql security definer set search_path = '' as $$
declare r record;
begin
  if new.value_per_pc_usd is distinct from old.value_per_pc_usd then
    for r in select distinct line_id, date from public.line_day_agg where style_id = new.id loop
      perform public.refresh_line_day_agg(r.line_id, r.date, new.id);
    end loop;
  end if;
  return new;
end; $$;
create trigger trg_styles_value_agg
  after update of value_per_pc_usd on public.styles
  for each row execute function public.trg_style_value_agg();

-- Full rebuild (nightly reconciliation safety net / after bulk changes).
create or replace function public.rebuild_line_day_agg()
returns void language plpgsql security definer set search_path = '' as $$
declare r record;
begin
  delete from public.line_day_agg;
  for r in select distinct line_id, date, style_id from public.production_hourly loop
    perform public.refresh_line_day_agg(r.line_id, r.date, r.style_id);
  end loop;
end; $$;

-- Backfill from existing seed + synthetic data.
select public.rebuild_line_day_agg();
;
