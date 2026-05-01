import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  const clientId = "b6c39651-9259-4930-af6e-b744a5a191ad";
  
  // 1. Check metricool config or legacy mapping
  const { data: legacyMapping } = await supabase
    .from('legacy_agency_client_mapping')
    .select('*')
    .eq('client_id', clientId);

  const { data: socialAccounts } = await supabase
    .from('social_accounts')
    .select('*')
    .eq('client_id', clientId);

  return new Response(
    JSON.stringify({
      legacyMapping,
      socialAccounts
    }),
    { headers: { "Content-Type": "application/json" } },
  )
})
