-- Create enum for platform types
CREATE TYPE platform_type AS ENUM ('instagram', 'facebook', 'tiktok', 'x', 'linkedin', 'youtube');

-- Create enum for content types
CREATE TYPE social_content_type AS ENUM ('post', 'reel', 'video', 'short', 'tweet', 'story', 'carousel');

-- Feature flag table for analytics source
CREATE TABLE IF NOT EXISTS feature_flags (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  flag_name TEXT NOT NULL UNIQUE,
  flag_value TEXT NOT NULL DEFAULT 'csv',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Insert default feature flag
INSERT INTO feature_flags (flag_name, flag_value) VALUES ('analytics_source', 'csv');

-- Social accounts table for storing platform connections
CREATE TABLE IF NOT EXISTS social_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  platform platform_type NOT NULL,
  account_id TEXT NOT NULL,
  account_name TEXT,
  access_token_encrypted TEXT,
  refresh_token_encrypted TEXT,
  token_expires_at TIMESTAMP WITH TIME ZONE,
  connected_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(client_id, platform, account_id)
);

-- Social content table for storing individual posts/content
CREATE TABLE IF NOT EXISTS social_content (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  social_account_id UUID REFERENCES social_accounts(id) ON DELETE SET NULL,
  platform platform_type NOT NULL,
  content_id TEXT NOT NULL,
  content_type social_content_type NOT NULL DEFAULT 'post',
  published_at TIMESTAMP WITH TIME ZONE NOT NULL,
  url TEXT,
  title TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(client_id, platform, content_id)
);

-- Social content metrics table for storing metrics snapshots
CREATE TABLE IF NOT EXISTS social_content_metrics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  social_content_id UUID NOT NULL REFERENCES social_content(id) ON DELETE CASCADE,
  platform platform_type NOT NULL,
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
  watch_time_hours NUMERIC DEFAULT 0,
  subscribers INTEGER DEFAULT 0,
  click_through_rate NUMERIC DEFAULT 0,
  collected_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Social account metrics table for storing account-level metrics
CREATE TABLE IF NOT EXISTS social_account_metrics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  social_account_id UUID REFERENCES social_accounts(id) ON DELETE SET NULL,
  platform platform_type NOT NULL,
  followers INTEGER DEFAULT 0,
  new_followers INTEGER DEFAULT 0,
  engagement_rate NUMERIC DEFAULT 0,
  total_content INTEGER DEFAULT 0,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  collected_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Sync log table for tracking API sync status
CREATE TABLE IF NOT EXISTS social_sync_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  platform platform_type NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  error_message TEXT,
  records_synced INTEGER DEFAULT 0,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX idx_social_accounts_client_id ON social_accounts(client_id);
CREATE INDEX idx_social_accounts_platform ON social_accounts(platform);
CREATE INDEX idx_social_content_client_id ON social_content(client_id);
CREATE INDEX idx_social_content_platform ON social_content(platform);
CREATE INDEX idx_social_content_published_at ON social_content(published_at);
CREATE INDEX idx_social_content_metrics_content_id ON social_content_metrics(social_content_id);
CREATE INDEX idx_social_content_metrics_period ON social_content_metrics(period_start, period_end);
CREATE INDEX idx_social_account_metrics_client_id ON social_account_metrics(client_id);
CREATE INDEX idx_social_account_metrics_platform ON social_account_metrics(platform);
CREATE INDEX idx_social_account_metrics_period ON social_account_metrics(period_start, period_end);
CREATE INDEX idx_social_sync_logs_client_id ON social_sync_logs(client_id);

-- Enable RLS on all new tables
ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_content_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_account_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_sync_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for feature_flags (public read, admin write)
CREATE POLICY "Anyone can view feature flags" ON feature_flags FOR SELECT USING (true);
CREATE POLICY "Admins can manage feature flags" ON feature_flags FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for social_accounts (admin only for tokens)
CREATE POLICY "Admins can manage social accounts" ON social_accounts FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Anyone can view social accounts" ON social_accounts FOR SELECT USING (true);

-- RLS Policies for social_content (public read, admin write)
CREATE POLICY "Anyone can view social content" ON social_content FOR SELECT USING (true);
CREATE POLICY "Admins can manage social content" ON social_content FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Service can insert social content" ON social_content FOR INSERT WITH CHECK (true);

-- RLS Policies for social_content_metrics (public read, admin write)
CREATE POLICY "Anyone can view social content metrics" ON social_content_metrics FOR SELECT USING (true);
CREATE POLICY "Admins can manage social content metrics" ON social_content_metrics FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Service can insert social content metrics" ON social_content_metrics FOR INSERT WITH CHECK (true);

-- RLS Policies for social_account_metrics (public read, admin write)
CREATE POLICY "Anyone can view social account metrics" ON social_account_metrics FOR SELECT USING (true);
CREATE POLICY "Admins can manage social account metrics" ON social_account_metrics FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Service can insert social account metrics" ON social_account_metrics FOR INSERT WITH CHECK (true);

-- RLS Policies for social_sync_logs (admin only)
CREATE POLICY "Admins can view sync logs" ON social_sync_logs FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can manage sync logs" ON social_sync_logs FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Service can insert sync logs" ON social_sync_logs FOR INSERT WITH CHECK (true);
CREATE POLICY "Service can update sync logs" ON social_sync_logs FOR UPDATE USING (true);