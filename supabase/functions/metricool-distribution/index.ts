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

// LinkedIn requires specific subject values for distribution API
// Map generic metrics to LinkedIn-specific subjects
const getLinkedInSubject = (metric: string): string | null => {
  const linkedInSubjectMap: Record<string, string> = {
    "country": "followerCountsByGeoCountry",
    "geo": "followerCountsByGeo",
    "industry": "aggregatedFollowerCountsByIndustry",
    "seniority": "followerCountsBySeniority",
    "function": "followerCountsByFunction",
    "staff_count": "followerCountsByStaffCountRange",
    "association": "followerCountsByAssociationType",
  };
  return linkedInSubjectMap[metric] || null;
};

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

    // LinkedIn doesn't support generic "gender" or "account" subjects for distribution
    // Return empty data gracefully instead of erroring
    if (network === "linkedin") {
      const linkedInSubject = getLinkedInSubject(metric);
      
      if (!linkedInSubject) {
        console.log(`LinkedIn does not support metric "${metric}" for distribution. Returning empty data.`);
        return new Response(
          JSON.stringify({ success: true, data: { data: [] }, unsupported: true }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Use the LinkedIn-specific subject
      const url = new URL(`${METRICOOL_BASE_URL}/api/v2/analytics/distribution`);
      url.searchParams.set("metric", linkedInSubject);
      url.searchParams.set("network", network);
      url.searchParams.set("subject", "account"); // LinkedIn uses account with specific metric names
      url.searchParams.set("from", from);
      url.searchParams.set("to", to);
      url.searchParams.set("userId", userId);
      if (blogId) url.searchParams.set("blogId", blogId);
      if (timezone) url.searchParams.set("timezone", timezone);

      console.log("Fetching LinkedIn distribution:", url.toString());

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
        // For LinkedIn, return empty data instead of error for unsupported distributions
        return new Response(
          JSON.stringify({ success: true, data: { data: [] }, unsupported: true }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const data = await response.json();
      console.log("Metricool LinkedIn distribution response:", JSON.stringify(data));

      return new Response(
        JSON.stringify({ success: true, data }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // For TikTok and other platforms, use original logic
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
