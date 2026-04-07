-- Add missing social platforms for Snarky Humans (TikTok, YouTube, X)
-- Snarky Humans already has Instagram and Facebook via Metricool (see 20260329225913)
-- From legacy reports: TikTok @headsnarky69, YouTube Snarky Humans, X @SnarkyHumans
INSERT INTO client_metricool_config (client_id, platform, user_id, blog_id, reporting_timezone, is_active)
VALUES
  ('297cbb3c-54b4-4bed-8206-25949a94fa62', 'tiktok', '4380439', '5691309', 'America/Chicago', true),
  ('297cbb3c-54b4-4bed-8206-25949a94fa62', 'youtube', '4380439', '5691309', 'America/Chicago', true)
ON CONFLICT (client_id, platform) DO UPDATE SET
  is_active = EXCLUDED.is_active,
  reporting_timezone = EXCLUDED.reporting_timezone;

-- Also create a social_accounts row for X so it shows as connected
INSERT INTO social_accounts (client_id, platform, account_id, account_name, is_active)
VALUES ('297cbb3c-54b4-4bed-8206-25949a94fa62', 'x', 'SnarkyHumans', '@SnarkyHumans', true)
ON CONFLICT (client_id, platform, account_id) DO UPDATE SET is_active = true;
