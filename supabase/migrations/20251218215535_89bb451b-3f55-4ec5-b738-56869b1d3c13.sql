-- Add url column to platform_content table for storing video/post links
ALTER TABLE public.platform_content 
ADD COLUMN IF NOT EXISTS url TEXT;

-- Add title column for video titles
ALTER TABLE public.platform_content 
ADD COLUMN IF NOT EXISTS title TEXT;