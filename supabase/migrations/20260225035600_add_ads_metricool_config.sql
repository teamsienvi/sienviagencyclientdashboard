-- Add Meta Ads and Google Ads Metricool configs for Snarky Humans and Snarky Pets
-- Reuses the same user_id/blog_id from existing TikTok configs (same Metricool account)

INSERT INTO public.client_metricool_config (client_id, platform, user_id, blog_id, is_active)
SELECT client_id, 'meta_ads', user_id, blog_id, true
FROM public.client_metricool_config
WHERE platform = 'tiktok'
  AND is_active = true
  AND client_id IN (
    SELECT id FROM public.clients WHERE name IN ('Snarky Humans', 'Snarky Pets')
  )
ON CONFLICT (client_id, platform) DO UPDATE SET
  user_id = EXCLUDED.user_id,
  blog_id = EXCLUDED.blog_id,
  is_active = true;

INSERT INTO public.client_metricool_config (client_id, platform, user_id, blog_id, is_active)
SELECT client_id, 'google_ads', user_id, blog_id, true
FROM public.client_metricool_config
WHERE platform = 'tiktok'
  AND is_active = true
  AND client_id IN (
    SELECT id FROM public.clients WHERE name IN ('Snarky Humans', 'Snarky Pets')
  )
ON CONFLICT (client_id, platform) DO UPDATE SET
  user_id = EXCLUDED.user_id,
  blog_id = EXCLUDED.blog_id,
  is_active = true;
