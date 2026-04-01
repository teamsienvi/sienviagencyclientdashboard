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

    // Parse CSV to video rows reliably handling quoted newlines and BOMs
    const parseVideosCSV = (csv: string): VideoData[] => {
      const normalizedText = csv.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
      const lines: string[] = [];
      let currentRecord = "";
      let isInsideQuotes = false;
      
      for (let i = 0; i < normalizedText.length; i++) {
        const char = normalizedText[i];
        if (char === '"') {
          isInsideQuotes = !isInsideQuotes;
          currentRecord += char;
        } else if (char === "\n" && !isInsideQuotes) {
          if (currentRecord.trim()) lines.push(currentRecord);
          currentRecord = "";
        } else {
          currentRecord += char;
        }
      }
      if (currentRecord.trim()) lines.push(currentRecord);

      if (lines.length < 2) return [];

      // Parse headers - strip \uFEFF BOM and handle quoted headers
      const headerLine = lines[0].replace(/^\uFEFF/, '').trim();
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
        // Handle CSV parsing with quoted values for columns
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
        postsType: 'all',
      };

      // Fetch all data in parallel — including timeline KPIs for period-specific totals
      const [
        totalSubsRes,
        subsGainedRes,
        videosCSVRes,
        viewsTimelineRes,
        likesTimelineRes,
        commentsTimelineRes,
        sharesTimelineRes,
      ] = await Promise.allSettled([
        // 1) Total Subscribers timeline
        fetchMetricool("/api/stats/timeline/yttotalSubscribers", timelineParams),
        // 2) Subscribers Gained timeline
        fetchMetricool("/api/stats/timeline/ytsubscribersGained", timelineParams),
        // 3) Videos CSV (for video list / top posts)
        fetchMetricool("/api/v2/analytics/posts/youtube", csvParams, "text/csv"),
        // 4) Views timeline (period-specific total)
        fetchMetricool("/api/stats/timeline/ytviews", timelineParams),
        // 5) Likes timeline (period-specific total)
        fetchMetricool("/api/stats/timeline/ytlikes", timelineParams),
        // 6) Comments timeline (period-specific total)
        fetchMetricool("/api/stats/timeline/ytcomments", timelineParams),
        // 7) Shares timeline (period-specific total)
        fetchMetricool("/api/stats/timeline/ytshares", timelineParams),
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

      // Process period-specific KPI totals from timeline APIs
      let timelineViewsAvailable = false;
      if (viewsTimelineRes.status === 'fulfilled') {
        const points = parseTimelineData(viewsTimelineRes.value);
        const sum = sumTimelineValues(points);
        if (points.length > 0) {
          result.totalViews = sum;
          timelineViewsAvailable = true;
          console.log(`Timeline views (${fromDate} to ${toDate}): ${sum}`);
        }
      } else {
        errors.push(`ytviews timeline ${fromDate}: ${viewsTimelineRes.reason}`);
        console.error(`Views timeline error:`, viewsTimelineRes.reason);
      }

      let timelineLikesAvailable = false;
      if (likesTimelineRes.status === 'fulfilled') {
        const points = parseTimelineData(likesTimelineRes.value);
        const sum = sumTimelineValues(points);
        if (points.length > 0) {
          result.totalLikes = sum;
          timelineLikesAvailable = true;
          console.log(`Timeline likes (${fromDate} to ${toDate}): ${sum}`);
        }
      } else {
        errors.push(`ytlikes timeline ${fromDate}: ${likesTimelineRes.reason}`);
        console.error(`Likes timeline error:`, likesTimelineRes.reason);
      }

      let timelineCommentsAvailable = false;
      if (commentsTimelineRes.status === 'fulfilled') {
        const points = parseTimelineData(commentsTimelineRes.value);
        const sum = sumTimelineValues(points);
        if (points.length > 0) {
          result.totalComments = sum;
          timelineCommentsAvailable = true;
          console.log(`Timeline comments (${fromDate} to ${toDate}): ${sum}`);
        }
      } else {
        errors.push(`ytcomments timeline ${fromDate}: ${commentsTimelineRes.reason}`);
        console.error(`Comments timeline error:`, commentsTimelineRes.reason);
      }

      let timelineSharesAvailable = false;
      if (sharesTimelineRes.status === 'fulfilled') {
        const points = parseTimelineData(sharesTimelineRes.value);
        const sum = sumTimelineValues(points);
        if (points.length > 0) {
          result.totalShares = sum;
          timelineSharesAvailable = true;
          console.log(`Timeline shares (${fromDate} to ${toDate}): ${sum}`);
        }
      } else {
        errors.push(`ytshares timeline ${fromDate}: ${sharesTimelineRes.reason}`);
        console.error(`Shares timeline error:`, sharesTimelineRes.reason);
      }

      // Process videos CSV — used for video list and as fallback for KPI totals
      if (videosCSVRes.status === 'fulfilled') {
        const allVideos = parseVideosCSV(videosCSVRes.value);
        
        // Filter videos to only include those actually published during this period
        // because Metricool postsType: "all" returns historical videos too
        const start = new Date(fromDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(toDate);
        end.setHours(23, 59, 59, 999);

        const periodVideos = allVideos.filter(v => {
          if (!v.publishedAt) return true; // include if no date to be safe
          const pubDate = new Date(v.publishedAt);
          if (isNaN(pubDate.getTime())) return true;
          return pubDate >= start && pubDate <= end;
        });

        result.videos = periodVideos;
        result.videosCount = periodVideos.length;

        // Aggregate from CSV only as fallback if timeline APIs didn't provide data
        let totalWatchTime = 0;
        let weightedDurationSum = 0;
        let csvViews = 0, csvLikes = 0, csvComments = 0, csvShares = 0;

        for (const video of allVideos) {
          csvViews += video.views;
          csvLikes += video.likes;
          csvComments += video.comments;
          csvShares += video.shares;
          totalWatchTime += video.watchTimeHours;
          weightedDurationSum += video.averageViewDuration * video.views;
        }

        // Use CSV aggregation as fallback if timeline data was not available
        if (!timelineViewsAvailable) result.totalViews = csvViews;
        if (!timelineLikesAvailable) result.totalLikes = csvLikes;
        if (!timelineCommentsAvailable) result.totalComments = csvComments;
        if (!timelineSharesAvailable) result.totalShares = csvShares;

        // Weighted average view duration (from CSV, timeline doesn't provide this)
        const viewsForDuration = timelineViewsAvailable ? result.totalViews : csvViews;
        if (viewsForDuration > 0) {
          result.avgViewDuration = weightedDurationSum / viewsForDuration;
        }

        // Sort videos by views descending for "Top 3"
        result.videos.sort((a, b) => b.views - a.views);

        console.log(`Videos (${fromDate} to ${toDate}): ${result.videosCount}, views: ${result.totalViews}, likes: ${result.totalLikes}`);
      } else {
        errors.push(`videosCSV ${fromDate}: ${videosCSVRes.reason}`);
        console.error(`Videos CSV error:`, videosCSVRes.reason);
      }

      // Engagement percentage (based on final KPI totals)
      if (result.totalViews > 0) {
        result.engagementPct = ((result.totalLikes + result.totalComments + result.totalShares) / result.totalViews) * 100;
      }

      console.log(`Period ${fromDate} to ${toDate} final KPIs — views: ${result.totalViews}, likes: ${result.totalLikes}, comments: ${result.totalComments}, shares: ${result.totalShares}, engagement: ${result.engagementPct?.toFixed(2)}%`);

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

    // Persist video content to social_content + social_content_metrics for Top Performing Posts
    if (currentData.videos.length > 0) {
      try {
        for (const video of currentData.videos) {
          if (!video.title && !video.url) continue;

          // Generate stable content_id from URL or title
          const videoIdMatch = video.url?.match(/[?&]v=([^&]+)/);
          const contentId = videoIdMatch ? videoIdMatch[1] : `yt_${video.title.substring(0, 50).replace(/[^a-zA-Z0-9]/g, '_')}`;

          // Parse published date
          let publishedAt = new Date().toISOString();
          if (video.publishedAt) {
            const parsed = new Date(video.publishedAt.replace(' ', 'T'));
            if (!isNaN(parsed.getTime())) {
              publishedAt = parsed.toISOString();
            }
          }

          // Upsert social_content
          const { data: contentRow, error: contentErr } = await supabase
            .from("social_content")
            .upsert(
              {
                client_id: clientId,
                platform: "youtube",
                content_id: contentId,
                content_type: "video",
                title: video.title,
                url: video.url || null,
                published_at: publishedAt,
              },
              { onConflict: "client_id,platform,content_id" }
            )
            .select("id")
            .single();

          if (contentErr) {
            console.error(`Error upserting content ${contentId}:`, contentErr.message);
            continue;
          }

          // Upsert social_content_metrics
          if (contentRow) {
            await supabase
              .from("social_content_metrics")
              .upsert(
                {
                  social_content_id: contentRow.id,
                  platform: "youtube",
                  period_start: from,
                  period_end: to,
                  views: video.views,
                  likes: video.likes,
                  comments: video.comments,
                  shares: video.shares,
                  collected_at: new Date().toISOString(),
                },
                { onConflict: "social_content_id,period_start,period_end" }
              );
          }
        }
        console.log(`Persisted ${currentData.videos.length} YouTube videos to social_content`);
      } catch (persistContentErr) {
        console.error("Error persisting YouTube content:", persistContentErr);
        errors.push(`persist content: ${persistContentErr}`);
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
