import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.87.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface MetricoolBlog {
  id: string;
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

    // Step 1: Get user's blogs if blogId not provided
    let targetBlogId = blogId;
    if (!targetBlogId) {
      console.log("Fetching blogs for user...");
      const blogsResponse = await fetch(`${baseUrl}/user/blogs?userId=${userId}`, {
        headers: {
          "Authorization": `Bearer ${metricoolToken}`,
          "Content-Type": "application/json",
        },
      });

      if (!blogsResponse.ok) {
        const errorText = await blogsResponse.text();
        console.error("Metricool API error fetching blogs:", errorText);
        throw new Error(`Metricool API error: ${blogsResponse.status}`);
      }

      const blogsData = await blogsResponse.json();
      const blogs: MetricoolBlog[] = blogsData.blogs || [];
      
      // Find a blog with the target platform
      const platformBlog = blogs.find((blog) => 
        blog.networks?.includes(platform.toLowerCase()) || 
        blog.networks?.includes(platform)
      );
      
      if (platformBlog) {
        targetBlogId = platformBlog.id;
        console.log(`Found blog ${platformBlog.name} with ${platform} network`);
      } else if (blogs.length > 0) {
        targetBlogId = blogs[0].id;
        console.log(`Using first blog: ${blogs[0].name}`);
      } else {
        throw new Error("No blogs found for this Metricool user");
      }
    }

    // Step 2: Fetch analytics for the platform
    const startDate = periodStart || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const endDate = periodEnd || new Date().toISOString().split('T')[0];

    console.log(`Fetching ${platform} analytics from ${startDate} to ${endDate}...`);
    
    // Get account stats
    const statsUrl = `${baseUrl}/stats/${platform.toLowerCase()}?userId=${userId}&blogId=${targetBlogId}&startDate=${startDate}&endDate=${endDate}`;
    
    const statsResponse = await fetch(statsUrl, {
      headers: {
        "Authorization": `Bearer ${metricoolToken}`,
        "Content-Type": "application/json",
      },
    });

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
      }
    } else {
      console.error(`Stats API error: ${statsResponse.status}`);
    }

    // Step 3: Fetch content/posts
    const postsUrl = `${baseUrl}/posts/${platform.toLowerCase()}?userId=${userId}&blogId=${targetBlogId}&startDate=${startDate}&endDate=${endDate}`;
    
    const postsResponse = await fetch(postsUrl, {
      headers: {
        "Authorization": `Bearer ${metricoolToken}`,
        "Content-Type": "application/json",
      },
    });

    if (postsResponse.ok) {
      const postsData = await postsResponse.json();
      const posts = postsData.posts || postsData.content || [];
      
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
