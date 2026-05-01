import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  // ID for The Haven At Deer Park
  const clientId = "b6c39651-9259-4930-af6e-b744a5a191ad";
  
  const { data, error } = await supabase
    .from('client_ga4_config')
    .upsert({
      client_id: clientId,
      ga4_property_id: '535561041',
      website_url: 'https://thehavenatdeerpark.com',
      is_active: true
    }, { onConflict: 'client_id' });

  return new Response(
    JSON.stringify({
      success: true,
      data,
      error
    }),
    { headers: { "Content-Type": "application/json" } },
  )
})
