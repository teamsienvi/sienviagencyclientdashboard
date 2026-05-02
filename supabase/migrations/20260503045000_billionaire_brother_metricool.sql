-- Add Metricool config for Billionaire Brother
-- blogId=6157013, userId=4380439
-- Platforms: facebook, instagram, linkedin, tiktok, youtube

INSERT INTO public.client_metricool_config (client_id, platform, user_id, blog_id, reporting_timezone, is_active)
SELECT id, 'facebook', 4380439, 6157013, 'America/Los_Angeles', true
FROM public.clients WHERE name ILIKE '%Billionaire Brother%'
ON CONFLICT (client_id, platform) DO UPDATE SET
  user_id = EXCLUDED.user_id,
  blog_id = EXCLUDED.blog_id,
  is_active = true;

INSERT INTO public.client_metricool_config (client_id, platform, user_id, blog_id, reporting_timezone, is_active)
SELECT id, 'instagram', 4380439, 6157013, 'America/Los_Angeles', true
FROM public.clients WHERE name ILIKE '%Billionaire Brother%'
ON CONFLICT (client_id, platform) DO UPDATE SET
  user_id = EXCLUDED.user_id,
  blog_id = EXCLUDED.blog_id,
  is_active = true;

INSERT INTO public.client_metricool_config (client_id, platform, user_id, blog_id, reporting_timezone, is_active)
SELECT id, 'linkedin', 4380439, 6157013, 'America/Los_Angeles', true
FROM public.clients WHERE name ILIKE '%Billionaire Brother%'
ON CONFLICT (client_id, platform) DO UPDATE SET
  user_id = EXCLUDED.user_id,
  blog_id = EXCLUDED.blog_id,
  is_active = true;

INSERT INTO public.client_metricool_config (client_id, platform, user_id, blog_id, reporting_timezone, is_active)
SELECT id, 'tiktok', 4380439, 6157013, 'America/Los_Angeles', true
FROM public.clients WHERE name ILIKE '%Billionaire Brother%'
ON CONFLICT (client_id, platform) DO UPDATE SET
  user_id = EXCLUDED.user_id,
  blog_id = EXCLUDED.blog_id,
  is_active = true;

INSERT INTO public.client_metricool_config (client_id, platform, user_id, blog_id, reporting_timezone, is_active)
SELECT id, 'youtube', 4380439, 6157013, 'America/Los_Angeles', true
FROM public.clients WHERE name ILIKE '%Billionaire Brother%'
ON CONFLICT (client_id, platform) DO UPDATE SET
  user_id = EXCLUDED.user_id,
  blog_id = EXCLUDED.blog_id,
  is_active = true;
