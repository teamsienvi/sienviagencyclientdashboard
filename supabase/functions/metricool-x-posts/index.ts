import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface XPost {
  id: string | null;
  text: string | null;
  url: string | null;
  timestamp: string | null;
  impressions: number;
  likes: number;
  reposts: number;
  replies: number;
  quotes: number;
  engagements: number;
  linkClicks: number;
  profileClicks: number;
  videoViews: number;
}

function parseCSV(csvText: string): XPost[] {
  const normalizedText = csvText.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  
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

  const rows: XPost[] = [];

  for (let i = 1; i < records.length; i++) {
    const line = records[i].trim();
    if (!line) continue;

    const values = parseCSVLine(line);
    
    const row: Record<string, string> = {};
    headers.forEach((header, idx) => {
      row[header] = values[idx] || "";
    });

    if (i === 1) {
      console.log("First row fields:", JSON.stringify(row));
    }

    // Helper to parse and sum organic + paid columns
    const sumColumns = (organic: string, paid: string): number => {
      const o = parseInt(row[organic] || "0", 10) || 0;
      const p = parseInt(row[paid] || "0", 10) || 0;
      return o + p;
    };

    // Map X CSV columns from Metricool export
    // Columns: Id, URL, Text, Timestamp, Impressions (Organic), Impressions (Paid), 
    // Favorites (Organic), Favorites (Paid), Retweets (Organic), Retweets (Paid),
    // Replies (Organic), Replies (Paid), Quotes, Engagement, Link Clicks (Organic), 
    // Link Clicks (Paid), Profile Clicks (Organic), Profile Clicks (Paid),
    // Video views (Organic), Video views (Paid)
    const post: XPost = {
      id: row["id"] || null,
      text: row["text"] || row["content"] || null,
      url: row["url"] || null,
      timestamp: row["timestamp"] || row["date"] || null,
      impressions: sumColumns("impressions (organic)", "impressions (paid)"),
      likes: sumColumns("favorites (organic)", "favorites (paid)"),
      reposts: sumColumns("retweets (organic)", "retweets (paid)"),
      replies: sumColumns("replies (organic)", "replies (paid)"),
      quotes: parseInt(row["quotes"] || "0", 10) || 0,
      engagements: parseInt(row["engagement"] || "0", 10) || 0,
      linkClicks: sumColumns("link clicks (organic)", "link clicks (paid)"),
      profileClicks: sumColumns("profile clicks (organic)", "profile clicks (paid)"),
      videoViews: sumColumns("video views (organic)", "video views (paid)"),
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

// Parse timestamp - supports both ISO strings and epoch milliseconds
function parseTimestamp(ts: string | null): string {
  if (!ts) return new Date().toISOString();
  
  // Try as number (epoch ms)
  const asNum = Number(ts);
  if (!isNaN(asNum) && asNum > 1000000000000) {
    return new Date(asNum).toISOString();
  }
  
  // Try as date string
  const parsed = new Date(ts);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString();
  }
  
  return new Date().toISOString();
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
      .eq("platform", "x")
      .eq("is_active", true)
      .single();

    if (configError || !config) {
      return new Response(
        JSON.stringify({ error: `No Metricool X config found for client ${clientId}` }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = config.user_id;
    const blogId = config.blog_id;

    console.log("Fetching X posts via Metricool:", { clientId, userId, blogId, periodStart, periodEnd });

    const METRICOOL_BASE_URL = Deno.env.get("METRICOOL_BASE_URL") || "https://app.metricool.com";
    const METRICOOL_AUTH = Deno.env.get("METRICOOL_USER_TOKEN");

    if (!METRICOOL_AUTH) {
      return new Response(
        JSON.stringify({ error: "METRICOOL_USER_TOKEN not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build date range (default to last 7 days)
    const endDate = periodEnd || new Date().toISOString().split("T")[0];
    const startDate = periodStart || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    // Fetch X posts CSV from Metricool
    const postsUrl = new URL(`${METRICOOL_BASE_URL}/api/v2/analytics/posts/twitter`);
    postsUrl.searchParams.set("from", `${startDate}T00:00:00`);
    postsUrl.searchParams.set("to", `${endDate}T23:59:59`);
    postsUrl.searchParams.set("timezone", "UTC");
    postsUrl.searchParams.set("userId", userId);
    if (blogId) {
      postsUrl.searchParams.set("blogId", blogId);
    }

    console.log("Fetching X posts CSV:", postsUrl.toString());

    const postsResponse = await fetch(postsUrl.toString(), {
      method: "GET",
      headers: {
        "x-mc-auth": METRICOOL_AUTH,
        "accept": "text/csv",
      },
    });

    console.log("Posts response status:", postsResponse.status);

    let posts: XPost[] = [];
    let savedCount = 0;

    if (postsResponse.ok) {
      const csvText = await postsResponse.text();
      console.log("CSV response length:", csvText.length);
      console.log("CSV preview:", csvText.substring(0, 800));
      
      posts = parseCSV(csvText);
      console.log("Parsed posts count:", posts.length);

      // Persist posts to database
      for (const post of posts) {
        // Use tweet ID from URL or fallback to hash
        let contentId = post.id;
        if (!contentId && post.url) {
          const match = post.url.match(/status\/(\d+)/);
          contentId = match ? match[1] : null;
        }
        if (!contentId) {
          // Generate hash
          const combined = `${post.url || ""}-${post.timestamp || ""}-${post.text || ""}`;
          let hash = 0;
          for (let i = 0; i < combined.length; i++) {
            hash = ((hash << 5) - hash) + combined.charCodeAt(i);
            hash = hash & hash;
          }
          contentId = `x_${Math.abs(hash).toString(16)}`;
        }

        const publishedAt = parseTimestamp(post.timestamp);

        const { data: contentData, error: contentError } = await supabase
          .from("social_content")
          .upsert({
            client_id: clientId,
            content_id: contentId,
            platform: "x",
            content_type: "tweet",
            title: post.text,
            url: post.url,
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
            platform: "x",
            period_start: startDate,
            period_end: endDate,
            impressions: post.impressions,
            engagements: post.engagements,
            likes: post.likes,
            comments: post.replies,
            shares: post.reposts,
            views: post.videoViews,
            link_clicks: post.linkClicks,
            profile_visits: post.profileClicks,
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
      return new Response(
        JSON.stringify({ 
          error: "Failed to fetch posts from Metricool",
          upstreamStatus: postsResponse.status,
          upstreamBody: errorText.substring(0, 500),
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("X posts sync completed. Saved:", savedCount);

    // Return posts for frontend display (sorted by timestamp desc)
    const sortedPosts = posts.sort((a, b) => {
      const dateA = a.timestamp ? new Date(parseTimestamp(a.timestamp)).getTime() : 0;
      const dateB = b.timestamp ? new Date(parseTimestamp(b.timestamp)).getTime() : 0;
      return dateB - dateA;
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        recordsSynced: savedCount,
        posts: sortedPosts,
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
