import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.87.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface MetricoolBlog {
  id: string;
  blogId?: string;
  name: string;
  picture: string;
  networks: string[];
}

interface MetricoolMetrics {
  followers?: number;
  following?: number;
  posts?: number;
  likes?: number;
  comments?: number;
  shares?: number;
  views?: number;
  engagement?: number;
  reach?: number;
  impressions?: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const metricoolToken = Deno.env.get("METRICOOL_USER_TOKEN")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { clientId, platform, userId, blogId, periodStart, periodEnd } = await req.json();

    if (!clientId || !platform || !userId) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing required parameters: clientId, platform, userId" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Syncing Metricool ${platform} data for client ${clientId}, userId: ${userId}, blogId: ${blogId || 'auto'}`);

    // Create sync log
    const { data: syncLog, error: syncLogError } = await supabase
      .from("social_sync_logs")
      .insert({
        client_id: clientId,
        platform: platform,
        status: "running",
      })
      .select()
      .single();

    if (syncLogError) {
      console.error("Error creating sync log:", syncLogError);
    }

    let recordsSynced = 0;
    let accountMetrics: MetricoolMetrics = {};

    // Metricool API base URL
    const baseUrl = "https://app.metricool.com/api";

    // Common headers for Metricool API - use X-Mc-Auth header as per documentation
    const metricoolHeaders = {
      "X-Mc-Auth": metricoolToken,
      "Content-Type": "application/json",
    };

    // Step 1: Get user's blogs and verify platform is connected
    let targetBlogId = blogId;
    let platformConnected = false;
    
    console.log("Fetching blogs for user...");
    const blogsResponse = await fetch(`${baseUrl}/admin/simpleProfiles?userId=${userId}`, {
      headers: metricoolHeaders,
    });

    if (!blogsResponse.ok) {
      const errorText = await blogsResponse.text();
      console.error("Metricool API error fetching blogs:", errorText);
      throw new Error(`Metricool API error: ${blogsResponse.status}`);
    }

    const blogsData = await blogsResponse.json();
    console.log("Full blogs response:", JSON.stringify(blogsData));
    
    // The API returns an array of blogs with platform-specific fields
    const blogs = Array.isArray(blogsData) ? blogsData : (blogsData.blogs || blogsData.profiles || []);
    
    if (blogs.length === 0) {
      throw new Error("No blogs found for this Metricool user");
    }

    // Check each blog for the target platform
    for (const blog of blogs) {
      // Platform fields are named like "tiktok", "linkedin", "instagram", etc.
      const platformField = blog[platform.toLowerCase()];
      console.log(`Blog ${blog.id} (${blog.label}): ${platform} = ${platformField}`);
      
      if (platformField) {
        platformConnected = true;
        if (!targetBlogId) {
          targetBlogId = blog.id;
          console.log(`Found blog with ${platform} connected: ${blog.label} (${blog.id})`);
        }
        break;
      }
    }

    if (!platformConnected) {
      const blogNames = blogs.map((b: any) => b.label || b.name).join(", ");
      throw new Error(`${platform} is not connected to any Metricool blog. Available blogs: ${blogNames}. Please connect ${platform} to your Metricool account first.`);
    }

    if (!targetBlogId) {
      targetBlogId = blogs[0].id;
      console.log(`Using first blog: ${blogs[0].label}, blogId: ${targetBlogId}`);
    }

    // Step 2: Fetch analytics for the platform
    const startDate = periodStart || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const endDate = periodEnd || new Date().toISOString().split('T')[0];

    console.log(`Fetching ${platform} analytics from ${startDate} to ${endDate}...`);
    console.log(`Using blogId: ${targetBlogId}`);
    
    // Try the /stats/overview endpoint which returns all network stats
    const overviewUrl = `${baseUrl}/stats/overview?userId=${userId}&blogId=${targetBlogId}&init=${startDate}&end=${endDate}`;
    console.log("Trying overview URL:", overviewUrl);
    
    const overviewResponse = await fetch(overviewUrl, { headers: metricoolHeaders });
    if (overviewResponse.ok) {
      const overviewData = await overviewResponse.json();
      console.log("Overview response:", JSON.stringify(overviewData).substring(0, 1000));
    } else {
      console.log("Overview failed:", overviewResponse.status);
    }
    
    // Get account stats - try multiple endpoint formats
    // Format 1: /stats/timeling/{network}Followers
    const statsUrl1 = `${baseUrl}/stats/timeling/${platform.toLowerCase()}Followers?userId=${userId}&blogId=${targetBlogId}&init=${startDate}&end=${endDate}`;
    // Format 2: /stats/{network}
    const statsUrl2 = `${baseUrl}/stats/${platform.toLowerCase()}?userId=${userId}&blogId=${targetBlogId}&init=${startDate}&end=${endDate}`;
    // Format 3: /{network}/stats
    const statsUrl3 = `${baseUrl}/${platform.toLowerCase()}/stats?userId=${userId}&blogId=${targetBlogId}&init=${startDate}&end=${endDate}`;
    
    console.log("Stats URL 1:", statsUrl1);
    console.log("Stats URL 2:", statsUrl2);
    console.log("Stats URL 3:", statsUrl3);
    
    // Try each URL format
    let statsResponse = await fetch(statsUrl1, { headers: metricoolHeaders });
    let statsUrl = statsUrl1;
    
    if (!statsResponse.ok) {
      console.log(`Stats URL 1 failed: ${statsResponse.status}`);
      statsResponse = await fetch(statsUrl2, { headers: metricoolHeaders });
      statsUrl = statsUrl2;
    }
    
    if (!statsResponse.ok) {
      console.log(`Stats URL 2 failed: ${statsResponse.status}`);
      statsResponse = await fetch(statsUrl3, { headers: metricoolHeaders });
      statsUrl = statsUrl3;
    }

    if (statsResponse.ok) {
      const statsData = await statsResponse.json();
      console.log(`${platform} stats response:`, JSON.stringify(statsData).substring(0, 500));

      // Extract metrics based on platform
      if (platform === "tiktok") {
        accountMetrics = {
          followers: statsData.followers || statsData.summary?.followers || 0,
          views: statsData.videoViews || statsData.summary?.videoViews || 0,
          likes: statsData.likes || statsData.summary?.likes || 0,
          comments: statsData.comments || statsData.summary?.comments || 0,
          shares: statsData.shares || statsData.summary?.shares || 0,
          engagement: statsData.engagementRate || statsData.summary?.engagementRate || 0,
        };
      } else if (platform === "linkedin") {
        accountMetrics = {
          followers: statsData.followers || statsData.summary?.followers || 0,
          impressions: statsData.impressions || statsData.summary?.impressions || 0,
          engagement: statsData.engagementRate || statsData.summary?.engagementRate || 0,
          reach: statsData.reach || statsData.summary?.reach || 0,
          likes: statsData.reactions || statsData.summary?.reactions || 0,
          comments: statsData.comments || statsData.summary?.comments || 0,
          shares: statsData.shares || statsData.summary?.shares || 0,
        };
      } else {
        // Generic extraction
        accountMetrics = {
          followers: statsData.followers || statsData.summary?.followers || 0,
          engagement: statsData.engagementRate || statsData.summary?.engagementRate || 0,
          reach: statsData.reach || statsData.summary?.reach || 0,
          impressions: statsData.impressions || statsData.summary?.impressions || 0,
        };
      }

      // Store account metrics
      const { error: metricsError } = await supabase
        .from("social_account_metrics")
        .insert({
          client_id: clientId,
          platform: platform,
          followers: accountMetrics.followers || 0,
          engagement_rate: accountMetrics.engagement || 0,
          period_start: startDate,
          period_end: endDate,
        });

      if (metricsError) {
        console.error("Error inserting account metrics:", metricsError);
      } else {
        recordsSynced++;
        console.log("Account metrics inserted successfully");
      }
    } else {
      const errorText = await statsResponse.text();
      console.error(`Stats API error: ${statsResponse.status}`, errorText);
    }

    // Step 3: Fetch content/posts - Metricool uses /posts/{network} or /videos/{network}
    // TikTok uses /videos/tiktok, LinkedIn uses /posts/linkedin
    const contentEndpoint = platform.toLowerCase() === "tiktok" ? "videos/tiktok" : `posts/${platform.toLowerCase()}`;
    const postsUrl = `${baseUrl}/${contentEndpoint}?userId=${userId}&blogId=${targetBlogId}&init=${startDate}&end=${endDate}`;
    
    console.log("Posts URL:", postsUrl);
    
    const postsResponse = await fetch(postsUrl, {
      headers: metricoolHeaders,
    });

    if (postsResponse.ok) {
      const postsData = await postsResponse.json();
      const posts = Array.isArray(postsData) ? postsData : (postsData.posts || postsData.content || []);
      
      console.log(`Found ${posts.length} ${platform} posts`);

      for (const post of posts) {
        // Upsert content
        const { data: content, error: contentError } = await supabase
          .from("social_content")
          .upsert({
            client_id: clientId,
            platform: platform,
            content_id: post.id || post.postId || `${platform}_${Date.now()}_${Math.random()}`,
            content_type: post.type || "post",
            published_at: post.publishedAt || post.date || new Date().toISOString(),
            url: post.url || post.permalink,
            title: (post.text || post.caption || post.title || "").substring(0, 100),
          }, { onConflict: 'client_id,platform,content_id' })
          .select()
          .single();

        if (contentError) {
          console.error("Error upserting content:", contentError);
          continue;
        }

        // Insert metrics
        const { error: postMetricsError } = await supabase
          .from("social_content_metrics")
          .insert({
            social_content_id: content.id,
            platform: platform,
            views: post.views || post.videoViews || 0,
            likes: post.likes || post.reactions || 0,
            comments: post.comments || 0,
            shares: post.shares || post.reposts || 0,
            reach: post.reach || 0,
            impressions: post.impressions || 0,
            interactions: (post.likes || 0) + (post.comments || 0) + (post.shares || 0),
            period_start: startDate,
            period_end: endDate,
          });

        if (postMetricsError) {
          console.error("Error inserting post metrics:", postMetricsError);
        } else {
          recordsSynced++;
        }
      }
    } else {
      const errorText = await postsResponse.text();
      console.error(`Posts API error: ${postsResponse.status}`, errorText);
    }

    // Update sync log
    if (syncLog?.id) {
      await supabase
        .from("social_sync_logs")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
          records_synced: recordsSynced,
        })
        .eq("id", syncLog.id);
    }

    console.log(`Metricool sync completed. Records synced: ${recordsSynced}`);

    return new Response(
      JSON.stringify({
        success: true,
        recordsSynced,
        platform,
        blogId: targetBlogId,
        accountMetrics,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in sync-metricool:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
