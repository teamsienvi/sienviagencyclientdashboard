-- Create function to update timestamps if it doesn't exist
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create table for storing Meta OAuth connected accounts
CREATE TABLE public.social_oauth_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('facebook', 'instagram')),
  meta_user_id TEXT NOT NULL,
  page_id TEXT,
  instagram_business_id TEXT,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  token_expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  connected_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes for efficient querying
CREATE INDEX idx_social_oauth_accounts_client_id ON public.social_oauth_accounts(client_id);
CREATE INDEX idx_social_oauth_accounts_platform ON public.social_oauth_accounts(platform);
CREATE INDEX idx_social_oauth_accounts_client_platform ON public.social_oauth_accounts(client_id, platform);

-- Enable Row Level Security
ALTER TABLE public.social_oauth_accounts ENABLE ROW LEVEL SECURITY;

-- RLS policies - admins can manage, service can insert/update
CREATE POLICY "Admins can manage OAuth accounts"
  ON public.social_oauth_accounts
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service can insert OAuth accounts"
  ON public.social_oauth_accounts
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Service can update OAuth accounts"
  ON public.social_oauth_accounts
  FOR UPDATE
  USING (true);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_social_oauth_accounts_updated_at
  BEFORE UPDATE ON public.social_oauth_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();