-- Create table to store Shopify OAuth connections
CREATE TABLE public.shopify_oauth_connections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  shop_domain TEXT NOT NULL,
  access_token TEXT NOT NULL,
  scope TEXT,
  connected_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  is_active BOOLEAN NOT NULL DEFAULT true,
  UNIQUE(client_id)
);

-- Enable RLS
ALTER TABLE public.shopify_oauth_connections ENABLE ROW LEVEL SECURITY;

-- Admin-only policies
CREATE POLICY "Admins can view all shopify connections"
ON public.shopify_oauth_connections
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert shopify connections"
ON public.shopify_oauth_connections
FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update shopify connections"
ON public.shopify_oauth_connections
FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete shopify connections"
ON public.shopify_oauth_connections
FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));

-- Trigger for updated_at
CREATE TRIGGER update_shopify_oauth_connections_updated_at
BEFORE UPDATE ON public.shopify_oauth_connections
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();