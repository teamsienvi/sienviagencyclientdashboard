-- Add YouTube Metricool Analytics for PlayIQ
INSERT INTO public.client_metricool_config (client_id, user_id, blog_id, platform, is_active, reporting_timezone, is_business)
SELECT id, '4380439', '5917304', 'youtube', true, 'America/Chicago', true
FROM public.clients 
WHERE name ILIKE '%PlayIQ%'
ON CONFLICT ON CONSTRAINT client_metricool_config_client_id_platform_key 
DO UPDATE SET is_active = true, user_id = '4380439', blog_id = '5917304';
