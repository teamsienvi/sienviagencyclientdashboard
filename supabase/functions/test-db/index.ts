import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  const { data: clients, error: clientsError } = await supabase
    .from('clients')
    .select('id, name, client_ga4_config(ga4_property_id)')
    .order('name');

  return new Response(
    JSON.stringify({
      clients,
      error: clientsError
    }),
    { headers: { "Content-Type": "application/json" } },
  )
})
