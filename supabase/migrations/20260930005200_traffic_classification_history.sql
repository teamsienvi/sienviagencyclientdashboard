-- ============================================================
-- Traffic Classification v2.1: History, Rollback, Actor Identity
-- ============================================================
-- Adds:
--   1. traffic_classification_history — per-row snapshot before mutation
--   2. Rollback statuses on traffic_audit_runs
--   3. created_by_user_id on traffic_audit_runs (fix actor identity)
--   4. changed_by_user_id on traffic_rule_audit_log (fix actor identity)
-- ============================================================

-- 1. Classification history: snapshot before every mutation
CREATE TABLE IF NOT EXISTS public.traffic_classification_history (
  id                       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_run_id             UUID        NOT NULL REFERENCES public.traffic_audit_runs(id) ON DELETE CASCADE,
  client_id                UUID        NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  record_type              TEXT        NOT NULL,   -- 'page_view' or 'session'
  record_id                UUID        NOT NULL,   -- FK to the analytics row

  -- Previous state (before mutation)
  previous_is_excluded     BOOLEAN     NULL,
  previous_exclude_reason  TEXT        NULL,
  previous_traffic_class   TEXT        NULL,
  previous_traffic_flags   JSONB       NULL,
  previous_exclusion_policy TEXT       NULL,
  previous_audit_version   TEXT        NULL,
  previous_evaluated_at    TIMESTAMPTZ NULL,

  -- New state (after mutation)
  new_is_excluded          BOOLEAN     NOT NULL,
  new_exclude_reason       TEXT        NULL,
  new_traffic_class        TEXT        NOT NULL,
  new_traffic_flags        JSONB       NOT NULL DEFAULT '[]'::jsonb,
  new_exclusion_policy     TEXT        NULL,
  new_audit_version        TEXT        NOT NULL,
  new_evaluated_at         TIMESTAMPTZ NOT NULL,

  created_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. RLS: admin-only
ALTER TABLE public.traffic_classification_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage classification history"
  ON public.traffic_classification_history
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 3. Indexes for classification history
CREATE INDEX IF NOT EXISTS idx_cls_history_run
  ON public.traffic_classification_history (audit_run_id);

CREATE INDEX IF NOT EXISTS idx_cls_history_record
  ON public.traffic_classification_history (record_type, record_id);

CREATE INDEX IF NOT EXISTS idx_cls_history_client
  ON public.traffic_classification_history (client_id, created_at DESC);

-- 4. Extend traffic_audit_runs with rollback statuses and actor identity
--    Existing CHECK constraint must be updated to include new statuses.
ALTER TABLE public.traffic_audit_runs
  DROP CONSTRAINT IF EXISTS chk_run_status;

ALTER TABLE public.traffic_audit_runs
  ADD CONSTRAINT chk_run_status
  CHECK (status IN (
    'pending', 'running', 'completed', 'failed', 'cancelled',
    'rolled_back', 'rollback_partial', 'rollback_failed'
  ));

-- Add server-validated user identity columns
ALTER TABLE public.traffic_audit_runs
  ADD COLUMN IF NOT EXISTS created_by_user_id UUID NULL;

-- 5. Fix actor identity on traffic_rule_audit_log
ALTER TABLE public.traffic_rule_audit_log
  ADD COLUMN IF NOT EXISTS changed_by_user_id UUID NULL;
