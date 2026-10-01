-- ============================================================
-- Traffic Audit & Geo-fence: exclusion flags + per-client rules
-- ============================================================

-- 1. Add exclusion columns to both analytics tables
ALTER TABLE public.web_analytics_page_views
  ADD COLUMN IF NOT EXISTS is_excluded   BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS exclude_reason TEXT    NULL;

ALTER TABLE public.web_analytics_sessions
  ADD COLUMN IF NOT EXISTS is_excluded   BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS exclude_reason TEXT    NULL;

-- Indexes for fast filtered queries (most dashboard queries will add WHERE is_excluded = false)
CREATE INDEX IF NOT EXISTS idx_pv_excluded
  ON public.web_analytics_page_views (client_id, viewed_at)
  WHERE is_excluded = false;

CREATE INDEX IF NOT EXISTS idx_sess_excluded
  ON public.web_analytics_sessions (client_id, started_at)
  WHERE is_excluded = false;

-- 2. Per-client traffic rules table
CREATE TABLE IF NOT EXISTS public.client_traffic_rules (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id       UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  -- Geo-fence: JSON array of allowed 2-letter country codes, NULL = allow all
  allowed_countries JSONB NULL,
  -- Team / VPN IPs to exclude (CIDR or exact), e.g. ["203.0.113.0/24","198.51.100.5"]
  team_ips          JSONB NULL DEFAULT '[]'::jsonb,
  -- Extra bot UA substrings beyond the built-in list
  custom_bot_patterns JSONB NULL DEFAULT '[]'::jsonb,
  -- Master toggle
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (client_id)
);

-- RLS
ALTER TABLE public.client_traffic_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage traffic rules"
  ON public.client_traffic_rules
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Clients can view own traffic rules"
  ON public.client_traffic_rules
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.id = client_id AND c.is_active = true
    )
  );

-- 3. Add IP column to page_views and sessions for team-IP matching
-- (currently not captured — the track-analytics function will populate it going forward)
ALTER TABLE public.web_analytics_page_views
  ADD COLUMN IF NOT EXISTS ip_address TEXT NULL;

ALTER TABLE public.web_analytics_sessions
  ADD COLUMN IF NOT EXISTS ip_address TEXT NULL;

-- 4. Seed default rules for every active client (US-only geo-fence as starting point)
INSERT INTO public.client_traffic_rules (client_id, allowed_countries)
SELECT id, '["US"]'::jsonb
FROM public.clients
WHERE is_active = true
ON CONFLICT (client_id) DO NOTHING;

-- 5. Helper: partial index on ip_address for team-IP lookups
CREATE INDEX IF NOT EXISTS idx_pv_ip ON public.web_analytics_page_views (ip_address)
  WHERE ip_address IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sess_ip ON public.web_analytics_sessions (ip_address)
  WHERE ip_address IS NOT NULL;
