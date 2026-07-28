-- Phase 7: enable pg_net + pg_cron, schedule daily FX fetch at 6 AM UTC.
create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron with schema pg_catalog;

-- Cron job: fetch FX rates daily at 06:00 UTC via the Edge Function.
select cron.schedule(
  'daily-fx-fetch',
  '0 6 * * *',
  $$
  select net.http_post(
    url := 'https://grfjeiodszrgklnillwy.supabase.co/functions/v1/fetch-fx-rates',
    headers := jsonb_build_object('Authorization','Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdyZmplaW9kc3pyZ2tsbmlsbHd5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUyMjQ0MDAsImV4cCI6MjEwMDgwMDQwMH0.AW25nG0dhstSkXfCFaIZ76QGimmXddnroyy6RtVFu0Y'),
    body := '{}'::jsonb
  );
  $$
);;
