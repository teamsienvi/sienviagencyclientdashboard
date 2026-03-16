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
      .select('id, name, supabase_url, api_key, analytics_api_key, is_active')
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

    // Helper: compute traffic sources & device breakdown from local tables
    const computeLocalBreakdowns = async (cid: string, sDate: string, eDate: string) => {
      const sISO = new Date(`${sDate}T00:00:00.000Z`).toISOString();
      const eExcl = new Date(`${eDate}T00:00:00.000Z`);
      eExcl.setUTCDate(eExcl.getUTCDate() + 1);
      const eISO = eExcl.toISOString();

      const { data: localSessions } = await supabase
        .from('web_analytics_sessions')
        .select('referrer, utm_source, utm_medium, device_type, user_agent')
        .eq('client_id', cid)
        .gte('started_at', sISO)
        .lt('started_at', eISO);

      if (!localSessions || localSessions.length === 0) return null;

      const searchHostnames = ["google.com", "bing.com", "yahoo.com", "duckduckgo.com", "baidu.com", "yandex.com"];
      const socialHostnames = ["facebook.com", "m.facebook.com", "l.facebook.com", "instagram.com", "l.instagram.com", "twitter.com", "t.co", "linkedin.com", "tiktok.com", "youtube.com", "pinterest.com", "reddit.com"];
      const getHostname = (r: string) => { try { return new URL(r).hostname.replace(/^www\./, ""); } catch { return ""; } };

      const srcCounts: Record<string, number> = { Direct: 0, Organic: 0, Social: 0, Referral: 0, Email: 0, Paid: 0 };
      const devCounts: Record<string, number> = { Desktop: 0, Mobile: 0, Tablet: 0 };

      localSessions.forEach((item: any) => {
        // Traffic source
        const utmMedium = String(item.utm_medium || "").toLowerCase();
        const utmSource = String(item.utm_source || "").toLowerCase();
        const referrer = String(item.referrer || "");
        const hostname = referrer ? getHostname(referrer) : "";
        let src = "Direct";
        if (["cpc", "ppc", "paid", "paid_social", "display"].includes(utmMedium)) src = "Paid";
        else if (utmMedium === "email" || utmSource.includes("mail") || hostname.includes("mail")) src = "Email";
        else if (!utmSource && !hostname) src = "Direct";
        else if (searchHostnames.some(s => utmSource.includes(s.split(".")[0]) || hostname === s)) src = "Organic";
        else if (socialHostnames.some(s => utmSource.includes(s.split(".")[0]) || hostname === s)) src = "Social";
        else if (hostname) src = "Referral";
        else src = "Referral";
        srcCounts[src] = (srcCounts[src] || 0) + 1;

        // Device
        const explicit = String(item.device_type || "").toLowerCase();
        const ua = String(item.user_agent || "").toLowerCase();
        let dev = "Desktop";
        if (explicit.includes("mobile") || explicit.includes("phone") || (!explicit && /mobile|android|iphone/i.test(ua))) dev = "Mobile";
        else if (explicit.includes("tablet") || explicit.includes("ipad") || (!explicit && /tablet|ipad/i.test(ua))) dev = "Tablet";
        devCounts[dev] = (devCounts[dev] || 0) + 1;
      });

      const total = localSessions.length;
      const trafficSources = Object.entries(srcCounts).filter(([, c]) => c > 0).sort((a, b) => b[1] - a[1])
        .map(([source, count]) => ({ source, sessions: count, percentage: Math.round((count / total) * 1000) / 10 }));
      const deviceBreakdown = Object.entries(devCounts).filter(([, c]) => c > 0).sort((a, b) => b[1] - a[1])
        .map(([device, count]) => ({ device, sessions: count, percentage: Math.round((count / total) * 1000) / 10 }));

      return { trafficSources, deviceBreakdown };
    };

    // Try external analytics endpoint first (for clients with their own Supabase project)
    if (client.supabase_url && client.api_key) {
      console.log('Fetching analytics from external source:', client.supabase_url);
      const analyticsUrl = `${client.supabase_url}/functions/v1/get-analytics`;

      try {
        // Use analytics_api_key for x-api-key header when present (for projects with separate auth keys)
        const analyticsApiKey = client.analytics_api_key || client.api_key;
        const analyticsResponse = await fetch(analyticsUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': analyticsApiKey,
            'apikey': client.api_key,
            Authorization: `Bearer ${client.api_key}`,
          },
          body: JSON.stringify({
            startDate,
            endDate,
            apiKey: analyticsApiKey,
            api_key: analyticsApiKey,
          }),
        });

        console.log('External analytics response status:', analyticsResponse.status);

        if (analyticsResponse.ok) {
          const analyticsData = await analyticsResponse.json();
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

          if (hasRealData) {
            // Normalize breakdowns-style responses (key/value format from some external projects)
            let enrichedData = { ...data };

            if (data.breakdowns) {
              const bd = data.breakdowns;
              if (bd.sources && !data.trafficSources && !data.sources) {
                enrichedData.trafficSources = bd.sources.map((s: any) => {
                  const total = bd.sources.reduce((sum: number, x: any) => sum + (x.value || 0), 0);
                  return { source: s.key, sessions: s.value, percentage: total > 0 ? Math.round((s.value / total) * 1000) / 10 : 0 };
                });
              }
              if (bd.devices && !data.deviceBreakdown && !data.devices) {
                enrichedData.deviceBreakdown = bd.devices.map((d: any) => {
                  const total = bd.devices.reduce((sum: number, x: any) => sum + (x.value || 0), 0);
                  return { device: d.key.charAt(0).toUpperCase() + d.key.slice(1), sessions: d.value, percentage: total > 0 ? Math.round((d.value / total) * 1000) / 10 : 0 };
                });
              }
              if (bd.top_pages && !data.topPages && !data.top_pages) {
                enrichedData.topPages = bd.top_pages.map((p: any) => ({ path: p.key, views: p.value }));
                enrichedData.top_pages = bd.top_pages.map((p: any) => ({ page_path: p.key, count: p.value, display_name: p.key }));
              }
              if (bd.countries && !data.countries) {
                enrichedData.countries = bd.countries.map((c: any) => ({ country: c.key, count: c.value }));
              }
              if (bd.browsers) {
                enrichedData.browsers = bd.browsers.map((b: any) => {
                  const total = bd.browsers.reduce((sum: number, x: any) => sum + (x.value || 0), 0);
                  return { browser: b.key, sessions: b.value, percentage: total > 0 ? Math.round((b.value / total) * 1000) / 10 : 0 };
                });
              }
              if (bd.os) {
                enrichedData.os = bd.os.map((o: any) => {
                  const total = bd.os.reduce((sum: number, x: any) => sum + (x.value || 0), 0);
                  return { os: o.key, sessions: o.value, percentage: total > 0 ? Math.round((o.value / total) * 1000) / 10 : 0 };
                });
              }
            }

            // Normalize dailyTimeSeries → dailyBreakdown
            if (data.dailyTimeSeries && !data.dailyBreakdown) {
              enrichedData.dailyBreakdown = data.dailyTimeSeries.map((d: any) => ({
                date: d.date,
                visitors: d.visitors || 0,
                sessions: d.sessions || d.visitors || 0,
                pageViews: d.pageViews || 0,
              }));
            }

            // Supplement: if external lacks trafficSources or deviceBreakdown, compute from local
            const hasSources = enrichedData.trafficSources?.length > 0 || enrichedData.sources?.length > 0;
            const hasDevices = enrichedData.deviceBreakdown?.length > 0 || enrichedData.devices?.length > 0;

            if (!hasSources || !hasDevices) {
              console.log('External data lacks sources/devices, supplementing from local tables...');
              const localBreakdowns = await computeLocalBreakdowns(clientId, startDate, endDate);
              if (localBreakdowns) {
                if (!hasSources) enrichedData.trafficSources = localBreakdowns.trafficSources;
                if (!hasDevices) enrichedData.deviceBreakdown = localBreakdowns.deviceBreakdown;
                console.log('Supplemented with local breakdowns');
              }
            }

            // Helper to fetch from external REST API with timeout
            const fetchExternal = async (url: string, timeoutMs = 5000): Promise<any[] | null> => {
              try {
                const controller = new AbortController();
                const timer = setTimeout(() => controller.abort(), timeoutMs);
                const resp = await fetch(url, {
                  headers: { 'apikey': client.api_key, 'Authorization': `Bearer ${client.api_key}` },
                  signal: controller.signal,
                });
                clearTimeout(timer);
                if (resp.ok) {
                  const json = await resp.json();
                  return Array.isArray(json) ? json : null;
                }
                console.log(`External REST ${resp.status} for ${url.split('?')[0].split('/').pop()}`);
                return null;
              } catch (e) {
                console.log(`External REST error: ${e instanceof Error ? e.message : e}`);
                return null;
              }
            };

            // Supplement top pages from external project's REST API if missing or sparse
            const hasTopPages = (data.topPages?.length > 0 || data.top_pages?.length > 0) &&
              (data.topPages?.[0]?.views > 2 || data.top_pages?.[0]?.count > 2);
            if (!hasTopPages) {
              console.log('Trying to supplement top pages from external tables...');
              const pvTables = ['analytics_page_views', 'analytics_pageviews', 'analytics_events'];
              for (const table of pvTables) {
                const dateCol = table === 'analytics_events' ? 'created_at' : 'viewed_at';
                const pvUrl = `${client.supabase_url}/rest/v1/${table}?select=page_url,path,title,page_title&${dateCol}=gte.${startDate}&${dateCol}=lt.${endDate}&limit=1000`;
                const pvData = await fetchExternal(pvUrl);
                if (pvData && pvData.length > 0) {
                  const dashPaths = ['/admin', '/client/', '/login', '/reset-password', '/web-analytics', '/analytics/', '/report/'];
                  const pageCounts: Record<string, { count: number; title: string | null }> = {};
                  for (const pv of pvData) {
                    let path = pv.page_url || pv.path || '';
                    try { path = new URL(path).pathname; } catch { path = path.split('?')[0]; }
                    if (!path || dashPaths.some((dp: string) => path.startsWith(dp))) continue;
                    if (!pageCounts[path]) pageCounts[path] = { count: 0, title: pv.page_title || pv.title || null };
                    pageCounts[path].count++;
                  }
                  const topPages = Object.entries(pageCounts)
                    .sort((a, b) => b[1].count - a[1].count)
                    .slice(0, 10)
                    .map(([page_path, { count, title }]) => ({ page_path, count, display_name: title || page_path }));
                  if (topPages.length > 0) {
                    enrichedData.top_pages = topPages;
                    enrichedData.topPages = topPages.map(p => ({ path: p.page_path, views: p.count }));
                    console.log(`Supplemented top pages from ${table}: ${topPages.length} pages`);
                  }
                  break;
                }
              }
            }

            // Supplement countries from external project's sessions table if missing/poor
            const hasCountries = data.countries?.length > 0 &&
              !(data.countries.length === 1 && data.countries[0].country === 'Unknown');
            if (!hasCountries) {
              console.log('Trying to supplement countries from external sessions...');
              const sessData = await fetchExternal(
                `${client.supabase_url}/rest/v1/analytics_sessions?select=country&started_at=gte.${startDate}&started_at=lt.${endDate}&limit=1000`
              );
              if (sessData && sessData.length > 0) {
                const countryCounts: Record<string, number> = {};
                for (const s of sessData) {
                  const c = s.country && s.country !== 'Unknown' ? s.country.trim().toUpperCase().slice(0, 2) : 'XX';
                  countryCounts[c] = (countryCounts[c] || 0) + 1;
                }
                const countries = Object.entries(countryCounts)
                  .map(([country, count]) => ({ country, count }))
                  .sort((a, b) => b.count - a.count);
                if (countries.length > 0) {
                  enrichedData.countries = countries;
                  console.log(`Supplemented countries: ${countries.length} countries`);
                }
              }
            }

            // Fetch Airbnb outbound clicks
            let airbnbClicks = data.airbnbClicks || 0;
            if (!airbnbClicks) {
              try {
                const outboundUrl = `${client.supabase_url}/rest/v1/analytics_outbound_clicks?select=target_url&clicked_at=gte.${startDate}&clicked_at=lt.${endDate}`;
                const outboundResponse = await fetch(outboundUrl, {
                  headers: { 'apikey': client.api_key, 'Authorization': `Bearer ${client.api_key}` },
                });
                if (outboundResponse.ok) {
                  const outboundData = await outboundResponse.json();
                  airbnbClicks = outboundData.filter((click: any) =>
                    String(click.target_url || '').toLowerCase().includes('airbnb.com')
                  ).length;
                }
              } catch (e) {
                console.log('Could not fetch outbound clicks:', e);
              }
            }

            // Fix data inconsistency: if we have sessions but zero/very low pageViews,
            // supplement from external page view tables directly
            const extSessions = enrichedData.totalSessions || enrichedData.summary?.totalSessions || 0;
            const extPageViews = enrichedData.pageViews || enrichedData.totalPageViews || enrichedData.summary?.totalPageViews || 0;

            if (extSessions > 0 && extPageViews < extSessions * 0.1) {
              console.log(`Data inconsistency detected: ${extSessions} sessions but only ${extPageViews} pageViews. Supplementing...`);

              // Try to get actual page view count from external project
              const pvCountTables = [
                { name: 'analytics_page_views', dateCol: 'viewed_at' },
                { name: 'analytics_pageviews', dateCol: 'viewed_at' },
                { name: 'web_analytics_page_views', dateCol: 'viewed_at' },
                { name: 'analytics_events', dateCol: 'created_at' },
              ];

              for (const table of pvCountTables) {
                try {
                  // Use HEAD with count to get total
                  const countUrl = `${client.supabase_url}/rest/v1/${table.name}?select=id&${table.dateCol}=gte.${startDate}&${table.dateCol}=lt.${endDate}&limit=1`;
                  const countResp = await fetch(countUrl, {
                    method: 'HEAD',
                    headers: {
                      'apikey': client.api_key,
                      'Authorization': `Bearer ${client.api_key}`,
                      'Prefer': 'count=exact',
                    },
                  });

                  if (countResp.ok) {
                    const contentRange = countResp.headers.get('content-range');
                    if (contentRange) {
                      const totalMatch = contentRange.match(/\/(\d+)/);
                      if (totalMatch) {
                        const actualPvCount = parseInt(totalMatch[1], 10);
                        if (actualPvCount > extPageViews) {
                          console.log(`Found ${actualPvCount} actual page views from ${table.name}`);

                          // Update page view counts
                          if (enrichedData.summary) {
                            enrichedData.summary.totalPageViews = actualPvCount;
                            enrichedData.summary.avgPagesPerSession = extSessions > 0 ? Math.round((actualPvCount / extSessions) * 10) / 10 : 0;
                          }
                          enrichedData.pageViews = actualPvCount;
                          enrichedData.totalPageViews = actualPvCount;
                          enrichedData.pagesPerVisit = extSessions > 0 ? Math.round((actualPvCount / extSessions) * 10) / 10 : 0;

                          // Fix bounce rate - if we had 100% bounce because of zero page views, recalculate
                          const currentBounce = enrichedData.bounceRate ?? enrichedData.summary?.bounceRate ?? 100;
                          if (currentBounce >= 99 && actualPvCount > extSessions) {
                            // Pages per session > 1 means not all sessions are bounces
                            const pps = actualPvCount / extSessions;
                            const estBounceRate = Math.max(10, Math.min(70, 100 - (pps - 1) * 30));
                            enrichedData.bounceRate = Math.round(estBounceRate * 10) / 10;
                            if (enrichedData.summary) enrichedData.summary.bounceRate = enrichedData.bounceRate;
                            console.log(`Adjusted bounce rate from ${currentBounce}% to ${enrichedData.bounceRate}%`);
                          }

                          break;
                        }
                      }
                    }
                  }
                } catch (e) {
                  console.log(`Page view count from ${table.name} failed:`, e);
                }
              }
            }

            console.log('Analytics fetched successfully from external source for client:', client.name);
            return new Response(
              JSON.stringify({
                clientId: client.id,
                clientName: client.name,
                analytics: { ...enrichedData, airbnbClicks: airbnbClicks > 0 ? airbnbClicks : undefined },
                dateRange: { startDate, endDate },
                source: 'external',
              }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          } else {
            console.log('External returned no real data, falling through to local...');
          }
        }
      } catch (fetchError) {
        console.log('External analytics fetch error, falling back to local:', fetchError);
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

    // Try to fetch Airbnb outbound clicks (only available on some client projects like Haven)
    let airbnbClicks = 0;
    try {
      // First check if the table exists by trying to query it
      const { data: outboundClicks, error: outboundError } = await supabase
        .from('analytics_outbound_clicks')
        .select('*')
        .gte('clicked_at', startISO)
        .lt('clicked_at', endISO);

      if (!outboundError && outboundClicks) {
        // Filter for Airbnb links
        airbnbClicks = outboundClicks.filter((click: any) => {
          const url = String(click.target_url || click.url || '').toLowerCase();
          return url.includes('airbnb.com');
        }).length;
        console.log('Airbnb outbound clicks found:', airbnbClicks);
      }
    } catch (e) {
      // Table might not exist on this client - that's okay
      console.log('analytics_outbound_clicks table not available');
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
      airbnbClicks: airbnbClicks > 0 ? airbnbClicks : undefined,
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
