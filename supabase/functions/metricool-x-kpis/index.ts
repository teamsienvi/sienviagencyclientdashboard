import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TimelinePoint {
  date: string;
  value: number;
}

interface PostTypesResponse {
  [key: string]: number;
}

interface KPIResult {
  current: {
    followers: number | null;
    newFollowers: number | null;
    engagementRate: number | null;
    totalPosts: number | null;
  };
  previous: {
    followers: number | null;
    newFollowers: number | null;
    engagementRate: number | null;
    totalPosts: number | null;
  };
  debug?: {
    followersTimeline?: { status: number; body: string };
    engagementTimeline?: { status: number; body: string };
    postsTypes?: { status: number; body: string };
    prevPostsTypes?: { status: number; body: string };
  };
}

// Convert date to YYYYMMDD format for Metricool API
function toMetricoolDate(dateStr: string): string {
  return dateStr.replace(/-/g, "");
}

// Parse timeline response - handles various response formats from Metricool
function parseTimelineValues(data: any): TimelinePoint[] {
  if (!data) return [];
  
  // Handle string response (needs JSON parsing)
  if (typeof data === 'string') {
    try {
      data = JSON.parse(data);
    } catch {
      return [];
    }
  }
  
  if (!Array.isArray(data) || data.length === 0) return [];
  
  return data.map((point, idx) => {
    // Handle array format: [[timestamp, value], ...]
    if (Array.isArray(point) && point.length >= 2) {
      return { date: String(point[0]), value: parseFloat(point[1]) || 0 };
    }
    // Handle number format
    if (typeof point === 'number') {
      return { date: `day_${idx}`, value: point };
    }
    // Handle object format: { date, value } or { x, y }
    if (typeof point === 'object' && point !== null) {
      const value = point.value ?? point.y ?? point.count ?? 0;
      const date = point.date ?? point.x ?? point.timestamp ?? `day_${idx}`;
      return { date: String(date), value: Number(value) || 0 };
    }
    return { date: `day_${idx}`, value: 0 };
  });
}

// Calculate average from timeline, ignoring nulls
function calculateAverage(points: TimelinePoint[]): number | null {
  const validPoints = points.filter(p => p.value != null && !isNaN(p.value));
  if (validPoints.length === 0) return null;
  const sum = validPoints.reduce((acc, p) => acc + p.value, 0);
  return Math.round((sum / validPoints.length) * 100) / 100;
}

// Get last value from timeline
function getLastValue(points: TimelinePoint[]): number | null {
  if (points.length === 0) return null;
  return points[points.length - 1].value;
}

// Get first value from timeline
function getFirstValue(points: TimelinePoint[]): number | null {
  if (points.length === 0) return null;
  return points[0].value;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { clientId, currentStart, currentEnd, previousStart, previousEnd } = await req.json();

    if (!clientId || !currentStart || !currentEnd) {
      return new Response(
        JSON.stringify({ error: "Missing required params: clientId, currentStart, currentEnd" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch Metricool config for X
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
    const METRICOOL_BASE_URL = Deno.env.get("METRICOOL_BASE_URL") || "https://app.metricool.com";
    const METRICOOL_AUTH = Deno.env.get("METRICOOL_USER_TOKEN");

    if (!METRICOOL_AUTH) {
      return new Response(
        JSON.stringify({ error: "METRICOOL_USER_TOKEN not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Fetching X KPIs:", { clientId, userId, blogId, currentStart, currentEnd, previousStart, previousEnd });

    const debug: KPIResult["debug"] = {};
    const result: KPIResult = {
      current: { followers: null, newFollowers: null, engagementRate: null, totalPosts: null },
      previous: { followers: null, newFollowers: null, engagementRate: null, totalPosts: null },
    };

    // Helper to build params
    const buildParams = (start: string, end: string, extra: Record<string, string> = {}) => {
      const params = new URLSearchParams({
        start: toMetricoolDate(start),
        end: toMetricoolDate(end),
        timezone: "UTC",
        userId,
        ...extra,
      });
      if (blogId) params.set("blogId", blogId);
      return params;
    };

    // 1. Fetch Followers Timeline for CURRENT week
    try {
      const url = `${METRICOOL_BASE_URL}/api/stats/timeline/twitterFollowers?${buildParams(currentStart, currentEnd)}`;
      console.log("Fetching followers (current):", url);
      
      const response = await fetch(url, {
        headers: { "x-mc-auth": METRICOOL_AUTH, "accept": "application/json" },
      });
      
      const body = await response.text();
      debug.followersTimeline = { status: response.status, body: body.substring(0, 500) };
      
      if (response.ok) {
        const data = JSON.parse(body);
        const points = parseTimelineValues(data);
        result.current.followers = getLastValue(points);
        const firstVal = getFirstValue(points);
        if (result.current.followers !== null && firstVal !== null) {
          result.current.newFollowers = result.current.followers - firstVal;
        }
      }
    } catch (e) {
      console.error("Error fetching current followers:", e);
    }

    // 2. Fetch Followers Timeline for PREVIOUS week
    if (previousStart && previousEnd) {
      try {
        const url = `${METRICOOL_BASE_URL}/api/stats/timeline/twitterFollowers?${buildParams(previousStart, previousEnd)}`;
        console.log("Fetching followers (previous):", url);
        
        const response = await fetch(url, {
          headers: { "x-mc-auth": METRICOOL_AUTH, "accept": "application/json" },
        });
        
        if (response.ok) {
          const data = await response.json();
          const points = parseTimelineValues(data);
          result.previous.followers = getLastValue(points);
          const firstVal = getFirstValue(points);
          if (result.previous.followers !== null && firstVal !== null) {
            result.previous.newFollowers = result.previous.followers - firstVal;
          }
        }
      } catch (e) {
        console.error("Error fetching previous followers:", e);
      }
    }

    // 3. Fetch Engagement Rate Timeline for CURRENT week
    try {
      const url = `${METRICOOL_BASE_URL}/api/stats/timeline/twEngagement?${buildParams(currentStart, currentEnd)}`;
      console.log("Fetching engagement (current):", url);
      
      const response = await fetch(url, {
        headers: { "x-mc-auth": METRICOOL_AUTH, "accept": "application/json" },
      });
      
      const body = await response.text();
      debug.engagementTimeline = { status: response.status, body: body.substring(0, 500) };
      
      if (response.ok) {
        const data = JSON.parse(body);
        const points = parseTimelineValues(data);
        result.current.engagementRate = calculateAverage(points);
      }
    } catch (e) {
      console.error("Error fetching current engagement:", e);
    }

    // 4. Fetch Engagement Rate Timeline for PREVIOUS week
    if (previousStart && previousEnd) {
      try {
        const url = `${METRICOOL_BASE_URL}/api/stats/timeline/twEngagement?${buildParams(previousStart, previousEnd)}`;
        console.log("Fetching engagement (previous):", url);
        
        const response = await fetch(url, {
          headers: { "x-mc-auth": METRICOOL_AUTH, "accept": "application/json" },
        });
        
        if (response.ok) {
          const data = await response.json();
          const points = parseTimelineValues(data);
          result.previous.engagementRate = calculateAverage(points);
        }
      } catch (e) {
        console.error("Error fetching previous engagement:", e);
      }
    }

    // 5. Fetch Total Posts by Type for CURRENT week
    try {
      const url = `${METRICOOL_BASE_URL}/api/stats/twitter/posts/types?${buildParams(currentStart, currentEnd)}`;
      console.log("Fetching posts types (current):", url);
      
      const response = await fetch(url, {
        headers: { "x-mc-auth": METRICOOL_AUTH, "accept": "application/json" },
      });
      
      const body = await response.text();
      debug.postsTypes = { status: response.status, body: body.substring(0, 500) };
      
      if (response.ok) {
        const data: PostTypesResponse = JSON.parse(body);
        // Sum all post types (Original, Replies, Retweets, etc.)
        result.current.totalPosts = Object.values(data).reduce((sum, val) => sum + (Number(val) || 0), 0);
      }
    } catch (e) {
      console.error("Error fetching current posts types:", e);
    }

    // 6. Fetch Total Posts by Type for PREVIOUS week
    if (previousStart && previousEnd) {
      try {
        const url = `${METRICOOL_BASE_URL}/api/stats/twitter/posts/types?${buildParams(previousStart, previousEnd)}`;
        console.log("Fetching posts types (previous):", url);
        
        const response = await fetch(url, {
          headers: { "x-mc-auth": METRICOOL_AUTH, "accept": "application/json" },
        });
        
        const body = await response.text();
        debug.prevPostsTypes = { status: response.status, body: body.substring(0, 500) };
        
        if (response.ok) {
          const data: PostTypesResponse = JSON.parse(body);
          result.previous.totalPosts = Object.values(data).reduce((sum, val) => sum + (Number(val) || 0), 0);
        }
      } catch (e) {
        console.error("Error fetching previous posts types:", e);
      }
    }

    console.log("X KPI result:", JSON.stringify(result));

    return new Response(
      JSON.stringify({ success: true, ...result, debug }),
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
