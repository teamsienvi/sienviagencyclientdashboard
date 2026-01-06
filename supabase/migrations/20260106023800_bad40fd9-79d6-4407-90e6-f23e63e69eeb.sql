-- Add unique constraint on social_content for upsert operations
ALTER TABLE public.social_content 
ADD CONSTRAINT social_content_client_id_content_id_key 
UNIQUE (client_id, content_id);