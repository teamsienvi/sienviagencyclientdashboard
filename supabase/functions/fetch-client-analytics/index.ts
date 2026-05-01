import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Base64Url encoder helper for JWT
function encodeBase64Url(str: string): string {
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function encodeBase64UrlBuffer(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let str = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    str += String.fromCharCode(bytes[i]);
  }
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Generate Google Access Token using Service Account JSON via WebCrypto
async function getGoogleAccessToken(serviceAccountJson: any, scopes: string[]): Promise<string> {
  const header = { alg: 'RS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: serviceAccountJson.client_email,
    scope: scopes.join(' '),
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  };
  
  const headerEncoded = encodeBase64Url(JSON.stringify(header));
  const payloadEncoded = encodeBase64Url(JSON.stringify(payload));
  const signatureInput = `${headerEncoded}.${payloadEncoded}`;
  
  const pemHeader = "-----BEGIN PRIVATE KEY-----";
  const pemFooter = "-----END PRIVATE KEY-----";
  const pemContents = serviceAccountJson.private_key.replace(pemHeader, '').replace(pemFooter, '').replace(/\s/g, '');
  const binaryDer = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));
  
  const key = await crypto.subtle.importKey(
    'pkcs8', binaryDer, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']
  );
  
  const signatureBuffer = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(signatureInput));
  const signatureEncoded = encodeBase64UrlBuffer(signatureBuffer);
  const jwt = `${signatureInput}.${signatureEncoded}`;
  
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt }),
  });
  
  const data = await response.json();
  if (!response.ok) throw new Error('Failed to get Google Access Token: ' + JSON.stringify(data));
  return data.access_token;
}

// Helper to run a single GA4 report
async function runGA4Report(propertyId: string, accessToken: string, requestBody: any) {
  const url = `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody)
  });
  if (!response.ok) {
    const errorText = await response.text();
    console.error('GA4 API Error:', errorText);
    throw new Error(`GA4 API Error: ${response.status} ${errorText}`);
  }
  return response.json();
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { clientId, startDate, endDate } = await req.json();

    if (!clientId || !startDate || !endDate) {
      return new Response(JSON.stringify({ error: 'Missing parameters' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('id, name, is_active, client_ga4_config(ga4_property_id)')
      .eq('id', clientId)
      .maybeSingle();

    if (clientError || !client) {
      return new Response(JSON.stringify({ error: 'Client not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (!client.is_active) {
      return new Response(JSON.stringify({ ok: false, errorType: 'inactive', clientId, clientName: client.name }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const ga4Config = Array.isArray(client.client_ga4_config) ? client.client_ga4_config[0] : client.client_ga4_config;
    const propertyId = ga4Config?.ga4_property_id;

    if (!propertyId) {
      return new Response(JSON.stringify({ ok: false, errorType: 'not_configured', error: 'GA4 Property ID not configured for this client.', clientId, clientName: client.name }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const saJsonRaw = Deno.env.get('GA4_SERVICE_ACCOUNT_JSON');
    if (!saJsonRaw) {
       console.error("Missing GA4_SERVICE_ACCOUNT_JSON secret");
       return new Response(JSON.stringify({ error: 'Server misconfiguration: Missing GA4 credentials' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    
    let serviceAccountJson;
    try {
      serviceAccountJson = JSON.parse(saJsonRaw);
    } catch (e) {
      console.error("Invalid GA4_SERVICE_ACCOUNT_JSON format");
      return new Response(JSON.stringify({ error: 'Server misconfiguration: Invalid GA4 credentials format' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const accessToken = await getGoogleAccessToken(serviceAccountJson, ['https://www.googleapis.com/auth/analytics.readonly']);
    
    // Normalize property ID (strip "properties/" if present)
    const cleanPropertyId = propertyId.replace('properties/', '');
    const dateRanges = [{ startDate, endDate }];

    // Parallel GA4 queries for different breakdown dimensions
    const [
      overviewData,
      trafficData,
      deviceData,
      dailyData,
      topPagesData,
      countriesData,
      outboundData
    ] = await Promise.all([
      // 1. Overview Metrics
      runGA4Report(cleanPropertyId, accessToken, {
        dateRanges,
        metrics: [{ name: 'sessions' }, { name: 'screenPageViews' }, { name: 'totalUsers' }, { name: 'bounceRate' }, { name: 'averageSessionDuration' }]
      }),
      // 2. Traffic Sources
      runGA4Report(cleanPropertyId, accessToken, {
        dateRanges,
        dimensions: [{ name: 'sessionDefaultChannelGroup' }, { name: 'sessionSource' }],
        metrics: [{ name: 'sessions' }]
      }),
      // 3. Devices
      runGA4Report(cleanPropertyId, accessToken, {
        dateRanges,
        dimensions: [{ name: 'deviceCategory' }],
        metrics: [{ name: 'sessions' }]
      }),
      // 4. Daily Breakdown
      runGA4Report(cleanPropertyId, accessToken, {
        dateRanges,
        dimensions: [{ name: 'date' }],
        metrics: [{ name: 'sessions' }, { name: 'screenPageViews' }]
      }),
      // 5. Top Pages
      runGA4Report(cleanPropertyId, accessToken, {
        dateRanges,
        dimensions: [{ name: 'pagePath' }],
        metrics: [{ name: 'screenPageViews' }],
        orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
        limit: 10
      }),
      // 6. Countries
      runGA4Report(cleanPropertyId, accessToken, {
        dateRanges,
        dimensions: [{ name: 'country' }],
        metrics: [{ name: 'sessions' }],
        orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
        limit: 20
      }),
      // 7. Outbound (Airbnb) Clicks tracked via Enhanced Measurement
      runGA4Report(cleanPropertyId, accessToken, {
        dateRanges,
        dimensionFilter: {
           andGroup: {
             expressions: [
               { filter: { fieldName: 'eventName', stringFilter: { value: 'click' } } },
               { filter: { fieldName: 'linkUrl', stringFilter: { matchType: 'CONTAINS', value: 'airbnb.com' } } }
             ]
           }
        },
        metrics: [{ name: 'eventCount' }]
      }).catch(e => {
        console.error("Outbound clicks query failed (this is non-fatal):", e);
        return { rows: [] };
      })
    ]);

    // Parse Overview
    let totalSessions = 0, totalPageViews = 0, uniqueVisitors = 0, bounceRate = 0, avgSessionDuration = 0;
    if (overviewData.rows && overviewData.rows.length > 0) {
      const row = overviewData.rows[0].metricValues;
      totalSessions = parseInt(row[0].value) || 0;
      totalPageViews = parseInt(row[1].value) || 0;
      uniqueVisitors = parseInt(row[2].value) || 0;
      bounceRate = parseFloat(row[3].value) * 100 || 0; // GA4 returns decimal (e.g. 0.45)
      avgSessionDuration = parseFloat(row[4].value) || 0;
    }

    if (totalSessions === 0 && totalPageViews === 0) {
      return new Response(JSON.stringify({ ok: false, errorType: 'no_data', error: 'No analytics data found for this date range in GA4.', clientId, clientName: client.name }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Parse Traffic Sources with Breakdown
    const trafficSourcesMap = new Map<string, any>();
    
    (trafficData.rows || []).forEach((row: any) => {
      const group = row.dimensionValues[0].value;
      const sourceDetail = row.dimensionValues[1].value;
      const sessions = parseInt(row.metricValues[0].value);
      
      if (!trafficSourcesMap.has(group)) {
        trafficSourcesMap.set(group, { source: group, sessions: 0, breakdown: [] });
      }
      
      const groupData = trafficSourcesMap.get(group)!;
      groupData.sessions += sessions;
      if (sessions > 0) {
        groupData.breakdown.push({ name: sourceDetail, sessions });
      }
    });

    const trafficSources = Array.from(trafficSourcesMap.values()).map(groupData => {
      // Sort the breakdown details
      groupData.breakdown.sort((a: any, b: any) => b.sessions - a.sessions);
      // Optional: limit breakdown to top 5 and group rest into "Other"
      let finalBreakdown = groupData.breakdown;
      if (finalBreakdown.length > 5) {
        const top5 = finalBreakdown.slice(0, 5);
        const otherSessions = finalBreakdown.slice(5).reduce((sum: number, item: any) => sum + item.sessions, 0);
        top5.push({ name: 'Other', sessions: otherSessions });
        finalBreakdown = top5;
      }
      
      return {
        ...groupData,
        breakdown: finalBreakdown,
        percentage: totalSessions > 0 ? Math.round((groupData.sessions / totalSessions) * 1000) / 10 : 0
      };
    }).sort((a: any, b: any) => b.sessions - a.sessions);

    // Parse Devices
    const deviceBreakdown = (deviceData.rows || []).map((row: any) => {
      const device = row.dimensionValues[0].value;
      const sessions = parseInt(row.metricValues[0].value);
      return { device: device.charAt(0).toUpperCase() + device.slice(1), sessions, percentage: totalSessions > 0 ? Math.round((sessions / totalSessions) * 1000) / 10 : 0 };
    }).sort((a: any, b: any) => b.sessions - a.sessions);

    // Parse Daily
    const dailyBreakdown = (dailyData.rows || []).map((row: any) => {
      const d = row.dimensionValues[0].value; // Format: YYYYMMDD
      const dateStr = `${d.substring(0,4)}-${d.substring(4,6)}-${d.substring(6,8)}`;
      return {
        date: dateStr,
        sessions: parseInt(row.metricValues[0].value),
        pageViews: parseInt(row.metricValues[1].value)
      };
    }).sort((a: any, b: any) => a.date.localeCompare(b.date));

    // Parse Top Pages
    const topPages = (topPagesData.rows || []).map((row: any) => {
      return { path: row.dimensionValues[0].value, views: parseInt(row.metricValues[0].value) };
    });

    // Parse Countries
    const countries = (countriesData.rows || []).map((row: any) => {
      return { country: row.dimensionValues[0].value, count: parseInt(row.metricValues[0].value) };
    });

    // Parse Outbound Clicks
    let airbnbClicks = 0;
    if (outboundData.rows && outboundData.rows.length > 0) {
      airbnbClicks = parseInt(outboundData.rows[0].metricValues[0].value) || 0;
    }

    const analyticsPayload = {
      summary: {
        totalSessions,
        totalPageViews,
        uniqueVisitors,
        bounceRate: Math.round(bounceRate * 10) / 10,
        avgPagesPerSession: totalSessions > 0 ? Math.round((totalPageViews / totalSessions) * 10) / 10 : 0,
        avgSessionDuration: Math.round(avgSessionDuration)
      },
      trafficSources,
      deviceBreakdown,
      dailyBreakdown,
      topPages,
      countries,
      airbnbClicks: airbnbClicks > 0 ? airbnbClicks : undefined
    };

    return new Response(JSON.stringify({
      clientId: client.id,
      clientName: client.name,
      analytics: analyticsPayload,
      dateRange: { startDate, endDate },
      source: 'ga4'
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('Edge function error:', error);
    return new Response(JSON.stringify({ error: 'Internal Server Error', details: error instanceof Error ? error.message : String(error) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
