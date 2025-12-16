-- Add YouTube-specific columns to platform_content
ALTER TABLE public.platform_content 
ADD COLUMN IF NOT EXISTS duration TEXT,
ADD COLUMN IF NOT EXISTS played_to_watch_percent NUMERIC,
ADD COLUMN IF NOT EXISTS watch_time_hours NUMERIC,
ADD COLUMN IF NOT EXISTS subscribers INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS click_through_rate NUMERIC;