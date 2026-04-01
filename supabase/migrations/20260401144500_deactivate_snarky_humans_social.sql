-- Deactivate legacy social media platforms for Snarky A$$ Humans (client_id: ef580ebf-439f-4305-826a-f1f8aa89fd03)
-- Snarky Humans is an Ads/Website only client

UPDATE client_metricool_config 
SET is_active = false 
WHERE client_id = 'ef580ebf-439f-4305-826a-f1f8aa89fd03' 
AND platform IN ('facebook', 'instagram', 'tiktok', 'youtube', 'linkedin', 'x');

-- Also deactivate any potential OAuth social connections for good measure
UPDATE social_oauth_accounts
SET is_active = false
WHERE client_id = 'ef580ebf-439f-4305-826a-f1f8aa89fd03'
AND platform IN ('facebook', 'instagram', 'tiktok', 'youtube', 'linkedin', 'x');

UPDATE client_youtube_map
SET active = false
WHERE client_id = 'ef580ebf-439f-4305-826a-f1f8aa89fd03';
