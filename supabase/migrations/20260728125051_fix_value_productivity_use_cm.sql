-- Fix: Value Productivity should use CM/pc (not style value/pc).
-- value_usd now = produced_qty * cm_per_pc_usd
create or replace function public.refresh_line_day_agg(p_line_id uuid, p_date date, p_style_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_produced int; v_good int; v_def int; v_defects int; v_slots int; v_last timestamptz;
  v_smv numeric; v_cm numeric;
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

  select ls.smv, coalesce(c.cm_per_pc_usd, 0) into v_smv, v_cm
  from public.line_styles ls
  left join public.line_style_costs c on c.line_style_id = ls.id
  where ls.line_id = p_line_id and ls.style_id = p_style_id and ls.loaded_at <= coalesce(v_last, now())
  order by ls.loaded_at desc
  limit 1;
  v_smv := coalesce(v_smv, 0); v_cm := coalesce(v_cm, 0);

  select factory_id, floor_id, unit_id into v_factory, v_floor, v_unit
  from public.lines where id = p_line_id;

  insert into public.line_day_agg(factory_id,line_id,floor_id,unit_id,date,style_id,
    produced_qty,good_qty,defective_pcs,total_defects,slots,produced_minutes,value_usd,cm_value_usd,updated_at)
  values (v_factory,p_line_id,v_floor,v_unit,p_date,p_style_id,
    v_produced,v_good,v_def,v_defects,v_slots, v_produced*v_smv, v_produced*v_cm, v_good*v_cm, now())
  on conflict (line_id,date,style_id) do update set
    produced_qty = excluded.produced_qty, good_qty = excluded.good_qty,
    defective_pcs = excluded.defective_pcs, total_defects = excluded.total_defects,
    slots = excluded.slots, produced_minutes = excluded.produced_minutes,
    value_usd = excluded.value_usd, cm_value_usd = excluded.cm_value_usd,
    factory_id = excluded.factory_id, floor_id = excluded.floor_id, unit_id = excluded.unit_id,
    updated_at = now();
end; $$;

-- Rebuild to apply the formula change to existing data.
select public.rebuild_line_day_agg();

-- Also update the column comment for clarity.
comment on column public.line_day_agg.value_usd is 'produced_qty * cm_per_pc_usd (drives Value Productivity KPI)';;
