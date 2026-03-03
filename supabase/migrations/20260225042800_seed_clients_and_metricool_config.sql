-- Seed clients and their Metricool configurations
-- All clients share user_id = '4380439'

-- 1. Insert all clients
INSERT INTO public.clients (name) VALUES
  ('Snarky Humans'),
  ('Snarky Pets'),
  ('Father Figure Formula'),
  ('Sienvi Agency'),
  ('Serenity Scrolls'),
  ('OxiSure Tech'),
  ('The Haven At Deer Park'),
  ('BSUE Brow & Lash'),
  ('Cissie Pryor Presents'),
  ('BlingyBag'),
  ('Luxxe Auto Accessories')
ON CONFLICT (name) DO NOTHING;

-- 2. Insert Metricool configs for each client
-- Helper: use subquery to get client_id by name

-- Snarky Humans (blog_id: 5691309) — IG, FB, TikTok, LinkedIn, YouTube, Meta Ads, Google Ads
INSERT INTO public.client_metricool_config (client_id, platform, user_id, blog_id, is_active)
SELECT id, unnest(ARRAY['instagram','facebook','tiktok','linkedin','youtube','meta_ads','google_ads']),
       '4380439', '5691309', true
FROM public.clients WHERE name = 'Snarky Humans'
ON CONFLICT (client_id, platform) DO UPDATE SET user_id = EXCLUDED.user_id, blog_id = EXCLUDED.blog_id, is_active = true;

-- Snarky Pets (blog_id: 5691190) — IG, FB, TikTok, LinkedIn, YouTube, Meta Ads, Google Ads
INSERT INTO public.client_metricool_config (client_id, platform, user_id, blog_id, is_active)
SELECT id, unnest(ARRAY['instagram','facebook','tiktok','linkedin','youtube','meta_ads','google_ads']),
       '4380439', '5691190', true
FROM public.clients WHERE name = 'Snarky Pets'
ON CONFLICT (client_id, platform) DO UPDATE SET user_id = EXCLUDED.user_id, blog_id = EXCLUDED.blog_id, is_active = true;

-- Father Figure Formula (blog_id: 5691111) — IG, FB, TikTok, LinkedIn, YouTube, Meta Ads, Google Ads
INSERT INTO public.client_metricool_config (client_id, platform, user_id, blog_id, is_active)
SELECT id, unnest(ARRAY['instagram','facebook','tiktok','linkedin','youtube','meta_ads','google_ads']),
       '4380439', '5691111', true
FROM public.clients WHERE name = 'Father Figure Formula'
ON CONFLICT (client_id, platform) DO UPDATE SET user_id = EXCLUDED.user_id, blog_id = EXCLUDED.blog_id, is_active = true;

-- Sienvi Agency (blog_id: 5650673) — IG, FB, TikTok, LinkedIn, YouTube
INSERT INTO public.client_metricool_config (client_id, platform, user_id, blog_id, is_active)
SELECT id, unnest(ARRAY['instagram','facebook','tiktok','linkedin','youtube']),
       '4380439', '5650673', true
FROM public.clients WHERE name = 'Sienvi Agency'
ON CONFLICT (client_id, platform) DO UPDATE SET user_id = EXCLUDED.user_id, blog_id = EXCLUDED.blog_id, is_active = true;

-- Serenity Scrolls (blog_id: 4380439) — IG, FB, TikTok, LinkedIn, YouTube
INSERT INTO public.client_metricool_config (client_id, platform, user_id, blog_id, is_active)
SELECT id, unnest(ARRAY['instagram','facebook','tiktok','linkedin','youtube']),
       '4380439', '4380439', true
FROM public.clients WHERE name = 'Serenity Scrolls'
ON CONFLICT (client_id, platform) DO UPDATE SET user_id = EXCLUDED.user_id, blog_id = EXCLUDED.blog_id, is_active = true;

-- OxiSure Tech (blog_id: 5691500) — IG, FB, TikTok, YouTube
INSERT INTO public.client_metricool_config (client_id, platform, user_id, blog_id, is_active)
SELECT id, unnest(ARRAY['instagram','facebook','tiktok','youtube']),
       '4380439', '5691500', true
FROM public.clients WHERE name = 'OxiSure Tech'
ON CONFLICT (client_id, platform) DO UPDATE SET user_id = EXCLUDED.user_id, blog_id = EXCLUDED.blog_id, is_active = true;

-- The Haven At Deer Park (blog_id: 5691522) — IG, FB, TikTok, YouTube
INSERT INTO public.client_metricool_config (client_id, platform, user_id, blog_id, is_active)
SELECT id, unnest(ARRAY['instagram','facebook','tiktok','youtube']),
       '4380439', '5691522', true
FROM public.clients WHERE name = 'The Haven At Deer Park'
ON CONFLICT (client_id, platform) DO UPDATE SET user_id = EXCLUDED.user_id, blog_id = EXCLUDED.blog_id, is_active = true;

-- BSUE Brow & Lash — IG, FB, TikTok, YouTube (no blog_id provided, using Sienvi's user_id only)
-- NOTE: No Metricool blog_id was provided for BSUE. Skipping Metricool config.
-- Add manually when blog_id is available.

-- Cissie Pryor Presents (blog_id: 5691382) — IG, FB, YouTube
INSERT INTO public.client_metricool_config (client_id, platform, user_id, blog_id, is_active)
SELECT id, unnest(ARRAY['instagram','facebook','youtube']),
       '4380439', '5691382', true
FROM public.clients WHERE name = 'Cissie Pryor Presents'
ON CONFLICT (client_id, platform) DO UPDATE SET user_id = EXCLUDED.user_id, blog_id = EXCLUDED.blog_id, is_active = true;

-- Luxxe Auto Accessories — Meta Ads only (no blog_id provided)
-- NOTE: No Metricool blog_id was provided for Luxxe. Skipping Metricool config.
-- Add manually when blog_id is available.

-- BlingyBag (blog_id: 5761261) — Shopify only (no Metricool social platforms)
-- No Metricool config needed - Shopify is handled via shopify_oauth_connections
