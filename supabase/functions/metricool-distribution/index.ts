import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const METRICOOL_BASE_URL = "https://app.metricool.com";

interface DistributionRequest {
  metric: string;       // e.g., "gender", "country", "age"
  network: string;      // e.g., "tiktok", "linkedin"
  subject: string;      // e.g., "account"
  from: string;         // ISO date string
  to: string;           // ISO date string
  timezone?: string;    // optional timezone
  userId: string;       // Metricool user ID (per client)
  blogId?: string;      // optional Metricool blog ID (per client)
}

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

    const body: DistributionRequest = await req.json();
    const { metric, network, subject, from, to, timezone, userId, blogId } = body;

    console.log("metricool-distribution request:", { metric, network, subject, from, to, timezone, userId, blogId });

    // Validate required params
    if (!metric || !network || !subject || !from || !to || !userId) {
      return new Response(
        JSON.stringify({ error: "Missing required parameters: metric, network, subject, from, to, userId" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build URL with query params
    const url = new URL(`${METRICOOL_BASE_URL}/api/v2/analytics/distribution`);
    url.searchParams.set("metric", metric);
    url.searchParams.set("network", network);
    url.searchParams.set("subject", subject);
    url.searchParams.set("from", from);
    url.searchParams.set("to", to);
    url.searchParams.set("userId", userId);
    if (blogId) url.searchParams.set("blogId", blogId);
    if (timezone) url.searchParams.set("timezone", timezone);

    console.log("Fetching Metricool distribution:", url.toString());

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
          error: "Metricool API error", 
          upstreamStatus: response.status,
          body: errorText 
        }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    console.log("Metricool distribution response:", JSON.stringify(data));

    return new Response(
      JSON.stringify({ success: true, data }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in metricool-distribution:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
