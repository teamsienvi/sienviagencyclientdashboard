-- Create youtube_assets table to store YouTube channels
CREATE TABLE public.youtube_assets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  channel_id TEXT NOT NULL UNIQUE,
  channel_name TEXT NOT NULL,
  channel_url TEXT,
  thumbnail_url TEXT,
  subscriber_count INTEGER DEFAULT 0,
  video_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  discovered_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.youtube_assets ENABLE ROW LEVEL SECURITY;

-- RLS policies for youtube_assets
CREATE POLICY "Admins can manage youtube assets"
ON public.youtube_assets FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can view youtube assets"
ON public.youtube_assets FOR SELECT
USING (true);

CREATE POLICY "Service can insert youtube assets"
ON public.youtube_assets FOR INSERT
WITH CHECK (true);

CREATE POLICY "Service can update youtube assets"
ON public.youtube_assets FOR UPDATE
USING (true);

-- Create client_youtube_map table to link channels to clients
CREATE TABLE public.client_youtube_map (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  channel_id TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  mapped_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(client_id, channel_id)
);

-- Enable RLS
ALTER TABLE public.client_youtube_map ENABLE ROW LEVEL SECURITY;

-- RLS policies for client_youtube_map
CREATE POLICY "Admins can manage client youtube map"
ON public.client_youtube_map FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can view client youtube map"
ON public.client_youtube_map FOR SELECT
USING (true);

CREATE POLICY "Service can insert client youtube map"
ON public.client_youtube_map FOR INSERT
WITH CHECK (true);

CREATE POLICY "Service can update client youtube map"
ON public.client_youtube_map FOR UPDATE
USING (true);

-- Add trigger for updated_at
CREATE TRIGGER update_client_youtube_map_updated_at
BEFORE UPDATE ON public.client_youtube_map
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();