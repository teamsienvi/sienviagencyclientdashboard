-- LinkedIn should only be configured for Father Figure Formula
-- Remove linkedin from all other clients
DELETE FROM public.client_metricool_config
WHERE platform = 'linkedin'
  AND client_id NOT IN (
    SELECT id FROM public.clients WHERE name = 'Father Figure Formula'
  );
