import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { clientId, startDate, endDate } = await req.json();

    if (!clientId || !startDate || !endDate) {
      console.error('Missing required parameters:', { clientId, startDate, endDate });
      return new Response(
        JSON.stringify({ error: 'Missing required parameters: clientId, startDate, endDate' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client with service role for admin access
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch client details
    console.log('Fetching client:', clientId);
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('id, name, supabase_url, api_key, is_active')
      .eq('id', clientId)
      .maybeSingle();

    if (clientError) {
      console.error('Error fetching client:', clientError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch client details' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!client) {
      console.error('Client not found:', clientId);
      return new Response(
        JSON.stringify({ error: 'Client not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!client.is_active) {
      console.error('Client is not active:', clientId);
      return new Response(
        JSON.stringify({ 
          ok: false,
          error: 'Client is not active',
          errorType: 'inactive',
          clientId: client.id,
          clientName: client.name,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if client has external analytics configured
    if (client.supabase_url && client.api_key) {
      // Try external analytics endpoint
      console.log('Fetching analytics from external source:', client.supabase_url);
      const analyticsUrl = `${client.supabase_url}/functions/v1/get-analytics`;
      
      try {
        const analyticsResponse = await fetch(analyticsUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': client.api_key,
            'apikey': client.api_key,
            Authorization: `Bearer ${client.api_key}`,
          },
          body: JSON.stringify({
            startDate,
            endDate,
            apiKey: client.api_key,
            api_key: client.api_key,
          }),
        });

        console.log('External analytics response status:', analyticsResponse.status);

        if (analyticsResponse.ok) {
          const analyticsData = await analyticsResponse.json();
          console.log('External analytics raw response:', JSON.stringify(analyticsData));
          
          // Check if external returned all zeros (no real data)
          // Support both nested and flat response formats
          const data = analyticsData?.data || analyticsData?.analytics || analyticsData;
          const hasRealData = data && (
            (data.visitors && data.visitors > 0) ||
            (data.pageViews && data.pageViews > 0) ||
            (data.totalSessions && data.totalSessions > 0) ||
            (data.uniqueVisitors && data.uniqueVisitors > 0) ||
            (data.summary?.uniqueVisitors && data.summary.uniqueVisitors > 0) ||
            (data.summary?.totalSessions && data.summary.totalSessions > 0) ||
            (data.summary?.totalPageViews && data.summary.totalPageViews > 0)
          );

          console.log('External has real data:', hasRealData, 'data keys:', data ? Object.keys(data) : 'null');

          if (!hasRealData) {
            // External returned zeros - fall through to local or show no_data
            console.log('External source returned no data, checking local tables...');
          } else {
            console.log('Analytics fetched successfully from external source for client:', client.name);
            return new Response(
              JSON.stringify({ 
                clientId: client.id,
                clientName: client.name,
                analytics: data,
                dateRange: { startDate, endDate },
                source: 'external',
              }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        } else {
          const errorText = await analyticsResponse.text();
          console.log('External analytics failed, status:', analyticsResponse.status, 'response:', errorText);
          // Fall through to local analytics
        }
      } catch (fetchError) {
        console.log('External analytics fetch error, falling back to local:', fetchError);
        // Fall through to local analytics
      }
    }

    // Fetch from local web_analytics tables
    console.log('Fetching analytics from local tables for client:', client.name);

    // Convert date-only inputs into an inclusive UTC range.
    // startDate/endDate arrive as "YYYY-MM-DD"; using lte(endDate) would exclude the entire end day.
    const startISO = new Date(`${startDate}T00:00:00.000Z`).toISOString();
    const endExclusive = new Date(`${endDate}T00:00:00.000Z`);
    endExclusive.setUTCDate(endExclusive.getUTCDate() + 1);
    const endISO = endExclusive.toISOString();

    // Fetch sessions for date range
    const { data: sessions, error: sessionsError } = await supabase
      .from('web_analytics_sessions')
      .select('*')
      .eq('client_id', clientId)
      .gte('started_at', startISO)
      .lt('started_at', endISO);

    if (sessionsError) {
      console.error('Error fetching sessions:', sessionsError);
    }

    // Fetch page views for date range
    const { data: pageViews, error: pageViewsError } = await supabase
      .from('web_analytics_page_views')
      .select('*')
      .eq('client_id', clientId)
      .gte('viewed_at', startISO)
      .lt('viewed_at', endISO);

    if (pageViewsError) {
      console.error('Error fetching page views:', pageViewsError);
    }

    const sessionList = sessions || [];
    const pageViewList = pageViews || [];

    // Check if there's any data
    if (sessionList.length === 0 && pageViewList.length === 0) {
      console.log('No local analytics data for client:', client.name);
      
      // Check for last event timestamp (any time, not just date range)
      const { data: lastPageView } = await supabase
        .from('web_analytics_page_views')
        .select('viewed_at')
        .eq('client_id', clientId)
        .order('viewed_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      const { data: lastSession } = await supabase
        .from('web_analytics_sessions')
        .select('started_at')
        .eq('client_id', clientId)
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      const lastEventTime = lastPageView?.viewed_at || lastSession?.started_at || null;
      
      return new Response(
        JSON.stringify({ 
          ok: false,
          error: 'No analytics data recorded for this period',
          errorType: 'no_data',
          clientId: client.id,
          clientName: client.name,
          details: lastEventTime 
            ? `Last event recorded: ${lastEventTime}. No data in the selected date range.`
            : 'Install the tracking script on your website to start collecting analytics data.',
          lastEventTime,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Calculate analytics metrics
    const totalSessions = sessionList.length;
    const totalPageViews = pageViewList.length;
    const uniqueVisitors = new Set(sessionList.map(s => s.visitor_id)).size;
    const bounceSessions = sessionList.filter(s => s.bounce).length;
    const bounceRate = totalSessions > 0 ? (bounceSessions / totalSessions) * 100 : 0;
    const avgPagesPerSession = totalSessions > 0 ? totalPageViews / totalSessions : 0;

    // Traffic sources breakdown (Direct / Organic / Social / Referral / Email / Paid)
    const trafficSourceCounts: Record<string, number> = {
      Direct: 0,
      Organic: 0,
      Social: 0,
      Referral: 0,
      Email: 0,
      Paid: 0,
    };

    const searchHostnames = [
      "google.com",
      "bing.com",
      "yahoo.com",
      "duckduckgo.com",
      "baidu.com",
      "yandex.com",
    ];

    const socialHostnames = [
      "facebook.com",
      "m.facebook.com",
      "l.facebook.com",
      "instagram.com",
      "l.instagram.com",
      "twitter.com",
      "t.co",
      "linkedin.com",
      "tiktok.com",
      "youtube.com",
      "pinterest.com",
      "reddit.com",
    ];

    const getHostname = (referrer: string): string => {
      try {
        return new URL(referrer).hostname.replace(/^www\./, "");
      } catch {
        return "";
      }
    };

    const categorizeTrafficSource = (item: any): keyof typeof trafficSourceCounts => {
      const utmMedium = String(item.utm_medium || "").toLowerCase();
      const utmSource = String(item.utm_source || "").toLowerCase();
      const referrer = String(item.referrer || "");
      const hostname = referrer ? getHostname(referrer) : "";

      if (["cpc", "ppc", "paid", "paid_social", "display"].includes(utmMedium)) return "Paid";
      if (utmMedium === "email" || utmSource.includes("mail") || hostname.includes("mail")) return "Email";

      if (!utmSource && !hostname) return "Direct";

      // Prefer explicit utm_source when it matches a known category
      if (searchHostnames.some((se) => utmSource.includes(se.split(".")[0]) || utmSource.includes(se))) return "Organic";
      if (socialHostnames.some((sp) => utmSource.includes(sp.split(".")[0]) || utmSource.includes(sp))) return "Social";

      if (hostname) {
        if (searchHostnames.includes(hostname)) return "Organic";
        if (socialHostnames.includes(hostname)) return "Social";
        return "Referral";
      }

      // If utm_source exists but isn't recognized, treat as Referral rather than Direct
      return "Referral";
    };

    const dataForAttribution = sessionList.length > 0 ? sessionList : pageViewList;
    dataForAttribution.forEach((item: any) => {
      const source = categorizeTrafficSource(item);
      trafficSourceCounts[source] = (trafficSourceCounts[source] || 0) + 1;
    });

    const trafficSourcesArr = Object.entries(trafficSourceCounts)
      .map(([source, count]) => ({ source, count }))
      .filter((s) => s.count > 0)
      .sort((a, b) => b.count - a.count);

    // Device breakdown (Desktop / Mobile / Tablet)
    const deviceCounts: Record<string, number> = {
      Desktop: 0,
      Mobile: 0,
      Tablet: 0,
    };

    const detectDevice = (item: any): keyof typeof deviceCounts => {
      const explicit = String(item.device_type || item.device || "").toLowerCase();
      const ua = String(item.user_agent || item.ua || "").toLowerCase();

      if (explicit) {
        if (explicit.includes("mobile") || explicit.includes("phone")) return "Mobile";
        if (explicit.includes("tablet") || explicit.includes("ipad")) return "Tablet";
        return "Desktop";
      }

      if (ua) {
        if (/tablet|ipad/i.test(ua)) return "Tablet";
        if (/mobile|android|iphone|ipod|blackberry|opera mini|iemobile/i.test(ua)) return "Mobile";
      }

      return "Desktop";
    };

    dataForAttribution.forEach((item: any) => {
      const device = detectDevice(item);
      deviceCounts[device] = (deviceCounts[device] || 0) + 1;
    });

    const devicesArr = Object.entries(deviceCounts)
      .map(([device, count]) => ({ device, count }))
      .filter((d) => d.count > 0)
      .sort((a, b) => b.count - a.count);

    // Daily breakdown
    const dailyData: Record<string, { sessions: number; pageViews: number }> = {};
    sessionList.forEach(session => {
      const date = session.started_at.split('T')[0];
      if (!dailyData[date]) dailyData[date] = { sessions: 0, pageViews: 0 };
      dailyData[date].sessions++;
    });
    pageViewList.forEach(pv => {
      const date = pv.viewed_at.split('T')[0];
      if (!dailyData[date]) dailyData[date] = { sessions: 0, pageViews: 0 };
      dailyData[date].pageViews++;
    });

    // Top pages (normalize to pathname, drop query params, filter dashboard paths)
    const dashboardPaths = [
      "/admin",
      "/client/",
      "/login",
      "/reset-password",
      "/web-analytics",
      "/youtube-analytics",
      "/tiktok-analytics",
      "/x-analytics",
      "/meta-analytics",
      "/linkedin-analytics",
      "/analytics/",
      "/report/",
    ];

    const normalizePath = (raw: string): string => {
      if (!raw) return "";
      // If it's a full URL, keep only pathname; otherwise treat as path.
      try {
        const url = new URL(raw);
        return url.pathname || "/";
      } catch {
        return raw.split("?")[0] || "/";
      }
    };

    const pageCounts: Record<string, number> = {};
    pageViewList.forEach((pv) => {
      const path = normalizePath(pv.page_url);
      if (!path) return;
      if (dashboardPaths.some((dashPath) => path.startsWith(dashPath))) return;
      pageCounts[path] = (pageCounts[path] || 0) + 1;
    });

    const topPages = Object.entries(pageCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([url, views]) => ({ url, views }));

    const analyticsData = {
      summary: {
        totalSessions,
        totalPageViews,
        uniqueVisitors,
        bounceRate: Math.round(bounceRate * 10) / 10,
        avgPagesPerSession: Math.round(avgPagesPerSession * 10) / 10,
        avgSessionDuration: 0, // Would need timestamps to calculate
      },
      trafficSources: trafficSourcesArr.map(({ source, count }) => ({
        source,
        sessions: count,
        percentage: totalSessions > 0 ? Math.round((count / totalSessions) * 1000) / 10 : 0,
      })),
      deviceBreakdown: devicesArr.map(({ device, count }) => ({
        device,
        sessions: count,
        percentage: totalSessions > 0 ? Math.round((count / totalSessions) * 1000) / 10 : 0,
      })),
      dailyBreakdown: Object.entries(dailyData)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([date, data]) => ({
          date,
          sessions: data.sessions,
          pageViews: data.pageViews,
        })),
      topPages,
    };


    console.log('Analytics fetched successfully from local tables for client:', client.name);

    return new Response(
      JSON.stringify({ 
        clientId: client.id,
        clientName: client.name,
        analytics: analyticsData,
        dateRange: { startDate, endDate },
        source: 'local',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in fetch-client-analytics function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
