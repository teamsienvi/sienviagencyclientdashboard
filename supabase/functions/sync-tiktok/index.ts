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
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { clientId, accountId, platform, accessToken, accountExternalId, periodStart, periodEnd } = await req.json();

    if (!accessToken) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing access token" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Syncing TikTok data for account ${accountExternalId}`);

    let recordsSynced = 0;

    // TikTok Business API base URL
    const baseUrl = "https://business-api.tiktok.com/open_api/v1.3";

    // Fetch user info for follower count
    const userInfoUrl = `${baseUrl}/user/info/`;
    
    console.log("Fetching TikTok user info...");
    const userResponse = await fetch(userInfoUrl, {
      headers: {
        "Access-Token": accessToken,
        "Content-Type": "application/json",
      },
    });

    if (!userResponse.ok) {
      const errorText = await userResponse.text();
      console.error("TikTok API error:", errorText);
      throw new Error(`TikTok API error: ${userResponse.status}`);
    }

    const userData = await userResponse.json();
    
    if (userData.code !== 0) {
      throw new Error(`TikTok API error: ${userData.message}`);
    }

    const followerCount = userData.data?.user?.follower_count || 0;

    // Fetch videos with metrics
    const videosUrl = `${baseUrl}/video/list/`;
    
    console.log("Fetching TikTok videos...");
    const videosResponse = await fetch(videosUrl, {
      method: "POST",
      headers: {
        "Access-Token": accessToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        business_id: accountExternalId,
        filters: {
          create_time_start: new Date(periodStart).getTime() / 1000,
          create_time_end: new Date(periodEnd).getTime() / 1000,
        },
        max_count: 50,
      }),
    });

    if (!videosResponse.ok) {
      const errorText = await videosResponse.text();
      console.error("TikTok API error fetching videos:", errorText);
    }

    const videosData = videosResponse.ok ? await videosResponse.json() : { data: { videos: [] } };
    const videos = videosData.data?.videos || [];

    // Store content and metrics
    for (const video of videos) {
      // Upsert content
      const { data: content, error: contentError } = await supabase
        .from("social_content")
        .upsert({
          client_id: clientId,
          social_account_id: accountId,
          platform: "tiktok",
          content_id: video.item_id || video.video_id,
          content_type: "video",
          published_at: video.create_time ? new Date(video.create_time * 1000).toISOString() : new Date().toISOString(),
          url: video.share_url || `https://www.tiktok.com/@${accountExternalId}/video/${video.item_id}`,
          title: video.title?.substring(0, 100) || video.video_description?.substring(0, 100),
        }, { onConflict: 'client_id,platform,content_id' })
        .select()
        .single();

      if (contentError) {
        console.error("Error upserting content:", contentError);
        continue;
      }

      // Extract metrics
      const views = video.video_views || video.play_count || 0;
      const likes = video.likes || video.digg_count || 0;
      const comments = video.comments || video.comment_count || 0;
      const shares = video.shares || video.share_count || 0;
      const interactions = likes + comments + shares;

      // Insert metrics snapshot
      const { error: metricsError } = await supabase
        .from("social_content_metrics")
        .insert({
          social_content_id: content.id,
          platform: "tiktok",
          views,
          likes,
          comments,
          shares,
          interactions,
          reach: views, // TikTok doesn't separate reach from views
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
    const totalInteractions = videos.reduce((sum: number, v: any) => {
      return sum + (v.likes || v.digg_count || 0) + 
             (v.comments || v.comment_count || 0) + 
             (v.shares || v.share_count || 0);
    }, 0);
    
    const engagementRate = followerCount > 0 ? (totalInteractions / followerCount) * 100 : 0;

    // Store account metrics
    const { error: accountMetricsError } = await supabase
      .from("social_account_metrics")
      .insert({
        client_id: clientId,
        social_account_id: accountId,
        platform: "tiktok",
        followers: followerCount,
        engagement_rate: engagementRate,
        total_content: videos.length,
        period_start: periodStart,
        period_end: periodEnd,
      });

    if (accountMetricsError) {
      console.error("Error inserting account metrics:", accountMetricsError);
    }

    console.log(`TikTok sync completed. Records synced: ${recordsSynced}`);

    return new Response(
      JSON.stringify({
        success: true,
        recordsSynced,
        platform: "tiktok",
        accountMetrics: {
          followers: followerCount,
          engagementRate,
          totalContent: videos.length,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in sync-tiktok:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
