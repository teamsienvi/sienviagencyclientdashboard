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
      const visitorId = pv.visitor_id || pv.session_id;
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

    console.log(`Processing ${visitorIds.length} unique visitors/sessions`);

    for (const visitorId of visitorIds) {
      const events = visitorEvents[visitorId];
      
      // Bounce: visitor with only 1 page view
      if (events.length === 1) {
        bounces++;
      }

      // Duration: time between first and last event for this visitor
      if (events.length > 1) {
        const timestamps = events
          .map((e: any) => {
            const ts = e.created_at || e.viewed_at || e.timestamp;
            if (!ts) return null;
            const time = new Date(ts).getTime();
            return isNaN(time) ? null : time;
          })
          .filter((t): t is number => t !== null)
          .sort((a, b) => a - b);
        
        if (timestamps.length >= 2) {
          const duration = (timestamps[timestamps.length - 1] - timestamps[0]) / 1000;
          // Only count reasonable durations (less than 2 hours)
          if (duration > 0 && duration < 7200) {
            totalDuration += duration;
            sessionsWithDuration++;
          }
        }
      }
    }

    console.log(`Duration calculation: ${sessionsWithDuration} sessions with duration, total: ${totalDuration}s`);

    const avgDuration = sessionsWithDuration > 0 ? totalDuration / sessionsWithDuration : 0;
    const bounceRate = visitorIds.length > 0 ? (bounces / visitorIds.length) * 100 : 0;
    const pagesPerVisit = uniqueVisitors > 0 ? pageViews.length / uniqueVisitors : 0;

    // Calculate traffic sources from referrer data
    const trafficSourceCounts: Record<string, number> = {
      direct: 0,
      organic: 0,
      social: 0,
      referral: 0,
      email: 0,
      paid: 0,
    };

    const searchEngines = ['google', 'bing', 'yahoo', 'duckduckgo', 'baidu', 'yandex'];
    const socialPlatforms = ['facebook', 'twitter', 'instagram', 'linkedin', 'pinterest', 'tiktok', 'youtube', 'reddit'];
    
    // Analyze sessions or page views for referrer data
    const dataWithReferrer = sessions && sessions.length > 0 ? sessions : pageViews;
    
    for (const item of dataWithReferrer) {
      const referrer = (item.referrer || item.referrer_url || item.utm_source || '').toLowerCase();
      const utmMedium = (item.utm_medium || '').toLowerCase();
      const utmSource = (item.utm_source || '').toLowerCase();
      
      if (!referrer && !utmSource) {
        trafficSourceCounts.direct++;
      } else if (utmMedium === 'cpc' || utmMedium === 'ppc' || utmMedium === 'paid') {
        trafficSourceCounts.paid++;
      } else if (utmMedium === 'email' || referrer.includes('mail')) {
        trafficSourceCounts.email++;
      } else if (searchEngines.some(se => referrer.includes(se) || utmSource.includes(se))) {
        trafficSourceCounts.organic++;
      } else if (socialPlatforms.some(sp => referrer.includes(sp) || utmSource.includes(sp))) {
        trafficSourceCounts.social++;
      } else if (referrer) {
        trafficSourceCounts.referral++;
      } else {
        trafficSourceCounts.direct++;
      }
    }

    const totalTrafficSources = Object.values(trafficSourceCounts).reduce((a, b) => a + b, 0);
    const trafficSources = Object.entries(trafficSourceCounts).map(([source, count]) => ({
      source: source.charAt(0).toUpperCase() + source.slice(1),
      visitors: count,
      percentage: totalTrafficSources > 0 ? Math.round((count / totalTrafficSources) * 100) : 0,
    })).filter(ts => ts.visitors > 0).sort((a, b) => b.visitors - a.visitors);

    // Calculate device breakdown from user agent data
    const deviceCounts: Record<string, number> = {
      desktop: 0,
      mobile: 0,
      tablet: 0,
    };

    for (const item of dataWithReferrer) {
      const userAgent = (item.user_agent || item.ua || '').toLowerCase();
      const deviceType = (item.device_type || item.device || '').toLowerCase();
      
      if (deviceType) {
        if (deviceType.includes('mobile') || deviceType.includes('phone')) {
          deviceCounts.mobile++;
        } else if (deviceType.includes('tablet') || deviceType.includes('ipad')) {
          deviceCounts.tablet++;
        } else {
          deviceCounts.desktop++;
        }
      } else if (userAgent) {
        if (/mobile|android|iphone|ipod|blackberry|opera mini|iemobile/i.test(userAgent)) {
          if (/tablet|ipad/i.test(userAgent)) {
            deviceCounts.tablet++;
          } else {
            deviceCounts.mobile++;
          }
        } else if (/ipad|tablet/i.test(userAgent)) {
          deviceCounts.tablet++;
        } else {
          deviceCounts.desktop++;
        }
      } else {
        // Default to desktop if no device info
        deviceCounts.desktop++;
      }
    }

    const totalDevices = Object.values(deviceCounts).reduce((a, b) => a + b, 0);
    const deviceBreakdown = Object.entries(deviceCounts).map(([device, count]) => ({
      device: device.charAt(0).toUpperCase() + device.slice(1),
      visitors: count,
      percentage: totalDevices > 0 ? Math.round((count / totalDevices) * 100) : 0,
    })).filter(db => db.visitors > 0).sort((a, b) => b.visitors - a.visitors);

    // Get daily breakdown for charts
    const dailyData: Record<string, { visitors: Set<string>; pageViews: number }> = {};
    
    for (const pv of pageViews) {
      const date = (pv.viewed_at || pv.created_at || '').split('T')[0];
      if (!date) continue;
      
      if (!dailyData[date]) {
        dailyData[date] = { visitors: new Set(), pageViews: 0 };
      }
      
      const visitorId = pv.visitor_id || pv.session_id;
      if (visitorId) {
        dailyData[date].visitors.add(visitorId);
      }
      dailyData[date].pageViews++;
    }

    const dailyBreakdown = Object.entries(dailyData)
      .map(([date, data]) => ({
        date,
        visitors: data.visitors.size,
        pageViews: data.pageViews,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    console.log(`Analytics calculated: ${uniqueVisitors} visitors, ${pageViews.length} pageviews, ${avgDuration.toFixed(1)}s avg duration, ${bounceRate.toFixed(1)}% bounce`);
    console.log(`Traffic sources: ${JSON.stringify(trafficSources)}`);
    console.log(`Device breakdown: ${JSON.stringify(deviceBreakdown)}`);

    const analytics = {
      visitors: uniqueVisitors,
      pageViews: pageViews.length,
      avgDuration,
      bounceRate,
      pagesPerVisit,
      totalSessions: visitorIds.length,
      trafficSources,
      deviceBreakdown,
      dailyBreakdown,
    };

    return new Response(
      JSON.stringify({ success: true, data: analytics }),
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
