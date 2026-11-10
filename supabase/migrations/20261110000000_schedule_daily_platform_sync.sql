-- Schedule Daily & Evening Full Platform Sync (GSC, GA4, Ubersuggest SEO, Shopify, Klaviyo, Meta, Google Ads, TikTok)
-- Runs daily at 06:00 UTC (2:00 PM PHT) and 18:00 UTC (2:00 AM PHT)

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'daily-full-platform-sync') THEN
    PERFORM cron.unschedule('daily-full-platform-sync');
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'evening-full-platform-sync') THEN
    PERFORM cron.unschedule('evening-full-platform-sync');
  END IF;
END $$;

SELECT cron.schedule(
  'daily-full-platform-sync',
  '0 6 * * *',
  $$
  SELECT net.http_post(
    url := 'https://mhuxrnxajtiwxauhlhlv.supabase.co/functions/v1/scheduled-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-trigger', 'true'
    ),
    body := '{"source": "pg_cron_daily_morning"}'::jsonb,
    timeout_milliseconds := 120000
  ) AS request_id;
  $$
);

SELECT cron.schedule(
  'evening-full-platform-sync',
  '0 18 * * *',
  $$
  SELECT net.http_post(
    url := 'https://mhuxrnxajtiwxauhlhlv.supabase.co/functions/v1/scheduled-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-trigger', 'true'
    ),
    body := '{"source": "pg_cron_daily_evening"}'::jsonb,
    timeout_milliseconds := 120000
  ) AS request_id;
  $$
);

