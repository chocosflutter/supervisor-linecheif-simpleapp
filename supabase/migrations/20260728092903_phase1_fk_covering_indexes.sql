-- Covering indexes for the two FK columns the app actually filters/joins on.
-- (Audit-user FKs like entered_by/submitted_by/raised_by are intentionally left
--  unindexed: the app never queries by them, so indexes there would be dead weight.)
create index ix_line_styles_style on public.line_styles(style_id);
create index ix_downtime_reason on public.downtime_events(reason_id);;
