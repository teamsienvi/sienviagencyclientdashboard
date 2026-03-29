import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface FacebookPost {
  title: string | null;
  date: string | null;
  type: string | null;
  reach: number;
  impressions: number;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  clicks: number;
  reactions: number;
  engagement: number;
  url: string | null;
  link: string | null;
  image: string | null;
}

function parseCSV(csvText: string): FacebookPost[] {
  const normalizedText = csvText.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  
  // Split into records properly handling quoted fields with newlines
  const records: string[] = [];
  let current = "";
  let inQuotes = false;
  
  for (let i = 0; i < normalizedText.length; i++) {
    const char = normalizedText[i];
    if (char === '"') {
      inQuotes = !inQuotes;
      current += char;
    } else if (char === "\n" && !inQuotes) {
      if (current.trim()) {
        records.push(current);
      }
      current = "";
    } else {
      current += char;
    }
  }
  if (current.trim()) {
    records.push(current);
  }
  
  if (records.length < 2) return [];

  const headerLine = records[0].replace(/^\uFEFF/, "").trim();
  const headers = parseCSVLine(headerLine).map((h) => h.trim().toLowerCase());
  
  console.log("CSV Headers:", headers);

  const rows: FacebookPost[] = [];

  for (let i = 1; i < records.length; i++) {
    const line = records[i].trim();
    if (!line) continue;

    const values = parseCSVLine(line);
    
    const row: Record<string, string> = {};
    headers.forEach((header, idx) => {
      row[header] = values[idx] || "";
    });

    // Log first row for debugging
    if (i === 1) {
      console.log("First row fields:", JSON.stringify(row));
    }

    // Map Facebook CSV columns - Note: Metricool uses 'postlink' for the URL
    // For reels/videos, "views" is the actual video view count; for posts, use impressions
    const post: FacebookPost = {
      title: row["content"] || row["title"] || row["message"] || null,
      date: row["timestamp"] || row["date"] || row["published"] || null,
      type: row["type"] || row["format"] || null,
      reach: parseInt(row["reach"] || row["reach (organic)"] || "0", 10) || 0,
      impressions: parseInt(row["impressions"] || "0", 10) || 0,
      views: parseInt(row["views"] || row["video views"] || row["videoviews"] || "0", 10) || 0,
      likes: parseInt(row["likes"] || "0", 10) || 0,
      comments: parseInt(row["comments"] || "0", 10) || 0,
      shares: parseInt(row["shares"] || row["shared"] || "0", 10) || 0,
      clicks: parseInt(row["clicks"] || row["link clicks"] || row["linkclicks"] || "0", 10) || 0,
      reactions: parseInt(row["reactions"] || "0", 10) || 0,
      engagement: parseFloat(row["engagement"] || "0") || 0,
      url: row["postlink"] || row["url"] || null,
      link: row["link"] || null,
      image: row["image"] || null,
    };

    rows.push(post);
  }

  return rows;
}

function parseCSVLine(line: string): string[] {
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
  
  return values;
}

function parseMetricoolDate(dateStr: string | null): string {
  if (!dateStr) return new Date().toISOString();
  
  const parsed = new Date(dateStr);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString();
  }
  
  return new Date().toISOString();
}

/** Normalize content type — robust reel detection */
function normalizeContentType(type: string | null, url: string | null): string {
  const t = (type || "").toLowerCase().trim();
  if (["reel", "video", "reel_video", "reels", "igtv"].includes(t)) return "reel";
  if (url && /\/reel\//i.test(url)) return "reel";
  return "post";
}

function generateContentId(post: FacebookPost): string {
  // Use date + title for stable content ID (don't include URL as it may vary between syncs)
  const datePart = post.date || "";
  const titlePart = (post.title || "").substring(0, 100); // Truncate long titles
  
  const combined = `${datePart}-${titlePart}`;
  let hash = 0;
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return `fb_${Math.abs(hash).toString(16)}`;
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

    // --- JWT/Admin Auth Gate ---
    const authHeader = req.headers.get("authorization");
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      if (user && !authError) {
        const { data: roleData } = await supabase
          .from("user_roles").select("role").eq("user_id", user.id).maybeSingle();
        const isAdmin = roleData?.role === "admin";
        if (!isAdmin) {
          const { data: accessData } = await supabase
            .from("client_users").select("id").eq("user_id", user.id).eq("client_id", clientId).maybeSingle();
          if (!accessData) {
            return new Response(
              JSON.stringify({ error: "Access denied" }),
              { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
        }
      }
    }

    // Fetch config from database (including reporting_timezone)
    const { data: config, error: configError } = await supabase
      .from("client_metricool_config")
      .select("user_id, blog_id, followers, reporting_timezone")
      .eq("client_id", clientId)
      .eq("platform", "facebook")
      .eq("is_active", true)
      .single();

    if (configError || !config) {
      return new Response(
        JSON.stringify({ error: `No Metricool Facebook config found for client ${clientId}` }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = config.user_id;
    const blogId = config.blog_id;
    const reportingTimezone = config.reporting_timezone || "America/Chicago";

    // --- Sync diagnostics ---
    const diagnostics = {
      rowsFetched: 0,
      postsDetected: 0,
      reelsDetected: 0,
      rowsUpserted: 0,
      timezoneUsed: reportingTimezone,
      errors: [] as string[],
    };

    console.log("Starting Facebook Metricool sync:", { clientId, userId, blogId, reportingTimezone });

    const METRICOOL_BASE_URL = Deno.env.get("METRICOOL_BASE_URL") || "https://app.metricool.com";
    const METRICOOL_AUTH = Deno.env.get("METRICOOL_USER_TOKEN");

    if (!METRICOOL_AUTH) {
      return new Response(
        JSON.stringify({ error: "METRICOOL_USER_TOKEN not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Calculate date range
    const endDate = periodEnd || new Date().toISOString().split("T")[0];
    const startDate = periodStart || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    // Create sync log
    const { data: syncLog } = await supabase
      .from("social_sync_logs")
      .insert({
        client_id: clientId,
        platform: "facebook",
        status: "in_progress",
      })
      .select()
      .single();

    // Fetch Facebook posts from Metricool
    const postsUrl = new URL(`${METRICOOL_BASE_URL}/api/v2/analytics/posts/facebook`);
    postsUrl.searchParams.set("from", `${startDate}T00:00:00`);
    postsUrl.searchParams.set("to", `${endDate}T23:59:59`);
    postsUrl.searchParams.set("timezone", reportingTimezone);
    postsUrl.searchParams.set("userId", userId);
    if (blogId) {
      postsUrl.searchParams.set("blogId", blogId);
    }

    console.log("Fetching Facebook posts:", postsUrl.toString());

    const postsResponse = await fetch(postsUrl.toString(), {
      method: "GET",
      headers: {
        "x-mc-auth": METRICOOL_AUTH,
        "accept": "text/csv",
      },
    });

    console.log("Posts response status:", postsResponse.status);

    let rows: FacebookPost[] = [];
    let savedCount = 0;

    if (postsResponse.ok) {
      const csvText = await postsResponse.text();
      console.log("CSV response length:", csvText.length);
      console.log("CSV preview:", csvText.substring(0, 500));
      
      rows = parseCSV(csvText);
      diagnostics.rowsFetched = rows.length;
      console.log("Parsed rows count:", rows.length);

      // Filter to only posts within the reporting period
      const periodStartDate = new Date(startDate);
      const periodEndDate = new Date(endDate);
      periodEndDate.setHours(23, 59, 59, 999);
      
      const postsInPeriod = rows.filter(post => {
        if (!post.date) return false;
        const postDate = new Date(post.date);
        return postDate >= periodStartDate && postDate <= periodEndDate;
      });
      
      console.log(`Posts in period (${startDate} to ${endDate}):`, postsInPeriod.length, "out of", rows.length);

      // Persist posts to database
      for (const post of postsInPeriod) {
        const contentId = generateContentId(post);
        const publishedAt = parseMetricoolDate(post.date);
        const postUrl = post.url || post.link || null;
        const contentType = normalizeContentType(post.type, postUrl);

        if (contentType === "reel") {
          diagnostics.reelsDetected++;
        } else {
          diagnostics.postsDetected++;
        }

        const { data: contentData, error: contentError } = await supabase
          .from("social_content")
          .upsert({
            client_id: clientId,
            content_id: contentId,
            platform: "facebook",
            content_type: contentType,
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

        // For reels/videos, use actual views; for posts, fall back to impressions
        const viewCount = contentType === "reel" && post.views > 0 ? post.views : post.impressions;

        // Delete any existing metrics for this content in this period to ensure fresh data
        await supabase
          .from("social_content_metrics")
          .delete()
          .eq("social_content_id", contentData.id)
          .eq("period_start", startDate)
          .eq("period_end", endDate);

        const { error: metricsError } = await supabase
          .from("social_content_metrics")
          .insert({
            social_content_id: contentData.id,
            platform: "facebook",
            period_start: startDate,
            period_end: endDate,
            reach: post.reach,
            impressions: post.impressions,
            views: viewCount,
            likes: post.likes + post.reactions,
            comments: post.comments,
            shares: post.shares,
            link_clicks: post.clicks,
            engagements: post.likes + post.reactions + post.comments + post.shares + post.clicks,
            collected_at: new Date().toISOString(),
          });

        if (metricsError) {
          console.error("Error inserting metrics:", metricsError);
          continue;
        }

        savedCount++;
        diagnostics.rowsUpserted++;
      }
      
      console.log(`Saved ${savedCount} posts within the reporting period`);
    } else {
      const errorText = await postsResponse.text();
      console.error("Posts fetch failed:", postsResponse.status, errorText);
    }

    // Fetch followers from timelines endpoint - Facebook uses "pageFollows" not "followers_count"
    let followers: number | null = null;
    let newFollowers: number | null = null;
    try {
      const timelinesUrl = new URL(`${METRICOOL_BASE_URL}/api/v2/analytics/timelines`);
      timelinesUrl.searchParams.set("from", startDate);
      timelinesUrl.searchParams.set("to", endDate);
      timelinesUrl.searchParams.set("metric", "pageFollows");
      timelinesUrl.searchParams.set("network", "facebook");
      timelinesUrl.searchParams.set("subject", "account");
      timelinesUrl.searchParams.set("timezone", reportingTimezone);
      timelinesUrl.searchParams.set("userId", userId);
      if (blogId) {
        timelinesUrl.searchParams.set("blogId", blogId);
      }

      console.log("Fetching Facebook timelines (followers):", timelinesUrl.toString());

      const timelinesResponse = await fetch(timelinesUrl.toString(), {
        method: "GET",
        headers: {
          "x-mc-auth": METRICOOL_AUTH,
          "accept": "application/json",
        },
      });

      if (timelinesResponse.ok) {
        const timelinesData = await timelinesResponse.json();
        console.log("Timelines response:", JSON.stringify(timelinesData).substring(0, 1000));
        
        if (Array.isArray(timelinesData) && timelinesData.length > 0) {
          const lastPoint = timelinesData[timelinesData.length - 1];
          const firstPoint = timelinesData[0];
          
          if (lastPoint && typeof lastPoint.value === 'number') {
            followers = lastPoint.value;
          } else if (lastPoint && typeof lastPoint === 'number') {
            followers = lastPoint;
          }
          
          if (firstPoint && lastPoint) {
            const firstVal = typeof firstPoint.value === 'number' ? firstPoint.value : (typeof firstPoint === 'number' ? firstPoint : 0);
            const lastVal = typeof lastPoint.value === 'number' ? lastPoint.value : (typeof lastPoint === 'number' ? lastPoint : 0);
            newFollowers = lastVal - firstVal;
          }
        }
      }
    } catch (e) {
      console.error("Error fetching timelines:", e);
    }

    // Fallback: aggregation endpoint
    if (followers === null) {
      try {
        const followersUrl = new URL(`${METRICOOL_BASE_URL}/api/v2/analytics/aggregation`);
        followersUrl.searchParams.set("from", startDate);
        followersUrl.searchParams.set("to", endDate);
        followersUrl.searchParams.set("metric", "followers");
        followersUrl.searchParams.set("network", "facebook");
        followersUrl.searchParams.set("userId", userId);
        if (blogId) {
          followersUrl.searchParams.set("blogId", blogId);
        }

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

    // Use config followers as fallback
    if (followers === null && config.followers) {
      followers = config.followers;
    }

    // Calculate engagement rate
    let engagementRate: number | null = null;
    if (rows.length > 0) {
      const postsWithEngagement = rows.filter(p => p.engagement > 0);
      if (postsWithEngagement.length > 0) {
        const avgEngagement = postsWithEngagement.reduce((sum, p) => sum + p.engagement, 0) / postsWithEngagement.length;
        engagementRate = avgEngagement > 100 ? avgEngagement / 100 : avgEngagement;
      } else {
        const totalInteractions = rows.reduce((sum, p) => sum + p.likes + p.reactions + p.comments + p.shares + p.clicks, 0);
        const totalReach = rows.reduce((sum, p) => sum + p.reach, 0);
        
        if (totalReach > 0) {
          engagementRate = (totalInteractions / totalReach) * 100;
        } else if (followers && followers > 0) {
          engagementRate = (totalInteractions / followers) * 100;
        }
      }
      
      if (engagementRate !== null) {
        engagementRate = Math.round(engagementRate * 100) / 100;
        if (engagementRate > 100) engagementRate = 100;
      }
    }

    // Save account-level metrics - use postsInPeriod.length for accurate post count from Metricool
    const totalContentInPeriod = rows.filter(post => {
      if (!post.date) return false;
      const postDate = new Date(post.date);
      const periodStartDate = new Date(startDate);
      const periodEndDate = new Date(endDate);
      periodEndDate.setHours(23, 59, 59, 999);
      return postDate >= periodStartDate && postDate <= periodEndDate;
    }).length;

    if (totalContentInPeriod > 0 || followers !== null) {
      await supabase
        .from("social_account_metrics")
        .upsert({
          client_id: clientId,
          platform: "facebook",
          period_start: startDate,
          period_end: endDate,
          followers: followers,
          new_followers: newFollowers,
          engagement_rate: engagementRate,
          total_content: totalContentInPeriod,
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
          error_message: diagnostics.errors.length > 0 ? diagnostics.errors.join("; ") : null,
        })
        .eq("id", syncLog.id);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        recordsSynced: savedCount,
        followers,
        newFollowers,
        engagementRate,
        diagnostics,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Error in sync-metricool-facebook:", error);
    const message = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
