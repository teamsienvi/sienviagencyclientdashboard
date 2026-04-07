-- Substack GA4 Analytics Configuration
-- Stores GA4 property IDs for Substack publications so the edge function
-- can query the Google Analytics Data API for each client's newsletter.

CREATE TABLE IF NOT EXISTS client_substack_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  ga4_property_id TEXT NOT NULL,
  substack_url TEXT,
  publication_name TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(client_id)
);

-- Indexes
CREATE INDEX idx_substack_config_client ON client_substack_config(client_id);

-- RLS
ALTER TABLE client_substack_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view substack config" ON client_substack_config FOR SELECT USING (true);
CREATE POLICY "Admins can manage substack config" ON client_substack_config FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Seed the 4 Substack publications
INSERT INTO client_substack_config (client_id, ga4_property_id, substack_url, publication_name, is_active)
VALUES
  ('041555a7-1a25-42b8-89c7-edc40afff861', '531743785', 'https://serenityscrolls.substack.com', 'Serenity Scrolls', true),
  ('95791e88-87cd-4621-af7e-df46f5ad93ac', '531752272', 'https://fatherfigureformula.substack.com', 'Father Figure Formula', true),
  ('d8f38e01-77ff-4839-ac48-54795adc9f3e', '531747724', 'https://sienviagency.substack.com', 'Sienvi Agency', true),
  ('1a1edf9f-2ebe-4d40-a904-7295d5033401', '531757124', 'https://oxisuretech.substack.com', 'OxiSure Tech', true)
ON CONFLICT (client_id) DO UPDATE SET
  ga4_property_id = EXCLUDED.ga4_property_id,
  substack_url = EXCLUDED.substack_url,
  publication_name = EXCLUDED.publication_name,
  is_active = EXCLUDED.is_active;
