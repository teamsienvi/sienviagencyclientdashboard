-- Configure "In the Dome" (951ea00b-c710-4c26-ac4f-6b35629a4a70) for Website Analytics (GA4) only
UPDATE public.clients
SET is_active = true,
    updated_at = now()
WHERE id = '951ea00b-c710-4c26-ac4f-6b35629a4a70';

INSERT INTO public.client_ga4_config (client_id, ga4_property_id, website_url, is_active)
VALUES ('951ea00b-c710-4c26-ac4f-6b35629a4a70', 'G-X21CNC0YM0', 'https://inthedome.ca', true)
ON CONFLICT (client_id) DO UPDATE
SET ga4_property_id = EXCLUDED.ga4_property_id,
    website_url = EXCLUDED.website_url,
    is_active = true,
    updated_at = now();

-- Remove any non-website summaries/cache/sync entries for In the Dome
DELETE FROM public.analytics_summaries
WHERE client_id = '951ea00b-c710-4c26-ac4f-6b35629a4a70'
  AND type <> 'website';

DELETE FROM public.platform_analytics_cache
WHERE client_id = '951ea00b-c710-4c26-ac4f-6b35629a4a70'
  AND platform <> 'website';

DELETE FROM public.sync_state_registry
WHERE client_id = '951ea00b-c710-4c26-ac4f-6b35629a4a70'
  AND platform NOT IN ('ga4', 'website');
