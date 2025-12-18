import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.87.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const youtubeApiKey = Deno.env.get("YOUTUBE_API_KEY");
    
    if (!youtubeApiKey) {
      console.error("YOUTUBE_API_KEY is not configured");
      return new Response(
        JSON.stringify({ success: false, error: "YouTube API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { clientId, accountId, channelId: inputChannelId, channelHandle, periodStart, periodEnd } = await req.json();

    if (!inputChannelId && !channelHandle) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing channel ID or handle" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let channelId = inputChannelId;

    // If handle provided, resolve to channel ID
    if (!channelId && channelHandle) {
      const handle = channelHandle.startsWith('@') ? channelHandle.slice(1) : channelHandle;
      const handleUrl = `https://www.googleapis.com/youtube/v3/channels?part=id,snippet&forHandle=${handle}&key=${youtubeApiKey}`;
      
      console.log(`Resolving handle @${handle} to channel ID...`);
      const handleResponse = await fetch(handleUrl);
      
      if (!handleResponse.ok) {
        const errorText = await handleResponse.text();
        console.error("YouTube API error resolving handle:", errorText);
        throw new Error(`Failed to resolve channel handle: ${handleResponse.status}`);
      }
      
      const handleData = await handleResponse.json();
      if (!handleData.items?.[0]?.id) {
        throw new Error(`Channel not found for handle: @${handle}`);
      }
      
      channelId = handleData.items[0].id;
      console.log(`Resolved @${handle} to channel ID: ${channelId}`);
    }

    console.log(`Syncing YouTube data for channel ${channelId}`);

    let recordsSynced = 0;

    // Fetch channel statistics using API key
    const channelUrl = `https://www.googleapis.com/youtube/v3/channels?part=statistics,snippet&id=${channelId}&key=${youtubeApiKey}`;
    
    console.log("Fetching channel statistics...");
    const channelResponse = await fetch(channelUrl);

    if (!channelResponse.ok) {
      const errorText = await channelResponse.text();
      console.error("YouTube API error:", errorText);
      throw new Error(`YouTube API error: ${channelResponse.status} - ${errorText}`);
    }

    const channelData = await channelResponse.json();
    const channel = channelData.items?.[0];

    if (!channel) {
      throw new Error("Channel not found");
    }

    const subscriberCount = parseInt(channel.statistics?.subscriberCount || "0");
    const videoCount = parseInt(channel.statistics?.videoCount || "0");
    const viewCount = parseInt(channel.statistics?.viewCount || "0");

    console.log(`Channel found: ${channel.snippet?.title}, Subscribers: ${subscriberCount}`);

    // Fetch recent videos using YouTube Data API
    const videosUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&type=video&order=date&publishedAfter=${periodStart}T00:00:00Z&publishedBefore=${periodEnd}T23:59:59Z&maxResults=50&key=${youtubeApiKey}`;

    console.log("Fetching recent videos...");
    const videosResponse = await fetch(videosUrl);

    if (!videosResponse.ok) {
      const errorText = await videosResponse.text();
      console.error("YouTube API error fetching videos:", errorText);
    }

    const videosData = videosResponse.ok ? await videosResponse.json() : { items: [] };
    const videoItems = videosData.items || [];

    console.log(`Found ${videoItems.length} videos in date range`);

    // Get video IDs for statistics
    const videoIds = videoItems.map((v: any) => v.id.videoId).join(",");

    // Fetch video statistics
    let videoStats: any[] = [];
    if (videoIds) {
      const statsUrl = `https://www.googleapis.com/youtube/v3/videos?part=statistics,contentDetails,snippet&id=${videoIds}&key=${youtubeApiKey}`;
      
      const statsResponse = await fetch(statsUrl);

      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        videoStats = statsData.items || [];
      }
    }

    // Store content and metrics
    for (const video of videoStats) {
      const videoId = video.id;
      const stats = video.statistics || {};
      const contentDetails = video.contentDetails || {};
      const snippet = video.snippet || {};

      // Determine content type (video or short)
      const duration = contentDetails.duration || "PT0S";
      const durationSeconds = parseDuration(duration);
      const contentType = durationSeconds <= 60 ? "short" : "video";

      // Upsert content - only include social_account_id if it's a valid UUID
      const contentData: any = {
        client_id: clientId,
        platform: "youtube",
        content_id: videoId,
        content_type: contentType,
        published_at: snippet.publishedAt || new Date().toISOString(),
        url: `https://www.youtube.com/watch?v=${videoId}`,
        title: snippet.title?.substring(0, 100),
      };
      
      // Only add social_account_id if it's a valid UUID
      if (accountId && accountId.length === 36) {
        contentData.social_account_id = accountId;
      }

      const { data: content, error: contentError } = await supabase
        .from("social_content")
        .upsert(contentData, { onConflict: 'client_id,platform,content_id' })
        .select()
        .single();

      if (contentError) {
        console.error("Error upserting content:", contentError);
        continue;
      }

      // Insert metrics snapshot
      const views = parseInt(stats.viewCount || "0");
      const likes = parseInt(stats.likeCount || "0");
      const comments = parseInt(stats.commentCount || "0");
      const interactions = likes + comments;
      
      // Improved watch time estimation based on content type and industry averages:
      // - Shorts (≤60s): ~75% average view duration (high retention for short content)
      // - Short videos (1-5 min): ~50% average view duration
      // - Medium videos (5-20 min): ~40% average view duration  
      // - Long videos (20+ min): ~30% average view duration
      let retentionRate: number;
      if (durationSeconds <= 60) {
        retentionRate = 0.75; // Shorts have high retention
      } else if (durationSeconds <= 300) {
        retentionRate = 0.50; // 1-5 min videos
      } else if (durationSeconds <= 1200) {
        retentionRate = 0.40; // 5-20 min videos
      } else {
        retentionRate = 0.30; // 20+ min videos
      }
      
      const estimatedWatchTimeHours = (views * durationSeconds * retentionRate) / 3600;

      const { error: metricsError } = await supabase
        .from("social_content_metrics")
        .insert({
          social_content_id: content.id,
          platform: "youtube",
          views,
          likes,
          comments,
          shares: 0, // YouTube doesn't expose shares via API
          interactions,
          subscribers: subscriberCount,
          watch_time_hours: estimatedWatchTimeHours,
          click_through_rate: 0, // Would need YouTube Analytics API with OAuth
          period_start: periodStart,
          period_end: periodEnd,
        });

      if (metricsError) {
        console.error("Error inserting metrics:", metricsError);
      } else {
        recordsSynced++;
      }
    }

    // Calculate engagement rate
    const totalInteractions = videoStats.reduce((sum, v) => {
      const stats = v.statistics || {};
      return sum + parseInt(stats.likeCount || "0") + parseInt(stats.commentCount || "0");
    }, 0);
    
    const engagementRate = subscriberCount > 0 ? (totalInteractions / subscriberCount) * 100 : 0;

    // Store account metrics - only include social_account_id if valid
    const accountMetricsData: any = {
      client_id: clientId,
      platform: "youtube",
      followers: subscriberCount,
      engagement_rate: engagementRate,
      total_content: videoStats.length,
      period_start: periodStart,
      period_end: periodEnd,
    };
    
    if (accountId && accountId.length === 36) {
      accountMetricsData.social_account_id = accountId;
    }

    const { error: accountMetricsError } = await supabase
      .from("social_account_metrics")
      .insert(accountMetricsData);

    if (accountMetricsError) {
      console.error("Error inserting account metrics:", accountMetricsError);
    }

    // Populate top_performing_posts table
    // First, find or create a report for this client and date range
    const { data: existingReport } = await supabase
      .from("reports")
      .select("id")
      .eq("client_id", clientId)
      .eq("week_start", periodStart)
      .eq("week_end", periodEnd)
      .maybeSingle();

    let reportId = existingReport?.id;

    if (!reportId) {
      // Create a new report
      const { data: newReport, error: reportError } = await supabase
        .from("reports")
        .insert({
          client_id: clientId,
          date_range: `${periodStart} - ${periodEnd}`,
          week_start: periodStart,
          week_end: periodEnd,
        })
        .select("id")
        .single();

      if (reportError) {
        console.error("Error creating report:", reportError);
      } else {
        reportId = newReport.id;
      }
    }

    // Insert top performing YouTube posts
    if (reportId) {
      // Calculate reach and engagement tiers for each video
      const topPostsToInsert = videoStats
        .map((video) => {
          const stats = video.statistics || {};
          const views = parseInt(stats.viewCount || "0");
          const likes = parseInt(stats.likeCount || "0");
          const comments = parseInt(stats.commentCount || "0");
          const engagementPercent = views > 0 ? ((likes + comments) / views) * 100 : 0;

          // Calculate reach tier (using views as proxy for reach)
          let reachTier = "Tier 1";
          if (views >= 100000) reachTier = "Tier 5";
          else if (views >= 20000) reachTier = "Tier 4";
          else if (views >= 5000) reachTier = "Tier 3";
          else if (views >= 1000) reachTier = "Tier 2";

          // Calculate engagement tier
          let engagementTier = "Tier 5";
          if (engagementPercent >= 7) engagementTier = "Tier 1";
          else if (engagementPercent >= 5) engagementTier = "Tier 2";
          else if (engagementPercent >= 3) engagementTier = "Tier 3";
          else if (engagementPercent >= 1) engagementTier = "Tier 4";

          // Calculate influence score (1-5)
          let influence = 1;
          if (reachTier === "Tier 4" || reachTier === "Tier 5") influence++;
          if (engagementTier === "Tier 1" || engagementTier === "Tier 2") influence++;
          if (views >= videoStats.reduce((sum, v) => sum + parseInt(v.statistics?.viewCount || "0"), 0) / videoStats.length) influence++;
          influence = Math.min(influence, 5);

          return {
            report_id: reportId,
            link: `https://www.youtube.com/watch?v=${video.id}`,
            views,
            engagement_percent: parseFloat(engagementPercent.toFixed(2)),
            platform: "Youtube",
            followers: subscriberCount,
            reach_tier: reachTier,
            engagement_tier: engagementTier,
            influence,
          };
        })
        .sort((a, b) => b.engagement_percent - a.engagement_percent)
        .slice(0, 10); // Top 10 posts

      // Delete existing YouTube posts for this report to avoid duplicates
      await supabase
        .from("top_performing_posts")
        .delete()
        .eq("report_id", reportId)
        .eq("platform", "Youtube");

      // Insert new top posts
      if (topPostsToInsert.length > 0) {
        const { error: topPostsError } = await supabase
          .from("top_performing_posts")
          .insert(topPostsToInsert);

        if (topPostsError) {
          console.error("Error inserting top performing posts:", topPostsError);
        } else {
          console.log(`Inserted ${topPostsToInsert.length} top performing YouTube posts`);
        }
      }
    }

    console.log(`YouTube sync completed. Records synced: ${recordsSynced}`);

    return new Response(
      JSON.stringify({
        success: true,
        recordsSynced,
        platform: "youtube",
        channelName: channel.snippet?.title,
        accountMetrics: {
          subscribers: subscriberCount,
          totalVideos: videoCount,
          totalViews: viewCount,
          engagementRate,
          contentInPeriod: videoStats.length,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in sync-youtube:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// Helper function to parse ISO 8601 duration
function parseDuration(duration: string): number {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  
  const hours = parseInt(match[1] || "0");
  const minutes = parseInt(match[2] || "0");
  const seconds = parseInt(match[3] || "0");
  
  return hours * 3600 + minutes * 60 + seconds;
}
