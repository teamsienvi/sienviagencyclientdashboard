-- Deactivate all ads platform configs for The Haven (client has no ads channels)
-- This hides the Ads Shredder component for them
UPDATE client_metricool_config 
SET is_active = false 
WHERE client_id = (SELECT id FROM clients WHERE name ILIKE '%Haven%' LIMIT 1) 
AND platform IN ('meta_ads', 'google_ads', 'tiktok_ads');
