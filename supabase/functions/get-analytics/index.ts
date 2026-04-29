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

    // Try web_analytics_sessions first, fall back to analytics_events
    const { data: sessions, error: sessionsError } = await supabase
      .from('web_analytics_sessions')
      .select('*')
      .gte('started_at', startDate)
      .lte('started_at', endDate);

    // Get page views - try web_analytics_page_views first, then analytics_events
    let pageViews: any[] = [];
    const { data: pageViewData, error: pvError } = await supabase
      .from('web_analytics_page_views')
      .select('*')
      .gte('viewed_at', startDate)
      .lte('viewed_at', endDate);

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

    // Calculate traffic sources - show actual referrer hostnames
    const trafficSourceCounts: Record<string, number> = {};

    const getHostname = (url: string): string => {
      try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; }
    };

    // Analyze sessions or page views for referrer data
    const dataWithReferrer = sessions && sessions.length > 0 ? sessions : pageViews;

    // Traffic sources - derive from referrer URL
    const sourceMap: Record<string, number> = {};
    sessions?.forEach(session => {
      let source = 'direct';
      const referrer = (session as any).referrer || (session as any).referrer_url || '';
      if (referrer) {
        try {
          const hostname = new URL(referrer).hostname.replace(/^www\./, '');
          if (['google.com', 'bing.com', 'yahoo.com', 'duckduckgo.com', 'baidu.com'].some(se => hostname.includes(se))) source = 'organic';
          else if (['facebook.com', 'instagram.com', 'twitter.com', 'tiktok.com', 'linkedin.com', 'pinterest.com', 't.co', 'x.com'].some(sn => hostname.includes(sn))) {
             let platform = 'unknown';
             if (hostname.includes('facebook')) platform = 'facebook';
             else if (hostname.includes('instagram')) platform = 'instagram';
             else if (hostname.includes('tiktok')) platform = 'tiktok';
             else if (hostname.includes('twitter') || hostname.includes('t.co') || hostname.includes('x.com')) platform = 'x (twitter)';
             else if (hostname.includes('linkedin')) platform = 'linkedin';
             else if (hostname.includes('pinterest')) platform = 'pinterest';
             else if (hostname.includes('youtube')) platform = 'youtube';
             else if (hostname.includes('reddit')) platform = 'reddit';
             source = `social - ${platform}`;
          }
          else source = 'referral';
        } catch { source = 'referral'; }
      }
      const utmMedium = ((session as any).utm_medium || '').toLowerCase();
      const utmSource = ((session as any).utm_source || '').toLowerCase();
      if (['cpc', 'ppc', 'paid', 'paid_social', 'display'].includes(utmMedium)) source = 'paid';
      else if (utmMedium === 'email' || utmSource.includes('mail')) source = 'email';
      else if (utmMedium === 'social' || ['facebook', 'instagram', 'tiktok', 'twitter', 'linkedin'].some(p => utmSource.includes(p))) {
         let platform = 'unknown';
         if (utmSource.includes('facebook')) platform = 'facebook';
         else if (utmSource.includes('instagram')) platform = 'instagram';
         else if (utmSource.includes('tiktok')) platform = 'tiktok';
         else if (utmSource.includes('twitter') || utmSource.includes('x')) platform = 'x (twitter)';
         else if (utmSource.includes('linkedin')) platform = 'linkedin';
         else if (utmSource.includes('pinterest')) platform = 'pinterest';
         else if (utmSource.includes('youtube')) platform = 'youtube';
         else if (utmSource.includes('reddit')) platform = 'reddit';
         source = `social - ${platform}`;
      }
      sourceMap[source] = (sourceMap[source] || 0) + 1;
    });

    const totalTrafficSources = Object.values(sourceMap).reduce((a, b) => a + b, 0);
    const trafficSources = Object.entries(sourceMap).map(([source, count]) => ({
      source,
      count,
      percentage: totalTrafficSources > 0 ? Math.round((count / totalTrafficSources) * 100) : 0,
    })).filter(ts => ts.count > 0).sort((a, b) => b.count - a.count);

    // Calculate device breakdown from user agent data
    const pageMap: Record<string, number> = {};
    pageViews?.forEach(pv => {
      let p = (pv as any).page_url || (pv as any).path || (pv as any).url || '(not set)';
      try { p = new URL(p).pathname; } catch { p = p.split('?')[0]; }
      pageMap[p] = (pageMap[p] || 0) + 1;
    });

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
      count,
      percentage: totalDevices > 0 ? Math.round((count / totalDevices) * 100) : 0,
    })).filter(db => db.count > 0).sort((a, b) => b.count - a.count);

    // Get daily breakdown for charts - use sessions if pageviews are sparse
    const dailyData: Record<string, { visitors: Set<string>; pageViews: number; sessions: number }> = {};

    // Add session-based daily data
    if (sessions && sessions.length > 0) {
      for (const s of sessions) {
        const date = (s.started_at || s.created_at || '').split('T')[0];
        if (!date) continue;
        if (!dailyData[date]) dailyData[date] = { visitors: new Set(), pageViews: 0, sessions: 0 };
        dailyData[date].sessions++;
        if (s.visitor_id) dailyData[date].visitors.add(s.visitor_id);
      }
    }

    // Add pageview-based daily data
    for (const pv of pageViews) {
      const date = (pv.viewed_at || pv.created_at || '').split('T')[0];
      if (!date) continue;
      if (!dailyData[date]) dailyData[date] = { visitors: new Set(), pageViews: 0, sessions: 0 };
      const visitorId = pv.visitor_id || pv.session_id;
      if (visitorId) dailyData[date].visitors.add(visitorId);
      dailyData[date].pageViews++;
    }

    const dailyBreakdown = Object.entries(dailyData)
      .map(([date, data]) => ({
        date,
        visitors: data.visitors.size,
        pageViews: data.pageViews,
        sessions: data.sessions,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Top pages - extract from pageviews (page_url or path)
    const dashboardPaths = ['/admin', '/client/', '/login', '/reset-password', '/web-analytics', '/youtube-analytics', '/tiktok-analytics', '/x-analytics', '/meta-analytics', '/linkedin-analytics', '/analytics/', '/report/'];
    const pageCounts: Record<string, { count: number; title: string | null }> = {};
    for (const pv of pageViews) {
      let path = pv.page_url || pv.path || pv.url || '';
      // Normalize to pathname only
      try { path = new URL(path).pathname; } catch { path = path.split('?')[0]; }
      if (!path) continue;
      if (dashboardPaths.some(dp => path.startsWith(dp))) continue;
      if (!pageCounts[path]) pageCounts[path] = { count: 0, title: pv.page_title || pv.title || null };
      pageCounts[path].count++;
    }
    const topPages = Object.entries(pageCounts)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 10)
      .map(([page_path, { count, title }]) => ({ page_path, count, display_name: title || page_path }));

    // Country breakdown from sessions (preferred) or pageviews
    const countryCounts: Record<string, number> = {};
    const countrySource = sessions && sessions.length > 0 ? sessions : pageViews;
    for (const item of countrySource) {
      const c = (item.country || 'Unknown').trim();
      const normalized = c.length === 2 ? c.toUpperCase() : (c === 'Unknown' || !c ? 'Unknown' : c);
      countryCounts[normalized] = (countryCounts[normalized] || 0) + 1;
    }
    const countries = Object.entries(countryCounts)
      .map(([country, count]) => ({ country, count }))
      .sort((a, b) => b.count - a.count);

    // Use sessions count as totalSessions when sessions table has data
    const totalSessions = sessions && sessions.length > 0 ? sessions.length : visitorIds.length;
    // Bounce rate from sessions table if available
    const sessionBounceRate = sessions && sessions.length > 0
      ? (sessions.filter((s: any) => s.bounce === true).length / sessions.length) * 100
      : bounceRate;
    // Avg duration from sessions if they have ended_at
    let sessionAvgDuration = avgDuration;
    if (sessions && sessions.length > 0) {
      let durSum = 0, durCount = 0;
      for (const s of sessions) {
        if (s.started_at && s.ended_at) {
          const dur = (new Date(s.ended_at).getTime() - new Date(s.started_at).getTime()) / 1000;
          if (dur > 0 && dur < 7200) { durSum += dur; durCount++; }
        }
      }
      if (durCount > 0) sessionAvgDuration = durSum / durCount;
    }

    console.log(`Analytics calculated: ${uniqueVisitors} visitors, ${pageViews.length} pageviews, ${sessionAvgDuration.toFixed(1)}s avg duration, ${sessionBounceRate.toFixed(1)}% bounce`);
    console.log(`Traffic sources: ${JSON.stringify(trafficSources)}`);
    console.log(`Device breakdown: ${JSON.stringify(deviceBreakdown)}`);
    console.log(`Top pages: ${topPages.length}, Countries: ${countries.length}`);

    const analytics = {
      visitors: uniqueVisitors,
      pageViews: pageViews.length,
      avgDuration: sessionAvgDuration,
      avgSessionDuration: sessionAvgDuration,
      bounceRate: sessionBounceRate,
      pagesPerVisit,
      totalSessions,
      totalPageViews: pageViews.length,
      uniqueVisitors,
      trafficSources,
      deviceBreakdown,
      dailyBreakdown,
      topPages: topPages.map(p => ({ path: p.page_path, views: p.count })),
      top_pages: topPages,
      countries,
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
