-- 1. Alias client_ubersuggest_config as a view pointing to client_seo_config
--    (The dashboard checks client_ubersuggest_config but the real table is client_seo_config)
CREATE OR REPLACE VIEW public.client_ubersuggest_config AS
SELECT
  id,
  client_id,
  domain,
  is_active,
  created_at,
  updated_at
FROM public.client_seo_config;

-- 2. Re-enable BlingyBag SEO config (delete + insert to avoid constraint issues)
DELETE FROM public.client_seo_config
WHERE client_id = (SELECT id FROM public.clients WHERE name ILIKE '%BlingyBag%' LIMIT 1);

INSERT INTO public.client_seo_config (client_id, domain, is_active)
SELECT id, 'blingybag.com', true
FROM public.clients WHERE name ILIKE '%BlingyBag%';

-- 3. Deactivate ads platforms for PlayIQ in client_metricool_config
UPDATE public.client_metricool_config
SET is_active = false
WHERE client_id = (SELECT id FROM public.clients WHERE name ILIKE '%PlayIQ%' LIMIT 1)
  AND platform IN ('meta_ads', 'google_ads', 'tiktok_ads');
