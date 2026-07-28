create or replace function public.get_line_kpis(p_line_ids uuid[], p_start date, p_end date, p_filter_style uuid default null)
returns table(
  line_id uuid, produced_qty bigint, good_qty bigint, defective_pcs bigint, total_defects bigint,
  workforce bigint, man_hours numeric, produced_minutes numeric, value_usd numeric,
  operating_cost_usd numeric, cm_value_usd numeric, planned_man_days bigint, present_man_days bigint,
  downtime_minutes numeric, changeover_count int, changeover_total_min numeric
) language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
begin
  if (p_end - p_start) > 400 then raise exception 'Date range too large (max 400 days).'; end if;
  return query
  with acc as (
    select lid from unnest(p_line_ids) as lid where public.can_access_line(lid)
  ),
  prod as (
    select a.line_id, a.date,
      sum(a.produced_qty) produced, sum(a.good_qty) good, sum(a.defective_pcs) defective,
      sum(a.total_defects) defects, sum(a.slots) slots, sum(a.produced_minutes) pmin,
      sum(a.value_usd) val, sum(a.cm_value_usd) cmval
    from public.line_day_agg a join acc on acc.lid = a.line_id
    where a.date between p_start and p_end and (p_filter_style is null or a.style_id = p_filter_style)
    group by a.line_id, a.date
  ),
  att as (
    select t.line_id, t.date,
      (t.operators + t.helpers + t.pressmen + t.checkers) wf,
      public.labor_cost_per_hour(t.factory_id, t.date, t.operators, t.helpers, t.pressmen, t.checkers) cph
    from public.attendance t join acc on acc.lid = t.line_id
    where t.date between p_start and p_end
  ),
  plan as (
    select p.line_id, p.date, (p.operators + p.helpers + p.pressmen + p.checkers) planned
    from public.planned_headcount p join acc on acc.lid = p.line_id
    where p.date between p_start and p_end
  ),
  dt as (
    select d.line_id, sum(extract(epoch from (d.end_time - d.start_time)) / 60) dmin
    from public.downtime_events d join acc on acc.lid = d.line_id
    where d.date between p_start and p_end group by d.line_id
  ),
  keys as (
    select prod.line_id, prod.date from prod
    union select att.line_id, att.date from att
    union select plan.line_id, plan.date from plan
  ),
  perday as (
    select k.line_id, k.date,
      coalesce(pr.produced,0) produced, coalesce(pr.good,0) good, coalesce(pr.defective,0) defective,
      coalesce(pr.defects,0) defects, coalesce(pr.slots,0) slots, coalesce(pr.pmin,0) pmin,
      coalesce(pr.val,0) val, coalesce(pr.cmval,0) cmval,
      coalesce(a.wf,0) wf, coalesce(a.cph,0) cph, coalesce(pl.planned,0) planned
    from keys k
    left join prod pr on pr.line_id = k.line_id and pr.date = k.date
    left join att a on a.line_id = k.line_id and a.date = k.date
    left join plan pl on pl.line_id = k.line_id and pl.date = k.date
  ),
  per_line as (
    select pd.line_id,
      sum(pd.produced)::bigint produced_qty, sum(pd.good)::bigint good_qty,
      sum(pd.defective)::bigint defective_pcs, sum(pd.defects)::bigint total_defects,
      sum(pd.wf)::bigint workforce, sum(pd.wf * pd.slots)::numeric man_hours,
      sum(pd.pmin)::numeric produced_minutes, sum(pd.val)::numeric value_usd,
      sum(pd.cph * pd.slots)::numeric operating_cost_usd, sum(pd.cmval)::numeric cm_value_usd,
      sum(pd.planned)::bigint planned_man_days, sum(pd.wf)::bigint present_man_days
    from perday pd group by pd.line_id
  )
  select pl.line_id, pl.produced_qty, pl.good_qty, pl.defective_pcs, pl.total_defects,
    pl.workforce, pl.man_hours, pl.produced_minutes, pl.value_usd, pl.operating_cost_usd, pl.cm_value_usd,
    pl.planned_man_days, pl.present_man_days,
    coalesce(d.dmin, 0)::numeric downtime_minutes,
    co.cnt, co.total_min
  from per_line pl
  left join dt d on d.line_id = pl.line_id
  cross join lateral public.changeover_stats(pl.line_id, p_start, p_end) co;
end; $$;;
