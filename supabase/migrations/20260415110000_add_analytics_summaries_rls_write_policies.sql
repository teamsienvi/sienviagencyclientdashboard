-- Patch: add SELECT, INSERT and UPDATE RLS policies for analytics_summaries
-- Uses the project's standard has_role() helper (app_role enum: 'admin', 'user' only).
-- Safe to re-run: each policy is only created if it doesn't already exist.

-- Drop and recreate SELECT policy to fix 'superadmin' bug in original migration
DO $$
BEGIN
  -- Drop old SELECT policy if it exists (it may have failed silently before)
  DROP POLICY IF EXISTS "Allow users to select their client's summaries" ON analytics_summaries;

  CREATE POLICY "Allow users to select their client's summaries"
    ON analytics_summaries
    FOR SELECT
    USING (
      EXISTS (
        SELECT 1 FROM client_users
        WHERE client_users.client_id = analytics_summaries.client_id
        AND client_users.user_id = auth.uid()
      ) OR
      public.has_role(auth.uid(), 'admin'::public.app_role)
    );
END
$$;

-- INSERT policy
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'analytics_summaries'
    AND policyname = 'Allow users to insert their client''s summaries'
  ) THEN
    CREATE POLICY "Allow users to insert their client's summaries"
      ON analytics_summaries
      FOR INSERT
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM client_users
          WHERE client_users.client_id = analytics_summaries.client_id
          AND client_users.user_id = auth.uid()
        ) OR
        public.has_role(auth.uid(), 'admin'::public.app_role)
      );
  END IF;
END
$$;

-- UPDATE policy
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'analytics_summaries'
    AND policyname = 'Allow users to update their client''s summaries'
  ) THEN
    CREATE POLICY "Allow users to update their client's summaries"
      ON analytics_summaries
      FOR UPDATE
      USING (
        EXISTS (
          SELECT 1 FROM client_users
          WHERE client_users.client_id = analytics_summaries.client_id
          AND client_users.user_id = auth.uid()
        ) OR
        public.has_role(auth.uid(), 'admin'::public.app_role)
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM client_users
          WHERE client_users.client_id = analytics_summaries.client_id
          AND client_users.user_id = auth.uid()
        ) OR
        public.has_role(auth.uid(), 'admin'::public.app_role)
      );
  END IF;
END
$$;
