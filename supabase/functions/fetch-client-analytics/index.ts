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

    // Prefer local tracking for Snarky Humans for now (we're collecting visits into this project's web_analytics tables).
    const preferLocal = client.name === 'Snarky Humans';

    // Check if client has external analytics configured
    if (!preferLocal && client.supabase_url && client.api_key) {
      // Try external analytics endpoint
      console.log('Fetching analytics from external source:', client.supabase_url);
      const analyticsUrl = `${client.supabase_url}/functions/v1/get-analytics`;
      
      try {
        const analyticsResponse = await fetch(analyticsUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': client.api_key,
            Authorization: `Bearer ${client.api_key}`,
          },
          body: JSON.stringify({
            startDate,
            endDate,
            apiKey: client.api_key,
            api_key: client.api_key,
          }),
        });

        if (analyticsResponse.ok) {
          const analyticsData = await analyticsResponse.json();
          console.log('Analytics fetched successfully from external source for client:', client.name);
          
          // Check if external returned all zeros (no real data)
          const data = analyticsData?.data || analyticsData;
          const hasRealData = data && (
            (data.visitors && data.visitors > 0) ||
            (data.pageViews && data.pageViews > 0) ||
            (data.totalSessions && data.totalSessions > 0)
          );

          if (!hasRealData) {
            // External returned zeros - fall through to local or show no_data
            console.log('External source returned no data, checking local tables...');
          } else {
            return new Response(
              JSON.stringify({ 
                clientId: client.id,
                clientName: client.name,
                analytics: analyticsData,
                dateRange: { startDate, endDate },
                source: 'external',
              }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        } else {
          console.log('External analytics failed, falling back to local:', analyticsResponse.status);
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
      return new Response(
        JSON.stringify({ 
          ok: false,
          error: 'No analytics data recorded for this period',
          errorType: 'no_data',
          clientId: client.id,
          clientName: client.name,
          details: 'Install the tracking script on your website to start collecting analytics data.',
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

    // Traffic sources breakdown
    const trafficSources: Record<string, number> = {};
    sessionList.forEach(session => {
      let source = 'Direct';
      if (session.utm_source) {
        source = session.utm_source;
      } else if (session.referrer) {
        try {
          const url = new URL(session.referrer);
          source = url.hostname.replace('www.', '');
        } catch {
          source = 'Referral';
        }
      }
      trafficSources[source] = (trafficSources[source] || 0) + 1;
    });

    // Device breakdown
    const deviceBreakdown: Record<string, number> = { desktop: 0, mobile: 0, tablet: 0 };
    sessionList.forEach(session => {
      const device = session.device_type || 'desktop';
      deviceBreakdown[device] = (deviceBreakdown[device] || 0) + 1;
    });

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

    // Top pages
    const pageCounts: Record<string, number> = {};
    pageViewList.forEach(pv => {
      const page = pv.page_url;
      pageCounts[page] = (pageCounts[page] || 0) + 1;
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
      trafficSources: Object.entries(trafficSources).map(([source, sessions]) => ({
        source,
        sessions,
        percentage: totalSessions > 0 ? Math.round((sessions / totalSessions) * 1000) / 10 : 0,
      })),
      deviceBreakdown: Object.entries(deviceBreakdown).map(([device, count]) => ({
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
