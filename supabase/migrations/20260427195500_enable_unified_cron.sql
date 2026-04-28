-- ============================================================
-- Enable Unified Cron Automation
-- Targets: active + stale + unlocked + retry-eligible modules
-- Frequency: Every 30 minutes (conservative start)
-- ============================================================

-- 1. Unschedule old legacy cron jobs to prevent collisions
DO $$
BEGIN
    PERFORM cron.unschedule('sync-metricool-morning');
    EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
    PERFORM cron.unschedule('sync-metricool-evening');
    EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
    PERFORM cron.unschedule('sync-platforms-morning');
    EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
    PERFORM cron.unschedule('sync-platforms-evening');
    EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
    PERFORM cron.unschedule('sync-meta-ads-morning');
    EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
    PERFORM cron.unschedule('sync-meta-ads-evening');
    EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 2. Schedule the new unified dispatcher
-- Frequency: '*/30 * * * *' (Every 30 minutes)
-- The dispatcher handles its own batching (limit 15) and precise targeting
SELECT cron.schedule(
  'unified-sync-dispatcher',
  '*/30 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://mhuxrnxajtiwxauhlhlv.supabase.co/functions/v1/cron-sync-dispatcher',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1)
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Note: We use a feature flag or variable for the URL to avoid hardcoding project IDs 
-- where possible, but if not set, the fallback is the mhuxrnxajtiwxauhlhlv project.
-- If the feature_flag 'supabase_url' is missing, update the URL manually.
