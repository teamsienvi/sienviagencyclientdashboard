-- Migration to create the 'Secure and Style' client (Amazon Ads only)

DO $$
DECLARE
  new_client_id UUID := gen_random_uuid();
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.clients WHERE LOWER(name) = 'secure and style') THEN
    INSERT INTO public.clients (id, name, is_active, created_at, updated_at)
    VALUES (new_client_id, 'Secure and Style', true, now(), now());
  ELSE
    UPDATE public.clients
    SET is_active = true, updated_at = now()
    WHERE LOWER(name) = 'secure and style';
  END IF;
END $$;

