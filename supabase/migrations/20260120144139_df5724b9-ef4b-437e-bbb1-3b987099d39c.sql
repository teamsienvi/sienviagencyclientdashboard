-- Drop the existing check constraint and add one that includes meta_ads and google_ads
ALTER TABLE client_metricool_config DROP CONSTRAINT IF EXISTS client_metricool_config_platform_check;

ALTER TABLE client_metricool_config ADD CONSTRAINT client_metricool_config_platform_check 
CHECK (platform IN ('instagram', 'facebook', 'tiktok', 'youtube', 'linkedin', 'x', 'meta_ads', 'google_ads'));