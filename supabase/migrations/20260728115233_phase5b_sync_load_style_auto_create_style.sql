-- Enhance sync_load_style to accept style_name/style_code text and auto-create
-- the style if no style_id is provided or it doesn't exist.
create or replace function public.sync_load_style(p_event_id uuid, p_payload jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare v_line uuid; v_factory uuid; v_style uuid; v_has_active boolean; v_status public.line_style_status; v_ls uuid;
  v_style_name text; v_style_code text;
begin
  if exists (select 1 from public.processed_events where event_id = p_event_id) then return; end if;
  v_line := (p_payload->>'lineId')::uuid;
  if not public.can_load_line(v_line) then raise exception 'not authorized to load line %', v_line using errcode='42501'; end if;
  select factory_id into v_factory from public.lines where id = v_line;

  -- Resolve or create style
  v_style := nullif(p_payload->>'styleId','')::uuid;
  if v_style is null or not exists (select 1 from public.styles where id = v_style) then
    v_style_name := coalesce(nullif(p_payload->>'styleName',''), nullif(p_payload->>'styleCode',''), 'Untitled');
    v_style_code := coalesce(nullif(p_payload->>'styleCode',''), v_style_name);
    -- Try to find existing by code within same factory
    select id into v_style from public.styles where factory_id = v_factory and code = v_style_code limit 1;
    if v_style is null then
      insert into public.styles (factory_id, code, name, value_per_pc_usd)
      values (v_factory, v_style_code, v_style_name, 0)
      returning id into v_style;
    end if;
  end if;

  select exists (select 1 from public.line_styles where line_id = v_line and status = 'active') into v_has_active;
  v_status := case when v_has_active then 'queued' else 'active' end;
  insert into public.line_styles (factory_id, line_id, style_id, smv, status, loaded_at, created_by)
  values (v_factory, v_line, v_style, (p_payload->>'smv')::numeric, v_status, now(), public.current_user_id())
  returning id into v_ls;
  insert into public.line_style_costs (line_style_id, cm_per_pc_usd)
  values (v_ls, coalesce((p_payload->>'cmPerPcUsd')::numeric, 0));
  insert into public.processed_events(event_id, action) values (p_event_id, 'LOAD_STYLE');
end; $$;;
