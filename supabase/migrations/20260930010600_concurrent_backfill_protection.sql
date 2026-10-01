-- ============================================================
-- Traffic Classification v2.2: Concurrent Backfill Protection
-- ============================================================
-- Adds:
--   1. Partial unique index preventing concurrent active backfills
--      per client_id (only non-dry-run runs in 'pending'/'running' state)
--
-- Mechanism:
--   CREATE UNIQUE INDEX ... WHERE dry_run = false AND status IN (...)
--
-- This is PostgreSQL-enforced: two concurrent INSERT/UPDATE operations
-- that would both set a non-dry-run run to 'pending' or 'running'
-- for the same client_id will conflict at the index level.
--
-- Dry-runs are excluded because they do not mutate analytics state.
-- ============================================================

-- Partial unique index: at most one active non-dry-run backfill per client
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_active_backfill_per_client
  ON public.traffic_audit_runs (client_id)
  WHERE dry_run = false AND status IN ('pending', 'running');
