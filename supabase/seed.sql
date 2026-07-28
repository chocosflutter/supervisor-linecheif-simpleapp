-- Parity seed — mirrors src/data/mock.ts for one factory (dev/staging parity).
-- Idempotent-ish: intended for a fresh DB (supabase db reset) or one-time apply.
-- Uses a DO block with variables so we never hardcode generated UUIDs.

do $$
declare
  fac  uuid;
  ie   uuid; chief uuid; sup uuid;
  u1 uuid; u2 uuid;
  f1 uuid; f2 uuid; f3 uuid;
  l1 uuid; l2 uuid; l3 uuid; l4 uuid; l5 uuid; l6 uuid;
  s1 uuid; s2 uuid; s3 uuid;
  today date := current_date;
begin
  -- Factory
  insert into factories(name, code, city, active)
    values ('RBC Apparels — Unit Complex 1', 'RBC-1', 'Dhaka', true)
    returning id into fac;

  -- Users (super admin has no factory)
  insert into users(name, role, factory_id) values ('Super Admin', 'super_admin', null);
  insert into users(name, role, factory_id) values ('Anita (IE)', 'ie', fac) returning id into ie;
  insert into users(name, role, factory_id) values ('Karim (Line Chief)', 'chief', fac) returning id into chief;
  insert into users(name, role, factory_id) values ('Rahim (Supervisor)', 'supervisor', fac) returning id into sup;

  -- Per-factory config
  insert into app_settings(factory_id, display_currency) values (fac, 'BDT');
  insert into shift_config(factory_id, shift_start, shift_end) values (fac, '08:00', '17:00');

  insert into kpi_thresholds(factory_id, kpi, good_min, watch_min, direction) values
    (fac,'productivity',800,500,'higher_is_better'),
    (fac,'cost',0.6,1.0,'lower_is_better'),
    (fac,'efficiency',70,50,'higher_is_better'),
    (fac,'profit',200,50,'higher_is_better'),
    (fac,'changeover',30,60,'lower_is_better'),
    (fac,'absenteeism',5,12,'lower_is_better'),
    (fac,'defective',3,6,'lower_is_better'),
    (fac,'dhu',5,10,'lower_is_better');

  insert into salary_bank(factory_id, worker_class, monthly_salary_usd, working_days, standard_hours, effective_from) values
    (fac,'operator',150,26,8, today - 180),
    (fac,'helper',110,26,8, today - 180),
    (fac,'pressman',140,26,8, today - 180),
    (fac,'checker',130,26,8, today - 180);

  insert into downtime_reasons(factory_id, label, active) values
    (fac,'Machine breakdown',true),
    (fac,'Power cut',true),
    (fac,'No feeding / input shortage',true),
    (fac,'Maintenance',true),
    (fac,'Other',true);

  -- Structure: units -> floors -> lines
  insert into units(factory_id,name_en,name_bn) values (fac,'Unit 1','ইউনিট ১') returning id into u1;
  insert into units(factory_id,name_en,name_bn) values (fac,'Unit 2','ইউনিট ২') returning id into u2;

  insert into floors(factory_id,unit_id,name_en,name_bn) values (fac,u1,'Floor A','ফ্লোর এ') returning id into f1;
  insert into floors(factory_id,unit_id,name_en,name_bn) values (fac,u1,'Floor B','ফ্লোর বি') returning id into f2;
  insert into floors(factory_id,unit_id,name_en,name_bn) values (fac,u2,'Floor C','ফ্লোর সি') returning id into f3;

  insert into lines(factory_id,unit_id,floor_id,name_en,name_bn) values (fac,u1,f1,'Line 1','লাইন ১') returning id into l1;
  insert into lines(factory_id,unit_id,floor_id,name_en,name_bn) values (fac,u1,f1,'Line 2','লাইন ২') returning id into l2;
  insert into lines(factory_id,unit_id,floor_id,name_en,name_bn) values (fac,u1,f2,'Line 3','লাইন ৩') returning id into l3;
  insert into lines(factory_id,unit_id,floor_id,name_en,name_bn) values (fac,u1,f2,'Line 4','লাইন ৪') returning id into l4;
  insert into lines(factory_id,unit_id,floor_id,name_en,name_bn) values (fac,u2,f3,'Line 5','লাইন ৫') returning id into l5;
  insert into lines(factory_id,unit_id,floor_id,name_en,name_bn) values (fac,u2,f3,'Line 6','লাইন ৬') returning id into l6;

  -- Assignments
  insert into line_supervisors(line_id,user_id) values (l1,sup);
  insert into line_chiefs(line_id,user_id) values (l1,chief),(l2,chief),(l3,chief),(l4,chief);

  -- Styles
  insert into styles(factory_id,code,name,value_per_pc_usd) values (fac,'PL-2201','Basic Polo',4.5) returning id into s1;
  insert into styles(factory_id,code,name,value_per_pc_usd) values (fac,'TS-3310','Crew Tee',3.2) returning id into s2;
  insert into styles(factory_id,code,name,value_per_pc_usd) values (fac,'HD-7788','Pullover Hoodie',8.9) returning id into s3;

  -- Line-style loads (one active per line; l1 also has a queued s2).
  -- CM lives in the RLS-protected line_style_costs table (Phase 2 CM isolation).
  insert into line_styles(factory_id,line_id,style_id,smv,status,loaded_at,created_by) values
    (fac,l1,s1,14,'active', now() - interval '6 hours', chief),
    (fac,l1,s2,10,'queued', now() - interval '4 hours', chief),
    (fac,l2,s2,10,'active', now() - interval '6 hours', chief),
    (fac,l3,s3,24,'active', now() - interval '6 hours', chief),
    (fac,l4,s1,14,'active', now() - interval '6 hours', chief),
    (fac,l5,s2,10,'active', now() - interval '6 hours', chief),
    (fac,l6,s3,24,'active', now() - interval '6 hours', chief);

  insert into line_style_costs(line_style_id, cm_per_pc_usd)
  select ls.id, v.cm
  from public.line_styles ls
  join (values (l1,s1,1.20),(l1,s2,0.95),(l2,s2,0.90),(l3,s3,2.10),(l4,s1,1.15),(l5,s2,0.95),(l6,s3,2.00))
       as v(line,style,cm)
    on v.line = ls.line_id and v.style = ls.style_id
  where ls.factory_id = fac;

  -- Planned headcount (IE, today)
  insert into planned_headcount(factory_id,line_id,date,operators,helpers,pressmen,checkers,entered_by) values
    (fac,l1,today,24,6,3,3,ie),(fac,l2,today,24,6,3,3,ie),(fac,l3,today,24,6,3,3,ie),
    (fac,l4,today,24,6,3,3,ie),(fac,l5,today,24,6,3,3,ie),(fac,l6,today,24,6,3,3,ie);

  -- Attendance (today)
  insert into attendance(factory_id,line_id,date,operators,helpers,pressmen,checkers,submitted_by) values
    (fac,l1,today,24,6,3,3,sup),(fac,l2,today,23,6,3,3,sup),(fac,l3,today,22,5,3,2,sup),
    (fac,l4,today,24,6,2,3,sup),(fac,l5,today,21,6,3,3,sup),(fac,l6,today,24,6,3,3,sup);

  -- Production (today): 5 slots per line
  insert into production_hourly(factory_id,line_id,floor_id,unit_id,style_id,date,hour_slot,good_qty,defective_pcs,total_defects,entered_by,entered_at)
  select fac, m.line, ln.floor_id, ln.unit_id, m.style, today, sl.slot,
         (m.base + sl.i*3)::int,
         greatest(1, round((m.base + sl.i*3)*0.03))::int,
         greatest(1, round((m.base + sl.i*3)*0.05))::int,
         sup, now() - ((5 - sl.i) || ' hours')::interval
  from (values (l1,s1,100),(l2,s2,120),(l3,s3,70),(l4,s1,95),(l5,s2,110),(l6,s3,65)) as m(line,style,base)
  join lines ln on ln.id = m.line
  cross join (values ('08:00-09:00',0),('09:00-10:00',1),('10:00-11:00',2),('11:00-12:00',3),('13:00-14:00',4)) as sl(slot,i);

  -- One downtime event on Line 1 (unplanned, paid)
  insert into downtime_events(factory_id,line_id,date,start_time,end_time,reason_id,note,entered_by)
  select fac, l1, today, '10:20','10:45', dr.id, 'Needle plate jam on station 6', sup
  from downtime_reasons dr
  where dr.factory_id = fac and dr.label = 'Machine breakdown'
  limit 1;

  -- FX (cached daily)
  insert into fx_rates(currency,rate,rate_date) values ('INR',83.2,today),('BDT',119.5,today);
end $$;
