-- Add tiktok_ads to the platform check constraint
ALTER TABLE client_metricool_config DROP CONSTRAINT IF EXISTS client_metricool_config_platform_check;

ALTER TABLE client_metricool_config ADD CONSTRAINT client_metricool_config_platform_check 
CHECK (platform IN ('instagram', 'facebook', 'tiktok', 'youtube', 'linkedin', 'x', 'meta_ads', 'google_ads', 'tiktok_ads'));
