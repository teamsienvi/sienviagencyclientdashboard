-- BSUE Brow & Lash: deactivate ads platforms and all non-TikTok social platforms
-- Only TikTok should remain active

-- 1. Deactivate all ads platforms
UPDATE public.client_metricool_config
SET is_active = false
WHERE client_id = (SELECT id FROM public.clients WHERE name ILIKE '%BSUE%' LIMIT 1)
  AND platform IN ('meta_ads', 'google_ads', 'tiktok_ads');

-- 2. Deactivate all non-TikTok social platforms
UPDATE public.client_metricool_config
SET is_active = false
WHERE client_id = (SELECT id FROM public.clients WHERE name ILIKE '%BSUE%' LIMIT 1)
  AND platform NOT IN ('tiktok', 'meta_ads', 'google_ads', 'tiktok_ads');

-- 3. Ensure TikTok is active
UPDATE public.client_metricool_config
SET is_active = true
WHERE client_id = (SELECT id FROM public.clients WHERE name ILIKE '%BSUE%' LIMIT 1)
  AND platform = 'tiktok';
