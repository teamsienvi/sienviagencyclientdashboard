-- ============================================================
-- Schedule automated sync: twice daily via pg_cron + pg_net
-- Calls existing edge functions to keep dashboard data fresh
-- ============================================================

-- Store the service role key in vault so cron jobs can authenticate.
-- NOTE: If this INSERT fails because the secret already exists, you can
-- skip it — the jobs below reference it by name 'service_role_key'.
-- You can also add/update it manually via the Supabase SQL Editor:
--   SELECT vault.create_secret('YOUR_KEY', 'service_role_key', 'Service role key for cron jobs');

-- ============================================================
-- 1. Metricool bulk sync (account metrics, timelines, demographics, content)
--    Runs at 6:00 AM and 6:00 PM UTC  (~10 PM / 10 AM PST)
-- ============================================================
SELECT cron.schedule(
  'sync-metricool-morning',
  '0 6 * * *',
  $$
  SELECT net.http_post(
    url := 'https://ihbdwilzjxivmmmlkuyu.supabase.co/functions/v1/bulk-sync-all',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1)
    ),
    body := '{}'::jsonb
  );
  $$
);

SELECT cron.schedule(
  'sync-metricool-evening',
  '0 18 * * *',
  $$
  SELECT net.http_post(
    url := 'https://ihbdwilzjxivmmmlkuyu.supabase.co/functions/v1/bulk-sync-all',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1)
    ),
    body := '{}'::jsonb
  );
  $$
);

-- ============================================================
-- 2. Platform API sync (YouTube, X, TikTok, LinkedIn, Meta content)
--    Runs at 6:05 AM and 6:05 PM UTC  (5 min after Metricool to stagger)
-- ============================================================
SELECT cron.schedule(
  'sync-platforms-morning',
  '5 6 * * *',
  $$
  SELECT net.http_post(
    url := 'https://ihbdwilzjxivmmmlkuyu.supabase.co/functions/v1/scheduled-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1)
    ),
    body := '{}'::jsonb
  );
  $$
);

SELECT cron.schedule(
  'sync-platforms-evening',
  '5 18 * * *',
  $$
  SELECT net.http_post(
    url := 'https://ihbdwilzjxivmmmlkuyu.supabase.co/functions/v1/scheduled-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1)
    ),
    body := '{}'::jsonb
  );
  $$
);

-- ============================================================
-- 3. Meta Ads sync
--    Runs at 6:10 AM and 6:10 PM UTC  (10 min after Metricool to stagger)
-- ============================================================
SELECT cron.schedule(
  'sync-meta-ads-morning',
  '10 6 * * *',
  $$
  SELECT net.http_post(
    url := 'https://ihbdwilzjxivmmmlkuyu.supabase.co/functions/v1/meta-ads-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1)
    ),
    body := '{}'::jsonb
  );
  $$
);

SELECT cron.schedule(
  'sync-meta-ads-evening',
  '10 18 * * *',
  $$
  SELECT net.http_post(
    url := 'https://ihbdwilzjxivmmmlkuyu.supabase.co/functions/v1/meta-ads-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1)
    ),
    body := '{}'::jsonb
  );
  $$
);
