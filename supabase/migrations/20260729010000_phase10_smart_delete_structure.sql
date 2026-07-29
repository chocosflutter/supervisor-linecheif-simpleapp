-- Smart delete for factory structure (units / floors / lines).
-- Hard-delete when the entity has NO real history (production / attendance /
-- line_styles / downtime / planned_headcount / alerts); otherwise soft-delete
-- (set archived_at) to preserve historical integrity. Idempotent via
-- processed_events so the offline outbox can retry safely. Called from the
-- client outbox actions DELETE_UNIT / DELETE_FLOOR / DELETE_LINE.

create or replace function public.line_has_data(p_line uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.production_hourly where line_id=p_line)
      or exists(select 1 from public.attendance where line_id=p_line)
      or exists(select 1 from public.line_styles where line_id=p_line)
      or exists(select 1 from public.downtime_events where line_id=p_line)
      or exists(select 1 from public.planned_headcount where line_id=p_line)
      or exists(select 1 from public.alerts where line_id=p_line);
$$;

create or replace function public.delete_line_hard(p_line uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
  delete from public.line_supervisors where line_id=p_line;
  delete from public.line_chiefs where line_id=p_line;
  delete from public.lines where id=p_line;
end; $$;

create or replace function public.archive_or_delete_line(p_event_id uuid, p_payload jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_factory uuid;
begin
  if exists(select 1 from public.processed_events where event_id=p_event_id) then return; end if;
  v_id := (p_payload->>'id')::uuid;
  select factory_id into v_factory from public.lines where id=v_id;
  if v_factory is not null then
    if not public.can_manage_factory(v_factory) then raise exception 'not authorized' using errcode='42501'; end if;
    if public.line_has_data(v_id) then
      update public.lines set archived_at=now() where id=v_id;
    else
      perform public.delete_line_hard(v_id);
    end if;
  end if;
  insert into public.processed_events(event_id, action) values (p_event_id,'DELETE_LINE');
end; $$;

create or replace function public.archive_or_delete_floor(p_event_id uuid, p_payload jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_factory uuid; v_has_data boolean; r record;
begin
  if exists(select 1 from public.processed_events where event_id=p_event_id) then return; end if;
  v_id := (p_payload->>'id')::uuid;
  select factory_id into v_factory from public.floors where id=v_id;
  if v_factory is not null then
    if not public.can_manage_factory(v_factory) then raise exception 'not authorized' using errcode='42501'; end if;
    select exists(select 1 from public.lines l where l.floor_id=v_id and public.line_has_data(l.id)) into v_has_data;
    if v_has_data then
      update public.lines set archived_at=now() where floor_id=v_id and archived_at is null;
      update public.floors set archived_at=now() where id=v_id;
    else
      for r in select id from public.lines where floor_id=v_id loop
        perform public.delete_line_hard(r.id);
      end loop;
      delete from public.break_slots where floor_id=v_id;
      delete from public.floors where id=v_id;
    end if;
  end if;
  insert into public.processed_events(event_id, action) values (p_event_id,'DELETE_FLOOR');
end; $$;

create or replace function public.archive_or_delete_unit(p_event_id uuid, p_payload jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_factory uuid; v_has_data boolean; r record;
begin
  if exists(select 1 from public.processed_events where event_id=p_event_id) then return; end if;
  v_id := (p_payload->>'id')::uuid;
  select factory_id into v_factory from public.units where id=v_id;
  if v_factory is not null then
    if not public.can_manage_factory(v_factory) then raise exception 'not authorized' using errcode='42501'; end if;
    select exists(
      select 1 from public.lines l join public.floors f on f.id=l.floor_id
      where f.unit_id=v_id and public.line_has_data(l.id)
    ) into v_has_data;
    if v_has_data then
      update public.lines set archived_at=now() where floor_id in (select id from public.floors where unit_id=v_id) and archived_at is null;
      update public.floors set archived_at=now() where unit_id=v_id and archived_at is null;
      update public.units set archived_at=now() where id=v_id;
    else
      for r in select id from public.lines where floor_id in (select id from public.floors where unit_id=v_id) loop
        perform public.delete_line_hard(r.id);
      end loop;
      delete from public.break_slots where unit_id=v_id or floor_id in (select id from public.floors where unit_id=v_id);
      delete from public.floors where unit_id=v_id;
      delete from public.units where id=v_id;
    end if;
  end if;
  insert into public.processed_events(event_id, action) values (p_event_id,'DELETE_UNIT');
end; $$;

revoke all on function public.line_has_data(uuid) from public, anon;
revoke all on function public.delete_line_hard(uuid) from public, anon;
revoke all on function public.archive_or_delete_line(uuid, jsonb) from public, anon;
revoke all on function public.archive_or_delete_floor(uuid, jsonb) from public, anon;
revoke all on function public.archive_or_delete_unit(uuid, jsonb) from public, anon;
grant execute on function public.archive_or_delete_line(uuid, jsonb) to authenticated;
grant execute on function public.archive_or_delete_floor(uuid, jsonb) to authenticated;
grant execute on function public.archive_or_delete_unit(uuid, jsonb) to authenticated;
