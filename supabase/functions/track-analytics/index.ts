import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
// Traffic classification: uses the canonical v2.2 classifier.
// Source of truth: supabase/functions/src/traffic-classifier.ts
// Do NOT import from the legacy traffic-filter.ts or use evaluateExclusion().
import { classifyTraffic, rulesFromDbRow, type TrafficRules } from "../src/traffic-classifier.ts";

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

// ── Geo Resolution Types ────────────────────────────────────────────

interface GeoResult {
  country: string;          // 2-letter ISO or 'XX'
  geo_source: string;       // 'cf_header' | 'ip_lookup' | 'client' | 'unresolved'
  geo_failure_reason: string | null;
}

// ── Private IP detection ────────────────────────────────────────────

function isPrivateIp(ip: string): boolean {
  const parts = ip.split('.');
  if (parts.length !== 4) return false;
  const [a, b] = parts.map(Number);
  // 10.x.x.x, 172.16-31.x.x, 192.168.x.x, 127.x.x.x
  return a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a === 127;
}

// ── Layered Geo Resolution (Geo Capture Reliability v1) ─────────────
//
// Priority:
//   1. Trusted CDN/platform country header (cf-ipcountry, x-country, etc.)
//   2. Server-side IP geo lookup (ip-api.com, 2s timeout)
//   3. Client-provided country (legacy fallback, lowest trust)
//   4. 'XX' if all methods fail
//
// Every result includes geo_source and geo_failure_reason for telemetry.

async function resolveGeo(req: Request, clientCountry?: string): Promise<GeoResult> {
  // ── Layer 1: CDN / Platform headers (highest trust) ────────────
  const cdnCountry = req.headers.get('cf-ipcountry')
    || req.headers.get('x-country')
    || req.headers.get('x-vercel-ip-country')
    || req.headers.get('x-nf-country')      // Netlify
    || req.headers.get('x-appengine-country') // GCP App Engine
    || null;

  if (cdnCountry && cdnCountry.trim().length >= 2 && cdnCountry.trim().toUpperCase() !== 'XX') {
    return {
      country: cdnCountry.trim().toUpperCase().slice(0, 2),
      geo_source: 'cf_header',
      geo_failure_reason: null,
    };
  }

  // ── Layer 2: Server-side IP geo lookup ─────────────────────────
  const clientIp = req.headers.get('cf-connecting-ip')
    || req.headers.get('x-real-ip')
    || req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || null;

  if (!clientIp) {
    // No IP available — skip to client fallback
    if (clientCountry && typeof clientCountry === 'string' && clientCountry.trim().length >= 2) {
      return {
        country: clientCountry.trim().toUpperCase().slice(0, 2),
        geo_source: 'client',
        geo_failure_reason: 'no_ip',
      };
    }
    return { country: 'XX', geo_source: 'unresolved', geo_failure_reason: 'no_ip' };
  }

  if (isPrivateIp(clientIp)) {
    if (clientCountry && typeof clientCountry === 'string' && clientCountry.trim().length >= 2) {
      return {
        country: clientCountry.trim().toUpperCase().slice(0, 2),
        geo_source: 'client',
        geo_failure_reason: 'private_ip',
      };
    }
    return { country: 'XX', geo_source: 'unresolved', geo_failure_reason: 'private_ip' };
  }

  // ip-api.com: 45 req/min free tier, no key needed, returns JSON
  // Fields: countryCode only (minimizes response size)
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000); // 2s hard timeout

    const geoRes = await fetch(
      `http://ip-api.com/json/${encodeURIComponent(clientIp)}?fields=status,countryCode,message`,
      { signal: controller.signal }
    );
    clearTimeout(timeout);

    if (geoRes.status === 429) {
      // Rate limited — fall through to client fallback
      if (clientCountry && typeof clientCountry === 'string' && clientCountry.trim().length >= 2) {
        return {
          country: clientCountry.trim().toUpperCase().slice(0, 2),
          geo_source: 'client',
          geo_failure_reason: 'provider_rate_limit',
        };
      }
      return { country: 'XX', geo_source: 'unresolved', geo_failure_reason: 'provider_rate_limit' };
    }

    if (!geoRes.ok) {
      throw new Error(`HTTP ${geoRes.status}`);
    }

    const geoData = await geoRes.json();

    if (geoData.status === 'success' && geoData.countryCode && geoData.countryCode.length >= 2) {
      return {
        country: geoData.countryCode.toUpperCase().slice(0, 2),
        geo_source: 'ip_lookup',
        geo_failure_reason: null,
      };
    }

    // API returned but no country (e.g., reserved range)
    if (clientCountry && typeof clientCountry === 'string' && clientCountry.trim().length >= 2) {
      return {
        country: clientCountry.trim().toUpperCase().slice(0, 2),
        geo_source: 'client',
        geo_failure_reason: 'invalid_response',
      };
    }
    return { country: 'XX', geo_source: 'unresolved', geo_failure_reason: 'invalid_response' };

  } catch (err: unknown) {
    const isTimeout = err instanceof DOMException && err.name === 'AbortError';
    const failureReason = isTimeout ? 'provider_timeout' : 'provider_error';

    if (clientCountry && typeof clientCountry === 'string' && clientCountry.trim().length >= 2) {
      return {
        country: clientCountry.trim().toUpperCase().slice(0, 2),
        geo_source: 'client',
        geo_failure_reason: failureReason,
      };
    }
    return { country: 'XX', geo_source: 'unresolved', geo_failure_reason: failureReason };
  }
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

    // Send immediately — geo resolution is now handled server-side.
    // No client-side geo API call needed (was ipapi.co, unreliable).
    fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      credentials: 'omit',
      keepalive: true
    }).catch(function(){}); // Ignore errors silently
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
      country: clientCountry,  // client-provided (lowest trust, legacy fallback only)
    } = body;

    // ── Layered Geo Resolution (Geo Capture Reliability v1) ─────────
    // Priority: CDN header → server-side IP lookup → client fallback → XX
    const geoResult = await resolveGeo(req, clientCountry);

    if (!clientId || !visitorId || !pageUrl) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameters: clientId, visitorId, pageUrl' }),
        { status: 400, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
      );
    }

    // Get user agent and IP from headers
    const userAgent = req.headers.get('user-agent') || '';
    const deviceType = getDeviceType(userAgent);
    const ipAddress = req.headers.get('cf-connecting-ip')
      || req.headers.get('x-real-ip')
      || req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || null;

    // Create Supabase client with service role for admin access
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Resolve alias if client was consolidated
    let effectiveClientId = clientId;
    try {
      const { data: alias } = await supabase
        .from('client_aliases')
        .select('canonical_client_id')
        .eq('alias_client_id', clientId)
        .maybeSingle();

      if (alias?.canonical_client_id) {
        effectiveClientId = alias.canonical_client_id;
      }
    } catch {
      // Table may not exist yet prior to migration run
    }

    // Verify client exists and is active
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('id, is_active')
      .eq('id', effectiveClientId)
      .maybeSingle();

    if (clientError || !client) {
      console.error('Client not found:', effectiveClientId);
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

    // ── Traffic classification (v2) ──────────────────────────────────
    // Fetch per-client traffic rules including v2 fields
    const { data: rulesRow } = await supabase
      .from('client_traffic_rules')
      .select('allowed_countries, team_ips, custom_bot_patterns, is_active, geo_mode, allowed_ips, allowed_cidrs, allowed_ua_patterns')
      .eq('client_id', effectiveClientId)
      .maybeSingle();

    const rules: TrafficRules | null = rulesRow
      ? rulesFromDbRow(rulesRow)
      : null;

    const classification = classifyTraffic({
      userAgent,
      country: geoResult.country,
      ipAddress,
      rules,
    });

    // ── End traffic classification ───────────────────────────────────

    const now = Date.now();
    const sessionId = generateSessionId(visitorId, now);
    const viewedAt = new Date().toISOString();

    // Insert page view (with full classification + geo telemetry)
    const { error: pageViewError } = await supabase
      .from('web_analytics_page_views')
      .insert({
        client_id: effectiveClientId,
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
        country: geoResult.country,
        ip_address: ipAddress,
        is_excluded: classification.is_excluded,
        exclude_reason: classification.exclude_reason,
        traffic_class: classification.traffic_class,
        traffic_flags: classification.traffic_flags,
        exclusion_policy: classification.exclusion_policy,
        audit_version: classification.audit_version,
        evaluated_at: classification.evaluated_at,
        geo_source: geoResult.geo_source,
        geo_failure_reason: geoResult.geo_failure_reason,
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
      // Create new session (with full classification + geo telemetry)
      const { error: sessionError } = await supabase
        .from('web_analytics_sessions')
        .insert({
          client_id: effectiveClientId,
          visitor_id: visitorId,
          session_id: sessionId,
          started_at: viewedAt,
          referrer: referrer || null,
          utm_source: utmSource || null,
          utm_medium: utmMedium || null,
          user_agent: userAgent,
          device_type: deviceType,
          bounce: true,
          country: geoResult.country,
          ip_address: ipAddress,
          is_excluded: classification.is_excluded,
          exclude_reason: classification.exclude_reason,
          traffic_class: classification.traffic_class,
          traffic_flags: classification.traffic_flags,
          exclusion_policy: classification.exclusion_policy,
          audit_version: classification.audit_version,
          evaluated_at: classification.evaluated_at,
          geo_source: geoResult.geo_source,
          geo_failure_reason: geoResult.geo_failure_reason,
        });

      if (sessionError) {
        console.error('Error inserting session:', sessionError);
        // Don't fail the request - page view was recorded
      }
    }

    if (classification.is_excluded) {
      console.log(`[EXCLUDED] ${classification.exclude_reason} (${classification.traffic_class}) — client ${clientId}: ${pageUrl} (${geoResult.country}) [geo:${geoResult.geo_source}]`);
    } else {
      console.log(`Tracked page view for client ${clientId}: ${pageUrl} (${classification.traffic_class}) [geo:${geoResult.geo_source}/${geoResult.country}]`);
    }

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
