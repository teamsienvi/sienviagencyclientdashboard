-- Add raw_project_data JSONB column to report_seo_metrics
ALTER TABLE public.report_seo_metrics
ADD COLUMN IF NOT EXISTS raw_project_data JSONB;
