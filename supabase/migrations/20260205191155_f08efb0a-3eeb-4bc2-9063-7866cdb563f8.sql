-- Create meta_ads_daily table for caching Meta Ads data
CREATE TABLE public.meta_ads_daily (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  date_start date NOT NULL,
  level text NOT NULL DEFAULT 'campaign',
  campaign_id text,
  campaign_name text,
  adset_id text,
  adset_name text,
  ad_id text,
  ad_name text,
  objective text,
  spend numeric NOT NULL DEFAULT 0,
  impressions integer NOT NULL DEFAULT 0,
  reach integer NOT NULL DEFAULT 0,
  link_clicks integer NOT NULL DEFAULT 0,
  unique_clicks integer,
  ctr numeric DEFAULT 0,
  cpc numeric DEFAULT 0,
  cpm numeric DEFAULT 0,
  purchases integer DEFAULT 0,
  revenue numeric DEFAULT 0,
  roas numeric DEFAULT 0,
  breakdowns jsonb,
  raw_actions jsonb,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(client_id, date_start, level, campaign_id, adset_id, ad_id, breakdowns)
);

-- Add index for efficient queries
CREATE INDEX idx_meta_ads_daily_client_date ON public.meta_ads_daily(client_id, date_start);
CREATE INDEX idx_meta_ads_daily_level ON public.meta_ads_daily(level);

-- Enable RLS
ALTER TABLE public.meta_ads_daily ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admins can manage meta ads daily"
ON public.meta_ads_daily
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Client users can view their meta ads data"
ON public.meta_ads_daily
FOR SELECT
USING (user_has_client_access(auth.uid(), client_id));

CREATE POLICY "Public can view meta ads for active clients"
ON public.meta_ads_daily
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM clients c
  WHERE c.id = meta_ads_daily.client_id AND c.is_active = true
));

CREATE POLICY "Service can insert meta ads daily"
ON public.meta_ads_daily
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Service can update meta ads daily"
ON public.meta_ads_daily
FOR UPDATE
USING (true);

CREATE POLICY "Service can delete meta ads daily"
ON public.meta_ads_daily
FOR DELETE
USING (true);