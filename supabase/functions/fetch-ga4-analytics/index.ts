import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encode as base64url } from "https://deno.land/std@0.168.0/encoding/base64url.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ── JWT / OAuth helpers ──────────────────────────────────────────
async function importPKCS8Key(pem: string): Promise<CryptoKey> {
  const b64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s/g, '');
  const binary = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  return crypto.subtle.importKey(
    'pkcs8', binary, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign'],
  );
}

async function getAccessToken(sa: { client_email: string; private_key: string; token_uri: string }): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/analytics.readonly',
    aud: sa.token_uri,
    iat: now,
    exp: now + 3600,
  };

  const enc = new TextEncoder();
  const segments = [
    base64url(enc.encode(JSON.stringify(header))),
    base64url(enc.encode(JSON.stringify(payload))),
  ];
  const sigInput = `${segments[0]}.${segments[1]}`;
  const key = await importPKCS8Key(sa.private_key);
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, enc.encode(sigInput));
  segments.push(base64url(new Uint8Array(sig)));

  const jwt = segments.join('.');

  const resp = await fetch(sa.token_uri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Token exchange failed (${resp.status}): ${errText}`);
  }
  const tokenData = await resp.json();
  return tokenData.access_token;
}

// ── GA4 Data API helpers ────────────────────────────────────────
const GA4_BASE = 'https://analyticsdata.googleapis.com/v1beta';

async function runReport(
  token: string,
  propertyId: string,
  body: Record<string, unknown>,
): Promise<any> {
  const resp = await fetch(`${GA4_BASE}/properties/${propertyId}:runReport`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const errText = await resp.text();
    console.error(`GA4 runReport error (${resp.status}):`, errText);
    throw new Error(`GA4 API error: ${resp.status} - ${errText}`);
  }
  return resp.json();
}

// ── Main handler ────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { clientId, startDate, endDate } = await req.json();

    if (!clientId || !startDate || !endDate) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameters: clientId, startDate, endDate' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // ── Supabase client ──
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // ── Fetch GA4 config for client ──
    const { data: config, error: cfgErr } = await supabase
      .from('client_ga4_config')
      .select('*')
      .eq('client_id', clientId)
      .eq('is_active', true)
      .maybeSingle();

    if (cfgErr || !config) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: 'GA4 not configured for this client',
          errorType: 'not_configured',
          clientId,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // ── Fetch client name ──
    const { data: client } = await supabase
      .from('clients')
      .select('name')
      .eq('id', clientId)
      .maybeSingle();

    // ── GCP auth ──
    const saJson = Deno.env.get('GCP_SERVICE_ACCOUNT_JSON');
    if (!saJson) {
      return new Response(
        JSON.stringify({ error: 'GCP_SERVICE_ACCOUNT_JSON secret not set', errorType: 'auth_failed' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }
    const sa = JSON.parse(saJson);
    const accessToken = await getAccessToken(sa);

    const propertyId = config.ga4_property_id;
    const dateRange = { startDate, endDate };

    // ── 1. Summary report ──
    console.log(`Fetching GA4 summary for property ${propertyId} (Client: ${client?.name})`);
    const summaryReport = await runReport(accessToken, propertyId, {
      dateRanges: [dateRange],
      metrics: [
        { name: 'activeUsers' },
        { name: 'sessions' },
        { name: 'screenPageViews' },
        { name: 'bounceRate' },
        { name: 'averageSessionDuration' },
        { name: 'screenPageViewsPerSession' },
      ],
    });

    const summaryRow = summaryReport.rows?.[0]?.metricValues || [];
    const activeUsers = parseInt(summaryRow[0]?.value || '0', 10);
    const sessions = parseInt(summaryRow[1]?.value || '0', 10);
    const pageViews = parseInt(summaryRow[2]?.value || '0', 10);
    const bounceRate = parseFloat(summaryRow[3]?.value || '0') * 100; // GA4 returns 0-1
    const avgDuration = parseFloat(summaryRow[4]?.value || '0');
    const pagesPerSession = parseFloat(summaryRow[5]?.value || '0');

    // ── 2. Daily timeseries ──
    const dailyReport = await runReport(accessToken, propertyId, {
      dateRanges: [dateRange],
      dimensions: [{ name: 'date' }],
      metrics: [
        { name: 'activeUsers' },
        { name: 'sessions' },
        { name: 'screenPageViews' },
      ],
      orderBys: [{ dimension: { dimensionName: 'date' } }],
    });

    const dailyBreakdown = (dailyReport.rows || []).map((row: any) => {
      const dateStr = row.dimensionValues[0].value; // YYYYMMDD
      const formatted = `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`;
      return {
        date: formatted,
        visitors: parseInt(row.metricValues[0].value, 10),
        sessions: parseInt(row.metricValues[1].value, 10),
        pageViews: parseInt(row.metricValues[2].value, 10),
      };
    });

    // ── 3. Traffic sources ──
    const sourcesReport = await runReport(accessToken, propertyId, {
      dateRanges: [dateRange],
      dimensions: [{ name: 'sessionDefaultChannelGroup' }],
      metrics: [{ name: 'sessions' }],
      orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
      limit: 10,
    });

    const totalSourceSessions = (sourcesReport.rows || []).reduce(
      (sum: number, r: any) => sum + parseInt(r.metricValues[0].value, 10), 0,
    );
    const trafficSources = (sourcesReport.rows || []).map((row: any) => {
      const count = parseInt(row.metricValues[0].value, 10);
      return {
        source: row.dimensionValues[0].value,
        sessions: count,
        percentage: totalSourceSessions > 0 ? Math.round((count / totalSourceSessions) * 1000) / 10 : 0,
      };
    });

    // ── 4. Device breakdown ──
    const devicesReport = await runReport(accessToken, propertyId, {
      dateRanges: [dateRange],
      dimensions: [{ name: 'deviceCategory' }],
      metrics: [{ name: 'sessions' }],
      orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
    });

    const totalDeviceSessions = (devicesReport.rows || []).reduce(
      (sum: number, r: any) => sum + parseInt(r.metricValues[0].value, 10), 0,
    );
    const deviceBreakdown = (devicesReport.rows || []).map((row: any) => {
      const count = parseInt(row.metricValues[0].value, 10);
      const device = row.dimensionValues[0].value;
      return {
        device: device.charAt(0).toUpperCase() + device.slice(1),
        sessions: count,
        percentage: totalDeviceSessions > 0 ? Math.round((count / totalDeviceSessions) * 1000) / 10 : 0,
      };
    });

    // ── 5. Top pages ──
    const pagesReport = await runReport(accessToken, propertyId, {
      dateRanges: [dateRange],
      dimensions: [{ name: 'pagePath' }, { name: 'pageTitle' }],
      metrics: [{ name: 'screenPageViews' }],
      orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
      limit: 15,
    });

    const topPages = (pagesReport.rows || []).map((row: any) => ({
      url: row.dimensionValues[0].value,
      views: parseInt(row.metricValues[0].value, 10),
      title: row.dimensionValues[1]?.value || null,
    }));

    // ── 6. Country breakdown ──
    const countryReport = await runReport(accessToken, propertyId, {
      dateRanges: [dateRange],
      dimensions: [{ name: 'country' }],
      metrics: [{ name: 'activeUsers' }],
      orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }],
      limit: 10,
    });

    const countries = (countryReport.rows || []).map((row: any) => ({
      country: row.dimensionValues[0].value,
      count: parseInt(row.metricValues[0].value, 10),
    }));

    // ── Build response ──
    const analyticsData = {
      summary: {
        totalSessions: sessions,
        totalPageViews: pageViews,
        uniqueVisitors: activeUsers,
        bounceRate: Math.round(bounceRate * 10) / 10,
        avgPagesPerSession: Math.round(pagesPerSession * 10) / 10,
        avgSessionDuration: Math.round(avgDuration),
      },
      visitors: activeUsers,
      pageViews,
      totalSessions: sessions,
      uniqueVisitors: activeUsers,
      bounceRate: Math.round(bounceRate * 10) / 10,
      avgDuration: Math.round(avgDuration),
      pagesPerVisit: Math.round(pagesPerSession * 10) / 10,
      trafficSources,
      deviceBreakdown,
      dailyBreakdown,
      topPages,
      countries,
      // Website metadata
      websiteUrl: config.website_url,
    };

    console.log(`GA4 analytics fetched for ${client?.name}: ${activeUsers} users, ${sessions} sessions, ${pageViews} pageViews`);

    return new Response(
      JSON.stringify({
        clientId,
        clientName: client?.name || 'Unknown Client',
        analytics: analyticsData,
        dateRange: { startDate, endDate },
        source: 'ga4_generic',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error('Error in fetch-ga4-analytics:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
