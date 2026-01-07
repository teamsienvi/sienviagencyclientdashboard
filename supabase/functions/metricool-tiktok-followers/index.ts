import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const METRICOOL_BASE_URL = "https://app.metricool.com";

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const metricoolAuth = Deno.env.get("METRICOOL_AUTH");
    if (!metricoolAuth) {
      console.error("METRICOOL_AUTH secret not configured");
      return new Response(
        JSON.stringify({ error: "METRICOOL_AUTH secret not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { from, to, timezone, userId, blogId } = body;

    console.log("metricool-tiktok-followers request:", { from, to, timezone, userId, blogId });

    if (!from || !to || !userId || !blogId) {
      return new Response(
        JSON.stringify({ error: "Missing required parameters: from, to, userId, blogId" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build URL using URLSearchParams to properly encode special characters
    const url = new URL(`${METRICOOL_BASE_URL}/api/v2/analytics/timelines`);
    url.searchParams.set("from", from);
    url.searchParams.set("to", to);
    url.searchParams.set("metric", "followers_count");
    url.searchParams.set("network", "tiktok");
    url.searchParams.set("subject", "account");
    url.searchParams.set("timezone", timezone || "UTC");
    url.searchParams.set("userId", userId.toString());
    url.searchParams.set("blogId", blogId.toString());

    console.log("Calling Metricool timelines API:", url.toString());

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "x-mc-auth": metricoolAuth,
        "accept": "application/json",
      },
    });

    console.log("Metricool response status:", response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Metricool API error:", response.status, errorText);
      return new Response(
        JSON.stringify({
          error: "Metricool API returned an error",
          upstreamStatus: response.status,
          upstreamBody: errorText,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    console.log("Metricool timelines response:", JSON.stringify(data).slice(0, 500));

    return new Response(
      JSON.stringify({ success: true, data }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in metricool-tiktok-followers:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
