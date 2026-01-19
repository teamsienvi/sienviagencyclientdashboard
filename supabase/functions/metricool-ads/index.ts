import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AdsWeeklyData {
  spend: number | null;
  impressions: number | null;
  clicks: number | null;
  reach: number | null;
  cpc: number | null;
  cpm: number | null;
  ctr: number | null;
  conversions: number | null;
}

interface AdsResponse {
  metaAds: {
    current: AdsWeeklyData;
    previous: AdsWeeklyData;
  } | null;
  googleAds: {
    current: AdsWeeklyData;
    previous: AdsWeeklyData;
  } | null;
  debug?: {
    errors: string[];
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { clientId, from, to, prevFrom, prevTo, timezone = "America/Chicago" } = await req.json();

    if (!clientId || !from || !to || !prevFrom || !prevTo) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Missing required params: clientId, from, to, prevFrom, prevTo" 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Validate client access
    const authHeader = req.headers.get("authorization");
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      
      if (user && !authError) {
        const { data: roleData } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .maybeSingle();
        
        const isAdmin = roleData?.role === "admin";
        
        if (!isAdmin) {
          const { data: accessData } = await supabase
            .from("client_users")
            .select("id")
            .eq("user_id", user.id)
            .eq("client_id", clientId)
            .maybeSingle();
          
          if (!accessData) {
            return new Response(
              JSON.stringify({ success: false, error: "Access denied" }),
              { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
        }
      }
    }

    // Load client's metricool config - we'll check for meta_ads and google_ads platforms
    // But they typically share the same userId/blogId as the main account
    const { data: configList } = await supabase
      .from("client_metricool_config")
      .select("user_id, blog_id, platform")
      .eq("client_id", clientId)
      .eq("is_active", true);

    if (!configList || configList.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "No Metricool config found for this client",
          notConfigured: true
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use first available config for userId/blogId (ads share same account)
    const config = configList[0];
    const userId = config.user_id;
    const blogId = config.blog_id;

    // Check if ads platforms are configured
    const hasMetaAds = configList.some(c => c.platform === "meta_ads");
    const hasGoogleAds = configList.some(c => c.platform === "google_ads");

    console.log(`Fetching ads data for:`, { clientId, userId, blogId, from, to, hasMetaAds, hasGoogleAds });

    const METRICOOL_BASE_URL = "https://app.metricool.com";
    const METRICOOL_AUTH = Deno.env.get("METRICOOL_AUTH");

    if (!METRICOOL_AUTH) {
      return new Response(
        JSON.stringify({ success: false, error: "METRICOOL_AUTH not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const errors: string[] = [];

    // Helper to build params
    const buildParams = (fromDate: string, toDate: string, network: string, metric: string) => {
      const params: Record<string, string> = {
        from: `${fromDate}T00:00:00`,
        to: `${toDate}T23:59:59`,
        network,
        metric,
        timezone,
        userId,
      };
      if (blogId) params.blogId = blogId;
      return params;
    };

    // Helper to fetch from Metricool aggregation endpoint
    const fetchAggregation = async (network: string, metric: string, fromDate: string, toDate: string): Promise<number | null> => {
      try {
        const url = new URL(`${METRICOOL_BASE_URL}/api/v2/analytics/aggregation`);
        const params = buildParams(fromDate, toDate, network, metric);
        Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
        
        console.log(`Fetching: ${url.toString()}`);
        const res = await fetch(url.toString(), {
          headers: { "x-mc-auth": METRICOOL_AUTH, "accept": "application/json" },
        });
        
        if (!res.ok) {
          const errorText = await res.text();
          throw new Error(`${res.status}: ${errorText.substring(0, 200)}`);
        }
        
        const data = await res.json();
        
        // Extract value from response
        if (data === null || data === undefined) return null;
        if (typeof data === 'number') return data;
        if (typeof data === 'object') {
          if (data.data !== undefined) {
            return typeof data.data === 'number' ? data.data : null;
          }
          if (data.value !== undefined) return data.value;
          if (data.total !== undefined) return data.total;
        }
        return null;
      } catch (e) {
        errors.push(`${network}_${metric}: ${e}`);
        return null;
      }
    };

    // Fetch all metrics for a platform in parallel
    const fetchPlatformData = async (network: string, fromDate: string, toDate: string): Promise<AdsWeeklyData> => {
      const metrics = ["spend", "impressions", "clicks", "reach", "cpc", "cpm", "ctr", "conversions"];
      
      const results = await Promise.all(
        metrics.map(metric => fetchAggregation(network, metric, fromDate, toDate))
      );
      
      return {
        spend: results[0],
        impressions: results[1],
        clicks: results[2],
        reach: results[3],
        cpc: results[4],
        cpm: results[5],
        ctr: results[6],
        conversions: results[7],
      };
    };

    const response: AdsResponse = {
      metaAds: null,
      googleAds: null,
    };

    // Always try to fetch Meta Ads (facebook_ads network)
    try {
      const [metaCurrent, metaPrev] = await Promise.all([
        fetchPlatformData("facebook_ads", from, to),
        fetchPlatformData("facebook_ads", prevFrom, prevTo),
      ]);
      
      // Only include if we got some data
      if (metaCurrent.spend !== null || metaCurrent.impressions !== null) {
        response.metaAds = { current: metaCurrent, previous: metaPrev };
      }
    } catch (e) {
      errors.push(`meta_ads_fetch: ${e}`);
    }

    // Always try to fetch Google Ads (adwords network)
    try {
      const [googleCurrent, googlePrev] = await Promise.all([
        fetchPlatformData("adwords", from, to),
        fetchPlatformData("adwords", prevFrom, prevTo),
      ]);
      
      // Only include if we got some data
      if (googleCurrent.spend !== null || googleCurrent.impressions !== null) {
        response.googleAds = { current: googleCurrent, previous: googlePrev };
      }
    } catch (e) {
      errors.push(`google_ads_fetch: ${e}`);
    }

    if (errors.length > 0) {
      response.debug = { errors };
    }

    return new Response(
      JSON.stringify({ success: true, data: response }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in metricool-ads:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : String(error) 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
