import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface OverviewKPIs {
  engagement: number | null;
  interactions: number | null;
  avgReachPerPost: number | null;
  impressions: number | null;
  postsCount: number | null;
  followers: number | null;
  engagementRate: number | null;
}

interface MetricoolResponse {
  success: boolean;
  data?: OverviewKPIs;
  upstreamStatus?: number;
  upstreamBody?: string;
  error?: string;
}

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
        JSON.stringify({ success: false, error: "METRICOOL_AUTH secret not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { clientId, platform, from, to, timezone = "America/Chicago" } = await req.json();

    if (!clientId || !platform || !from || !to) {
      return new Response(
        JSON.stringify({ success: false, error: "clientId, platform, from, and to are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Fetching Metricool overview for client=${clientId}, platform=${platform}, from=${from}, to=${to}`);

    // 1) Load Metricool config for this client + platform
    const { data: config, error: configError } = await supabase
      .from("client_metricool_config")
      .select("user_id, blog_id")
      .eq("client_id", clientId)
      .eq("platform", platform)
      .eq("is_active", true)
      .maybeSingle();

    if (configError || !config) {
      console.error("No Metricool config found for client:", clientId, platform, configError);
      return new Response(
        JSON.stringify({ success: false, error: "No Metricool configuration found for this client/platform" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { user_id: metricoolUserId, blog_id: metricoolBlogId } = config;
    console.log(`Found Metricool config: userId=${metricoolUserId}, blogId=${metricoolBlogId}`);

    // Format dates for Metricool API (YYYYMMDD format)
    const formatDateForMetricool = (dateStr: string) => {
      const d = new Date(dateStr);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}${month}${day}`;
    };

    const fromFormatted = formatDateForMetricool(from);
    const toFormatted = formatDateForMetricool(to);
    
    // Map platform to Metricool network name
    const networkMap: Record<string, string> = {
      instagram: "instagram",
      facebook: "facebookpages",
    };
    const network = networkMap[platform] || platform;

    // Initialize KPIs
    const kpis: OverviewKPIs = {
      engagement: null,
      interactions: null,
      avgReachPerPost: null,
      impressions: null,
      postsCount: null,
      followers: null,
      engagementRate: null,
    };

    let upstreamStatus: number | undefined;
    let upstreamBody: string | undefined;

    // Helper to make Metricool API calls
    const fetchMetricool = async (path: string, params: Record<string, string> = {}) => {
      const queryString = new URLSearchParams(params).toString();
      const url = `https://app.metricool.com${path}${queryString ? `?${queryString}` : ""}`;
      console.log("Fetching Metricool:", url);

      const response = await fetch(url, {
        method: "GET",
        headers: {
          "x-mc-auth": METRICOOL_AUTH,
          "accept": "application/json",
        },
      });

      const text = await response.text();
      console.log(`Metricool response status: ${response.status}`);

      if (!response.ok) {
        console.error("Metricool upstream error:", response.status, text);
        upstreamStatus = response.status;
        upstreamBody = text;
        return null;
      }

      try {
        return JSON.parse(text);
      } catch {
        return text;
      }
    };

    // 2) Fetch aggregation data for engagement, interactions, impressions, reach
    // Try fetching aggregation for various metrics
    const aggregationParams = {
      from: fromFormatted,
      to: toFormatted,
      metric: "all", // Get all available metrics
      network: network,
      userId: metricoolUserId,
      ...(metricoolBlogId ? { blogId: metricoolBlogId } : {}),
      timezone: timezone,
    };

    const aggregationData = await fetchMetricool("/api/stats/aggregation", aggregationParams);
    console.log("Aggregation data:", JSON.stringify(aggregationData));

    if (aggregationData) {
      // Parse aggregation response - structure varies by endpoint
      // Common fields: engagement, interactions, impressions, reach
      if (typeof aggregationData === 'object') {
        kpis.engagement = aggregationData.engagement ?? aggregationData.engagements ?? null;
        kpis.interactions = aggregationData.interactions ?? aggregationData.totalInteractions ?? null;
        kpis.impressions = aggregationData.impressions ?? aggregationData.totalImpressions ?? null;
        
        // Try to get reach
        const totalReach = aggregationData.reach ?? aggregationData.totalReach ?? null;
        if (totalReach !== null && kpis.postsCount && kpis.postsCount > 0) {
          kpis.avgReachPerPost = Math.round(totalReach / kpis.postsCount);
        }
      }
    }

    // 3) Fetch timelines for posts count and additional metrics
    const timelinesParams = {
      from: fromFormatted,
      to: toFormatted,
      network: network,
      userId: metricoolUserId,
      ...(metricoolBlogId ? { blogId: metricoolBlogId } : {}),
      timezone: timezone,
    };

    const timelinesData = await fetchMetricool("/api/stats/timelines", timelinesParams);
    console.log("Timelines data received");

    if (timelinesData && typeof timelinesData === 'object') {
      // Timelines often returns arrays of daily data - sum them up
      if (Array.isArray(timelinesData)) {
        // Sum up daily values
        let totalPosts = 0;
        let totalReach = 0;
        let totalImpressions = 0;
        let totalInteractions = 0;
        let totalEngagement = 0;
        let followersEnd = 0;

        for (const day of timelinesData) {
          totalPosts += day.posts ?? day.postsCount ?? 0;
          totalReach += day.reach ?? 0;
          totalImpressions += day.impressions ?? 0;
          totalInteractions += day.interactions ?? 0;
          totalEngagement += day.engagement ?? 0;
          // Get latest follower count
          if (day.followers !== undefined) {
            followersEnd = day.followers;
          }
        }

        if (kpis.postsCount === null && totalPosts > 0) {
          kpis.postsCount = totalPosts;
        }
        if (kpis.impressions === null && totalImpressions > 0) {
          kpis.impressions = totalImpressions;
        }
        if (kpis.interactions === null && totalInteractions > 0) {
          kpis.interactions = totalInteractions;
        }
        if (kpis.engagement === null && totalEngagement > 0) {
          kpis.engagement = totalEngagement;
        }
        if (kpis.avgReachPerPost === null && totalReach > 0 && totalPosts > 0) {
          kpis.avgReachPerPost = Math.round(totalReach / totalPosts);
        }
        if (followersEnd > 0) {
          kpis.followers = followersEnd;
        }
      } else {
        // Object response
        kpis.postsCount = timelinesData.postsCount ?? timelinesData.posts ?? kpis.postsCount;
        kpis.followers = timelinesData.followers ?? timelinesData.followersCount ?? kpis.followers;
      }
    }

    // 4) Try the network-specific overview endpoint
    const overviewPath = platform === "instagram" 
      ? "/api/stats/instagram/overview"
      : "/api/stats/facebook/overview";
    
    const overviewParams = {
      from: fromFormatted,
      to: toFormatted,
      userId: metricoolUserId,
      ...(metricoolBlogId ? { blogId: metricoolBlogId } : {}),
      timezone: timezone,
    };

    const overviewData = await fetchMetricool(overviewPath, overviewParams);
    console.log("Overview data:", JSON.stringify(overviewData));

    if (overviewData && typeof overviewData === 'object') {
      // Direct overview response - should have all KPIs
      if (overviewData.engagement !== undefined) kpis.engagement = overviewData.engagement;
      if (overviewData.interactions !== undefined) kpis.interactions = overviewData.interactions;
      if (overviewData.impressions !== undefined) kpis.impressions = overviewData.impressions;
      if (overviewData.avgReachPerPost !== undefined) kpis.avgReachPerPost = overviewData.avgReachPerPost;
      if (overviewData.postsCount !== undefined) kpis.postsCount = overviewData.postsCount;
      if (overviewData.posts !== undefined) kpis.postsCount = overviewData.posts;
      if (overviewData.followers !== undefined) kpis.followers = overviewData.followers;
      if (overviewData.engagementRate !== undefined) kpis.engagementRate = overviewData.engagementRate;
      
      // Calculate avgReachPerPost if not directly provided
      if (kpis.avgReachPerPost === null && overviewData.reach !== undefined && kpis.postsCount && kpis.postsCount > 0) {
        kpis.avgReachPerPost = Math.round(overviewData.reach / kpis.postsCount);
      }
    }

    // 5) Try posts count endpoint
    const postsPath = platform === "instagram"
      ? "/api/stats/instagram/posts"
      : "/api/stats/facebook/posts";
    
    const postsParams = {
      from: fromFormatted,
      to: toFormatted,
      userId: metricoolUserId,
      ...(metricoolBlogId ? { blogId: metricoolBlogId } : {}),
      timezone: timezone,
    };

    const postsData = await fetchMetricool(postsPath, postsParams);
    console.log("Posts data received");

    if (postsData) {
      if (Array.isArray(postsData)) {
        // Posts is an array - count them
        if (kpis.postsCount === null || kpis.postsCount === 0) {
          kpis.postsCount = postsData.length;
        }
        
        // Calculate total reach, impressions, interactions from posts
        if (postsData.length > 0) {
          let totalReach = 0;
          let totalImpressions = 0;
          let totalInteractions = 0;
          
          for (const post of postsData) {
            totalReach += post.reach ?? 0;
            totalImpressions += post.impressions ?? 0;
            totalInteractions += (post.likes ?? 0) + (post.comments ?? 0) + (post.shares ?? 0) + (post.saves ?? 0);
          }
          
          if (kpis.avgReachPerPost === null && totalReach > 0 && postsData.length > 0) {
            kpis.avgReachPerPost = Math.round(totalReach / postsData.length);
          }
          if (kpis.impressions === null && totalImpressions > 0) {
            kpis.impressions = totalImpressions;
          }
          if (kpis.interactions === null && totalInteractions > 0) {
            kpis.interactions = totalInteractions;
          }
        }
      } else if (typeof postsData === 'object' && postsData.count !== undefined) {
        kpis.postsCount = postsData.count;
      }
    }

    // 6) Fetch followers from account/profile endpoint if still null
    if (kpis.followers === null) {
      const profilePath = platform === "instagram"
        ? "/api/stats/instagram/profile"
        : "/api/stats/facebook/page";
      
      const profileData = await fetchMetricool(profilePath, {
        userId: metricoolUserId,
        ...(metricoolBlogId ? { blogId: metricoolBlogId } : {}),
      });

      if (profileData && typeof profileData === 'object') {
        kpis.followers = profileData.followers ?? profileData.followersCount ?? profileData.fans ?? null;
      }
    }

    // Calculate engagement rate if we have interactions and followers
    if (kpis.engagementRate === null && kpis.interactions !== null && kpis.followers && kpis.followers > 0 && kpis.postsCount && kpis.postsCount > 0) {
      // Engagement rate = (total interactions / (followers * posts)) * 100
      kpis.engagementRate = (kpis.interactions / (kpis.followers * kpis.postsCount)) * 100;
    }

    console.log("Final KPIs:", JSON.stringify(kpis));

    const response: MetricoolResponse = {
      success: true,
      data: kpis,
    };

    if (upstreamStatus) {
      response.upstreamStatus = upstreamStatus;
      response.upstreamBody = upstreamBody;
    }

    return new Response(
      JSON.stringify(response),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Error in metricool-meta-overview:", error);
    const message = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
