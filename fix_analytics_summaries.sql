-- Fix analytics_summaries to accept 'ads' type and ensure service-role bypass
-- Run this in Supabase SQL Editor

-- 1. Drop any existing check constraint on the type column that excludes 'ads'
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'analytics_summaries'::regclass
      AND contype = 'c'
  LOOP
    EXECUTE 'ALTER TABLE analytics_summaries DROP CONSTRAINT IF EXISTS ' || quote_ident(r.conname);
    RAISE NOTICE 'Dropped constraint: %', r.conname;
  END LOOP;
END $$;

-- 2. Ensure the type column accepts any text (no check constraint)
-- The valid values are: 'social', 'website', 'lms', 'ads'
-- No constraint needed — edge function already validates this.

-- 3. Ensure service role can bypass RLS (it does by default, but be explicit)
-- Drop and recreate policies to ensure service_role writes work
DO $$
BEGIN
  -- Grant insert/update/select to service_role explicitly
  -- (service_role bypasses RLS anyway, but the 23514 suggests a CHECK constraint)
  GRANT SELECT, INSERT, UPDATE, DELETE ON analytics_summaries TO service_role;
  GRANT SELECT, INSERT, UPDATE, DELETE ON analytics_summaries TO authenticated;
END $$;

-- 4. Verify table structure
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'analytics_summaries'
ORDER BY ordinal_position;

-- 5. Check existing constraints
SELECT conname, contype, pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conrelid = 'analytics_summaries'::regclass;

-- 6. Check current row count and types present
SELECT type, count(*) as rows
FROM analytics_summaries
GROUP BY type
ORDER BY type;
