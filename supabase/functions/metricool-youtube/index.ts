import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TimelinePoint {
  timestamp: number;
  value: number;
}

interface VideoData {
  title: string;
  url: string;
  publishedAt: string;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  averageViewDuration: number;
  watchTimeHours: number;
}

interface WeeklyYouTubeData {
  totalSubscribers: number;
  subscribersGained: number;
  totalViews: number;
  totalLikes: number;
  totalComments: number;
  totalShares: number;
  videosCount: number;
  avgViewDuration: number;
  engagementPct: number | null;
  videos: VideoData[];
}

interface YouTubeResponse {
  current: WeeklyYouTubeData;
  previous: WeeklyYouTubeData;
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

    // Load client's metricool config for YouTube
    const { data: config, error: configError } = await supabase
      .from("client_metricool_config")
      .select("user_id, blog_id")
      .eq("client_id", clientId)
      .eq("platform", "youtube")
      .eq("is_active", true)
      .maybeSingle();

    if (configError || !config) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "No Metricool YouTube config found for this client",
          notConfigured: true
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = config.user_id;
    const blogId = config.blog_id;

    console.log(`Fetching YouTube data for:`, { clientId, userId, blogId, from, to, prevFrom, prevTo, timezone });

    const METRICOOL_BASE_URL = "https://app.metricool.com";
    const METRICOOL_AUTH = Deno.env.get("METRICOOL_AUTH");

    if (!METRICOOL_AUTH) {
      return new Response(
        JSON.stringify({ success: false, error: "METRICOOL_AUTH not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const errors: string[] = [];

    // Convert date string (YYYY-MM-DD) to YYYYMMDD format for timeline endpoints
    const toTimelineFormat = (dateStr: string): string => {
      return dateStr.replace(/-/g, '');
    };

    // Helper to fetch from Metricool
    const fetchMetricool = async (endpoint: string, params: Record<string, string>, acceptHeader = "application/json"): Promise<any> => {
      const url = new URL(`${METRICOOL_BASE_URL}${endpoint}`);
      Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
      
      console.log(`Fetching: ${url.toString()}`);
      const res = await fetch(url.toString(), {
        headers: { 
          "x-mc-auth": METRICOOL_AUTH, 
          "accept": acceptHeader 
        },
      });
      
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`${res.status}: ${errorText.substring(0, 200)}`);
      }
      
      if (acceptHeader === "text/csv") {
        return res.text();
      }
      return res.json();
    };

    // Parse timeline data [[timestampMs, valueStr], ...]
    const parseTimelineData = (data: any[]): TimelinePoint[] => {
      if (!Array.isArray(data)) return [];
      return data.map(([timestamp, value]) => ({
        timestamp: Number(timestamp),
        value: typeof value === 'string' ? parseFloat(value) || 0 : Number(value) || 0,
      }));
    };

    // Get latest value from timeline (max timestamp)
    const getLatestValue = (points: TimelinePoint[]): number => {
      if (points.length === 0) return 0;
      const sorted = [...points].sort((a, b) => b.timestamp - a.timestamp);
      return sorted[0].value;
    };

    // Sum all values in timeline
    const sumTimelineValues = (points: TimelinePoint[]): number => {
      return points.reduce((sum, p) => sum + p.value, 0);
    };

    // Parse CSV to video rows
    const parseVideosCSV = (csv: string): VideoData[] => {
      const lines = csv.split('\n').filter(l => l.trim());
      if (lines.length < 2) return [];

      // Parse headers - handle quoted headers
      const headerLine = lines[0];
      const headers = headerLine.split(',').map(h => h.trim().replace(/"/g, '').toLowerCase());
      
      // Find column indices
      const findColumn = (names: string[]): number => {
        for (const name of names) {
          const idx = headers.findIndex(h => h.includes(name.toLowerCase()));
          if (idx >= 0) return idx;
        }
        return -1;
      };

      const titleIdx = findColumn(['title', 'name']);
      const urlIdx = findColumn(['url', 'link', 'permalink']);
      const dateIdx = findColumn(['date', 'published', 'datetime']);
      const viewsIdx = findColumn(['views', 'view']);
      const likesIdx = findColumn(['likes', 'like']);
      const commentsIdx = findColumn(['comments', 'comment']);
      const sharesIdx = findColumn(['shares', 'share']);
      const avgViewDurIdx = findColumn(['averageviewduration', 'avg view duration', 'average view duration', 'avgviewduration']);
      const watchTimeIdx = findColumn(['watchtime', 'watch time', 'watchtimeminutes']);

      const videos: VideoData[] = [];

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        // Handle CSV parsing with quoted values
        const values: string[] = [];
        let current = '';
        let inQuotes = false;
        
        for (const char of line) {
          if (char === '"') {
            inQuotes = !inQuotes;
          } else if (char === ',' && !inQuotes) {
            values.push(current.trim());
            current = '';
          } else {
            current += char;
          }
        }
        values.push(current.trim());

        const getVal = (idx: number): string => {
          if (idx < 0 || idx >= values.length) return '';
          return values[idx].replace(/"/g, '').trim();
        };

        const getNumVal = (idx: number): number => {
          const val = getVal(idx);
          return parseFloat(val) || 0;
        };

        const title = getVal(titleIdx);
        const url = getVal(urlIdx);
        const publishedAt = getVal(dateIdx);
        const views = getNumVal(viewsIdx);
        const likes = getNumVal(likesIdx);
        const comments = getNumVal(commentsIdx);
        const shares = getNumVal(sharesIdx);
        const averageViewDuration = getNumVal(avgViewDurIdx);
        
        // Watch time might be in minutes, convert to hours
        let watchTimeHours = getNumVal(watchTimeIdx);
        if (watchTimeHours > 100) {
          // Likely in minutes, convert to hours
          watchTimeHours = watchTimeHours / 60;
        }

        if (title || url) {
          // Metricool returns thumbnail URLs like https://i.ytimg.com/vi/VIDEO_ID/default.jpg
          // Convert to proper YouTube watch URLs
          let videoUrl = url;
          if (url && (url.includes('ytimg.com/vi/') || url.includes('i9.ytimg.com/vi/'))) {
            const videoIdMatch = url.match(/\/vi\/([^/]+)\//);
            if (videoIdMatch) {
              videoUrl = `https://www.youtube.com/watch?v=${videoIdMatch[1]}`;
            }
          }
          
          videos.push({
            title,
            url: videoUrl,
            publishedAt,
            views,
            likes,
            comments,
            shares,
            averageViewDuration,
            watchTimeHours,
          });
        }
      }

      return videos;
    };

    // Fetch data for a period
    const fetchPeriodData = async (fromDate: string, toDate: string): Promise<WeeklyYouTubeData> => {
      const result: WeeklyYouTubeData = {
        totalSubscribers: 0,
        subscribersGained: 0,
        totalViews: 0,
        totalLikes: 0,
        totalComments: 0,
        totalShares: 0,
        videosCount: 0,
        avgViewDuration: 0,
        engagementPct: null,
        videos: [],
      };

      const timelineParams = {
        start: toTimelineFormat(fromDate),
        end: toTimelineFormat(toDate),
        timezone,
        userId,
        blogId: blogId || '',
      };

      const csvParams = {
        from: `${fromDate}T00:00:00`,
        to: `${toDate}T23:59:59`,
        timezone,
        userId,
        blogId: blogId || '',
        postsType: 'publishedInRange',
      };

      // Fetch all data in parallel
      const [totalSubsRes, subsGainedRes, videosCSVRes] = await Promise.allSettled([
        // 1) Total Subscribers timeline
        fetchMetricool("/api/stats/timeline/yttotalSubscribers", timelineParams),
        // 2) Subscribers Gained timeline
        fetchMetricool("/api/stats/timeline/ytsubscribersGained", timelineParams),
        // 3) Videos CSV
        fetchMetricool("/api/v2/analytics/posts/youtube", csvParams, "text/csv"),
      ]);

      // Process total subscribers
      if (totalSubsRes.status === 'fulfilled') {
        const points = parseTimelineData(totalSubsRes.value);
        result.totalSubscribers = getLatestValue(points);
        console.log(`Total subscribers (${fromDate} to ${toDate}): ${result.totalSubscribers}`);
      } else {
        errors.push(`totalSubscribers ${fromDate}: ${totalSubsRes.reason}`);
        console.error(`Total subscribers error:`, totalSubsRes.reason);
      }

      // Process subscribers gained
      if (subsGainedRes.status === 'fulfilled') {
        const points = parseTimelineData(subsGainedRes.value);
        result.subscribersGained = sumTimelineValues(points);
        console.log(`Subscribers gained (${fromDate} to ${toDate}): ${result.subscribersGained}`);
      } else {
        errors.push(`subscribersGained ${fromDate}: ${subsGainedRes.reason}`);
        console.error(`Subscribers gained error:`, subsGainedRes.reason);
      }

      // Process videos CSV
      if (videosCSVRes.status === 'fulfilled') {
        const videos = parseVideosCSV(videosCSVRes.value);
        result.videos = videos;
        result.videosCount = videos.length;

        // Aggregate metrics
        let totalWatchTime = 0;
        let weightedDurationSum = 0;

        for (const video of videos) {
          result.totalViews += video.views;
          result.totalLikes += video.likes;
          result.totalComments += video.comments;
          result.totalShares += video.shares;
          totalWatchTime += video.watchTimeHours;
          weightedDurationSum += video.averageViewDuration * video.views;
        }

        // Weighted average view duration
        if (result.totalViews > 0) {
          result.avgViewDuration = weightedDurationSum / result.totalViews;
        }

        // Engagement percentage
        if (result.totalViews > 0) {
          result.engagementPct = ((result.totalLikes + result.totalComments + result.totalShares) / result.totalViews) * 100;
        }

        // Sort videos by views descending for "Top 3"
        result.videos.sort((a, b) => b.views - a.views);

        console.log(`Videos (${fromDate} to ${toDate}): ${result.videosCount}, views: ${result.totalViews}, engagement: ${result.engagementPct?.toFixed(2)}%`);
      } else {
        errors.push(`videosCSV ${fromDate}: ${videosCSVRes.reason}`);
        console.error(`Videos CSV error:`, videosCSVRes.reason);
      }

      return result;
    };

    // Fetch both periods in parallel
    const [currentData, previousData] = await Promise.all([
      fetchPeriodData(from, to),
      fetchPeriodData(prevFrom, prevTo),
    ]);

    // Persist subscriber count to social_account_metrics so dashboard always has fresh data
    if (currentData.totalSubscribers > 0) {
      try {
        const { data: existingMetric } = await supabase
          .from("social_account_metrics")
          .select("id, followers")
          .eq("client_id", clientId)
          .eq("platform", "youtube")
          .gte("period_start", from)
          .lte("period_end", to)
          .order("collected_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (existingMetric) {
          await supabase
            .from("social_account_metrics")
            .update({
              followers: currentData.totalSubscribers,
              new_followers: currentData.subscribersGained,
              engagement_rate: currentData.engagementPct,
              total_content: currentData.videosCount,
              collected_at: new Date().toISOString(),
            })
            .eq("id", existingMetric.id);
          console.log(`Updated subscriber count to ${currentData.totalSubscribers} for metric ${existingMetric.id}`);
        } else {
          await supabase
            .from("social_account_metrics")
            .insert({
              client_id: clientId,
              platform: "youtube",
              followers: currentData.totalSubscribers,
              new_followers: currentData.subscribersGained,
              engagement_rate: currentData.engagementPct,
              total_content: currentData.videosCount,
              period_start: from,
              period_end: to,
              collected_at: new Date().toISOString(),
            });
          console.log(`Inserted new subscriber count: ${currentData.totalSubscribers}`);
        }
      } catch (persistErr) {
        console.error("Error persisting subscriber count:", persistErr);
        errors.push(`persist subscribers: ${persistErr}`);
      }
    }

    const response: YouTubeResponse = {
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
    console.error("Error in metricool-youtube:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : String(error) 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
