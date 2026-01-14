import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TimelineDataPoint {
  dateTime: string;
  value: number;
}

interface WeeklyData {
  followersTimeline: TimelineDataPoint[];
  engagementTimeline: TimelineDataPoint[];
  engagementAgg: number | null;
  postsCount: number | null;
}

interface WeeklyResponse {
  current: WeeklyData;
  previous: WeeklyData;
  debug?: {
    errors: string[];
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { clientId, platform, from, to, prevFrom, prevTo, timezone = "America/Chicago" } = await req.json();

    if (!clientId || !platform || !from || !to || !prevFrom || !prevTo) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Missing required params: clientId, platform, from, to, prevFrom, prevTo" 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Validate client access
    const authHeader = req.headers.get("authorization");
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      
      if (user && !authError) {
        const { data: roleData } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .maybeSingle();
        
        const isAdmin = roleData?.role === "admin";
        
        if (!isAdmin) {
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

    // Load client's metricool config for the platform
    const { data: config, error: configError } = await supabase
      .from("client_metricool_config")
      .select("user_id, blog_id")
      .eq("client_id", clientId)
      .eq("platform", platform)
      .eq("is_active", true)
      .maybeSingle();

    if (configError || !config) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `No Metricool ${platform} config found for this client`,
          notConfigured: true
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = config.user_id;
    const blogId = config.blog_id;

    console.log(`Fetching ${platform} weekly data for:`, { clientId, userId, blogId, from, to, prevFrom, prevTo });

    const METRICOOL_BASE_URL = "https://app.metricool.com";
    const METRICOOL_AUTH = Deno.env.get("METRICOOL_AUTH");

    if (!METRICOOL_AUTH) {
      return new Response(
        JSON.stringify({ success: false, error: "METRICOOL_AUTH not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const errors: string[] = [];

    // Helper to build params
    const buildParams = (fromDate: string, toDate: string, extra: Record<string, string> = {}) => {
      const params: Record<string, string> = {
        from: `${fromDate}T00:00:00`,
        to: `${toDate}T23:59:59`,
        network: platform,
        timezone,
        userId,
        ...extra,
      };
      if (blogId) params.blogId = blogId;
      return params;
    };

    // Helper to fetch from Metricool
    const fetchMetricool = async (endpoint: string, params: Record<string, string>): Promise<any> => {
      const url = new URL(`${METRICOOL_BASE_URL}${endpoint}`);
      Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
      
      console.log(`Fetching: ${url.toString()}`);
      const res = await fetch(url.toString(), {
        headers: { "x-mc-auth": METRICOOL_AUTH, "accept": "application/json" },
      });
      
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`${res.status}: ${errorText.substring(0, 200)}`);
      }
      
      return res.json();
    };

    // Helper to extract timeline data points
    const extractTimelinePoints = (data: any): TimelineDataPoint[] => {
      if (!data) return [];
      
      // Handle different response formats
      if (Array.isArray(data)) {
        // Direct array of datapoints
        if (data.length > 0 && data[0]?.dateTime !== undefined) {
          return data.map(d => ({
            dateTime: d.dateTime || d.date || d.timestamp,
            value: typeof d.value === 'number' ? d.value : parseFloat(d.value) || 0,
          }));
        }
        // Array of objects with values array
        if (data[0]?.values) {
          return data[0].values.map((d: any) => ({
            dateTime: d.dateTime || d.date || d.timestamp,
            value: typeof d.value === 'number' ? d.value : parseFloat(d.value) || 0,
          }));
        }
      }
      
      // Object with data array
      if (data.data) {
        return extractTimelinePoints(data.data);
      }
      
      return [];
    };

    // Helper to extract aggregation value
    const extractAggValue = (data: any): number | null => {
      if (data === null || data === undefined) return null;
      if (typeof data === 'number') return data;
      if (typeof data === 'object') {
        if (data.data !== undefined) {
          return typeof data.data === 'number' ? data.data : null;
        }
        if (data.value !== undefined) return data.value;
        if (data.total !== undefined) return data.total;
      }
      return null;
    };

    // Fetch data for both periods in parallel
    const fetchPeriodData = async (fromDate: string, toDate: string): Promise<WeeklyData> => {
      const result: WeeklyData = {
        followersTimeline: [],
        engagementTimeline: [],
        engagementAgg: null,
        postsCount: null,
      };

      // Determine the correct metric name for followers based on platform
      const followersMetric = platform === "facebook" ? "pageFollows" : "followers";

      const [followersRes, engagementTimelineRes, engagementAggRes, postsRes] = await Promise.allSettled([
        // 1) Followers timeline
        fetchMetricool("/api/v2/analytics/timelines", buildParams(fromDate, toDate, {
          metric: followersMetric,
          subject: "account",
        })),
        // 2) Engagement timeline (for chart)
        fetchMetricool("/api/v2/analytics/timelines", buildParams(fromDate, toDate, {
          metric: "engagement",
          subject: "posts",
        })),
        // 3) Engagement aggregation (for KPI value)
        fetchMetricool("/api/v2/analytics/aggregation", buildParams(fromDate, toDate, {
          metric: "engagement",
          subject: "posts",
        })),
        // 4) Posts count via CSV (count rows)
        (async () => {
          const postsUrl = new URL(`${METRICOOL_BASE_URL}/api/v2/analytics/posts/${platform}`);
          Object.entries(buildParams(fromDate, toDate, {})).forEach(([k, v]) => 
            postsUrl.searchParams.set(k, v)
          );
          const res = await fetch(postsUrl.toString(), {
            headers: { "x-mc-auth": METRICOOL_AUTH, "accept": "text/csv" },
          });
          if (!res.ok) throw new Error(`Posts CSV: ${res.status}`);
          const csv = await res.text();
          // Count non-empty lines minus header
          const lines = csv.split('\n').filter(l => l.trim());
          return Math.max(0, lines.length - 1);
        })(),
      ]);

      // Process followers timeline
      if (followersRes.status === 'fulfilled') {
        result.followersTimeline = extractTimelinePoints(followersRes.value);
        console.log(`Followers timeline (${fromDate} to ${toDate}): ${result.followersTimeline.length} points`);
      } else {
        errors.push(`followers ${fromDate}: ${followersRes.reason}`);
        console.error(`Followers error:`, followersRes.reason);
      }

      // Process engagement timeline
      if (engagementTimelineRes.status === 'fulfilled') {
        result.engagementTimeline = extractTimelinePoints(engagementTimelineRes.value);
        console.log(`Engagement timeline (${fromDate} to ${toDate}): ${result.engagementTimeline.length} points`);
      } else {
        errors.push(`engagement_timeline ${fromDate}: ${engagementTimelineRes.reason}`);
      }

      // Process engagement aggregation
      if (engagementAggRes.status === 'fulfilled') {
        result.engagementAgg = extractAggValue(engagementAggRes.value);
        console.log(`Engagement agg (${fromDate} to ${toDate}): ${result.engagementAgg}`);
      } else {
        errors.push(`engagement_agg ${fromDate}: ${engagementAggRes.reason}`);
      }

      // Process posts count
      if (postsRes.status === 'fulfilled') {
        result.postsCount = postsRes.value as number;
        console.log(`Posts count (${fromDate} to ${toDate}): ${result.postsCount}`);
      } else {
        errors.push(`posts_count ${fromDate}: ${postsRes.reason}`);
      }

      return result;
    };

    // Fetch both periods in parallel
    const [currentData, previousData] = await Promise.all([
      fetchPeriodData(from, to),
      fetchPeriodData(prevFrom, prevTo),
    ]);

    const response: WeeklyResponse = {
      current: currentData,
      previous: previousData,
    };

    if (errors.length > 0) {
      response.debug = { errors };
    }

    return new Response(
      JSON.stringify({ success: true, data: response }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in metricool-social-weekly:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : String(error) 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
