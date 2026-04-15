-- Reactivate all Metricool social platforms for Snarky Humans
-- These were incorrectly deactivated in 20260401144500_deactivate_snarky_humans_social.sql
-- Metricool shows: Facebook, Instagram, TikTok, YouTube, Google Ads
-- client_id: ef580ebf-439f-4305-826a-f1f8aa89fd03
-- blog_id: 5691309, user_id: 4380439

UPDATE public.client_metricool_config
SET is_active = true
WHERE client_id = 'ef580ebf-439f-4305-826a-f1f8aa89fd03'
  AND platform IN ('facebook', 'instagram', 'tiktok', 'youtube', 'google_ads');

-- Ensure all 5 platforms exist (upsert in case any were deleted, not just deactivated)
INSERT INTO public.client_metricool_config (client_id, platform, user_id, blog_id, is_active)
VALUES
  ('ef580ebf-439f-4305-826a-f1f8aa89fd03', 'facebook',   '4380439', '5691309', true),
  ('ef580ebf-439f-4305-826a-f1f8aa89fd03', 'instagram',  '4380439', '5691309', true),
  ('ef580ebf-439f-4305-826a-f1f8aa89fd03', 'tiktok',     '4380439', '5691309', true),
  ('ef580ebf-439f-4305-826a-f1f8aa89fd03', 'youtube',    '4380439', '5691309', true),
  ('ef580ebf-439f-4305-826a-f1f8aa89fd03', 'google_ads', '4380439', '5691309', true)
ON CONFLICT (client_id, platform) DO UPDATE SET
  is_active = true,
  user_id   = EXCLUDED.user_id,
  blog_id   = EXCLUDED.blog_id;
