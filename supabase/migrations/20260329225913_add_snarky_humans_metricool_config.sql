-- Insert Metricool configs for Snarky Humans (Instagram + Facebook)
-- blogId and userId provided by user
INSERT INTO client_metricool_config (client_id, platform, user_id, blog_id, is_active, reporting_timezone)
VALUES
  ('297cbb3c-54b4-4bed-8206-25949a94fa62', 'instagram', '4380439', '5691309', true, 'America/Chicago'),
  ('297cbb3c-54b4-4bed-8206-25949a94fa62', 'facebook', '4380439', '5691309', true, 'America/Chicago')
ON CONFLICT (client_id, platform) DO UPDATE SET
  user_id = EXCLUDED.user_id,
  blog_id = EXCLUDED.blog_id,
  is_active = EXCLUDED.is_active,
  reporting_timezone = EXCLUDED.reporting_timezone;
