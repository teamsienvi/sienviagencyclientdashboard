-- Public read access for remaining analytics-related tables

-- Ensure RLS is enabled on clients (already enabled, safe to re-run)
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

-- Update clients table to allow public read for active clients (already exists, but verify)
DROP POLICY IF EXISTS "Anyone can view active clients" ON public.clients;
CREATE POLICY "Anyone can view active clients"
ON public.clients
FOR SELECT
TO anon, authenticated
USING (is_active = true);

-- Ensure client_metricool_config is publicly readable
ALTER TABLE public.client_metricool_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can view metricool configs" ON public.client_metricool_config;
CREATE POLICY "Public can view metricool configs for active clients"
ON public.client_metricool_config
FOR SELECT
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.clients c
    WHERE c.id = client_metricool_config.client_id
      AND c.is_active = true
  )
);

-- Ensure social_accounts is publicly readable for active clients
ALTER TABLE public.social_accounts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can view social accounts" ON public.social_accounts;
CREATE POLICY "Public can view social accounts for active clients"
ON public.social_accounts
FOR SELECT
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.clients c
    WHERE c.id = social_accounts.client_id
      AND c.is_active = true
  )
);

-- Ensure social_oauth_accounts is publicly readable for active clients
ALTER TABLE public.social_oauth_accounts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public can view oauth accounts for active clients" ON public.social_oauth_accounts;
CREATE POLICY "Public can view oauth accounts for active clients"
ON public.social_oauth_accounts
FOR SELECT
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.clients c
    WHERE c.id = social_oauth_accounts.client_id
      AND c.is_active = true
  )
);

-- Ensure platform_data is publicly readable for active clients (via reports -> client)
ALTER TABLE public.platform_data ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public can view platform data for active clients" ON public.platform_data;
CREATE POLICY "Public can view platform data for active clients"
ON public.platform_data
FOR SELECT
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.reports r
    JOIN public.clients c ON c.id = r.client_id
    WHERE r.id = platform_data.report_id
      AND c.is_active = true
  )
);

-- Ensure platform_content is publicly readable for active clients (via platform_data -> reports -> client)
ALTER TABLE public.platform_content ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public can view platform content for active clients" ON public.platform_content;
CREATE POLICY "Public can view platform content for active clients"
ON public.platform_content
FOR SELECT
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.platform_data pd
    JOIN public.reports r ON r.id = pd.report_id
    JOIN public.clients c ON c.id = r.client_id
    WHERE pd.id = platform_content.platform_data_id
      AND c.is_active = true
  )
);

-- Ensure reports is publicly readable for active clients
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public can view reports for active clients" ON public.reports;
CREATE POLICY "Public can view reports for active clients"
ON public.reports
FOR SELECT
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.clients c
    WHERE c.id = reports.client_id
      AND c.is_active = true
  )
);

-- Ensure social_sync_logs is publicly readable for active clients
ALTER TABLE public.social_sync_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public can view sync logs for active clients" ON public.social_sync_logs;
CREATE POLICY "Public can view sync logs for active clients"
ON public.social_sync_logs
FOR SELECT
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.clients c
    WHERE c.id = social_sync_logs.client_id
      AND c.is_active = true
  )
);