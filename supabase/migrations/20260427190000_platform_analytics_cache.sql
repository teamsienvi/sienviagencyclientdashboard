-- Cache table for direct analytics integration JSON payloads
CREATE TABLE platform_analytics_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    platform TEXT NOT NULL,
    module TEXT NOT NULL,
    data JSONB NOT NULL,
    collected_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(client_id, platform, module)
);

-- RLS
ALTER TABLE platform_analytics_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own client platform analytics cache"
ON platform_analytics_cache FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM client_users
        WHERE client_users.client_id = platform_analytics_cache.client_id
        AND client_users.user_id = auth.uid()
    )
    OR
    EXISTS (
        SELECT 1 FROM user_roles
        WHERE user_roles.user_id = auth.uid()
        AND user_roles.role = 'admin'
    )
);

-- Service role policies for edge functions
CREATE POLICY "Service role can insert platform analytics cache"
ON platform_analytics_cache FOR INSERT
TO service_role
WITH CHECK (true);

CREATE POLICY "Service role can update platform analytics cache"
ON platform_analytics_cache FOR UPDATE
TO service_role
USING (true)
WITH CHECK (true);
