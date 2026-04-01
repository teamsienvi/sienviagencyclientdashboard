-- ============================================
-- ALL PENDING CONFIG MIGRATIONS
-- Run this in the Supabase SQL Editor
-- ============================================

-- 1. OXISURE TECH: Add Google Ads Shredder
INSERT INTO client_metricool_config (client_id, platform, user_id, blog_id, reporting_timezone, is_active)
VALUES ('1a1edf9f-2ebe-4d40-a904-7295d5033401', 'google_ads', '4380439', '5691500', 'America/Chicago', true)
ON CONFLICT (client_id, platform) DO UPDATE SET is_active = true;

-- 2. SNARKY A$$ HUMANS: Reactivate Google Ads only
UPDATE client_metricool_config SET is_active = true
WHERE client_id = 'ef580ebf-439f-4305-826a-f1f8aa89fd03' AND platform = 'google_ads';

-- 3. SNARKY A$$ HUMANS: Deactivate all social media platforms
UPDATE client_metricool_config SET is_active = false
WHERE client_id = 'ef580ebf-439f-4305-826a-f1f8aa89fd03'
AND platform IN ('facebook', 'instagram', 'tiktok', 'youtube', 'linkedin', 'x');

-- 4. BSUE BROW & LASH: Add TikTok + Instagram
INSERT INTO client_metricool_config (client_id, platform, user_id, blog_id, reporting_timezone, is_active)
VALUES
  ('973e8407-bf7f-45ca-bd73-a26acc3ad9e3', 'tiktok', '4380439', '5831273', 'America/Chicago', true),
  ('973e8407-bf7f-45ca-bd73-a26acc3ad9e3', 'instagram', '4380439', '5831273', 'America/Chicago', true)
ON CONFLICT (client_id, platform)
DO UPDATE SET user_id = EXCLUDED.user_id, blog_id = EXCLUDED.blog_id, is_active = EXCLUDED.is_active;
