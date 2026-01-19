import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AdsWeeklyData {
  spend: number;
  impressions: number;
  clicks: number;
  reach: number;
  cpc: number;
  cpm: number;
  ctr: number;
  conversions: number;
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

    // Load client's metricool config
    const { data: configList } = await supabase
      .from("client_metricool_config")
      .select("user_id, blog_id, platform")
      .eq("client_id", clientId)
      .eq("is_active", true);

    if (!configList || configList.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          data: { metaAds: null, googleAds: null },
          message: "No Metricool config found for this client"
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use first available config for userId/blogId
    const config = configList[0];
    const userId = config.user_id;
    const blogId = config.blog_id;

    console.log(`[metricool-ads] Fetching ads data for:`, { clientId, userId, blogId, from, to });

    const METRICOOL_BASE_URL = "https://app.metricool.com";
    const METRICOOL_AUTH = Deno.env.get("METRICOOL_AUTH");

    if (!METRICOOL_AUTH) {
      return new Response(
        JSON.stringify({ success: false, error: "METRICOOL_AUTH not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const errors: string[] = [];

    // Format date for Metricool API (YYYYMMDD)
    const formatDate = (dateStr: string) => dateStr.replace(/-/g, "");

    // Fetch timeline data and sum values
    const fetchTimelineSum = async (metric: string, fromDate: string, toDate: string): Promise<number> => {
      const url = new URL(`${METRICOOL_BASE_URL}/api/stats/timeline/${metric}`);
      url.searchParams.set("start", formatDate(fromDate));
      url.searchParams.set("end", formatDate(toDate));
      url.searchParams.set("timezone", timezone);
      url.searchParams.set("userId", userId);
      if (blogId) url.searchParams.set("blogId", blogId);

      console.log(`[metricool-ads] Fetching: ${url.toString()}`);

      try {
        const res = await fetch(url.toString(), {
          headers: { "x-mc-auth": METRICOOL_AUTH, "accept": "application/json" },
        });

        const statusCode = res.status;
        const responseText = await res.text();
        console.log(`[metricool-ads] Timeline ${metric} status: ${statusCode}, response: ${responseText.substring(0, 200)}`);

        if (!res.ok) {
          errors.push(`${metric}: HTTP ${statusCode}`);
          return 0;
        }

        let data;
        try {
          data = JSON.parse(responseText);
        } catch {
          return 0;
        }
        
        // Timeline returns [[timestamp, value], ...] - sum all values
        if (Array.isArray(data)) {
          const sum = data.reduce((acc: number, item: [number, number | string]) => {
            const val = typeof item[1] === 'string' ? parseFloat(item[1]) : item[1];
            return acc + (isNaN(val) ? 0 : val);
          }, 0);
          console.log(`[metricool-ads] ${metric} sum: ${sum} from ${data.length} entries`);
          return sum;
        }
        
        return 0;
      } catch (err) {
        console.error(`[metricool-ads] Error fetching ${metric}:`, err);
        errors.push(`${metric}: ${err}`);
        return 0;
      }
    };

    // Fetch timeline average (for rates like CTR, CPC, CPM)
    const fetchTimelineAvg = async (metric: string, fromDate: string, toDate: string): Promise<number> => {
      const url = new URL(`${METRICOOL_BASE_URL}/api/stats/timeline/${metric}`);
      url.searchParams.set("start", formatDate(fromDate));
      url.searchParams.set("end", formatDate(toDate));
      url.searchParams.set("timezone", timezone);
      url.searchParams.set("userId", userId);
      if (blogId) url.searchParams.set("blogId", blogId);

      try {
        const res = await fetch(url.toString(), {
          headers: { "x-mc-auth": METRICOOL_AUTH, "accept": "application/json" },
        });

        if (!res.ok) return 0;

        const data = await res.json();
        
        if (Array.isArray(data) && data.length > 0) {
          const validValues = data.filter((item: [number, number | string]) => {
            const val = typeof item[1] === 'string' ? parseFloat(item[1]) : item[1];
            return !isNaN(val) && val !== 0;
          });
          
          if (validValues.length === 0) return 0;
          
          const sum = validValues.reduce((acc: number, item: [number, number | string]) => {
            const val = typeof item[1] === 'string' ? parseFloat(item[1]) : item[1];
            return acc + val;
          }, 0);
          
          return sum / validValues.length;
        }
        
        return 0;
      } catch (err) {
        console.error(`[metricool-ads] Error fetching avg ${metric}:`, err);
        errors.push(`${metric}: ${err}`);
        return 0;
      }
    };

    // Fetch ads data for a period using timeline APIs
    const fetchAdsData = async (fromDate: string, toDate: string): Promise<AdsWeeklyData> => {
      console.log(`[metricool-ads] Fetching ads data for period: ${fromDate} to ${toDate}`);
      
      const [spend, impressions, clicks, reach, cpc, cpm, ctr, conversions] = await Promise.all([
        fetchTimelineSum("adSpend", fromDate, toDate),
        fetchTimelineSum("adImpressions", fromDate, toDate),
        fetchTimelineSum("adClicks", fromDate, toDate),
        fetchTimelineSum("adReach", fromDate, toDate),
        fetchTimelineAvg("adCpc", fromDate, toDate),
        fetchTimelineAvg("adCpm", fromDate, toDate),
        fetchTimelineAvg("adCtr", fromDate, toDate),
        fetchTimelineSum("adConversions", fromDate, toDate),
      ]);

      return { spend, impressions, clicks, reach, cpc, cpm, ctr, conversions };
    };

    // Fetch current and previous period data
    const [currentData, previousData] = await Promise.all([
      fetchAdsData(from, to),
      fetchAdsData(prevFrom, prevTo),
    ]);

    // Check if we have any meaningful data
    const hasData = currentData.spend > 0 || currentData.impressions > 0 || 
                    previousData.spend > 0 || previousData.impressions > 0;

    console.log(`[metricool-ads] Current data:`, currentData);
    console.log(`[metricool-ads] Previous data:`, previousData);
    console.log(`[metricool-ads] Has meaningful data: ${hasData}`);

    const response: AdsResponse = {
      metaAds: hasData ? {
        current: currentData,
        previous: previousData,
      } : null,
      googleAds: null, // Will implement when Google Ads is connected
    };

    if (errors.length > 0) {
      response.debug = { errors };
    }

    return new Response(
      JSON.stringify({ success: true, data: response }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[metricool-ads] Error:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : String(error),
        data: { metaAds: null, googleAds: null }
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
