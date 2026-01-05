-- Create client Metricool configuration table for TikTok, LinkedIn, and other platforms
CREATE TABLE public.client_metricool_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  blog_id TEXT,
  platform TEXT NOT NULL CHECK (platform IN ('tiktok', 'linkedin', 'instagram', 'facebook', 'x', 'youtube')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(client_id, platform)
);

-- Enable RLS
ALTER TABLE public.client_metricool_config ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Admins can manage metricool configs"
ON public.client_metricool_config
FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Anyone can view metricool configs"
ON public.client_metricool_config
FOR SELECT
USING (true);

-- Add trigger for updated_at
CREATE TRIGGER update_client_metricool_config_updated_at
BEFORE UPDATE ON public.client_metricool_config
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();