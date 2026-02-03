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
      // Instagram: "followers" | Facebook: "pageFollows" | LinkedIn: "followers" | TikTok: "followers_count"
      const getFollowersMetric = (p: string) => {
        if (p === "facebook") return "pageFollows";
        if (p === "linkedin") return "followers";
        if (p === "tiktok") return "followers_count";
        return "followers"; // Instagram uses "followers"
      };
      const followersMetric = getFollowersMetric(platform);

      console.log(`Using followers metric "${followersMetric}" for platform "${platform}"`);

      // Helper to get correct subject for engagement aggregation based on platform
      const getEngagementSubject = (p: string, type: "posts" | "reels") => {
        if (p === "tiktok") return "video"; // TikTok uses "video" instead of "posts"/"reels"
        return type;
      };

      // Fetch posts/reels engagement from aggregation endpoint (correct API for KPIs)
      const fetchPostsEngagement = async (): Promise<number | null> => {
        try {
          const data = await fetchMetricool("/api/v2/analytics/aggregation", buildParams(fromDate, toDate, {
            metric: "engagement",
            subject: getEngagementSubject(platform, "posts"),
          }));
          return extractAggValue(data);
        } catch (e) {
          errors.push(`posts_engagement ${fromDate}: ${e}`);
          return null;
        }
      };

      const fetchReelsEngagement = async (): Promise<number | null> => {
        // TikTok doesn't have separate reels - all videos are counted in the video subject
        if (platform === "tiktok") return null;
        
        try {
          const data = await fetchMetricool("/api/v2/analytics/aggregation", buildParams(fromDate, toDate, {
            metric: "engagement",
            subject: getEngagementSubject(platform, "reels"),
          }));
          return extractAggValue(data);
        } catch (e) {
          errors.push(`reels_engagement ${fromDate}: ${e}`);
          return null;
        }
      };

      // Fetch total posts count from timelines API (includes all content: posts, reels, stories)
      // This is the ACCURATE count that matches Metricool dashboard
      const fetchPostsCountFromTimelines = async (): Promise<number | null> => {
        try {
          const data = await fetchMetricool("/api/v2/analytics/timelines", buildParams(fromDate, toDate, {
            metric: "postsCount",
            subject: "account",
          }));
          
          // Sum up daily values
          if (data?.data && Array.isArray(data.data)) {
            for (const series of data.data) {
              if (series.metric === "postsCount" && Array.isArray(series.values)) {
                const total = series.values.reduce((sum: number, v: any) => sum + (v.value || 0), 0);
                console.log(`postsCount from timelines (${fromDate} to ${toDate}): ${total}`);
                return total;
              }
            }
          }
          
          // Handle direct array response
          if (Array.isArray(data)) {
            const total = data.reduce((sum: number, v: any) => sum + (v.value || 0), 0);
            console.log(`postsCount from timelines (${fromDate} to ${toDate}): ${total}`);
            return total;
          }
          
          return null;
        } catch (e) {
          errors.push(`postsCount_timelines ${fromDate}: ${e}`);
          return null;
        }
      };

      // Fetch CSV for posts to get posts/reels breakdown (feed posts vs reels)
      const fetchPostsCSV = async (): Promise<{ feedPostsCount: number; reelsCount: number }> => {
        const postsUrl = new URL(`${METRICOOL_BASE_URL}/api/v2/analytics/posts/${platform}`);
        Object.entries(buildParams(fromDate, toDate, {})).forEach(([k, v]) => 
          postsUrl.searchParams.set(k, v)
        );
        const res = await fetch(postsUrl.toString(), {
          headers: { "x-mc-auth": METRICOOL_AUTH, "accept": "text/csv" },
        });
        if (!res.ok) throw new Error(`Posts CSV: ${res.status}`);
        const csv = await res.text();
        
        // Parse CSV to count posts and reels
        const lines = csv.split('\n').filter(l => l.trim());
        if (lines.length < 2) return { feedPostsCount: 0, reelsCount: 0 };
        
        const headers = lines[0].toLowerCase().split(',').map(h => h.trim().replace(/"/g, ''));
        const typeIdx = headers.findIndex(h => h === 'type' || h === 'format');
        
        let feedPostsCount = 0;
        let reelsCount = 0;
        
        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
          const type = values[typeIdx]?.toLowerCase() || 'post';
          
          // Categorize as reel or feed post based on type
          // REEL types: reel, video, REEL, VIDEO
          // Feed post types: FEED_IMAGE, CAROUSEL_ALBUM, IMAGE, PHOTO, post, etc.
          if (type === 'reel' || type === 'video') {
            reelsCount++;
          } else {
            feedPostsCount++;
          }
        }
        
        console.log(`CSV breakdown (${fromDate} to ${toDate}): ${feedPostsCount} feed posts, ${reelsCount} reels from CSV`);
        return { feedPostsCount, reelsCount };
      };

      const [followersRes, engagementTimelineRes, postsEngagementRes, reelsEngagementRes, postsCountRes, postsCSVRes] = await Promise.allSettled([
        // 1) Followers timeline - PLATFORM SPECIFIC METRIC
        fetchMetricool("/api/v2/analytics/timelines", buildParams(fromDate, toDate, {
          metric: followersMetric,
          subject: "account",
        })),
        // 2) Engagement timeline (for chart) - TikTok uses "video" subject
        fetchMetricool("/api/v2/analytics/timelines", buildParams(fromDate, toDate, {
          metric: "engagement",
          subject: getEngagementSubject(platform, "posts"),
        })),
        // 3) Posts engagement aggregation (correct endpoint!)
        fetchPostsEngagement(),
        // 4) Reels engagement aggregation (correct endpoint!)
        fetchReelsEngagement(),
        // 5) Total posts count from timelines API (ACCURATE - includes all content)
        fetchPostsCountFromTimelines(),
        // 6) Posts CSV for feed posts vs reels breakdown
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

      // Process posts engagement from aggregation API
      if (postsEngagementRes.status === 'fulfilled') {
        result.postsEngagement = postsEngagementRes.value;
        console.log(`Posts engagement (${fromDate} to ${toDate}): ${result.postsEngagement?.toFixed(2)}%`);
      }

      // Process reels engagement from aggregation API
      if (reelsEngagementRes.status === 'fulfilled') {
        result.reelsEngagement = reelsEngagementRes.value;
        console.log(`Reels engagement (${fromDate} to ${toDate}): ${result.reelsEngagement?.toFixed(2)}%`);
      }

      // Combined engagement - use posts engagement as the primary value for Facebook
      // (Metricool's "Engagement Rate" in Organic Summary is based on posts, not average)
      // For Instagram, we show them separately
      if (result.postsEngagement != null) {
        result.engagementAgg = result.postsEngagement;
      } else if (result.reelsEngagement != null) {
        result.engagementAgg = result.reelsEngagement;
      }

      // Use postsCount from timelines API as the TOTAL content count (accurate)
      if (postsCountRes.status === 'fulfilled' && postsCountRes.value !== null) {
        result.postsCount = postsCountRes.value;
        console.log(`Total content from timelines (${fromDate} to ${toDate}): ${result.postsCount}`);
      }
      
      // Process CSV breakdown for reels count (used for separate display if needed)
      if (postsCSVRes.status === 'fulfilled') {
        const { feedPostsCount, reelsCount } = postsCSVRes.value;
        result.reelsCount = reelsCount;
        
        // If timelines API failed, fall back to CSV count (but this only includes feed posts!)
        if (result.postsCount === null) {
          result.postsCount = feedPostsCount + reelsCount;
          console.log(`Total content from CSV fallback (${fromDate} to ${toDate}): ${result.postsCount} (${feedPostsCount} feed + ${reelsCount} reels)`);
        }
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
