-- Deactivate all ads platform configs for Snarky Humans (client has no ads channels)
UPDATE client_metricool_config 
SET is_active = false 
WHERE client_id = 'ef580ebf-439f-4305-826a-f1f8aa89fd03' 
AND platform IN ('meta_ads', 'google_ads', 'tiktok_ads');
