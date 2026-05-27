-- Migration to drop check constraints on analytics_summaries table to allow 'ads' type summaries
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
  END LOOP;
END $$;
