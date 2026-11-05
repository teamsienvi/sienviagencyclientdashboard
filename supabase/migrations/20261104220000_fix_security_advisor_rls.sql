-- ==============================================================================
-- Migration: 20261104220000_fix_security_advisor_rls.sql
-- Description: Enable RLS and configure policies on all remaining public tables,
--              set security_invoker on public views, and lock function search_paths.
-- ==============================================================================

-- 1. ads_analytics_summaries
ALTER TABLE public.ads_analytics_summaries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access ads_analytics_summaries" ON public.ads_analytics_summaries;
CREATE POLICY "Service role full access ads_analytics_summaries"
  ON public.ads_analytics_summaries
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users can view their client ads_analytics_summaries" ON public.ads_analytics_summaries;
CREATE POLICY "Users can view their client ads_analytics_summaries"
  ON public.ads_analytics_summaries
  FOR SELECT
  TO authenticated
  USING (public.user_has_client_access(auth.uid(), client_id));

DROP POLICY IF EXISTS "Users can manage their client ads_analytics_summaries" ON public.ads_analytics_summaries;
CREATE POLICY "Users can manage their client ads_analytics_summaries"
  ON public.ads_analytics_summaries
  FOR ALL
  TO authenticated
  USING (public.user_has_client_access(auth.uid(), client_id))
  WITH CHECK (public.user_has_client_access(auth.uid(), client_id));

-- 2. amazon_ads_reports
ALTER TABLE public.amazon_ads_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access amazon_ads_reports" ON public.amazon_ads_reports;
CREATE POLICY "Service role full access amazon_ads_reports"
  ON public.amazon_ads_reports
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users can view their client amazon_ads_reports" ON public.amazon_ads_reports;
CREATE POLICY "Users can view their client amazon_ads_reports"
  ON public.amazon_ads_reports
  FOR SELECT
  TO authenticated
  USING (public.user_has_client_access(auth.uid(), client_id));

DROP POLICY IF EXISTS "Users can manage their client amazon_ads_reports" ON public.amazon_ads_reports;
CREATE POLICY "Users can manage their client amazon_ads_reports"
  ON public.amazon_ads_reports
  FOR ALL
  TO authenticated
  USING (public.user_has_client_access(auth.uid(), client_id))
  WITH CHECK (public.user_has_client_access(auth.uid(), client_id));

-- 3. sync_coverage
ALTER TABLE public.sync_coverage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access sync_coverage" ON public.sync_coverage;
CREATE POLICY "Service role full access sync_coverage"
  ON public.sync_coverage
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users can view their client sync_coverage" ON public.sync_coverage;
CREATE POLICY "Users can view their client sync_coverage"
  ON public.sync_coverage
  FOR SELECT
  TO authenticated
  USING (public.user_has_client_access(auth.uid(), client_id));

-- 4. sync_state_registry
ALTER TABLE public.sync_state_registry ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access sync_state_registry" ON public.sync_state_registry;
CREATE POLICY "Service role full access sync_state_registry"
  ON public.sync_state_registry
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users can view their client sync_state_registry" ON public.sync_state_registry;
CREATE POLICY "Users can view their client sync_state_registry"
  ON public.sync_state_registry
  FOR SELECT
  TO authenticated
  USING (public.user_has_client_access(auth.uid(), client_id));

-- 5. client_aliases
ALTER TABLE public.client_aliases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access client_aliases" ON public.client_aliases;
CREATE POLICY "Service role full access client_aliases"
  ON public.client_aliases
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can view client_aliases" ON public.client_aliases;
CREATE POLICY "Authenticated users can view client_aliases"
  ON public.client_aliases
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Admins can manage client_aliases" ON public.client_aliases;
CREATE POLICY "Admins can manage client_aliases"
  ON public.client_aliases
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- 6. client_consolidation_manifest
ALTER TABLE public.client_consolidation_manifest ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access client_consolidation_manifest" ON public.client_consolidation_manifest;
CREATE POLICY "Service role full access client_consolidation_manifest"
  ON public.client_consolidation_manifest
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can view client_consolidation_manifest" ON public.client_consolidation_manifest;
CREATE POLICY "Admins can view client_consolidation_manifest"
  ON public.client_consolidation_manifest
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- 7. Views: Switch from SECURITY DEFINER to SECURITY INVOKER
ALTER VIEW public.sync_state_view SET (security_invoker = on);
ALTER VIEW public.client_ubersuggest_config SET (security_invoker = on);

-- 8. Functions: Lock mutable search_path
ALTER FUNCTION public.handle_updated_at() SET search_path = public;
ALTER FUNCTION public.exec_sql(text) SET search_path = public;
ALTER FUNCTION public.current_user_organization_id() SET search_path = public;
ALTER FUNCTION public.get_cron_jobs() SET search_path = public;

