-- ╔══════════════════════════════════════════════════════════════╗
-- ║  analytics_summaries — full idempotent setup                ║
-- ║  Safe to run even if table/policies already exist           ║
-- ╚══════════════════════════════════════════════════════════════╝

-- 1. Create table if it doesn't exist yet
CREATE TABLE IF NOT EXISTS analytics_summaries (
  id           UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id    UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  type         TEXT NOT NULL,
  summary_data JSONB NOT NULL,
  period_start TEXT,
  period_end   TEXT,
  generated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(client_id, type)
);

-- 2. Enable RLS
ALTER TABLE analytics_summaries ENABLE ROW LEVEL SECURITY;

-- 3. SELECT policy (drop first to fix any old version with 'superadmin')
DROP POLICY IF EXISTS "Allow users to select their client's summaries" ON analytics_summaries;
CREATE POLICY "Allow users to select their client's summaries"
  ON analytics_summaries FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM client_users
      WHERE client_users.client_id = analytics_summaries.client_id
        AND client_users.user_id = auth.uid()
    )
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  );

-- 4. INSERT policy
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'analytics_summaries'
      AND policyname = 'Allow users to insert their client''s summaries'
  ) THEN
    CREATE POLICY "Allow users to insert their client's summaries"
      ON analytics_summaries FOR INSERT
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM client_users
          WHERE client_users.client_id = analytics_summaries.client_id
            AND client_users.user_id = auth.uid()
        )
        OR public.has_role(auth.uid(), 'admin'::public.app_role)
      );
  END IF;
END $$;

-- 5. UPDATE policy
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'analytics_summaries'
      AND policyname = 'Allow users to update their client''s summaries'
  ) THEN
    CREATE POLICY "Allow users to update their client's summaries"
      ON analytics_summaries FOR UPDATE
      USING (
        EXISTS (
          SELECT 1 FROM client_users
          WHERE client_users.client_id = analytics_summaries.client_id
            AND client_users.user_id = auth.uid()
        )
        OR public.has_role(auth.uid(), 'admin'::public.app_role)
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM client_users
          WHERE client_users.client_id = analytics_summaries.client_id
            AND client_users.user_id = auth.uid()
        )
        OR public.has_role(auth.uid(), 'admin'::public.app_role)
      );
  END IF;
END $$;

-- ╔══════════════════════════════════════════════════════════════╗
-- ║  Reactivate Snarky Humans social platforms                  ║
-- ╚══════════════════════════════════════════════════════════════╝
UPDATE public.client_metricool_config
SET is_active = true
WHERE client_id = 'ef580ebf-439f-4305-826a-f1f8aa89fd03'
  AND platform IN ('facebook', 'instagram', 'tiktok', 'youtube', 'google_ads');

INSERT INTO public.client_metricool_config (client_id, platform, user_id, blog_id, is_active)
VALUES
  ('ef580ebf-439f-4305-826a-f1f8aa89fd03', 'facebook',   '4380439', '5691309', true),
  ('ef580ebf-439f-4305-826a-f1f8aa89fd03', 'instagram',  '4380439', '5691309', true),
  ('ef580ebf-439f-4305-826a-f1f8aa89fd03', 'tiktok',     '4380439', '5691309', true),
  ('ef580ebf-439f-4305-826a-f1f8aa89fd03', 'youtube',    '4380439', '5691309', true),
  ('ef580ebf-439f-4305-826a-f1f8aa89fd03', 'google_ads', '4380439', '5691309', true)
ON CONFLICT (client_id, platform) DO UPDATE SET
  is_active = true,
  user_id   = EXCLUDED.user_id,
  blog_id   = EXCLUDED.blog_id;
