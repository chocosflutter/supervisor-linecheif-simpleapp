-- Phase 3 (b): read-side helpers + the single get_line_kpis RPC.

-- Labor cost per hour for a class mix, using the salary rates EFFECTIVE on the date.
create or replace function public.labor_cost_per_hour(p_factory uuid, p_date date, op int, hl int, pr int, ch int)
returns numeric language sql stable security definer set search_path = '' as $$
  with rate as (
    select sb.worker_class, (sb.monthly_salary_usd / (sb.working_days * sb.standard_hours)) as r
    from public.salary_bank sb
    where sb.factory_id = p_factory and sb.effective_from <= p_date
      and sb.effective_from = (
        select max(s2.effective_from) from public.salary_bank s2
        where s2.factory_id = p_factory and s2.worker_class = sb.worker_class and s2.effective_from <= p_date
      )
  )
  select coalesce(sum(x.cnt * rate.r), 0)
  from (values ('operator'::public.worker_class, op),('helper', hl),('pressman', pr),('checker', ch)) as x(wc, cnt)
  join rate on rate.worker_class = x.wc;
$$;

-- Working minutes between two instants: within shift hours, minus the line's breaks.
-- Implements off-shift + break exclusion (R33) for changeover.
create or replace function public.working_minutes_between(p_line_id uuid, p_from timestamptz, p_to timestamptz)
returns numeric language plpgsql stable security definer set search_path = '' as $$
declare
  v_factory uuid; v_unit uuid; v_floor uuid; v_start time; v_end time;
  total numeric := 0; d date; ov_start timestamptz; ov_end timestamptz; day_min numeric;
  br record; b_start timestamptz; b_end timestamptz;
begin
  if p_to <= p_from then return 0; end if;
  select l.factory_id, l.unit_id, l.floor_id into v_factory, v_unit, v_floor from public.lines l where l.id = p_line_id;
  select shift_start, shift_end into v_start, v_end from public.shift_config where factory_id = v_factory;
  if v_start is null then v_start := '08:00'; v_end := '17:00'; end if;
  d := p_from::date;
  while d <= p_to::date loop
    ov_start := greatest(p_from, (d + v_start)::timestamptz);
    ov_end   := least(p_to,   (d + v_end)::timestamptz);
    if ov_end > ov_start then
      day_min := extract(epoch from (ov_end - ov_start)) / 60;
      for br in select b.start_time, b.end_time from public.break_slots b
                where b.factory_id = v_factory
                  and (b.unit_id is null or b.unit_id = v_unit)
                  and (b.floor_id is null or b.floor_id = v_floor) loop
        b_start := greatest(ov_start, (d + br.start_time)::timestamptz);
        b_end   := least(ov_end,   (d + br.end_time)::timestamptz);
        if b_end > b_start then
          day_min := day_min - extract(epoch from (b_end - b_start)) / 60;
        end if;
      end loop;
      total := total + greatest(day_min, 0);
    end if;
    d := d + 1;
  end loop;
  return greatest(total, 0);
end; $$;

-- Changeover count + total working-minutes over a range for one line.
create or replace function public.changeover_stats(p_line_id uuid, p_start date, p_end date, out cnt int, out total_min numeric)
language plpgsql stable security definer set search_path = '' as $$
declare prev record; curr record; last_old timestamptz; first_new timestamptz;
begin
  cnt := 0; total_min := 0; prev := null;
  for curr in select id, style_id, loaded_at, unloaded_at from public.line_styles
              where line_id = p_line_id and status <> 'queued' order by loaded_at loop
    if prev is not null and curr.loaded_at::date between p_start and p_end then
      select max(entered_at) into last_old from public.production_hourly
        where line_id = p_line_id and style_id = prev.style_id
          and entered_at >= prev.loaded_at and entered_at <= coalesce(prev.unloaded_at, curr.loaded_at);
      select min(entered_at) into first_new from public.production_hourly
        where line_id = p_line_id and style_id = curr.style_id and entered_at >= curr.loaded_at;
      if last_old is not null and first_new is not null and first_new > last_old then
        cnt := cnt + 1;
        total_min := total_min + public.working_minutes_between(p_line_id, last_old, first_new);
      end if;
    end if;
    prev := curr;
  end loop;
end; $$;

-- THE aggregation RPC: one additive-aggregate row PER accessible line over the range.
-- Client sums lines per group and runs deriveKpis(). Enforces access + range cap.
create or replace function public.get_line_kpis(p_line_ids uuid[], p_start date, p_end date, p_filter_style uuid default null)
returns table(
  line_id uuid, produced_qty bigint, good_qty bigint, defective_pcs bigint, total_defects bigint,
  workforce bigint, man_hours numeric, produced_minutes numeric, value_usd numeric,
  operating_cost_usd numeric, cm_value_usd numeric, planned_man_days bigint, present_man_days bigint,
  downtime_minutes numeric, changeover_count int, changeover_total_min numeric
) language plpgsql stable security definer set search_path = '' as $$
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
    select line_id, date from prod
    union select line_id, date from att
    union select line_id, date from plan
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
end; $$;

-- Internal helpers: not exposed via RPC.
revoke execute on function public.labor_cost_per_hour(uuid,date,int,int,int,int) from public;
revoke execute on function public.working_minutes_between(uuid,timestamptz,timestamptz) from public;
revoke execute on function public.changeover_stats(uuid,date,date) from public;
revoke execute on function public.refresh_line_day_agg(uuid,date,uuid) from public;
revoke execute on function public.rebuild_line_day_agg() from public;
-- Public aggregation entrypoint: authenticated only (enforces access internally).
revoke execute on function public.get_line_kpis(uuid[],date,date,uuid) from public, anon;
grant execute on function public.get_line_kpis(uuid[],date,date,uuid) to authenticated;
;
