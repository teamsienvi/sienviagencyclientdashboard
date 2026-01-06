-- Add unique constraint on social_content_metrics for content + period
ALTER TABLE public.social_content_metrics 
ADD CONSTRAINT social_content_metrics_content_period_unique 
UNIQUE (social_content_id, period_start, period_end);

-- Add unique constraint on social_account_metrics for client + platform + period
ALTER TABLE public.social_account_metrics 
ADD CONSTRAINT social_account_metrics_client_platform_period_unique 
UNIQUE (client_id, platform, period_start, period_end);