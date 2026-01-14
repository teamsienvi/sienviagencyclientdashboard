import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface MetricoolConfig {
  user_id: string;
  blog_id: string | null;
}

interface OverviewKPIs {
  engagement: number | null;
  interactions: number | null;
  avgReachPerPost: number | null;
  impressions: number | null;
  postsCount: number | null;
  followers: number | null;
  engagementRate: number | null;
}

interface TopPost {
  title: string | null;
  url: string | null;
  views: number;
  reach: number;
  likes: number;
  comments: number;
  shares: number;
  date: string | null;
  type: string | null;
}

// Parse CSV for top posts
function parseCSV(csvText: string): any[] {
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

  const rows: any[] = [];
  for (let i = 1; i < records.length; i++) {
    const line = records[i].trim();
    if (!line) continue;
    const values = parseCSVLine(line);
    const row: Record<string, string> = {};
    headers.forEach((header, idx) => {
      row[header] = values[idx] || "";
    });
    rows.push(row);
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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { clientId, from, to, timezone = "America/Chicago" } = await req.json();

    if (!clientId || !from || !to) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing required params: clientId, from, to" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Validate client access (admin can access all, user must have client_users entry)
    const authHeader = req.headers.get("authorization");
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      
      if (user && !authError) {
        // Check if admin
        const { data: roleData } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .maybeSingle();
        
        const isAdmin = roleData?.role === "admin";
        
        if (!isAdmin) {
          // Check client_users access
          const { data: accessData } = await supabase
            .from("client_users")
            .select("id")
            .eq("user_id", user.id)
            .eq("client_id", clientId)
            .maybeSingle();
          
          if (!accessData) {
            return new Response(
              JSON.stringify({ success: false, error: "Access denied" }),
              { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
        }
      }
    }

    // Load client's facebook metricool config
    const { data: config, error: configError } = await supabase
      .from("client_metricool_config")
      .select("user_id, blog_id")
      .eq("client_id", clientId)
      .eq("platform", "facebook")
      .eq("is_active", true)
      .maybeSingle();

    if (configError || !config) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "No Metricool Facebook config found for this client",
          notConfigured: true
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = config.user_id;
    const blogId = config.blog_id;

    console.log("Fetching Facebook overview for:", { clientId, userId, blogId, from, to });

    const METRICOOL_BASE_URL = "https://app.metricool.com";
    const METRICOOL_AUTH = Deno.env.get("METRICOOL_AUTH");

    if (!METRICOOL_AUTH) {
      return new Response(
        JSON.stringify({ success: false, error: "METRICOOL_AUTH not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results: {
      engagementAgg: any;
      interactionsTimeline: any;
      uniqueImpressionsAgg: any;
      reachAgg: any;
      followersTimeline: any;
      topPosts: TopPost[];
      errors: string[];
    } = {
      engagementAgg: null,
      interactionsTimeline: null,
      uniqueImpressionsAgg: null,
      reachAgg: null,
      followersTimeline: null,
      topPosts: [],
      errors: [],
    };

    // Build common query params
    const buildParams = (extra: Record<string, string> = {}) => {
      const params: Record<string, string> = {
        from: `${from}T00:00:00`,
        to: `${to}T23:59:59`,
        network: "facebook",
        timezone,
        userId,
        ...extra,
      };
      if (blogId) params.blogId = blogId;
      return params;
    };

    // A) Engagement (posts) - aggregation
    try {
      const engagementUrl = new URL(`${METRICOOL_BASE_URL}/api/v2/analytics/aggregation`);
      Object.entries(buildParams({ metric: "engagement", subject: "posts" })).forEach(([k, v]) => 
        engagementUrl.searchParams.set(k, v)
      );
      
      console.log("Fetching engagement:", engagementUrl.toString());
      const engagementRes = await fetch(engagementUrl.toString(), {
        headers: { "x-mc-auth": METRICOOL_AUTH, "accept": "application/json" },
      });
      
      if (engagementRes.ok) {
        results.engagementAgg = await engagementRes.json();
        console.log("Engagement response:", JSON.stringify(results.engagementAgg).substring(0, 500));
      } else {
        const errorText = await engagementRes.text();
        console.error("Engagement fetch failed:", engagementRes.status, errorText);
        results.errors.push(`engagement: ${engagementRes.status} - ${errorText.substring(0, 200)}`);
      }
    } catch (e) {
      console.error("Engagement error:", e);
      results.errors.push(`engagement: ${e instanceof Error ? e.message : String(e)}`);
    }

    // B) Interactions timeline (posts)
    try {
      const interactionsUrl = new URL(`${METRICOOL_BASE_URL}/api/v2/analytics/timelines`);
      Object.entries(buildParams({ metric: "interactions" })).forEach(([k, v]) => 
        interactionsUrl.searchParams.set(k, v)
      );
      
      console.log("Fetching interactions:", interactionsUrl.toString());
      const interactionsRes = await fetch(interactionsUrl.toString(), {
        headers: { "x-mc-auth": METRICOOL_AUTH, "accept": "application/json" },
      });
      
      if (interactionsRes.ok) {
        results.interactionsTimeline = await interactionsRes.json();
        console.log("Interactions response:", JSON.stringify(results.interactionsTimeline).substring(0, 500));
      } else {
        const errorText = await interactionsRes.text();
        console.error("Interactions fetch failed:", interactionsRes.status, errorText);
        results.errors.push(`interactions: ${interactionsRes.status} - ${errorText.substring(0, 200)}`);
      }
    } catch (e) {
      console.error("Interactions error:", e);
      results.errors.push(`interactions: ${e instanceof Error ? e.message : String(e)}`);
    }

    // C) Unique impressions (reels) - aggregation
    try {
      const impressionsUrl = new URL(`${METRICOOL_BASE_URL}/api/v2/analytics/aggregation`);
      Object.entries(buildParams({ metric: "post_impressions_unique", subject: "reels" })).forEach(([k, v]) => 
        impressionsUrl.searchParams.set(k, v)
      );
      
      console.log("Fetching unique impressions:", impressionsUrl.toString());
      const impressionsRes = await fetch(impressionsUrl.toString(), {
        headers: { "x-mc-auth": METRICOOL_AUTH, "accept": "application/json" },
      });
      
      if (impressionsRes.ok) {
        results.uniqueImpressionsAgg = await impressionsRes.json();
        console.log("Unique impressions response:", JSON.stringify(results.uniqueImpressionsAgg).substring(0, 500));
      } else {
        const errorText = await impressionsRes.text();
        console.error("Unique impressions fetch failed:", impressionsRes.status, errorText);
        results.errors.push(`unique_impressions: ${impressionsRes.status} - ${errorText.substring(0, 200)}`);
      }
    } catch (e) {
      console.error("Unique impressions error:", e);
      results.errors.push(`unique_impressions: ${e instanceof Error ? e.message : String(e)}`);
    }

    // D) Reach aggregation (for avg reach per post)
    try {
      const reachUrl = new URL(`${METRICOOL_BASE_URL}/api/v2/analytics/aggregation`);
      Object.entries(buildParams({ metric: "reach", subject: "posts" })).forEach(([k, v]) => 
        reachUrl.searchParams.set(k, v)
      );
      
      console.log("Fetching reach:", reachUrl.toString());
      const reachRes = await fetch(reachUrl.toString(), {
        headers: { "x-mc-auth": METRICOOL_AUTH, "accept": "application/json" },
      });
      
      if (reachRes.ok) {
        results.reachAgg = await reachRes.json();
        console.log("Reach response:", JSON.stringify(results.reachAgg).substring(0, 500));
      } else {
        const errorText = await reachRes.text();
        console.error("Reach fetch failed:", reachRes.status, errorText);
        results.errors.push(`reach: ${reachRes.status} - ${errorText.substring(0, 200)}`);
      }
    } catch (e) {
      console.error("Reach error:", e);
      results.errors.push(`reach: ${e instanceof Error ? e.message : String(e)}`);
    }

    // E) Followers timeline
    try {
      const followersUrl = new URL(`${METRICOOL_BASE_URL}/api/v2/analytics/timelines`);
      Object.entries(buildParams({ metric: "followers_count", subject: "account" })).forEach(([k, v]) => 
        followersUrl.searchParams.set(k, v)
      );
      
      console.log("Fetching followers:", followersUrl.toString());
      const followersRes = await fetch(followersUrl.toString(), {
        headers: { "x-mc-auth": METRICOOL_AUTH, "accept": "application/json" },
      });
      
      if (followersRes.ok) {
        results.followersTimeline = await followersRes.json();
        console.log("Followers response:", JSON.stringify(results.followersTimeline).substring(0, 500));
      } else {
        const errorText = await followersRes.text();
        console.error("Followers fetch failed:", followersRes.status, errorText);
        results.errors.push(`followers: ${followersRes.status} - ${errorText.substring(0, 200)}`);
      }
    } catch (e) {
      console.error("Followers error:", e);
      results.errors.push(`followers: ${e instanceof Error ? e.message : String(e)}`);
    }

    // F) Top 3 Posts by Views - fetch CSV and sort
    try {
      const postsUrl = new URL(`${METRICOOL_BASE_URL}/api/v2/analytics/posts/facebook`);
      Object.entries(buildParams({})).forEach(([k, v]) => 
        postsUrl.searchParams.set(k, v)
      );
      
      console.log("Fetching posts CSV for top 3:", postsUrl.toString());
      const postsRes = await fetch(postsUrl.toString(), {
        headers: { "x-mc-auth": METRICOOL_AUTH, "accept": "text/csv" },
      });
      
      if (postsRes.ok) {
        const csvText = await postsRes.text();
        console.log("Posts CSV length:", csvText.length);
        console.log("CSV preview:", csvText.substring(0, 500));
        
        const rows = parseCSV(csvText);
        console.log("Parsed", rows.length, "posts for ranking");
        
        // Find the video views column (could be VideoViews, Video Views, Views, etc.)
        const viewsColumns = ["videoviews", "video views", "views", "impressions"];
        
        // Sort by views descending and take top 3
        const sortedPosts = rows
          .map(row => {
            // Find views value from various possible column names
            let views = 0;
            for (const col of viewsColumns) {
              if (row[col] !== undefined && row[col] !== "") {
                views = parseInt(row[col], 10) || 0;
                if (views > 0) break;
              }
            }
            
            return {
              title: row["content"] || row["title"] || row["message"] || null,
              url: row["link"] || row["url"] || row["postlink"] || null,
              views,
              reach: parseInt(row["reach"] || "0", 10) || 0,
              likes: parseInt(row["likes"] || "0", 10) || 0,
              comments: parseInt(row["comments"] || "0", 10) || 0,
              shares: parseInt(row["shares"] || "0", 10) || 0,
              date: row["timestamp"] || row["date"] || row["published"] || null,
              type: row["type"] || row["format"] || null,
            };
          })
          .sort((a, b) => b.views - a.views)
          .slice(0, 3);
        
        results.topPosts = sortedPosts;
        console.log("Top 3 posts:", JSON.stringify(sortedPosts));
      } else {
        const errorText = await postsRes.text();
        console.error("Posts CSV fetch failed:", postsRes.status, errorText);
        results.errors.push(`top_posts: ${postsRes.status} - ${errorText.substring(0, 200)}`);
      }
    } catch (e) {
      console.error("Top posts error:", e);
      results.errors.push(`top_posts: ${e instanceof Error ? e.message : String(e)}`);
    }

    // Process aggregated values into KPIs
    const extractValue = (data: any): number | null => {
      if (data === null || data === undefined) return null;
      if (typeof data === "number") return data;
      if (typeof data === "object") {
        if (data.value !== undefined) return data.value;
        if (data.total !== undefined) return data.total;
        // If it's an array, sum the values
        if (Array.isArray(data)) {
          return data.reduce((sum, item) => {
            const val = typeof item === "number" ? item : (item?.value ?? 0);
            return sum + val;
          }, 0);
        }
      }
      return null;
    };

    const extractTimelineTotal = (data: any): number | null => {
      if (!Array.isArray(data) || data.length === 0) return null;
      return data.reduce((sum, item) => {
        const val = typeof item === "number" ? item : (item?.value ?? 0);
        return sum + val;
      }, 0);
    };

    const extractTimelineLast = (data: any): number | null => {
      if (!Array.isArray(data) || data.length === 0) return null;
      const lastItem = data[data.length - 1];
      if (typeof lastItem === "number") return lastItem;
      return lastItem?.value ?? null;
    };

    // Calculate posts count from CSV rows (if we got them)
    const postsCount = results.topPosts.length > 0 ? results.topPosts.length : null;
    // Actually we need to count all posts, not just top 3 - let's track this separately
    let totalPostsCount: number | null = null;
    
    // Engagement value from aggregation
    const engagement = extractValue(results.engagementAgg);
    
    // Interactions - sum from timeline or use total
    let interactions = extractTimelineTotal(results.interactionsTimeline);
    if (interactions === null || interactions === 0) {
      interactions = extractValue(results.interactionsTimeline);
    }
    
    // Unique impressions from aggregation
    const impressions = extractValue(results.uniqueImpressionsAgg);
    
    // Reach from aggregation
    const totalReach = extractValue(results.reachAgg);
    
    // Followers from timeline (last value)
    const followers = extractTimelineLast(results.followersTimeline);
    
    // Calculate avg reach per post
    let avgReachPerPost: number | null = null;
    // We need to fetch posts count separately - use CSV row count from a separate call
    // For now, estimate from interactions or use a ratio
    
    // Fetch posts CSV just for count (we already have it from top posts call)
    try {
      const postsUrl = new URL(`${METRICOOL_BASE_URL}/api/v2/analytics/posts/facebook`);
      Object.entries(buildParams({})).forEach(([k, v]) => 
        postsUrl.searchParams.set(k, v)
      );
      
      const postsRes = await fetch(postsUrl.toString(), {
        headers: { "x-mc-auth": METRICOOL_AUTH, "accept": "text/csv" },
      });
      
      if (postsRes.ok) {
        const csvText = await postsRes.text();
        const rows = parseCSV(csvText);
        totalPostsCount = rows.length;
        
        if (totalReach !== null && totalPostsCount > 0) {
          avgReachPerPost = Math.round(totalReach / totalPostsCount);
        }
      }
    } catch (e) {
      console.error("Posts count error:", e);
    }
    
    // Calculate engagement rate (interactions / followers * 100)
    let engagementRate: number | null = null;
    if (interactions !== null && followers !== null && followers > 0) {
      engagementRate = Math.round((interactions / followers) * 10000) / 100; // Two decimal places
    }

    const kpis: OverviewKPIs = {
      engagement,
      interactions,
      avgReachPerPost,
      impressions,
      postsCount: totalPostsCount,
      followers,
      engagementRate,
    };

    console.log("Final KPIs:", kpis);
    console.log("Top 3 posts:", results.topPosts);

    return new Response(
      JSON.stringify({
        success: true,
        data: kpis,
        topPosts: results.topPosts,
        raw: {
          engagementAgg: results.engagementAgg,
          interactionsTimeline: results.interactionsTimeline,
          uniqueImpressionsAgg: results.uniqueImpressionsAgg,
          reachAgg: results.reachAgg,
          followersTimeline: results.followersTimeline,
        },
        errors: results.errors.length > 0 ? results.errors : undefined,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Error in metricool-facebook-overview:", error);
    const message = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
