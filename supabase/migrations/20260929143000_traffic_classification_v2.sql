-- ============================================================
-- Traffic Classification v2: Data Quality Layer Upgrade
-- ============================================================
-- This migration evolves the traffic audit system from a binary
-- excluded/not-excluded model to a full classification pipeline:
--   RAW TRAFFIC → CLASSIFICATION → REPORTING POLICY → REPORTING DATASET
--
-- It preserves all existing data and exclusion states.
-- It does NOT rewrite the original 20260929060000 migration.
-- ============================================================

-- 1. Add classification columns to both analytics tables
-- (safe: all have defaults, existing rows get sensible values)

ALTER TABLE public.web_analytics_page_views
  ADD COLUMN IF NOT EXISTS traffic_class    TEXT        NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS traffic_flags    JSONB       NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS exclusion_policy TEXT        NULL,
  ADD COLUMN IF NOT EXISTS audit_version    TEXT        NULL,
  ADD COLUMN IF NOT EXISTS evaluated_at     TIMESTAMPTZ NULL;

ALTER TABLE public.web_analytics_sessions
  ADD COLUMN IF NOT EXISTS traffic_class    TEXT        NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS traffic_flags    JSONB       NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS exclusion_policy TEXT        NULL,
  ADD COLUMN IF NOT EXISTS audit_version    TEXT        NULL,
  ADD COLUMN IF NOT EXISTS evaluated_at     TIMESTAMPTZ NULL;

-- 2. Evolve client_traffic_rules: add geo_mode and allowlists
-- Default geo_mode to 'observe' (safe) — NOT 'exclude'

ALTER TABLE public.client_traffic_rules
  ADD COLUMN IF NOT EXISTS geo_mode             TEXT  NOT NULL DEFAULT 'observe',
  ADD COLUMN IF NOT EXISTS allowed_ips          JSONB NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS allowed_cidrs        JSONB NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS allowed_ua_patterns  JSONB NULL DEFAULT '[]'::jsonb;

-- Add CHECK constraint for valid geo_mode values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_geo_mode_valid'
  ) THEN
    ALTER TABLE public.client_traffic_rules
      ADD CONSTRAINT chk_geo_mode_valid
      CHECK (geo_mode IN ('off', 'observe', 'exclude'));
  END IF;
END $$;

-- 3. Create traffic_audit_runs: tracks backfill execution state
CREATE TABLE IF NOT EXISTS public.traffic_audit_runs (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id         UUID        NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  audit_version     TEXT        NOT NULL DEFAULT 'traffic-v2',
  dry_run           BOOLEAN     NOT NULL DEFAULT false,
  status            TEXT        NOT NULL DEFAULT 'pending',
  cursor            TEXT        NULL,           -- last-processed record ID for resumability
  started_at        TIMESTAMPTZ NULL,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at      TIMESTAMPTZ NULL,
  records_scanned   INTEGER     NOT NULL DEFAULT 0,
  records_changed   INTEGER     NOT NULL DEFAULT 0,
  records_excluded  INTEGER     NOT NULL DEFAULT 0,
  records_included  INTEGER     NOT NULL DEFAULT 0,
  error_message     TEXT        NULL,
  created_by        TEXT        NULL,           -- admin email or 'system'
  run_stats         JSONB       NULL DEFAULT '{}'::jsonb,  -- detailed breakdown
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT chk_run_status CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled'))
);

-- 4. Create traffic_rule_audit_log: records every config change
CREATE TABLE IF NOT EXISTS public.traffic_rule_audit_log (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id       UUID        NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  changed_by      TEXT        NOT NULL,         -- admin email
  changed_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  previous_config JSONB       NULL,
  new_config      JSONB       NOT NULL
);

-- 5. RLS for new tables

ALTER TABLE public.traffic_audit_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.traffic_rule_audit_log ENABLE ROW LEVEL SECURITY;

-- traffic_audit_runs: admin-only
CREATE POLICY "Admins can manage audit runs"
  ON public.traffic_audit_runs
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- traffic_rule_audit_log: admin read, service role insert
CREATE POLICY "Admins can view rule audit log"
  ON public.traffic_rule_audit_log
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert rule audit log"
  ON public.traffic_rule_audit_log
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 6. Fix overly permissive client_traffic_rules SELECT policy
-- The original policy allows ANY authenticated user with an active client to see ALL rules.
-- Replace with proper scoping.

DROP POLICY IF EXISTS "Clients can view own traffic rules" ON public.client_traffic_rules;

-- 7. Indexes for classification queries

-- Reporting queries: most dashboard queries filter by client_id + is_excluded = false
-- (idx_pv_excluded and idx_sess_excluded already exist from v1)

-- Backfill queries: cursor-based pagination by id
CREATE INDEX IF NOT EXISTS idx_pv_traffic_class
  ON public.web_analytics_page_views (client_id, traffic_class);

CREATE INDEX IF NOT EXISTS idx_sess_traffic_class
  ON public.web_analytics_sessions (client_id, traffic_class);

-- Audit runs: lookup by client + status
CREATE INDEX IF NOT EXISTS idx_audit_runs_client_status
  ON public.traffic_audit_runs (client_id, status);

-- Rule audit log: lookup by client
CREATE INDEX IF NOT EXISTS idx_rule_audit_log_client
  ON public.traffic_rule_audit_log (client_id, changed_at DESC);

-- 8. Backfill existing exclude_reason into exclusion_policy where already set
-- This preserves v1 classification decisions without data loss
UPDATE public.web_analytics_page_views
  SET exclusion_policy = CASE
    WHEN exclude_reason LIKE 'bot:%' THEN 'known_bot'
    WHEN exclude_reason LIKE 'custom_bot:%' THEN 'custom_bot'
    WHEN exclude_reason LIKE 'team_ip:%' THEN 'internal_traffic'
    WHEN exclude_reason LIKE 'geo:%' THEN 'geo_policy'
    ELSE 'other'
  END,
  traffic_class = CASE
    WHEN exclude_reason LIKE 'bot:%' THEN 'bot'
    WHEN exclude_reason LIKE 'custom_bot:%' THEN 'bot'
    WHEN exclude_reason LIKE 'team_ip:%' THEN 'internal'
    WHEN exclude_reason LIKE 'geo:%' THEN 'human'
    ELSE 'unknown'
  END,
  traffic_flags = jsonb_build_array(exclude_reason),
  audit_version = 'traffic-v1-migrated'
WHERE is_excluded = true AND exclude_reason IS NOT NULL AND audit_version IS NULL;

UPDATE public.web_analytics_sessions
  SET exclusion_policy = CASE
    WHEN exclude_reason LIKE 'bot:%' THEN 'known_bot'
    WHEN exclude_reason LIKE 'custom_bot:%' THEN 'custom_bot'
    WHEN exclude_reason LIKE 'team_ip:%' THEN 'internal_traffic'
    WHEN exclude_reason LIKE 'geo:%' THEN 'geo_policy'
    ELSE 'other'
  END,
  traffic_class = CASE
    WHEN exclude_reason LIKE 'bot:%' THEN 'bot'
    WHEN exclude_reason LIKE 'custom_bot:%' THEN 'bot'
    WHEN exclude_reason LIKE 'team_ip:%' THEN 'internal'
    WHEN exclude_reason LIKE 'geo:%' THEN 'human'
    ELSE 'unknown'
  END,
  traffic_flags = jsonb_build_array(exclude_reason),
  audit_version = 'traffic-v1-migrated'
WHERE is_excluded = true AND exclude_reason IS NOT NULL AND audit_version IS NULL;
