-- Reactivate google_ads for Snarky Humans so they have the Ad Shredder for Google only.
UPDATE client_metricool_config
SET is_active = true
WHERE client_id = 'ef580ebf-439f-4305-826a-f1f8aa89fd03'
AND platform = 'google_ads';
