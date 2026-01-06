import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

interface MetricoolMetrics {
  followers?: number;
  newFollowers?: number;
  engagementRate?: number;
  totalContent?: number;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const metricoolToken = Deno.env.get("METRICOOL_USER_TOKEN");

    if (!metricoolToken) {
      throw new Error("METRICOOL_USER_TOKEN not configured");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    const { clientId, platform, periodStart, periodEnd } = await req.json();

    if (!clientId || !platform) {
      throw new Error("Missing required parameters: clientId, platform");
    }

    // Fetch config from database
    const { data: config, error: configError } = await supabase
      .from("client_metricool_config")
      .select("user_id, blog_id")
      .eq("client_id", clientId)
      .eq("platform", platform)
      .eq("is_active", true)
      .single();

    if (configError || !config) {
      throw new Error(`No Metricool config found for client ${clientId} and platform ${platform}`);
    }

    const userId = config.user_id;
    const blogId = config.blog_id;

    if (!userId) {
      throw new Error("Metricool user_id not configured for this client");
    }

    console.log("Starting Metricool sync:", { clientId, platform, userId, blogId });

    // Calculate date range (default to last 30 days)
    const endDate = periodEnd || new Date().toISOString().split("T")[0];
    const startDate = periodStart || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    // Create sync log entry
    const { data: syncLog, error: logError } = await supabase
      .from("social_sync_logs")
      .insert({
        client_id: clientId,
        platform: platform,
        status: "in_progress",
      })
      .select()
      .single();

    if (logError) {
      console.error("Failed to create sync log:", logError);
    }

    let recordsSynced = 0;
    let accountMetrics: MetricoolMetrics = {};

    // Metricool API base URL - using the v2 analytics endpoints discovered from network inspection
    const baseUrl = "https://app.metricool.com/api";

    // Common headers for Metricool API - use X-Mc-Auth header
    const metricoolHeaders = {
      "X-Mc-Auth": metricoolToken,
      "Content-Type": "application/json",
    };

    // Step 1: Get user's blogs/profiles to verify connection
    let targetBlogId = blogId;
    let platformConnected = false;
    
    console.log("Fetching profiles for user...");
    const profilesResponse = await fetch(`${baseUrl}/admin/simpleProfiles?userId=${userId}`, {
      headers: metricoolHeaders,
    });

    if (!profilesResponse.ok) {
      const errorText = await profilesResponse.text();
      console.error("Failed to fetch profiles:", profilesResponse.status, errorText);
      throw new Error(`Failed to fetch Metricool profiles: ${profilesResponse.status}`);
    }

    const profiles = await profilesResponse.json();
    console.log("Profiles response:", JSON.stringify(profiles).substring(0, 500));

    // Find the target blog/profile
    if (Array.isArray(profiles)) {
      for (const profile of profiles) {
        if (profile.id === targetBlogId || profile.blogId === targetBlogId) {
          platformConnected = true;
          targetBlogId = profile.id || profile.blogId;
          break;
        }
        // Check if platform is connected to this profile
        const platformKey = platform.toLowerCase();
        if (profile[platformKey] || profile.networks?.includes(platformKey)) {
          platformConnected = true;
          if (!targetBlogId) {
            targetBlogId = profile.id || profile.blogId;
          }
        }
      }
    }

    if (!targetBlogId) {
      console.log("No blogId provided and couldn't determine from profiles, using userId as blogId");
      targetBlogId = blogId || userId;
    }

    console.log("Using blogId:", targetBlogId, "Platform connected:", platformConnected);

    // Step 2: Fetch TikTok account stats using discovered endpoints
    // Based on network inspection: /api/v2/analytics/stats/tiktok and /api/stats/timeling/tiktokFollowers
    
    if (platform.toLowerCase() === "tiktok") {
      // Endpoint 1: /api/v2/analytics/stats/tiktok - Main analytics stats (use blog_id with underscore)
      const analyticsStatsUrl = `${baseUrl}/v2/analytics/stats/tiktok?userId=${userId}&blog_id=${targetBlogId}&init=${startDate}&end=${endDate}`;
      console.log("Fetching TikTok analytics stats:", analyticsStatsUrl);
      
      try {
        const statsResponse = await fetch(analyticsStatsUrl, { headers: metricoolHeaders });
        console.log("Analytics stats response status:", statsResponse.status);
        
        if (statsResponse.ok) {
          const statsData = await statsResponse.json();
          console.log("TikTok analytics stats:", JSON.stringify(statsData).substring(0, 1000));
          
          // Extract metrics from response
          if (statsData) {
            accountMetrics.followers = statsData.followers || statsData.totalFollowers;
            accountMetrics.newFollowers = statsData.newFollowers || statsData.followersGained;
            accountMetrics.engagementRate = statsData.engagementRate || statsData.engagement;
            accountMetrics.totalContent = statsData.posts || statsData.videos || statsData.totalContent;
          }
        } else {
          console.log("Analytics stats endpoint returned:", statsResponse.status);
        }
      } catch (e) {
        console.error("Error fetching analytics stats:", e);
      }

      // Endpoint 2: /api/stats/timeling/tiktokFollowers - Follower timeline (use start/end params)
      const followersUrl = `${baseUrl}/stats/timeling/tiktokFollowers?userId=${userId}&blog_id=${targetBlogId}&start=${startDate}&end=${endDate}`;
      console.log("Fetching TikTok followers timeline:", followersUrl);
      
      try {
        const followersResponse = await fetch(followersUrl, { headers: metricoolHeaders });
        console.log("Followers timeline response status:", followersResponse.status);
        
        if (followersResponse.ok) {
          const followersData = await followersResponse.json();
          console.log("TikTok followers data:", JSON.stringify(followersData).substring(0, 500));
          
          // Get latest follower count from timeline
          if (Array.isArray(followersData) && followersData.length > 0) {
            const latestEntry = followersData[followersData.length - 1];
            accountMetrics.followers = latestEntry.followers || latestEntry.value || accountMetrics.followers;
          } else if (followersData.data && Array.isArray(followersData.data)) {
            const latestEntry = followersData.data[followersData.data.length - 1];
            accountMetrics.followers = latestEntry.followers || latestEntry.value || accountMetrics.followers;
          }
        }
      } catch (e) {
        console.error("Error fetching followers timeline:", e);
      }
    } else {
      // For other platforms, try generic endpoints
      const statsUrl = `${baseUrl}/v2/analytics/stats/${platform.toLowerCase()}?userId=${userId}&blog_id=${targetBlogId}&init=${startDate}&end=${endDate}`;
      console.log("Fetching platform stats:", statsUrl);
      
      try {
        const statsResponse = await fetch(statsUrl, { headers: metricoolHeaders });
        if (statsResponse.ok) {
          const statsData = await statsResponse.json();
          console.log("Platform stats:", JSON.stringify(statsData).substring(0, 500));
          
          if (statsData) {
            accountMetrics.followers = statsData.followers || statsData.totalFollowers;
            accountMetrics.newFollowers = statsData.newFollowers;
            accountMetrics.engagementRate = statsData.engagementRate;
          }
        }
      } catch (e) {
        console.error("Error fetching platform stats:", e);
      }
    }

    // Store account metrics if we have any
    if (accountMetrics.followers || accountMetrics.newFollowers || accountMetrics.engagementRate) {
      console.log("Storing account metrics:", accountMetrics);
      
      const { error: metricsError } = await supabase
        .from("social_account_metrics")
        .insert({
          client_id: clientId,
          platform: platform,
          period_start: startDate,
          period_end: endDate,
          followers: accountMetrics.followers || null,
          new_followers: accountMetrics.newFollowers || null,
          engagement_rate: accountMetrics.engagementRate || null,
          total_content: accountMetrics.totalContent || null,
        });

      if (metricsError) {
        console.error("Failed to store account metrics:", metricsError);
      } else {
        recordsSynced++;
      }
    }

    // Step 3: Fetch content/videos using discovered endpoints
    // For TikTok: /api/v2/analytics/videos/tiktok and /api/videos/tiktok
    let contentData: any[] = [];
    
    if (platform.toLowerCase() === "tiktok") {
      // Try /api/v2/analytics/videos/tiktok first (more detailed)
      const analyticsVideosUrl = `${baseUrl}/v2/analytics/videos/tiktok?userId=${userId}&blog_id=${targetBlogId}&init=${startDate}&end=${endDate}`;
      console.log("Fetching TikTok analytics videos:", analyticsVideosUrl);
      
      try {
        const videosResponse = await fetch(analyticsVideosUrl, { headers: metricoolHeaders });
        console.log("Analytics videos response status:", videosResponse.status);
        
        if (videosResponse.ok) {
          const videosData = await videosResponse.json();
          console.log("TikTok analytics videos:", JSON.stringify(videosData).substring(0, 1000));
          
          if (Array.isArray(videosData)) {
            contentData = videosData;
          } else if (videosData.data && Array.isArray(videosData.data)) {
            contentData = videosData.data;
          } else if (videosData.videos && Array.isArray(videosData.videos)) {
            contentData = videosData.videos;
          }
        }
      } catch (e) {
        console.error("Error fetching analytics videos:", e);
      }

      // Fallback to /api/videos/tiktok if no data
      if (contentData.length === 0) {
        const videosUrl = `${baseUrl}/videos/tiktok?userId=${userId}&blog_id=${targetBlogId}&init=${startDate}&end=${endDate}`;
        console.log("Fetching TikTok videos (fallback):", videosUrl);
        
        try {
          const videosResponse = await fetch(videosUrl, { headers: metricoolHeaders });
          if (videosResponse.ok) {
            const videosData = await videosResponse.json();
            console.log("TikTok videos fallback:", JSON.stringify(videosData).substring(0, 500));
            
            if (Array.isArray(videosData)) {
              contentData = videosData;
            } else if (videosData.data) {
              contentData = videosData.data;
            }
          }
        } catch (e) {
          console.error("Error fetching videos fallback:", e);
        }
      }
    } else {
      // For other platforms
      const postsUrl = `${baseUrl}/v2/analytics/posts/${platform.toLowerCase()}?userId=${userId}&blog_id=${targetBlogId}&init=${startDate}&end=${endDate}`;
      console.log("Fetching platform posts:", postsUrl);
      
      try {
        const postsResponse = await fetch(postsUrl, { headers: metricoolHeaders });
        if (postsResponse.ok) {
          const postsData = await postsResponse.json();
          if (Array.isArray(postsData)) {
            contentData = postsData;
          } else if (postsData.data) {
            contentData = postsData.data;
          }
        }
      } catch (e) {
        console.error("Error fetching posts:", e);
      }
    }

    console.log(`Found ${contentData.length} content items`);

    // Store content and metrics
    for (const item of contentData) {
      const contentId = item.id || item.videoId || item.postId || `${platform}-${Date.now()}-${Math.random()}`;
      const publishedAt = item.publishedAt || item.createdAt || item.date || new Date().toISOString();
      
      // Upsert content
      const { data: contentRecord, error: contentError } = await supabase
        .from("social_content")
        .upsert({
          client_id: clientId,
          platform: platform,
          content_id: contentId,
          title: item.title || item.description || item.caption || null,
          url: item.url || item.link || item.permalink || null,
          published_at: publishedAt,
          content_type: platform.toLowerCase() === "tiktok" ? "video" : "post",
        }, { onConflict: "client_id,platform,content_id" })
        .select()
        .single();

      if (contentError) {
        console.error("Failed to upsert content:", contentError);
        continue;
      }

      // Insert content metrics
      const { error: metricsError } = await supabase
        .from("social_content_metrics")
        .insert({
          social_content_id: contentRecord.id,
          platform: platform,
          period_start: startDate,
          period_end: endDate,
          views: item.views || item.plays || item.videoViews || 0,
          likes: item.likes || item.hearts || 0,
          comments: item.comments || 0,
          shares: item.shares || 0,
          reach: item.reach || 0,
          impressions: item.impressions || 0,
          engagements: item.engagements || item.engagement || 0,
        });

      if (metricsError) {
        console.error("Failed to insert content metrics:", metricsError);
      } else {
        recordsSynced++;
      }
    }

    // Update sync log
    if (syncLog) {
      await supabase
        .from("social_sync_logs")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
          records_synced: recordsSynced,
        })
        .eq("id", syncLog.id);
    }

    console.log("Sync completed. Records synced:", recordsSynced);

    return new Response(
      JSON.stringify({
        success: true,
        recordsSynced,
        accountMetrics,
        contentCount: contentData.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Sync error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
