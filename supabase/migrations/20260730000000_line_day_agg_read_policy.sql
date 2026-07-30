-- Allow authenticated users to read their accessible lines' daily aggregates.
-- Previously RLS was enabled with no policies → all reads returned empty.
create policy sel_line_day_agg on public.line_day_agg
  for select using (can_access_line(line_id));
