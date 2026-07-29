-- Phase 10: alerts cross-device sync support.
-- The IE↔supervisor notifications workflow previously lived only in client memory.
-- These columns let alerts round-trip through Supabase without extra joins:
--   entry_ref        → the UI deep-link key (e.g. "prod-<id>") so the supervisor
--                      can jump to the exact flagged entry on any device.
--   raised_by_name   → denormalized display name of the IE who raised it.
--   resolved_by_name → denormalized display name of the supervisor who resolved it.
alter table public.alerts
  add column if not exists entry_ref text,
  add column if not exists raised_by_name text,
  add column if not exists resolved_by_name text;
