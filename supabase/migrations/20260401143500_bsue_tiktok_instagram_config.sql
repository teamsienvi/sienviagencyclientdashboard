-- Insert TikTok and Instagram Metricool configurations for BSUE (client_id: 973e8407-bf7f-45ca-bd73-a26acc3ad9e3)
-- Metricool userId: 4380439 | blogId: 5831273

INSERT INTO client_metricool_config (client_id, platform, user_id, blog_id, reporting_timezone, is_active)
VALUES
  ('973e8407-bf7f-45ca-bd73-a26acc3ad9e3', 'tiktok', '4380439', '5831273', 'America/Chicago', true),
  ('973e8407-bf7f-45ca-bd73-a26acc3ad9e3', 'instagram', '4380439', '5831273', 'America/Chicago', true)
ON CONFLICT (client_id, platform) 
DO UPDATE SET 
  user_id = EXCLUDED.user_id,
  blog_id = EXCLUDED.blog_id,
  is_active = EXCLUDED.is_active;
