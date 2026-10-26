-- Add Ubersuggest SEO Configuration for The Haven At Deer Park
-- Client ID: b6c39651-9259-4930-af6e-b744a5a191ad
-- Domain: havenatdeerpark.com

INSERT INTO public.client_seo_config (client_id, domain, is_active)
VALUES ('b6c39651-9259-4930-af6e-b744a5a191ad', 'havenatdeerpark.com', true)
ON CONFLICT (id) DO UPDATE SET
  domain = EXCLUDED.domain,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();
