-- Add followers column to client_metricool_config for manual entry
-- (Metricool API doesn't provide TikTok follower counts)
ALTER TABLE public.client_metricool_config 
ADD COLUMN IF NOT EXISTS followers integer DEFAULT NULL;