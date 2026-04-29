-- Generic GA4 Website Analytics Configuration
-- Stores GA4 property IDs for clients to track web traffic metrics.

CREATE TABLE IF NOT EXISTS public.client_ga4_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  ga4_property_id TEXT NOT NULL,
  website_url TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(client_id)
);

-- Enable RLS
ALTER TABLE public.client_ga4_config ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to view configurations
CREATE POLICY "Users can view ga4 configs" 
ON public.client_ga4_config FOR SELECT 
TO authenticated 
USING (true);

-- Allow authenticated users to modify configurations
CREATE POLICY "Users can manage ga4 configs" 
ON public.client_ga4_config FOR ALL 
TO authenticated 
USING (true);

-- Create a trigger to automatically update the updated_at column
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_client_ga4_config_updated_at ON public.client_ga4_config;
CREATE TRIGGER set_client_ga4_config_updated_at
BEFORE UPDATE ON public.client_ga4_config
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- Insert Snarky Humans Property ID
INSERT INTO public.client_ga4_config (client_id, ga4_property_id, website_url, is_active)
VALUES ('ef580ebf-439f-4305-826a-f1f8aa89fd03', '535114183', 'https://bedd78-a1.myshopify.com', true)
ON CONFLICT (client_id) DO UPDATE SET
  ga4_property_id = EXCLUDED.ga4_property_id,
  website_url = EXCLUDED.website_url,
  is_active = EXCLUDED.is_active;
