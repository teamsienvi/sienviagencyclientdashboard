-- Create clients table
CREATE TABLE public.clients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  logo_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create reports table
CREATE TABLE public.reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  date_range TEXT NOT NULL,
  week_start DATE NOT NULL,
  week_end DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create top_performing_posts table
CREATE TABLE public.top_performing_posts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  report_id UUID NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  link TEXT NOT NULL,
  views INTEGER NOT NULL DEFAULT 0,
  engagement_percent DECIMAL(5,2) NOT NULL DEFAULT 0,
  platform TEXT NOT NULL,
  followers INTEGER NOT NULL DEFAULT 0,
  reach_tier TEXT,
  engagement_tier TEXT,
  influence INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create platform_data table
CREATE TABLE public.platform_data (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  report_id UUID NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  followers INTEGER NOT NULL DEFAULT 0,
  new_followers INTEGER DEFAULT 0,
  engagement_rate DECIMAL(5,2) DEFAULT 0,
  last_week_engagement_rate DECIMAL(5,2) DEFAULT 0,
  total_content INTEGER DEFAULT 0,
  last_week_total_content INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create platform_content table for individual posts
CREATE TABLE public.platform_content (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  platform_data_id UUID NOT NULL REFERENCES public.platform_data(id) ON DELETE CASCADE,
  content_type TEXT NOT NULL,
  post_date DATE NOT NULL,
  reach INTEGER DEFAULT 0,
  views INTEGER DEFAULT 0,
  likes INTEGER DEFAULT 0,
  comments INTEGER DEFAULT 0,
  shares INTEGER DEFAULT 0,
  interactions INTEGER DEFAULT 0,
  impressions INTEGER DEFAULT 0,
  engagements INTEGER DEFAULT 0,
  profile_visits INTEGER DEFAULT 0,
  link_clicks INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables (public read for dashboard)
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.top_performing_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_content ENABLE ROW LEVEL SECURITY;

-- Create public read policies (this is a client dashboard, data should be viewable)
CREATE POLICY "Anyone can view clients" ON public.clients FOR SELECT USING (true);
CREATE POLICY "Anyone can view reports" ON public.reports FOR SELECT USING (true);
CREATE POLICY "Anyone can view top posts" ON public.top_performing_posts FOR SELECT USING (true);
CREATE POLICY "Anyone can view platform data" ON public.platform_data FOR SELECT USING (true);
CREATE POLICY "Anyone can view platform content" ON public.platform_content FOR SELECT USING (true);

-- Create insert policies (for CSV import - public for now, can be restricted later with auth)
CREATE POLICY "Anyone can insert clients" ON public.clients FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can insert reports" ON public.reports FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can insert top posts" ON public.top_performing_posts FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can insert platform data" ON public.platform_data FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can insert platform content" ON public.platform_content FOR INSERT WITH CHECK (true);

-- Create update policies
CREATE POLICY "Anyone can update clients" ON public.clients FOR UPDATE USING (true);
CREATE POLICY "Anyone can update reports" ON public.reports FOR UPDATE USING (true);