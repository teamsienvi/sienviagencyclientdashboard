
-- Add nullable country column to web_analytics_page_views
ALTER TABLE public.web_analytics_page_views
ADD COLUMN country TEXT NULL;

-- Add nullable country column to web_analytics_sessions
ALTER TABLE public.web_analytics_sessions
ADD COLUMN country TEXT NULL;

-- Index for country breakdown queries on page_views
CREATE INDEX idx_web_analytics_page_views_client_viewed_country
ON public.web_analytics_page_views (client_id, viewed_at, country);

-- Index for country breakdown queries on sessions
CREATE INDEX idx_web_analytics_sessions_client_started_country
ON public.web_analytics_sessions (client_id, started_at, country);
