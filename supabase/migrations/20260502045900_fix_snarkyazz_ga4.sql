-- Fix missing GA4 mapping for Snarky A$$ Humans
-- The original seed used ILIKE '%SnarkyAzzHumans%' which failed to match the database name 'Snarky A$$ Humans'

INSERT INTO public.client_ga4_config (client_id, ga4_property_id, website_url, is_active)
VALUES ('297cbb3c-54b4-4bed-8206-25949a94fa62', '535205346', 'https://snarkyazzhumans.com', true)
ON CONFLICT (client_id) DO UPDATE SET 
  ga4_property_id = EXCLUDED.ga4_property_id,
  website_url = EXCLUDED.website_url;
