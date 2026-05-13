-- Fix platform_analytics_cache SELECT policy to allow anon access
-- so the LMS dashboard can read cached data without requiring auth
DROP POLICY IF EXISTS "Users can view their own client platform analytics cache" ON platform_analytics_cache;

CREATE POLICY "Anyone can read platform analytics cache"
ON platform_analytics_cache FOR SELECT
TO anon, authenticated
USING (true);
