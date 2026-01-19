import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TimelineDataPoint {
  dateTime: string;
  value: number;
}

interface DebugInfo {
  metricUsed: string;
  networkUsed: string;
  userIdUsed: string;
  blogIdUsed: string | null;
  firstPoint: { dateTime: string; value: number } | null;
  lastPoint: { dateTime: string; value: number } | null;
  pointsCount: number;
}

interface WeeklyData {
  followersTimeline: TimelineDataPoint[];
  engagementTimeline: TimelineDataPoint[];
  engagementAgg: number | null;
  postsCount: number | null;
  reelsCount: number | null;
  postsEngagement: number | null;
  reelsEngagement: number | null;
  followersDebug?: DebugInfo;
}

interface WeeklyResponse {
  current: WeeklyData;
  previous: WeeklyData;
  debug?: {
    errors: string[];
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { clientId, platform, from, to, prevFrom, prevTo, timezone = "America/Chicago" } = await req.json();

    if (!clientId || !platform || !from || !to || !prevFrom || !prevTo) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Missing required params: clientId, platform, from, to, prevFrom, prevTo" 
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

    // Load client's metricool config for the SPECIFIC platform
    const { data: config, error: configError } = await supabase
      .from("client_metricool_config")
      .select("user_id, blog_id")
      .eq("client_id", clientId)
      .eq("platform", platform)
      .eq("is_active", true)
      .maybeSingle();

    if (configError || !config) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `No Metricool ${platform} config found for this client`,
          notConfigured: true
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = config.user_id;
    const blogId = config.blog_id;

    console.log(`Fetching ${platform} weekly data for:`, { clientId, userId, blogId, from, to, prevFrom, prevTo, timezone });

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
    const buildParams = (fromDate: string, toDate: string, extra: Record<string, string> = {}) => {
      const params: Record<string, string> = {
        from: `${fromDate}T00:00:00`,
        to: `${toDate}T23:59:59`,
        network: platform,
        timezone,
        userId,
        ...extra,
      };
      if (blogId) params.blogId = blogId;
      return params;
    };

    // Helper to fetch from Metricool
    const fetchMetricool = async (endpoint: string, params: Record<string, string>): Promise<any> => {
      const url = new URL(`${METRICOOL_BASE_URL}${endpoint}`);
      Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
      
      console.log(`Fetching: ${url.toString()}`);
      const res = await fetch(url.toString(), {
        headers: { "x-mc-auth": METRICOOL_AUTH, "accept": "application/json" },
      });
      
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`${res.status}: ${errorText.substring(0, 200)}`);
      }
      
      return res.json();
    };

    // Helper to extract timeline data points and sort by dateTime ascending
    const extractTimelinePoints = (data: any): TimelineDataPoint[] => {
      if (!data) return [];
      
      let points: TimelineDataPoint[] = [];
      
      // Handle different response formats
      if (Array.isArray(data)) {
        // Direct array of datapoints
        if (data.length > 0 && data[0]?.dateTime !== undefined) {
          points = data.map(d => ({
            dateTime: d.dateTime || d.date || d.timestamp,
            value: typeof d.value === 'number' ? d.value : parseFloat(d.value) || 0,
          }));
        }
        // Array of objects with values array
        else if (data[0]?.values) {
          points = data[0].values.map((d: any) => ({
            dateTime: d.dateTime || d.date || d.timestamp,
            value: typeof d.value === 'number' ? d.value : parseFloat(d.value) || 0,
          }));
        }
      }
      // Object with data array
      else if (data.data) {
        points = extractTimelinePoints(data.data);
      }
      
      // Sort by dateTime ascending to ensure last() is always the most recent
      points.sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime());
      
      return points;
    };

    // Helper to extract aggregation value
    const extractAggValue = (data: any): number | null => {
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
    };

    // Build debug info for followers timeline
    const buildFollowersDebug = (timeline: TimelineDataPoint[], metric: string): DebugInfo => {
      const firstPoint = timeline.length > 0 ? timeline[0] : null;
      const lastPoint = timeline.length > 0 ? timeline[timeline.length - 1] : null;
      
      return {
        metricUsed: metric,
        networkUsed: platform,
        userIdUsed: userId,
        blogIdUsed: blogId,
        firstPoint: firstPoint ? { dateTime: firstPoint.dateTime, value: firstPoint.value } : null,
        lastPoint: lastPoint ? { dateTime: lastPoint.dateTime, value: lastPoint.value } : null,
        pointsCount: timeline.length,
      };
    };

    // Fetch data for both periods in parallel
    const fetchPeriodData = async (fromDate: string, toDate: string): Promise<WeeklyData> => {
      const result: WeeklyData = {
        followersTimeline: [],
        engagementTimeline: [],
        engagementAgg: null,
        postsCount: null,
        reelsCount: null,
        postsEngagement: null,
        reelsEngagement: null,
      };

      // CRITICAL: Use platform-specific metric for followers
      // Instagram: "followers" | Facebook: "pageFollows"
      const followersMetric = platform === "facebook" ? "pageFollows" : "followers";

      console.log(`Using followers metric "${followersMetric}" for platform "${platform}"`);

      // Fetch CSV for posts to get posts/reels breakdown with engagement
      const fetchPostsCSV = async (): Promise<{ posts: any[]; reels: any[] }> => {
        const postsUrl = new URL(`${METRICOOL_BASE_URL}/api/v2/analytics/posts/${platform}`);
        Object.entries(buildParams(fromDate, toDate, {})).forEach(([k, v]) => 
          postsUrl.searchParams.set(k, v)
        );
        const res = await fetch(postsUrl.toString(), {
          headers: { "x-mc-auth": METRICOOL_AUTH, "accept": "text/csv" },
        });
        if (!res.ok) throw new Error(`Posts CSV: ${res.status}`);
        const csv = await res.text();
        
        // Parse CSV to get posts and reels separately with engagement data
        const lines = csv.split('\n').filter(l => l.trim());
        if (lines.length < 2) return { posts: [], reels: [] };
        
        const headers = lines[0].toLowerCase().split(',').map(h => h.trim().replace(/"/g, ''));
        const typeIdx = headers.findIndex(h => h === 'type' || h === 'format');
        const engagementIdx = headers.findIndex(h => h === 'engagement');
        
        const posts: any[] = [];
        const reels: any[] = [];
        
        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
          const type = values[typeIdx]?.toLowerCase() || 'post';
          const engagement = parseFloat(values[engagementIdx] || '0') || 0;
          
          const item = { type, engagement };
          
          // Categorize as reel or post
          if (type === 'reel' || type === 'video') {
            reels.push(item);
          } else {
            posts.push(item);
          }
        }
        
        return { posts, reels };
      };

      const [followersRes, engagementTimelineRes, postsCSVRes] = await Promise.allSettled([
        // 1) Followers timeline - PLATFORM SPECIFIC METRIC
        fetchMetricool("/api/v2/analytics/timelines", buildParams(fromDate, toDate, {
          metric: followersMetric,
          subject: "account",
        })),
        // 2) Engagement timeline (for chart)
        fetchMetricool("/api/v2/analytics/timelines", buildParams(fromDate, toDate, {
          metric: "engagement",
          subject: "posts",
        })),
        // 3) Posts CSV with engagement data per post/reel
        fetchPostsCSV(),
      ]);

      // Process followers timeline
      if (followersRes.status === 'fulfilled') {
        result.followersTimeline = extractTimelinePoints(followersRes.value);
        // Add debug info
        result.followersDebug = buildFollowersDebug(result.followersTimeline, followersMetric);
        console.log(`Followers timeline (${fromDate} to ${toDate}): ${result.followersTimeline.length} points, last value: ${result.followersDebug.lastPoint?.value}`);
      } else {
        errors.push(`followers ${fromDate}: ${followersRes.reason}`);
        console.error(`Followers error:`, followersRes.reason);
        // Still build debug even on error
        result.followersDebug = buildFollowersDebug([], followersMetric);
      }

      // Process engagement timeline
      if (engagementTimelineRes.status === 'fulfilled') {
        result.engagementTimeline = extractTimelinePoints(engagementTimelineRes.value);
        console.log(`Engagement timeline (${fromDate} to ${toDate}): ${result.engagementTimeline.length} points`);
      } else {
        errors.push(`engagement_timeline ${fromDate}: ${engagementTimelineRes.reason}`);
      }

      // Process posts CSV data - separate engagement for posts vs reels
      if (postsCSVRes.status === 'fulfilled') {
        const { posts, reels } = postsCSVRes.value;
        
        result.postsCount = posts.length;
        result.reelsCount = reels.length;
        
        // Calculate average engagement for posts
        if (posts.length > 0) {
          const totalPostsEngagement = posts.reduce((sum, p) => sum + p.engagement, 0);
          result.postsEngagement = totalPostsEngagement / posts.length;
        }
        
        // Calculate average engagement for reels
        if (reels.length > 0) {
          const totalReelsEngagement = reels.reduce((sum, r) => sum + r.engagement, 0);
          result.reelsEngagement = totalReelsEngagement / reels.length;
        }
        
        // Overall engagement is combined average (for backward compatibility)
        const allItems = [...posts, ...reels];
        if (allItems.length > 0) {
          const totalEngagement = allItems.reduce((sum, i) => sum + i.engagement, 0);
          result.engagementAgg = totalEngagement / allItems.length;
        }
        
        console.log(`Posts/Reels count (${fromDate} to ${toDate}): ${posts.length} posts, ${reels.length} reels`);
        console.log(`Posts engagement: ${result.postsEngagement?.toFixed(2)}%, Reels engagement: ${result.reelsEngagement?.toFixed(2)}%`);
      } else {
        errors.push(`posts_csv ${fromDate}: ${postsCSVRes.reason}`);
      }

      return result;
    };

    // Fetch both periods in parallel
    const [currentData, previousData] = await Promise.all([
      fetchPeriodData(from, to),
      fetchPeriodData(prevFrom, prevTo),
    ]);

    const response: WeeklyResponse = {
      current: currentData,
      previous: previousData,
    };

    if (errors.length > 0) {
      response.debug = { errors };
    }

    return new Response(
      JSON.stringify({ success: true, data: response }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in metricool-social-weekly:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : String(error) 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
