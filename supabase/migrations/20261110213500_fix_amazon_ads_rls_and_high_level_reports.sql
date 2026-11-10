-- Ensure all dashboard users (anon and authenticated team members) can read Amazon Ads & Ads summaries
-- and all authenticated team members can manage them without getting stuck on RLS filters.

DROP POLICY IF EXISTS "Users can view their client amazon_ads_reports" ON public.amazon_ads_reports;
CREATE POLICY "Users can view their client amazon_ads_reports"
  ON public.amazon_ads_reports
  FOR SELECT
  TO anon, authenticated
  USING ((SELECT auth.role()) IN ('anon', 'authenticated', 'service_role'));

DROP POLICY IF EXISTS "Users can manage their client amazon_ads_reports" ON public.amazon_ads_reports;
CREATE POLICY "Users can manage their client amazon_ads_reports"
  ON public.amazon_ads_reports
  FOR ALL
  TO authenticated
  USING ((SELECT auth.role()) IN ('authenticated', 'service_role'))
  WITH CHECK ((SELECT auth.role()) IN ('authenticated', 'service_role'));

DROP POLICY IF EXISTS "Users can view their client ads_analytics_summaries" ON public.ads_analytics_summaries;
CREATE POLICY "Users can view their client ads_analytics_summaries"
  ON public.ads_analytics_summaries
  FOR SELECT
  TO anon, authenticated
  USING ((SELECT auth.role()) IN ('anon', 'authenticated', 'service_role'));

DROP POLICY IF EXISTS "Users can manage their client ads_analytics_summaries" ON public.ads_analytics_summaries;
CREATE POLICY "Users can manage their client ads_analytics_summaries"
  ON public.ads_analytics_summaries
  FOR ALL
  TO authenticated
  USING ((SELECT auth.role()) IN ('authenticated', 'service_role'))
  WITH CHECK ((SELECT auth.role()) IN ('authenticated', 'service_role'));
