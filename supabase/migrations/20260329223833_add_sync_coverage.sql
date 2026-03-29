-- Expanded sync coverage: distinguishes feed, reels, summary, and metrics coverage per day
CREATE TABLE IF NOT EXISTS sync_coverage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id),
  platform TEXT NOT NULL,
  day DATE NOT NULL,
  feed_synced BOOLEAN DEFAULT false,
  reels_synced BOOLEAN DEFAULT false,
  summary_synced BOOLEAN DEFAULT false,
  metrics_synced BOOLEAN DEFAULT false,
  feed_synced_at TIMESTAMPTZ,
  reels_synced_at TIMESTAMPTZ,
  summary_synced_at TIMESTAMPTZ,
  metrics_synced_at TIMESTAMPTZ,
  feed_rows INTEGER DEFAULT 0,
  reels_rows INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending',
  is_partial BOOLEAN DEFAULT false,
  UNIQUE(client_id, platform, day)
);

CREATE INDEX idx_sync_coverage_lookup ON sync_coverage(client_id, platform, day);

COMMENT ON TABLE sync_coverage IS 'Per-day sync freshness tracker for auto-hydration. UI queries this to decide whether to sync or render cached data.';
