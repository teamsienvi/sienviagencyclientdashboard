-- Add parent_page_id column for Instagram assets to reference their parent Facebook page
ALTER TABLE public.meta_assets ADD COLUMN IF NOT EXISTS parent_page_id text;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_meta_assets_parent_page_id ON public.meta_assets(parent_page_id);

-- Drop the unique constraint (not just the index)
ALTER TABLE public.meta_assets DROP CONSTRAINT IF EXISTS unique_page_id;

-- Create proper unique constraints - partial indexes for each platform type
CREATE UNIQUE INDEX IF NOT EXISTS unique_meta_fb_page_id 
ON public.meta_assets(page_id) 
WHERE platform = 'facebook' AND page_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS unique_meta_ig_business_id 
ON public.meta_assets(ig_business_id) 
WHERE platform = 'instagram' AND ig_business_id IS NOT NULL;