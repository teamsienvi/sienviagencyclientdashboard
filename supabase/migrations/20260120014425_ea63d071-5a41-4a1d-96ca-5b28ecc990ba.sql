-- Ensure client users can SELECT from client_metricool_config through their client access
-- First check if policy exists and drop it if so
DROP POLICY IF EXISTS "Client users can view their metricool configs" ON client_metricool_config;

-- Create a policy that allows users with client access to view configs
CREATE POLICY "Client users can view their metricool configs"
ON client_metricool_config
FOR SELECT
USING (
  user_has_client_access(auth.uid(), client_id)
);

-- Ensure social_oauth_accounts can be read by client users
DROP POLICY IF EXISTS "Client users can view their oauth accounts" ON social_oauth_accounts;
CREATE POLICY "Client users can view their oauth accounts"
ON social_oauth_accounts
FOR SELECT
USING (
  user_has_client_access(auth.uid(), client_id)
);

DROP POLICY IF EXISTS "Public can view oauth accounts for active clients" ON social_oauth_accounts;
CREATE POLICY "Public can view oauth accounts for active clients"
ON social_oauth_accounts
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM clients c
    WHERE c.id = social_oauth_accounts.client_id AND c.is_active = true
  )
);

-- Ensure client_meta_map can be read by client users
DROP POLICY IF EXISTS "Client users can view their meta map" ON client_meta_map;
CREATE POLICY "Client users can view their meta map"
ON client_meta_map
FOR SELECT
USING (
  user_has_client_access(auth.uid(), client_id)
);

DROP POLICY IF EXISTS "Public can view meta map for active clients" ON client_meta_map;
CREATE POLICY "Public can view meta map for active clients"
ON client_meta_map
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM clients c
    WHERE c.id = client_meta_map.client_id AND c.is_active = true
  )
);

-- Ensure social_sync_logs can be read by client users
DROP POLICY IF EXISTS "Client users can view their sync logs" ON social_sync_logs;
CREATE POLICY "Client users can view their sync logs"
ON social_sync_logs
FOR SELECT
USING (
  user_has_client_access(auth.uid(), client_id)
);

DROP POLICY IF EXISTS "Public can view sync logs for active clients" ON social_sync_logs;
CREATE POLICY "Public can view sync logs for active clients"
ON social_sync_logs
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM clients c
    WHERE c.id = social_sync_logs.client_id AND c.is_active = true
  )
);