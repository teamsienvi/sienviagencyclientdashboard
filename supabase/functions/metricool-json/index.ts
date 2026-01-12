import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const METRICOOL_AUTH = Deno.env.get("METRICOOL_AUTH");
    if (!METRICOOL_AUTH) {
      console.error("METRICOOL_AUTH secret not configured");
      return new Response(
        JSON.stringify({ error: "METRICOOL_AUTH secret not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { path, params } = await req.json();
    
    if (!path) {
      return new Response(
        JSON.stringify({ error: "path is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build the URL with query parameters
    const queryString = params ? new URLSearchParams(params).toString() : "";
    const url = `https://app.metricool.com${path}${queryString ? `?${queryString}` : ""}`;
    
    console.log("Fetching Metricool JSON:", url);

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "x-mc-auth": METRICOOL_AUTH,
        "accept": "application/json",
      },
    });

    const responseText = await response.text();
    console.log("Metricool response status:", response.status);

    // If non-200, return upstream status and body for debugging
    if (!response.ok) {
      console.error("Metricool upstream error:", response.status, responseText);
      return new Response(
        JSON.stringify({ 
          success: false,
          upstreamStatus: response.status, 
          upstreamBody: responseText 
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse and return the JSON response
    let data;
    try {
      data = JSON.parse(responseText);
    } catch {
      data = responseText;
    }

    return new Response(
      JSON.stringify({ success: true, data }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Error in metricool-json:", error);
    const message = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
