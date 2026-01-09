import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface InstagramPost {
  title: string | null;
  date: string | null;
  type: string | null;
  reach: number;
  impressions: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  engagement: number;
  url: string | null;
  link: string | null;
  image: string | null;
}

function parseCSV(csvText: string): InstagramPost[] {
  const lines = csvText.trim().split("\n");
  if (lines.length < 2) return [];

  const headerLine = lines[0].replace(/^\uFEFF/, "").trim();
  const headers = headerLine.split(",").map((h) => h.trim().toLowerCase());
  
  console.log("CSV Headers:", headers);

  const rows: InstagramPost[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let j = 0; j < line.length; j++) {
      const char = line[j];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === "," && !inQuotes) {
        values.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    values.push(current.trim());

    const row: Record<string, string> = {};
    headers.forEach((header, idx) => {
      row[header] = values[idx] || "";
    });

    // Map CSV columns: id, type, image, url, content, timestamp, views, reach (organic), likes, saved, comments, interactions, engagement
    const post: InstagramPost = {
      title: row["content"] || row["title"] || row["caption"] || null,
      date: row["timestamp"] || row["date"] || row["published"] || null,
      type: row["type"] || row["format"] || null,
      reach: parseInt(row["reach (organic)"] || row["reach"] || "0", 10) || 0,
      impressions: parseInt(row["views"] || row["impressions"] || "0", 10) || 0,
      likes: parseInt(row["likes"] || "0", 10) || 0,
      comments: parseInt(row["comments"] || "0", 10) || 0,
      shares: parseInt(row["shares"] || "0", 10) || 0,
      saves: parseInt(row["saved"] || row["saves"] || "0", 10) || 0,
      engagement: parseFloat(row["engagement"] || row["engageme"] || "0") || 0,
      url: row["url"] || null,
      link: row["link"] || null,
      image: row["image"] || null,
    };

    rows.push(post);
  }

  return rows;
}

function parseMetricoolDate(dateStr: string | null): string {
  if (!dateStr) return new Date().toISOString();
  
  const parsed = new Date(dateStr);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString();
  }
  
  return new Date().toISOString();
}

function generateContentId(post: InstagramPost): string {
  const urlPart = post.url || post.link || "";
  const datePart = post.date || "";
  const titlePart = post.title || "";
  
  const combined = `${urlPart}-${datePart}-${titlePart}`;
  let hash = 0;
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return `ig_${Math.abs(hash).toString(16)}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { clientId, periodStart, periodEnd } = await req.json();

    if (!clientId) {
      return new Response(
        JSON.stringify({ error: "Missing required param: clientId" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch config from database
    const { data: config, error: configError } = await supabase
      .from("client_metricool_config")
      .select("user_id, blog_id")
      .eq("client_id", clientId)
      .eq("platform", "instagram")
      .eq("is_active", true)
      .single();

    if (configError || !config) {
      return new Response(
        JSON.stringify({ error: `No Metricool Instagram config found for client ${clientId}` }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = config.user_id;
    const blogId = config.blog_id;

    console.log("Starting Instagram Metricool sync:", { clientId, userId, blogId });

    const METRICOOL_BASE_URL = Deno.env.get("METRICOOL_BASE_URL") || "https://app.metricool.com";
    const METRICOOL_AUTH = Deno.env.get("METRICOOL_USER_TOKEN");

    if (!METRICOOL_AUTH) {
      return new Response(
        JSON.stringify({ error: "METRICOOL_USER_TOKEN not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Calculate date range (default to last 7 days)
    const endDate = periodEnd || new Date().toISOString().split("T")[0];
    const startDate = periodStart || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    // Create sync log
    const { data: syncLog } = await supabase
      .from("social_sync_logs")
      .insert({
        client_id: clientId,
        platform: "instagram",
        status: "in_progress",
      })
      .select()
      .single();

    // Fetch Instagram posts from Metricool
    const postsUrl = new URL(`${METRICOOL_BASE_URL}/api/v2/analytics/posts/instagram`);
    postsUrl.searchParams.set("from", `${startDate}T00:00:00`);
    postsUrl.searchParams.set("to", `${endDate}T23:59:59`);
    postsUrl.searchParams.set("timezone", "UTC");
    postsUrl.searchParams.set("userId", userId);
    if (blogId) {
      postsUrl.searchParams.set("blogId", blogId);
    }

    console.log("Fetching Instagram posts:", postsUrl.toString());

    const postsResponse = await fetch(postsUrl.toString(), {
      method: "GET",
      headers: {
        "x-mc-auth": METRICOOL_AUTH,
        "accept": "text/csv",
      },
    });

    console.log("Posts response status:", postsResponse.status);

    let rows: InstagramPost[] = [];
    let savedCount = 0;

    if (postsResponse.ok) {
      const csvText = await postsResponse.text();
      console.log("CSV response length:", csvText.length);
      console.log("CSV preview:", csvText.substring(0, 500));
      
      rows = parseCSV(csvText);
      console.log("Parsed rows count:", rows.length);

      // Persist posts to database
      for (const post of rows) {
        const contentId = generateContentId(post);
        const publishedAt = parseMetricoolDate(post.date);
        const postUrl = post.url || post.link || null;

        const { data: contentData, error: contentError } = await supabase
          .from("social_content")
          .upsert({
            client_id: clientId,
            content_id: contentId,
            platform: "instagram",
            content_type: post.type === "REEL" || post.type === "reel" ? "reel" : "post",
            title: post.title,
            url: postUrl,
            published_at: publishedAt,
          }, { onConflict: "client_id,content_id" })
          .select("id")
          .single();

        if (contentError) {
          console.error("Error upserting content:", contentError);
          continue;
        }

        const { error: metricsError } = await supabase
          .from("social_content_metrics")
          .upsert({
            social_content_id: contentData.id,
            platform: "instagram",
            period_start: startDate,
            period_end: endDate,
            reach: post.reach,
            impressions: post.impressions,
            likes: post.likes,
            comments: post.comments,
            shares: post.shares,
            collected_at: new Date().toISOString(),
          }, { onConflict: "social_content_id,period_start,period_end" });

        if (metricsError) {
          console.error("Error upserting metrics:", metricsError);
          continue;
        }

        savedCount++;
      }
    } else {
      const errorText = await postsResponse.text();
      console.error("Posts fetch failed:", postsResponse.status, errorText);
    }

    // Fetch followers from distribution endpoint (more reliable)
    let followers: number | null = null;
    let newFollowers: number | null = null;
    try {
      const distUrl = new URL(`${METRICOOL_BASE_URL}/api/v2/analytics/distribution`);
      distUrl.searchParams.set("from", startDate);
      distUrl.searchParams.set("to", endDate);
      distUrl.searchParams.set("network", "instagram");
      distUrl.searchParams.set("userId", userId);
      if (blogId) {
        distUrl.searchParams.set("blogId", blogId);
      }

      console.log("Fetching Instagram distribution:", distUrl.toString());

      const distResponse = await fetch(distUrl.toString(), {
        method: "GET",
        headers: {
          "x-mc-auth": METRICOOL_AUTH,
          "accept": "application/json",
        },
      });

      if (distResponse.ok) {
        const distData = await distResponse.json();
        console.log("Distribution response:", JSON.stringify(distData).substring(0, 1000));
        
        // Distribution endpoint returns array of daily data with followers
        if (Array.isArray(distData) && distData.length > 0) {
          // Get the last day's followers count
          const lastDay = distData[distData.length - 1];
          if (lastDay && typeof lastDay.followers === 'number') {
            followers = lastDay.followers;
          }
          
          // Calculate new followers from the period
          const firstDay = distData[0];
          if (firstDay && lastDay && typeof firstDay.followers === 'number' && typeof lastDay.followers === 'number') {
            newFollowers = lastDay.followers - firstDay.followers;
          }
        }
      }
    } catch (e) {
      console.error("Error fetching distribution:", e);
    }

    // Fallback: try aggregation endpoint if distribution didn't work
    if (followers === null) {
      try {
        const followersUrl = new URL(`${METRICOOL_BASE_URL}/api/v2/analytics/aggregation`);
        followersUrl.searchParams.set("from", startDate);
        followersUrl.searchParams.set("to", endDate);
        followersUrl.searchParams.set("metric", "followers");
        followersUrl.searchParams.set("network", "instagram");
        followersUrl.searchParams.set("userId", userId);
        if (blogId) {
          followersUrl.searchParams.set("blogId", blogId);
        }

        console.log("Fetching Instagram followers (fallback):", followersUrl.toString());

        const followersResponse = await fetch(followersUrl.toString(), {
          method: "GET",
          headers: {
            "x-mc-auth": METRICOOL_AUTH,
            "accept": "application/json",
          },
        });

        if (followersResponse.ok) {
          const followersData = await followersResponse.json();
          console.log("Followers response:", JSON.stringify(followersData).substring(0, 500));
          
          if (typeof followersData === 'number') {
            followers = followersData;
          } else if (followersData.value !== undefined) {
            followers = followersData.value;
          } else if (followersData.followers !== undefined) {
            followers = followersData.followers;
          } else if (followersData.total !== undefined) {
            followers = followersData.total;
          }
        }
      } catch (e) {
        console.error("Error fetching followers:", e);
      }
    }

    // Calculate engagement rate from post data
    let engagementRate: number | null = null;
    if (rows.length > 0) {
      const totalReach = rows.reduce((sum, p) => sum + p.reach, 0);
      const totalEngagements = rows.reduce((sum, p) => sum + p.likes + p.comments + p.shares + p.saves, 0);
      if (totalReach > 0) {
        engagementRate = (totalEngagements / totalReach) * 100;
      } else if (followers && followers > 0) {
        engagementRate = (totalEngagements / (followers * rows.length)) * 100;
      }
    }

    // Save account-level metrics
    if (rows.length > 0 || followers !== null) {
      await supabase
        .from("social_account_metrics")
        .upsert({
          client_id: clientId,
          platform: "instagram",
          period_start: startDate,
          period_end: endDate,
          followers: followers,
          new_followers: newFollowers,
          engagement_rate: engagementRate,
          total_content: rows.length,
          collected_at: new Date().toISOString(),
        }, { onConflict: "client_id,platform,period_start,period_end" });
    }

    // Update sync log
    if (syncLog) {
      await supabase
        .from("social_sync_logs")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
          records_synced: savedCount,
        })
        .eq("id", syncLog.id);
    }

    console.log("Sync completed. Posts saved:", savedCount, "Followers:", followers);

    return new Response(
      JSON.stringify({ 
        success: true, 
        recordsSynced: savedCount,
        followers,
        engagement: engagementRate,
        postsCount: rows.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error("Edge function error:", errMsg);
    return new Response(
      JSON.stringify({ error: errMsg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
