-- Deactivate all ads platform configs for Father Figure Formula (client has no ads channels)
UPDATE client_metricool_config 
SET is_active = false 
WHERE client_id = '95791e88-87cd-4621-af7e-df46f5ad93ac' 
AND platform IN ('meta_ads', 'google_ads', 'tiktok_ads');
