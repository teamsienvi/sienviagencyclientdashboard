-- Migration to create the analytics_summaries table for persisting AI-generated summaries
CREATE TABLE IF NOT EXISTS analytics_summaries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  summary_data JSONB NOT NULL,
  period_start TEXT,
  period_end TEXT,
  generated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(client_id, type)
);

ALTER TABLE analytics_summaries ENABLE ROW LEVEL SECURITY;

-- SELECT: users can read summaries for their own clients or if they are admin/superadmin
CREATE POLICY "Allow users to select their client's summaries"
  ON analytics_summaries
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM client_users
      WHERE client_users.client_id = analytics_summaries.client_id
      AND client_users.user_id = auth.uid()
    ) OR 
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('admin', 'superadmin')
    )
  );

-- INSERT: authenticated users can insert summaries for their client(s) or if admin/superadmin
CREATE POLICY "Allow users to insert their client's summaries"
  ON analytics_summaries
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM client_users
      WHERE client_users.client_id = analytics_summaries.client_id
      AND client_users.user_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('admin', 'superadmin')
    )
  );

-- UPDATE: same access check as INSERT
CREATE POLICY "Allow users to update their client's summaries"
  ON analytics_summaries
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM client_users
      WHERE client_users.client_id = analytics_summaries.client_id
      AND client_users.user_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('admin', 'superadmin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM client_users
      WHERE client_users.client_id = analytics_summaries.client_id
      AND client_users.user_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('admin', 'superadmin')
    )
  );

-- Service role operations (e.g., from edge functions) bypass RLS.

