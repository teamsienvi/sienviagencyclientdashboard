import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TikTokPostsRequest {
  from: string;
  to: string;
  timezone: string;
  userId: string;
  blogId?: string;
  clientId?: string; // Optional: if provided, will persist to database
}

interface TikTokPost {
  title: string | null;
  date: string | null;
  type: string | null;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  reach: number;
  duration: string | null;
  engagement: number;
  url: string | null;
  link: string | null;
  image: string | null;
}

function parseCSV(csvText: string): TikTokPost[] {
  const lines = csvText.trim().split("\n");
  if (lines.length < 2) return [];

  // Parse header line - handle potential BOM and whitespace
  const headerLine = lines[0].replace(/^\uFEFF/, "").trim();
  const headers = headerLine.split(",").map((h) => h.trim().toLowerCase());
  
  console.log("CSV Headers:", headers);

  const rows: TikTokPost[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Parse CSV line - handle quoted values
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

    // Map values to object
    const row: Record<string, string> = {};
    headers.forEach((header, idx) => {
      row[header] = values[idx] || "";
    });

    // Convert to TikTokPost with numeric casting
    const post: TikTokPost = {
      title: row["title"] || null,
      date: row["date"] || null,
      type: row["type"] || null,
      views: parseInt(row["views"] || "0", 10) || 0,
      likes: parseInt(row["likes"] || "0", 10) || 0,
      comments: parseInt(row["comments"] || "0", 10) || 0,
      shares: parseInt(row["shares"] || "0", 10) || 0,
      reach: parseInt(row["reach"] || "0", 10) || 0,
      duration: row["duration"] || null,
      engagement: parseFloat(row["engageme"] || row["engagement"] || "0") || 0,
      url: row["url"] || null,
      link: row["link"] || null,
      image: row["image"] || null,
    };

    rows.push(post);
  }

  return rows;
}

// Parse date string from Metricool format to ISO
function parseMetricoolDate(dateStr: string | null): string {
  if (!dateStr) return new Date().toISOString();
  
  // Try parsing common formats like "Jan 5, 2025" or "2025-01-05"
  const parsed = new Date(dateStr);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString();
  }
  
  return new Date().toISOString();
}

// Generate a unique content_id from post data
function generateContentId(post: TikTokPost): string {
  const urlPart = post.url || post.link || "";
  const datePart = post.date || "";
  const titlePart = post.title || "";
  
  // Create a hash-like string from the components
  const combined = `${urlPart}-${datePart}-${titlePart}`;
  // Use a simple hash for uniqueness
  let hash = 0;
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return `tiktok_${Math.abs(hash).toString(16)}`;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: TikTokPostsRequest = await req.json();
    const { from, to, timezone, userId, blogId, clientId } = body;

    if (!from || !to || !userId) {
      return new Response(
        JSON.stringify({ error: "Missing required params: from, to, userId" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const METRICOOL_BASE_URL = Deno.env.get("METRICOOL_BASE_URL") || "https://app.metricool.com";
    const METRICOOL_AUTH = Deno.env.get("METRICOOL_USER_TOKEN");

    if (!METRICOOL_AUTH) {
      return new Response(
        JSON.stringify({ error: "METRICOOL_USER_TOKEN not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build URL with searchParams to properly encode special characters like +
    const url = new URL(`${METRICOOL_BASE_URL}/api/v2/analytics/posts/tiktok`);
    
    // Metricool requires datetime format: yyyy-MM-dd'T'HH:mm:ss
    // If from/to are just dates, append T00:00:00 / T23:59:59
    const fromFormatted = from.includes("T") ? from : `${from}T00:00:00`;
    const toFormatted = to.includes("T") ? to : `${to}T23:59:59`;
    
    url.searchParams.set("from", fromFormatted);
    url.searchParams.set("to", toFormatted);
    url.searchParams.set("timezone", timezone || "UTC");
    url.searchParams.set("userId", userId);
    if (blogId) {
      url.searchParams.set("blogId", blogId);
    }

    console.log("Metricool TikTok posts request URL:", url.toString());

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "x-mc-auth": METRICOOL_AUTH,
        "accept": "text/csv",
      },
    });

    console.log("Metricool upstream status:", response.status);

    if (!response.ok) {
      const errorBody = await response.text();
      console.error("Metricool upstream error:", response.status, errorBody);
      return new Response(
        JSON.stringify({
          error: "Metricool API error",
          upstreamStatus: response.status,
          upstreamBody: errorBody,
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const csvText = await response.text();
    console.log("CSV response length:", csvText.length);
    console.log("CSV preview:", csvText.substring(0, 500));

    const rows = parseCSV(csvText);
    console.log("Parsed rows count:", rows.length);

    // If clientId is provided, persist to database
    let savedCount = 0;
    if (clientId && rows.length > 0) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      console.log("Persisting", rows.length, "posts to database for client:", clientId);

      for (const post of rows) {
        const contentId = generateContentId(post);
        const publishedAt = parseMetricoolDate(post.date);
        const postUrl = post.url || post.link || null;

        // Upsert social_content
        const { data: contentData, error: contentError } = await supabase
          .from("social_content")
          .upsert({
            client_id: clientId,
            content_id: contentId,
            platform: "tiktok",
            content_type: "video",
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

        // Insert metrics (use current period dates)
        const { error: metricsError } = await supabase
          .from("social_content_metrics")
          .upsert({
            social_content_id: contentData.id,
            platform: "tiktok",
            period_start: from.split("T")[0],
            period_end: to.split("T")[0],
            views: post.views,
            likes: post.likes,
            comments: post.comments,
            shares: post.shares,
            reach: post.reach,
            collected_at: new Date().toISOString(),
          }, { onConflict: "social_content_id,period_start,period_end" });

        if (metricsError) {
          console.error("Error upserting metrics:", metricsError);
          continue;
        }

        savedCount++;
      }

      // Calculate and save account-level metrics
      const totalViews = rows.reduce((sum, p) => sum + p.views, 0);
      const totalLikes = rows.reduce((sum, p) => sum + p.likes, 0);
      const totalComments = rows.reduce((sum, p) => sum + p.comments, 0);
      const totalShares = rows.reduce((sum, p) => sum + p.shares, 0);
      const avgEngagement = rows.length > 0 
        ? rows.reduce((sum, p) => sum + p.engagement, 0) / rows.length 
        : 0;

      await supabase
        .from("social_account_metrics")
        .upsert({
          client_id: clientId,
          platform: "tiktok",
          period_start: from.split("T")[0],
          period_end: to.split("T")[0],
          engagement_rate: avgEngagement,
          total_content: rows.length,
          collected_at: new Date().toISOString(),
        }, { onConflict: "client_id,platform,period_start,period_end" });

      console.log("Saved", savedCount, "posts to database");
    }

    return new Response(
      JSON.stringify({ success: true, rows, savedCount }),
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
