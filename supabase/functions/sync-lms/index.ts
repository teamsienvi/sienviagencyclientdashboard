import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { clientId } = await req.json();

    if (!clientId) {
      throw new Error("Missing clientId");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log(`[sync-lms] Fetching LMS data for client: ${clientId}`);

    const { data: clientData, error: clientError } = await supabase
      .from('clients')
      .select('supabase_url, api_key')
      .eq('id', clientId)
      .single();

    if (clientError || !clientData) {
      throw new Error(`Failed to fetch client details: ${clientError?.message}`);
    }

    const { supabase_url, api_key } = clientData;
    const targetUrl = supabase_url || "https://ouxnqgwdwccjipmplure.supabase.co";

    // Fetch LMS data from external project (FFF Lovable Project)
    const res = await fetch(`${targetUrl}/functions/v1/beta-count`, {
        headers: { 
          "x-api-key": "Iydknyk1@#$%",
          ...(api_key ? { "Authorization": `Bearer ${api_key}`, "apikey": api_key } : {})
        },
    });

    if (!res.ok) {
        throw new Error(`Failed to fetch LMS data: ${res.statusText}`);
    }

    const lmsData = await res.json();

    console.log(`[sync-lms] Successfully fetched data, writing to cache...`);

    const { error: upsertError } = await supabase
        .from('platform_analytics_cache')
        .upsert({
            client_id: clientId,
            platform: 'lms',
            module: 'analytics',
            data: lmsData,
            collected_at: new Date().toISOString()
        }, { onConflict: 'client_id,platform,module' });

    if (upsertError) {
        throw upsertError;
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[sync-lms] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
