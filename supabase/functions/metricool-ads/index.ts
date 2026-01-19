import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Campaign {
  name: string;
  status: string;
  impressions: number;
  reach: number;
  clicks: number;
  uniqueClicks: number;
  spent: number;
  ctr: number;
  cpc: number;
  cpm: number;
  conversions: number;
  actions?: Record<string, number>;
}

interface AggregatedData {
  spend: number;
  impressions: number;
  reach: number;
  clicks: number;
  uniqueClicks: number;
  conversions: number;
  ctr: number;
  cpc: number;
  cpm: number;
  actions: Record<string, number>;
  campaigns: Campaign[];
}

interface AdsResponse {
  metaAds: {
    current: AggregatedData;
    previous: AggregatedData;
  } | null;
  googleAds: null;
  upstreamDebug?: {
    currentWeek?: { status: number; body: string; url: string };
    prevWeek?: { status: number; body: string; url: string };
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { clientId, from, to, prevFrom, prevTo } = await req.json();

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

    console.log(`[metricool-ads] Fetching Meta Ads for:`, { clientId, userId, blogId, from, to });

    const METRICOOL_AUTH = Deno.env.get("METRICOOL_AUTH");
    if (!METRICOOL_AUTH) {
      return new Response(
        JSON.stringify({ success: false, error: "METRICOOL_AUTH not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Format date for Metricool API (YYYYMMDD - no dashes)
    const formatDate = (dateStr: string) => dateStr.replace(/-/g, "");

    // Fetch Facebook Ads campaigns for a date range
    const fetchCampaigns = async (fromDate: string, toDate: string): Promise<{ campaigns: Campaign[] | null; debug: { status: number; body: string; url: string } }> => {
      const params = new URLSearchParams({
        start: formatDate(fromDate),
        end: formatDate(toDate),
        userId: userId,
        blogId: blogId || "",
      });
      
      const url = `https://app.metricool.com/api/stats/facebookads/campaigns?${params.toString()}`;
      console.log(`[metricool-ads] Fetching: ${url}`);

      try {
        const res = await fetch(url, {
          method: "GET",
          headers: {
            "x-mc-auth": METRICOOL_AUTH,
            "Accept": "application/json",
          },
        });

        const responseText = await res.text();
        console.log(`[metricool-ads] Response status: ${res.status}, body: ${responseText.substring(0, 500)}`);

        if (!res.ok) {
          return {
            campaigns: null,
            debug: { status: res.status, body: responseText, url }
          };
        }

        // Parse response
        let data;
        try {
          data = JSON.parse(responseText);
        } catch {
          return {
            campaigns: null,
            debug: { status: res.status, body: `Invalid JSON: ${responseText}`, url }
          };
        }

        // If empty array or not an array, return null campaigns
        if (!Array.isArray(data) || data.length === 0) {
          return {
            campaigns: [],
            debug: { status: res.status, body: responseText, url }
          };
        }

        // Map campaigns
        const campaigns: Campaign[] = data.map((c: Record<string, unknown>) => ({
          name: String(c.name || "Unknown"),
          status: String(c.status || "unknown"),
          impressions: Number(c.impressions) || 0,
          reach: Number(c.reach) || 0,
          clicks: Number(c.clicks) || 0,
          uniqueClicks: Number(c.uniqueClicks) || 0,
          spent: Number(c.spent) || 0,
          ctr: Number(c.ctr) || 0,
          cpc: Number(c.cpc) || 0,
          cpm: Number(c.cpm) || 0,
          conversions: Number(c.conversions) || 0,
          actions: c.actions as Record<string, number> || {},
        }));

        return { campaigns, debug: { status: res.status, body: responseText.substring(0, 200), url } };
      } catch (err) {
        console.error(`[metricool-ads] Error fetching campaigns:`, err);
        return {
          campaigns: null,
          debug: { status: 0, body: String(err), url }
        };
      }
    };

    // Aggregate campaigns data
    const aggregateCampaigns = (campaigns: Campaign[]): AggregatedData => {
      const result: AggregatedData = {
        spend: 0,
        impressions: 0,
        reach: 0,
        clicks: 0,
        uniqueClicks: 0,
        conversions: 0,
        ctr: 0,
        cpc: 0,
        cpm: 0,
        actions: {},
        campaigns: campaigns,
      };

      // Sum metrics across all campaigns
      for (const c of campaigns) {
        result.spend += c.spent || 0;
        result.impressions += c.impressions || 0;
        result.reach += c.reach || 0;
        result.clicks += c.clicks || 0;
        result.uniqueClicks += c.uniqueClicks || 0;
        result.conversions += c.conversions || 0;

        // Aggregate actions
        if (c.actions) {
          for (const [key, value] of Object.entries(c.actions)) {
            result.actions[key] = (result.actions[key] || 0) + (Number(value) || 0);
          }
        }
      }

      // Compute rates from totals (NOT averaging campaign rates)
      if (result.impressions > 0) {
        result.ctr = (result.clicks / result.impressions) * 100;
        result.cpm = (result.spend / result.impressions) * 1000;
      }
      if (result.clicks > 0) {
        result.cpc = result.spend / result.clicks;
      }

      return result;
    };

    // Fetch current and previous period
    const [currentResult, prevResult] = await Promise.all([
      fetchCampaigns(from, to),
      fetchCampaigns(prevFrom, prevTo),
    ]);

    // Build debug info for upstream issues
    const upstreamDebug: AdsResponse["upstreamDebug"] = {};
    if (currentResult.campaigns === null) {
      upstreamDebug.currentWeek = currentResult.debug;
    }
    if (prevResult.campaigns === null) {
      upstreamDebug.prevWeek = prevResult.debug;
    }

    // If both periods have null campaigns (upstream error), return with debug
    if (currentResult.campaigns === null && prevResult.campaigns === null) {
      return new Response(
        JSON.stringify({
          success: false,
          data: { metaAds: null, googleAds: null },
          upstreamDebug,
          message: "Failed to fetch Meta Ads campaigns from Metricool"
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Aggregate data
    const currentData = aggregateCampaigns(currentResult.campaigns || []);
    const previousData = aggregateCampaigns(prevResult.campaigns || []);

    console.log(`[metricool-ads] Current aggregated:`, {
      spend: currentData.spend,
      impressions: currentData.impressions,
      clicks: currentData.clicks,
      campaignsCount: currentData.campaigns.length
    });
    console.log(`[metricool-ads] Previous aggregated:`, {
      spend: previousData.spend,
      impressions: previousData.impressions,
      clicks: previousData.clicks,
      campaignsCount: previousData.campaigns.length
    });

    // Check if we have meaningful data
    const hasData = currentData.spend > 0 || currentData.impressions > 0 || 
                    previousData.spend > 0 || previousData.impressions > 0 ||
                    currentData.campaigns.length > 0 || previousData.campaigns.length > 0;

    const response: AdsResponse = {
      metaAds: hasData ? {
        current: currentData,
        previous: previousData,
      } : null,
      googleAds: null,
    };

    // Include upstream debug if there were any issues
    if (Object.keys(upstreamDebug).length > 0) {
      response.upstreamDebug = upstreamDebug;
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
