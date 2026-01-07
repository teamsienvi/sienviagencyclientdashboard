import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const METRICOOL_BASE_URL = "https://app.metricool.com";

interface DemographicsResponse {
  gender?: { male: number; female: number; unknown?: number };
  countries?: Array<{ country: string; percentage: number }>;
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

    const body = await req.json();
    const { userId, blogId, network = "tiktok" } = body;

    console.log("metricool-tiktok-demographics request:", { userId, blogId, network });

    if (!userId) {
      return new Response(
        JSON.stringify({ error: "Missing required parameter: userId" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const result: DemographicsResponse = {};

    // Calculate date range (last 30 days for demographics)
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const fromDate = thirtyDaysAgo.toISOString().split('T')[0] + "T00:00:00";
    const toDate = now.toISOString().split('T')[0] + "T23:59:59";

    // Fetch gender demographics using the timelines endpoint (similar to followers)
    try {
      const genderUrl = new URL(`${METRICOOL_BASE_URL}/api/v2/analytics/aggregation`);
      genderUrl.searchParams.set("from", fromDate);
      genderUrl.searchParams.set("to", toDate);
      genderUrl.searchParams.set("metric", "followers_gender");
      genderUrl.searchParams.set("network", network);
      genderUrl.searchParams.set("subject", "account");
      genderUrl.searchParams.set("userId", userId.toString());
      if (blogId) genderUrl.searchParams.set("blogId", blogId.toString());

      console.log("Fetching gender data:", genderUrl.toString());

      const genderResponse = await fetch(genderUrl.toString(), {
        method: "GET",
        headers: {
          "x-mc-auth": metricoolAuth,
          "accept": "application/json",
        },
      });

      console.log("Gender response status:", genderResponse.status);

      if (genderResponse.ok) {
        const genderData = await genderResponse.json();
        console.log("Gender response:", JSON.stringify(genderData));

        // Parse the gender data - Metricool returns different formats
        if (genderData && Array.isArray(genderData.data)) {
          const genderValues: { male: number; female: number; unknown: number } = {
            male: 0,
            female: 0,
            unknown: 0,
          };

          for (const item of genderData.data) {
            const label = (item.metric || item.label || item.gender || "").toLowerCase();
            const value = item.value || item.percentage || 0;
            
            if (label.includes("male") && !label.includes("female")) {
              genderValues.male = value;
            } else if (label.includes("female")) {
              genderValues.female = value;
            } else if (label.includes("unknown") || label.includes("other")) {
              genderValues.unknown = value;
            }
          }

          if (genderValues.male > 0 || genderValues.female > 0) {
            result.gender = genderValues;
          }
        } else if (genderData?.male !== undefined || genderData?.female !== undefined) {
          result.gender = {
            male: genderData.male || 0,
            female: genderData.female || 0,
            unknown: genderData.unknown || 0,
          };
        }
      } else {
        const errorText = await genderResponse.text();
        console.log("Gender fetch failed:", genderResponse.status, errorText);
      }
    } catch (e) {
      console.error("Error fetching gender data:", e);
    }

    // Fetch country demographics
    try {
      const countryUrl = new URL(`${METRICOOL_BASE_URL}/api/v2/analytics/aggregation`);
      countryUrl.searchParams.set("from", fromDate);
      countryUrl.searchParams.set("to", toDate);
      countryUrl.searchParams.set("metric", "followers_country");
      countryUrl.searchParams.set("network", network);
      countryUrl.searchParams.set("subject", "account");
      countryUrl.searchParams.set("userId", userId.toString());
      if (blogId) countryUrl.searchParams.set("blogId", blogId.toString());

      console.log("Fetching country data:", countryUrl.toString());

      const countryResponse = await fetch(countryUrl.toString(), {
        method: "GET",
        headers: {
          "x-mc-auth": metricoolAuth,
          "accept": "application/json",
        },
      });

      console.log("Country response status:", countryResponse.status);

      if (countryResponse.ok) {
        const countryData = await countryResponse.json();
        console.log("Country response:", JSON.stringify(countryData));

        // Parse country data
        if (countryData && Array.isArray(countryData.data)) {
          result.countries = countryData.data
            .map((item: any) => ({
              country: item.country || item.label || item.name || item.metric || "Unknown",
              percentage: item.percentage || item.value || 0,
            }))
            .filter((c: any) => c.percentage > 0)
            .sort((a: any, b: any) => b.percentage - a.percentage)
            .slice(0, 10); // Top 10 countries
        } else if (Array.isArray(countryData)) {
          result.countries = countryData
            .map((item: any) => ({
              country: item.country || item.label || item.name || item.metric || "Unknown",
              percentage: item.percentage || item.value || 0,
            }))
            .filter((c: any) => c.percentage > 0)
            .sort((a: any, b: any) => b.percentage - a.percentage)
            .slice(0, 10);
        }
      } else {
        const errorText = await countryResponse.text();
        console.log("Country fetch failed:", countryResponse.status, errorText);
      }
    } catch (e) {
      console.error("Error fetching country data:", e);
    }

    console.log("Demographics result:", JSON.stringify(result));

    // If no data was fetched, add a note about requirements
    const hasData = result.gender || (result.countries && result.countries.length > 0);
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        data: result,
        note: hasData ? undefined : "Demographics require a TikTok Business account with 100+ followers"
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in metricool-tiktok-demographics:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
