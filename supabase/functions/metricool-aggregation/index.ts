import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const metricoolBaseUrl = Deno.env.get("METRICOOL_BASE_URL") || "https://app.metricool.com";
    const metricoolAuth = Deno.env.get("METRICOOL_AUTH") || Deno.env.get("METRICOOL_USER_TOKEN");

    if (!metricoolAuth) {
      throw new Error("METRICOOL_AUTH not configured");
    }

    const body = await req.json();
    const { from, to, metric, network, timezone, subject, userId, blogId } = body;

    // Validate required parameters
    if (!from || !to || !metric || !network || !userId) {
      throw new Error("Missing required parameters: from, to, metric, network, userId");
    }

    // Format dates to Metricool's required format: yyyy-MM-dd'T'HH:mm:ss
    const formatDateForMetricool = (dateStr: string, isEnd: boolean) => {
      // If already has T and time, return as-is (but strip timezone offset)
      if (dateStr.includes("T") && dateStr.includes(":")) {
        // Remove timezone offset if present (e.g., +00:00 or Z)
        return dateStr.replace(/[Z+][0-9:]*$/, "");
      }
      // Otherwise append time
      const time = isEnd ? "T23:59:59" : "T00:00:00";
      return `${dateStr.split("T")[0]}${time}`;
    };

    const fromFormatted = formatDateForMetricool(from, false);
    const toFormatted = formatDateForMetricool(to, true);

    // Build URL using URL + URLSearchParams to properly encode special characters like +
    const url = new URL(`${metricoolBaseUrl}/api/v2/analytics/aggregation`);
    url.searchParams.set("from", fromFormatted);
    url.searchParams.set("to", toFormatted);
    url.searchParams.set("metric", metric);
    url.searchParams.set("network", network);
    url.searchParams.set("userId", userId);
    
    if (timezone) {
      url.searchParams.set("timezone", timezone);
    }
    if (subject) {
      url.searchParams.set("subject", subject);
    }
    if (blogId) {
      url.searchParams.set("blogId", blogId);
    }

    const finalUrl = url.toString();
    console.log("Metricool aggregation request URL:", finalUrl);

    const response = await fetch(finalUrl, {
      method: "GET",
      headers: {
        "x-mc-auth": metricoolAuth,
        "accept": "application/json",
      },
    });

    const status = response.status;
    console.log("Metricool upstream status:", status);

    if (!response.ok) {
      const upstreamBody = await response.text();
      console.error("Metricool upstream error:", status, upstreamBody);
      
      return new Response(
        JSON.stringify({
          error: `Upstream error: ${status}`,
          status,
          upstreamBody,
        }),
        {
          status: 200, // Return 200 to client so they can handle error
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const data = await response.json();
    console.log("Metricool aggregation response:", JSON.stringify(data).substring(0, 500));

    return new Response(
      JSON.stringify({
        success: true,
        data,
        debug: {
          url: finalUrl,
          status,
        },
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Metricool aggregation error:", errorMessage);
    
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        success: false,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
