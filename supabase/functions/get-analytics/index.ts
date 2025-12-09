import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { startDate, endDate, apiKey } = await req.json();
    
    // Validate API key
    const expectedApiKey = Deno.env.get("ANALYTICS_API_KEY");
    if (apiKey !== expectedApiKey) {
      console.error("Invalid API key provided");
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log(`Fetching analytics from ${startDate} to ${endDate}`);

    // Try analytics_sessions first, fall back to analytics_events
    const { data: sessions, error: sessionsError } = await supabase
      .from("analytics_sessions")
      .select("*")
      .gte("started_at", startDate)
      .lte("started_at", endDate);

    // Get page views - try analytics_page_views first, then analytics_events
    let pageViews: any[] = [];
    const { data: pageViewData, error: pvError } = await supabase
      .from("analytics_page_views")
      .select("*")
      .gte("viewed_at", startDate)
      .lte("viewed_at", endDate);

    if (!pvError && pageViewData && pageViewData.length > 0) {
      pageViews = pageViewData;
    } else {
      // Fall back to analytics_events for page views
      const { data: eventsData, error: eventsError } = await supabase
        .from("analytics_events")
        .select("*")
        .eq("event_type", "page_view")
        .gte("created_at", startDate)
        .lte("created_at", endDate);
      
      if (!eventsError && eventsData) {
        pageViews = eventsData;
      }
    }

    // Calculate unique visitors from sessions or events
    let uniqueVisitors = 0;
    if (sessions && sessions.length > 0) {
      uniqueVisitors = new Set(sessions.map((s: any) => s.visitor_id)).size;
    } else {
      // Use page views visitor_id
      uniqueVisitors = new Set(pageViews.map((p: any) => p.visitor_id).filter(Boolean)).size;
    }

    // Calculate avg duration and bounce rate
    // Group events by visitor_id since session_id is often null
    const visitorEvents: Record<string, any[]> = {};
    for (const pv of pageViews) {
      const visitorId = pv.visitor_id;
      if (!visitorId) continue;
      if (!visitorEvents[visitorId]) {
        visitorEvents[visitorId] = [];
      }
      visitorEvents[visitorId].push(pv);
    }

    let totalDuration = 0;
    let sessionsWithDuration = 0;
    let bounces = 0;
    const visitorIds = Object.keys(visitorEvents);

    for (const visitorId of visitorIds) {
      const events = visitorEvents[visitorId];
      
      // Bounce: visitor with only 1 page view
      if (events.length === 1) {
        bounces++;
      }

      // Duration: time between first and last event for this visitor
      if (events.length > 1) {
        const timestamps = events
          .map((e: any) => new Date(e.created_at || e.viewed_at).getTime())
          .sort((a: number, b: number) => a - b);
        
        const duration = (timestamps[timestamps.length - 1] - timestamps[0]) / 1000;
        // Only count reasonable durations (less than 2 hours)
        if (duration > 0 && duration < 7200) {
          totalDuration += duration;
          sessionsWithDuration++;
        }
      }
    }

    const avgDuration = sessionsWithDuration > 0 ? totalDuration / sessionsWithDuration : 0;
    const bounceRate = visitorIds.length > 0 ? (bounces / visitorIds.length) * 100 : 0;
    const pagesPerVisit = uniqueVisitors > 0 ? pageViews.length / uniqueVisitors : 0;

    console.log(`Analytics calculated: ${uniqueVisitors} visitors, ${pageViews.length} pageviews, ${avgDuration.toFixed(1)}s avg duration, ${bounceRate.toFixed(1)}% bounce`);

    const analytics = {
      visitors: uniqueVisitors,
      pageViews: pageViews.length,
      avgDuration,
      bounceRate,
      pagesPerVisit,
    };

    return new Response(
      JSON.stringify({ analytics }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error fetching analytics:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
