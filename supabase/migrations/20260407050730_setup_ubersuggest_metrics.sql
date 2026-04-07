-- Create config table to map Sienvi clients to Ubersuggest domains
CREATE TABLE public.client_seo_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  domain TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Safely allow dashboard to read configs
ALTER TABLE public.client_seo_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view seo config" ON public.client_seo_config FOR SELECT USING (true);
CREATE POLICY "Admins can manage seo config" ON public.client_seo_config FOR ALL USING (true);

-- Create table to store raw API metrics fetched by edge function
CREATE TABLE public.report_seo_metrics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  site_audit_score INTEGER,
  site_audit_issues JSONB,
  tracked_keywords JSONB,
  collected_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Safely allow dashboard to read metrics
ALTER TABLE public.report_seo_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view seo metrics" ON public.report_seo_metrics FOR SELECT USING (true);
CREATE POLICY "Edge Function can insert metrics" ON public.report_seo_metrics FOR ALL USING (true);
