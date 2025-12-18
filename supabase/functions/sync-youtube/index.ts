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

    const { clientId, accountId, channelId, periodStart, periodEnd } = await req.json();

    if (!channelId) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing channel ID" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
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

      // Upsert content
      const { data: content, error: contentError } = await supabase
        .from("social_content")
        .upsert({
          client_id: clientId,
          social_account_id: accountId,
          platform: "youtube",
          content_id: videoId,
          content_type: contentType,
          published_at: snippet.publishedAt || new Date().toISOString(),
          url: `https://www.youtube.com/watch?v=${videoId}`,
          title: snippet.title?.substring(0, 100),
        }, { onConflict: 'client_id,platform,content_id' })
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
          watch_time_hours: 0, // Would need YouTube Analytics API with OAuth
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

    // Store account metrics
    const { error: accountMetricsError } = await supabase
      .from("social_account_metrics")
      .insert({
        client_id: clientId,
        social_account_id: accountId,
        platform: "youtube",
        followers: subscriberCount,
        engagement_rate: engagementRate,
        total_content: videoStats.length,
        period_start: periodStart,
        period_end: periodEnd,
      });

    if (accountMetricsError) {
      console.error("Error inserting account metrics:", accountMetricsError);
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
