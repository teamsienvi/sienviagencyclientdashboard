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

    // Fetch gender demographics
    try {
      const genderUrl = new URL(`${METRICOOL_BASE_URL}/api/v2/analytics/aggregation`);
      genderUrl.searchParams.set("metric", "followers_gender");
      genderUrl.searchParams.set("network", network);
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

      if (genderResponse.ok) {
        const genderData = await genderResponse.json();
        console.log("Gender response:", JSON.stringify(genderData).slice(0, 500));

        // Parse the gender data - Metricool returns different formats
        if (genderData && Array.isArray(genderData.data)) {
          const genderValues: { male: number; female: number; unknown: number } = {
            male: 0,
            female: 0,
            unknown: 0,
          };

          for (const item of genderData.data) {
            if (item.metric === "male" || item.label === "Male" || item.gender === "male") {
              genderValues.male = item.value || item.percentage || 0;
            } else if (item.metric === "female" || item.label === "Female" || item.gender === "female") {
              genderValues.female = item.value || item.percentage || 0;
            } else if (item.metric === "unknown" || item.label === "Unknown") {
              genderValues.unknown = item.value || item.percentage || 0;
            }
          }

          result.gender = genderValues;
        } else if (genderData?.male !== undefined || genderData?.female !== undefined) {
          result.gender = {
            male: genderData.male || 0,
            female: genderData.female || 0,
            unknown: genderData.unknown || 0,
          };
        }
      } else {
        console.log("Gender fetch failed:", genderResponse.status);
      }
    } catch (e) {
      console.error("Error fetching gender data:", e);
    }

    // Fetch country demographics
    try {
      const countryUrl = new URL(`${METRICOOL_BASE_URL}/api/v2/analytics/aggregation`);
      countryUrl.searchParams.set("metric", "followers_country");
      countryUrl.searchParams.set("network", network);
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

      if (countryResponse.ok) {
        const countryData = await countryResponse.json();
        console.log("Country response:", JSON.stringify(countryData).slice(0, 500));

        // Parse country data
        if (countryData && Array.isArray(countryData.data)) {
          result.countries = countryData.data
            .map((item: any) => ({
              country: item.country || item.label || item.name || "Unknown",
              percentage: item.percentage || item.value || 0,
            }))
            .sort((a: any, b: any) => b.percentage - a.percentage)
            .slice(0, 10); // Top 10 countries
        } else if (Array.isArray(countryData)) {
          result.countries = countryData
            .map((item: any) => ({
              country: item.country || item.label || item.name || "Unknown",
              percentage: item.percentage || item.value || 0,
            }))
            .sort((a: any, b: any) => b.percentage - a.percentage)
            .slice(0, 10);
        }
      } else {
        console.log("Country fetch failed:", countryResponse.status);
      }
    } catch (e) {
      console.error("Error fetching country data:", e);
    }

    console.log("Demographics result:", JSON.stringify(result));

    return new Response(
      JSON.stringify({ success: true, data: result }),
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
