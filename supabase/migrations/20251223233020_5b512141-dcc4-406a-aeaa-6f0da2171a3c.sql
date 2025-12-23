-- Create meta_agency_connection table (single row for agency-level OAuth)
CREATE TABLE public.meta_agency_connection (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meta_user_id text NOT NULL,
  access_token text NOT NULL,
  token_expires_at timestamp with time zone NOT NULL,
  connected_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create meta_assets table (discovered Pages and IG accounts)
CREATE TABLE public.meta_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform text NOT NULL CHECK (platform IN ('facebook', 'instagram')),
  page_id text,
  ig_business_id text,
  name text NOT NULL,
  picture_url text,
  permalink text,
  discovered_at timestamp with time zone NOT NULL DEFAULT now(),
  last_seen_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT unique_page_id UNIQUE (page_id),
  CONSTRAINT unique_ig_business_id UNIQUE (ig_business_id),
  CONSTRAINT check_asset_id CHECK (
    (platform = 'facebook' AND page_id IS NOT NULL) OR
    (platform = 'instagram' AND ig_business_id IS NOT NULL)
  )
);

-- Create client_meta_map table (maps assets to clients)
CREATE TABLE public.client_meta_map (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  page_id text,
  ig_business_id text,
  active boolean NOT NULL DEFAULT true,
  mapped_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT unique_client_page UNIQUE (client_id, page_id),
  CONSTRAINT unique_client_ig UNIQUE (client_id, ig_business_id),
  CONSTRAINT check_map_id CHECK (page_id IS NOT NULL OR ig_business_id IS NOT NULL)
);

-- Create indexes for performance
CREATE INDEX idx_client_meta_map_client_id ON public.client_meta_map(client_id);
CREATE INDEX idx_client_meta_map_page_id ON public.client_meta_map(page_id);
CREATE INDEX idx_client_meta_map_ig_business_id ON public.client_meta_map(ig_business_id);
CREATE INDEX idx_meta_assets_page_id ON public.meta_assets(page_id);
CREATE INDEX idx_meta_assets_ig_business_id ON public.meta_assets(ig_business_id);
CREATE INDEX idx_meta_assets_platform ON public.meta_assets(platform);

-- Enable RLS
ALTER TABLE public.meta_agency_connection ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meta_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_meta_map ENABLE ROW LEVEL SECURITY;

-- RLS policies for meta_agency_connection (admin only)
CREATE POLICY "Admins can manage agency connection"
ON public.meta_agency_connection FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service can manage agency connection"
ON public.meta_agency_connection FOR ALL
USING (true)
WITH CHECK (true);

-- RLS policies for meta_assets (admin can view/manage, service can write)
CREATE POLICY "Admins can view meta assets"
ON public.meta_assets FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage meta assets"
ON public.meta_assets FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service can insert meta assets"
ON public.meta_assets FOR INSERT
WITH CHECK (true);

CREATE POLICY "Service can update meta assets"
ON public.meta_assets FOR UPDATE
USING (true);

-- RLS policies for client_meta_map (admin can manage)
CREATE POLICY "Admins can manage client meta map"
ON public.client_meta_map FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service can insert client meta map"
ON public.client_meta_map FOR INSERT
WITH CHECK (true);

CREATE POLICY "Service can update client meta map"
ON public.client_meta_map FOR UPDATE
USING (true);

CREATE POLICY "Anyone can view client meta map"
ON public.client_meta_map FOR SELECT
USING (true);

-- Add trigger for updated_at on meta_agency_connection
CREATE TRIGGER update_meta_agency_connection_updated_at
BEFORE UPDATE ON public.meta_agency_connection
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add trigger for updated_at on client_meta_map
CREATE TRIGGER update_client_meta_map_updated_at
BEFORE UPDATE ON public.client_meta_map
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();