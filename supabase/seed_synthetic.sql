-- Synthetic history generator (NOT part of the normal seed) — for EXPLAIN / index
-- validation on realistic row counts. Generates 90 prior days across all lines.
-- Safe to re-run: ON CONFLICT DO NOTHING. Uses past dates only (today comes from seed.sql).

-- Production: 9 slots/line/day for the last 90 days.
insert into production_hourly(factory_id,line_id,floor_id,unit_id,style_id,date,hour_slot,good_qty,defective_pcs,total_defects,entered_at)
select ln.factory_id, ln.id, ln.floor_id, ln.unit_id, ls.style_id, d.day::date, sl.slot,
       (80 + random()*60)::int,
       (2 + random()*6)::int,
       (3 + random()*8)::int,
       d.day + (sl.i || ' hours')::interval
from lines ln
join lateral (select style_id from line_styles where line_id = ln.id and status = 'active' limit 1) ls on true
cross join generate_series(current_date - 90, current_date - 1, interval '1 day') as d(day)
cross join (values
  ('08:00-09:00',8),('09:00-10:00',9),('10:00-11:00',10),('11:00-12:00',11),
  ('12:00-13:00',12),('13:00-14:00',13),('14:00-15:00',14),('15:00-16:00',15),('16:00-17:00',16)
) as sl(slot,i)
on conflict (line_id, date, hour_slot) do nothing;

-- Attendance: one row/line/day for the last 90 days.
insert into attendance(factory_id,line_id,date,operators,helpers,pressmen,checkers)
select ln.factory_id, ln.id, d.day::date,
       (22 + random()*3)::int, (5 + random()*2)::int, (2 + random()*2)::int, (2 + random()*2)::int
from lines ln
cross join generate_series(current_date - 90, current_date - 1, interval '1 day') as d(day)
on conflict (line_id, date) do nothing;

-- Planned headcount: one row/line/day for the last 90 days.
insert into planned_headcount(factory_id,line_id,date,operators,helpers,pressmen,checkers)
select ln.factory_id, ln.id, d.day::date, 24,6,3,3
from lines ln
cross join generate_series(current_date - 90, current_date - 1, interval '1 day') as d(day)
on conflict (line_id, date) do nothing;
