import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Dynamic CORS: reflect the request origin to support credentials: 'include'
function getCorsHeaders(req: Request) {
  const origin = req.headers.get('origin') || '*';
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Credentials': 'true',
  };
}

// Generate a simple session ID based on visitor + timestamp window
function generateSessionId(visitorId: string, timestamp: number): string {
  // Session window: 30 minutes
  const sessionWindow = Math.floor(timestamp / (30 * 60 * 1000));
  return `${visitorId}_${sessionWindow}`;
}

// Parse user agent to determine device type
function getDeviceType(userAgent: string): string {
  const ua = userAgent.toLowerCase();
  if (/mobile|android|iphone|ipad|ipod|blackberry|windows phone/.test(ua)) {
    if (/tablet|ipad/.test(ua)) return 'tablet';
    return 'mobile';
  }
  return 'desktop';
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: getCorsHeaders(req) });
  }

  // Handle GET request: Serve the tracking script
  if (req.method === 'GET') {
    const scriptContent = `
(function() {
  try {
    var currentScript = document.currentScript;
    if (!currentScript) {
      var scripts = document.getElementsByTagName('script');
      for (var i = 0; i < scripts.length; i++) {
        if (scripts[i].src && scripts[i].src.indexOf('track-analytics') !== -1) {
          currentScript = scripts[i];
          break;
        }
      }
    }
    var clientId = currentScript ? currentScript.getAttribute('data-client-id') : null;
    if (!clientId) return;

    var endpoint = currentScript.src;
    
    var visitorId = localStorage.getItem('sienvi_vid');
    if (!visitorId) {
      visitorId = 'v_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
      localStorage.setItem('sienvi_vid', visitorId);
    }

    var urlParams = new URLSearchParams(window.location.search);
    var payload = {
      clientId: clientId,
      visitorId: visitorId,
      pageUrl: window.location.pathname,
      pageTitle: document.title,
      referrer: document.referrer || '',
      utmSource: urlParams.get('utm_source') || '',
      utmMedium: urlParams.get('utm_medium') || '',
      utmCampaign: urlParams.get('utm_campaign') || ''
    };

    var sendData = function(data) {
      fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        credentials: 'omit',
        keepalive: true
      }).catch(function(){}); // Ignore errors silently to not clutter client console
    };

    // Attempt to fetch country from a free IP-to-Country API
    fetch('https://ipapi.co/json/')
      .then(function(res) { return res.json(); })
      .then(function(data) {
        if (data && data.country_code) {
          payload.country = data.country_code;
        }
        sendData(payload);
      })
      .catch(function() {
        sendData(payload); // Send without country if geolocation fails
      });
  } catch (e) {
    console.error('Sienvi Analytics Tracker Error:', e);
  }
})();
`;
    return new Response(scriptContent, {
      headers: {
        'Content-Type': 'application/javascript',
        'Cache-Control': 'public, max-age=3600',
        ...getCorsHeaders(req)
      }
    });
  }

  try {
    const body = await req.json();
    const {
      clientId,
      visitorId,
      pageUrl,
      pageTitle,
      referrer,
      utmSource,
      utmMedium,
      utmCampaign,
      country,
    } = body;

    // Auto-detect country from Cloudflare/proxy headers if not provided by client
    let detectedCountry = country;
    if (!detectedCountry) {
      detectedCountry = req.headers.get('cf-ipcountry')
        || req.headers.get('x-country')
        || req.headers.get('x-vercel-ip-country')
        || null;
    }

    // Normalize country: uppercase 2-letter code or 'XX' for unknown
    const normalizedCountry = (typeof detectedCountry === 'string' && detectedCountry.trim().length >= 2)
      ? detectedCountry.trim().toUpperCase().slice(0, 2)
      : 'XX';

    if (!clientId || !visitorId || !pageUrl) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameters: clientId, visitorId, pageUrl' }),
        { status: 400, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
      );
    }

    // Get user agent from headers
    const userAgent = req.headers.get('user-agent') || '';
    const deviceType = getDeviceType(userAgent);

    // Create Supabase client with service role for admin access
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify client exists and is active
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('id, is_active')
      .eq('id', clientId)
      .maybeSingle();

    if (clientError || !client) {
      console.error('Client not found:', clientId);
      return new Response(
        JSON.stringify({ error: 'Invalid client' }),
        { status: 400, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
      );
    }

    if (!client.is_active) {
      return new Response(
        JSON.stringify({ error: 'Client is not active' }),
        { status: 400, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
      );
    }

    const now = Date.now();
    const sessionId = generateSessionId(visitorId, now);
    const viewedAt = new Date().toISOString();

    // Insert page view
    const { error: pageViewError } = await supabase
      .from('web_analytics_page_views')
      .insert({
        client_id: clientId,
        visitor_id: visitorId,
        session_id: sessionId,
        page_url: pageUrl,
        page_title: pageTitle || null,
        referrer: referrer || null,
        utm_source: utmSource || null,
        utm_medium: utmMedium || null,
        utm_campaign: utmCampaign || null,
        user_agent: userAgent,
        device_type: deviceType,
        viewed_at: viewedAt,
        country: normalizedCountry,
      });

    if (pageViewError) {
      console.error('Error inserting page view:', pageViewError);
      return new Response(
        JSON.stringify({ error: 'Failed to track page view' }),
        { status: 500, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
      );
    }

    // Upsert session - update if exists, create if not
    const { data: existingSession } = await supabase
      .from('web_analytics_sessions')
      .select('id, page_count')
      .eq('session_id', sessionId)
      .maybeSingle();

    if (existingSession) {
      // Update existing session
      await supabase
        .from('web_analytics_sessions')
        .update({
          page_count: existingSession.page_count + 1,
          ended_at: viewedAt,
          bounce: false, // No longer a bounce if they viewed more pages
        })
        .eq('id', existingSession.id);
    } else {
      // Create new session
      const { error: sessionError } = await supabase
        .from('web_analytics_sessions')
        .insert({
          client_id: clientId,
          visitor_id: visitorId,
          session_id: sessionId,
          started_at: viewedAt,
          referrer: referrer || null,
          utm_source: utmSource || null,
          utm_medium: utmMedium || null,
          user_agent: userAgent,
          device_type: deviceType,
          bounce: true,
          country: normalizedCountry,
        });

      if (sessionError) {
        console.error('Error inserting session:', sessionError);
        // Don't fail the request - page view was recorded
      }
    }

    console.log(`Tracked page view for client ${clientId}: ${pageUrl}`);

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in track-analytics function:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
    );
  }
});
