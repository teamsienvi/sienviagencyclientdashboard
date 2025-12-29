-- Table for tracking page views
CREATE TABLE public.web_analytics_page_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  visitor_id TEXT NOT NULL,
  session_id TEXT,
  page_url TEXT NOT NULL,
  page_title TEXT,
  referrer TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  user_agent TEXT,
  device_type TEXT,
  viewed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table for tracking sessions
CREATE TABLE public.web_analytics_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  visitor_id TEXT NOT NULL,
  session_id TEXT NOT NULL UNIQUE,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ended_at TIMESTAMP WITH TIME ZONE,
  page_count INTEGER DEFAULT 1,
  referrer TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  user_agent TEXT,
  device_type TEXT,
  bounce BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Indexes for efficient queries
CREATE INDEX idx_web_page_views_client_date ON public.web_analytics_page_views(client_id, viewed_at);
CREATE INDEX idx_web_page_views_session ON public.web_analytics_page_views(session_id);
CREATE INDEX idx_web_sessions_client_date ON public.web_analytics_sessions(client_id, started_at);
CREATE INDEX idx_web_sessions_visitor ON public.web_analytics_sessions(visitor_id);

-- Enable RLS
ALTER TABLE public.web_analytics_page_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.web_analytics_sessions ENABLE ROW LEVEL SECURITY;

-- RLS policies for page views
CREATE POLICY "Allow public insert for tracking" ON public.web_analytics_page_views 
FOR INSERT WITH CHECK (true);

CREATE POLICY "Admins can view page views" ON public.web_analytics_page_views 
FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Anyone can view page views for active clients" ON public.web_analytics_page_views 
FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.clients WHERE id = client_id AND is_active = true)
);

-- RLS policies for sessions
CREATE POLICY "Allow public insert for sessions" ON public.web_analytics_sessions 
FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update for sessions" ON public.web_analytics_sessions 
FOR UPDATE USING (true);

CREATE POLICY "Admins can view sessions" ON public.web_analytics_sessions 
FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Anyone can view sessions for active clients" ON public.web_analytics_sessions 
FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.clients WHERE id = client_id AND is_active = true)
);