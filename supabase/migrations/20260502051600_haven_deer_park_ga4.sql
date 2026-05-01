-- Add GA4 Property ID for The Haven At Deer Park

INSERT INTO public.client_ga4_config (client_id, ga4_property_id, website_url, is_active)
VALUES ('b6c39651-9259-4930-af6e-b744a5a191ad', '535561041', 'https://thehavenatdeerpark.com', true)
ON CONFLICT (client_id) DO UPDATE SET 
  ga4_property_id = EXCLUDED.ga4_property_id,
  website_url = EXCLUDED.website_url;
