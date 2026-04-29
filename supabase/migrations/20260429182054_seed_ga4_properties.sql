-- Migration to seed GA4 Property IDs for all agency clients

-- Insert or Update GA4 Property IDs by matching the client's exact/partial name in the clients table.
INSERT INTO public.client_ga4_config (client_id, ga4_property_id, website_url, is_active)
SELECT id, '535114183', 'https://snarkyhumans.com', true FROM public.clients WHERE name ILIKE '%Snarky Humans%'
ON CONFLICT (client_id) DO UPDATE SET ga4_property_id = EXCLUDED.ga4_property_id;

INSERT INTO public.client_ga4_config (client_id, ga4_property_id, website_url, is_active)
SELECT id, '535215301', 'https://snarkypets.com', true FROM public.clients WHERE name ILIKE '%Snarky Pets%'
ON CONFLICT (client_id) DO UPDATE SET ga4_property_id = EXCLUDED.ga4_property_id;

INSERT INTO public.client_ga4_config (client_id, ga4_property_id, website_url, is_active)
SELECT id, '535204928', 'https://blingybag.com', true FROM public.clients WHERE name ILIKE '%BlingyBag%'
ON CONFLICT (client_id) DO UPDATE SET ga4_property_id = EXCLUDED.ga4_property_id;

INSERT INTO public.client_ga4_config (client_id, ga4_property_id, website_url, is_active)
SELECT id, '535211553', 'https://oxisuretech.com', true FROM public.clients WHERE name ILIKE '%OxiSure Tech%'
ON CONFLICT (client_id) DO UPDATE SET ga4_property_id = EXCLUDED.ga4_property_id;

INSERT INTO public.client_ga4_config (client_id, ga4_property_id, website_url, is_active)
SELECT id, '535216572', 'https://fatherfigureformula.com', true FROM public.clients WHERE name ILIKE '%Father Figure Formula%'
ON CONFLICT (client_id) DO UPDATE SET ga4_property_id = EXCLUDED.ga4_property_id;

INSERT INTO public.client_ga4_config (client_id, ga4_property_id, website_url, is_active)
SELECT id, '535215789', 'https://serenityscrolls.com', true FROM public.clients WHERE name ILIKE '%Serenity Scrolls%'
ON CONFLICT (client_id) DO UPDATE SET ga4_property_id = EXCLUDED.ga4_property_id;

INSERT INTO public.client_ga4_config (client_id, ga4_property_id, website_url, is_active)
SELECT id, '535207074', 'https://sienvi.com', true FROM public.clients WHERE name ILIKE '%Sienvi Agency%'
ON CONFLICT (client_id) DO UPDATE SET ga4_property_id = EXCLUDED.ga4_property_id;

INSERT INTO public.client_ga4_config (client_id, ga4_property_id, website_url, is_active)
SELECT id, '535200318', 'https://billionairebrother.com', true FROM public.clients WHERE name ILIKE '%Billionaire Brother%'
ON CONFLICT (client_id) DO UPDATE SET ga4_property_id = EXCLUDED.ga4_property_id;

INSERT INTO public.client_ga4_config (client_id, ga4_property_id, website_url, is_active)
SELECT id, '535210839', 'https://playiq.com', true FROM public.clients WHERE name ILIKE '%PlayIQ%'
ON CONFLICT (client_id) DO UPDATE SET ga4_property_id = EXCLUDED.ga4_property_id;

INSERT INTO public.client_ga4_config (client_id, ga4_property_id, website_url, is_active)
SELECT id, '535205346', 'https://snarkyazzhumans.com', true FROM public.clients WHERE name ILIKE '%SnarkyAzzHumans%'
ON CONFLICT (client_id) DO UPDATE SET ga4_property_id = EXCLUDED.ga4_property_id;
