-- 1. Enums
CREATE TYPE sync_status_enum AS ENUM ('ready', 'syncing', 'failed');
CREATE TYPE amazon_ads_status_enum AS ENUM ('pending', 'complete', 'failed');

-- 2. Sync State Registry Table
CREATE TABLE sync_state_registry (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    platform TEXT NOT NULL,
    module TEXT NOT NULL,
    status sync_status_enum DEFAULT 'ready',
    last_synced_at TIMESTAMPTZ,
    last_success_at TIMESTAMPTZ,
    stale_after_at TIMESTAMPTZ,
    job_locked_until TIMESTAMPTZ,
    retry_count INTEGER DEFAULT 0,
    last_failed_at TIMESTAMPTZ,
    next_retry_at TIMESTAMPTZ,
    error_message TEXT,
    UNIQUE(client_id, platform, module)
);

CREATE INDEX idx_sync_state_lookup ON sync_state_registry(client_id, platform, module);
CREATE INDEX idx_sync_state_cron ON sync_state_registry(stale_after_at, status, job_locked_until);

-- 3. Derived State View
CREATE VIEW sync_state_view AS
SELECT 
    *,
    CASE 
        WHEN status = 'failed' AND (last_success_at IS NOT NULL) THEN 'degraded'
        WHEN stale_after_at < (NOW() - INTERVAL '3 days') THEN 'overdue' -- Example threshold for overdue
        WHEN stale_after_at < NOW() THEN 'stale'
        WHEN status = 'failed' AND last_success_at IS NULL THEN 'empty_failed'
        WHEN status = 'syncing' AND last_success_at IS NULL THEN 'syncing_fresh'
        WHEN status = 'syncing' AND last_success_at IS NOT NULL THEN 'syncing_stale'
        ELSE 'ready'
    END AS derived_status
FROM sync_state_registry;

-- 4. Amazon Ads Reports Table
CREATE TABLE amazon_ads_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    report_period TEXT NOT NULL,
    source_file_name TEXT,
    source_file_hash TEXT,
    parsed_data JSONB,
    generated_report TEXT,
    generation_status amazon_ads_status_enum DEFAULT 'pending',
    generated_at TIMESTAMPTZ,
    UNIQUE(client_id, report_period)
);
