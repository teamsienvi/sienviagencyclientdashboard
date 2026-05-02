-- Migration to create the Hwabelle client and map its GA4 property

DO $$ 
DECLARE
  new_client_id UUID := gen_random_uuid();
BEGIN
  -- 1. Insert the new client if it doesn't already exist
  IF NOT EXISTS (SELECT 1 FROM public.clients WHERE name = 'Hwabelle') THEN
    INSERT INTO public.clients (id, name, is_active, created_at, updated_at)
    VALUES (new_client_id, 'Hwabelle', true, now(), now());
  ELSE
    SELECT id INTO new_client_id FROM public.clients WHERE name = 'Hwabelle' LIMIT 1;
  END IF;

  -- 2. Insert the GA4 configuration
  INSERT INTO public.client_ga4_config (client_id, ga4_property_id, website_url, is_active)
  VALUES (new_client_id, '535663094', 'https://hwabelle.com', true)
  ON CONFLICT (client_id) DO UPDATE SET 
    ga4_property_id = EXCLUDED.ga4_property_id,
    website_url = EXCLUDED.website_url;
    
END $$;
