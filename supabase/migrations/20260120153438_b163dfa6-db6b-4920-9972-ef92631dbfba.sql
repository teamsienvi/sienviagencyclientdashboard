-- Create table for social account demographics (gender, country distribution)
CREATE TABLE public.social_account_demographics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  gender_male NUMERIC,
  gender_female NUMERIC,
  gender_unknown NUMERIC,
  countries JSONB,
  collected_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(client_id, platform, period_start, period_end)
);

-- Create table for follower timeline (daily snapshots)
CREATE TABLE public.social_follower_timeline (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  date DATE NOT NULL,
  followers INTEGER NOT NULL,
  collected_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(client_id, platform, date)
);

-- Create indexes for performance
CREATE INDEX idx_social_account_demographics_client_platform ON public.social_account_demographics(client_id, platform);
CREATE INDEX idx_social_follower_timeline_client_platform ON public.social_follower_timeline(client_id, platform);
CREATE INDEX idx_social_follower_timeline_date ON public.social_follower_timeline(date);

-- Enable RLS
ALTER TABLE public.social_account_demographics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_follower_timeline ENABLE ROW LEVEL SECURITY;

-- RLS policies for demographics - service role bypass for edge functions
CREATE POLICY "Users can view demographics for their clients"
ON public.social_account_demographics FOR SELECT
USING (public.user_has_client_access(client_id, auth.uid()));

CREATE POLICY "Service role full access demographics"
ON public.social_account_demographics FOR ALL
USING (auth.role() = 'service_role');

-- RLS policies for follower timeline
CREATE POLICY "Users can view timeline for their clients"
ON public.social_follower_timeline FOR SELECT
USING (public.user_has_client_access(client_id, auth.uid()));

CREATE POLICY "Service role full access timeline"
ON public.social_follower_timeline FOR ALL
USING (auth.role() = 'service_role');