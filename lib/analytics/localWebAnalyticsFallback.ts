import { supabase } from "@/integrations/supabase/client";
import { eachDayOfInterval, format, parseISO } from "date-fns";

export async function fetchLocalWebAnalyticsFallback(
  clientId: string,
  startDate: string,
  endDate: string
) {
  const startIso = `${startDate}T00:00:00.000Z`;
  const endIso = `${endDate}T23:59:59.999Z`;

  const [clientRes, sessionsRes, pageViewsRes] = await Promise.all([
    supabase.from("clients").select("id, name").eq("id", clientId).maybeSingle(),
    supabase
      .from("web_analytics_sessions" as any)
      .select("*")
      .eq("client_id", clientId)
      .eq("is_excluded", false)
      .gte("started_at", startIso)
      .lte("started_at", endIso),
    supabase
      .from("web_analytics_page_views" as any)
      .select("*")
      .eq("client_id", clientId)
      .eq("is_excluded", false)
      .gte("viewed_at", startIso)
      .lte("viewed_at", endIso),
  ]);

  const clientName = (clientRes.data as any)?.name || "Client";
  const sessions = ((sessionsRes.data as any[]) || []).filter(Boolean);
  const pageViews = ((pageViewsRes.data as any[]) || []).filter(Boolean);

  const uniqueVisitorSet = new Set<string>();
  sessions.forEach((s) => {
    if (s.visitor_id) uniqueVisitorSet.add(String(s.visitor_id));
  });
  pageViews.forEach((pv) => {
    if (pv.visitor_id) uniqueVisitorSet.add(String(pv.visitor_id));
  });

  const uniqueVisitors = uniqueVisitorSet.size;
  const totalPageViews = pageViews.length;
  const totalSessions = sessions.length > 0 ? sessions.length : uniqueVisitors;

  // Bounce rate & Avg session duration
  let bounceCount = 0;
  let totalDurationSec = 0;
  let durationCount = 0;

  sessions.forEach((s) => {
    if (s.bounce || (s.page_count !== undefined && Number(s.page_count) <= 1)) {
      bounceCount++;
    }
    if (s.started_at && s.ended_at) {
      const dur = (new Date(s.ended_at).getTime() - new Date(s.started_at).getTime()) / 1000;
      if (dur > 0 && dur < 7200) {
        totalDurationSec += dur;
        durationCount++;
      }
    }
  });

  const bounceRate =
    sessions.length > 0 ? Math.round((bounceCount / sessions.length) * 1000) / 10 : 0;
  const avgSessionDuration =
    durationCount > 0 ? Math.round(totalDurationSec / durationCount) : 0;
  const avgPagesPerSession =
    totalSessions > 0 ? Math.round((totalPageViews / totalSessions) * 100) / 100 : 0;

  // Traffic Sources
  const sourceMap = new Map<string, number>();
  const sourceItems = sessions.length > 0 ? sessions : pageViews;
  sourceItems.forEach((item) => {
    let channel = "Direct";
    const ref = String(item.referrer || "").toLowerCase();
    const utmSource = String(item.utm_source || "").toLowerCase();
    const utmMedium = String(item.utm_medium || "").toLowerCase();

    if (utmMedium.includes("cpc") || utmMedium.includes("paid")) {
      channel = "Paid Search";
    } else if (
      utmMedium.includes("social") ||
      ["facebook", "instagram", "tiktok", "twitter", "x.com", "t.co", "youtube", "linkedin", "reddit"].some(
        (s) => ref.includes(s) || utmSource.includes(s)
      )
    ) {
      channel = "Organic Social";
    } else if (
      ["google", "bing", "yahoo", "duckduckgo", "baidu"].some(
        (s) => ref.includes(s) || utmSource.includes(s)
      )
    ) {
      channel = "Organic Search";
    } else if (ref && !ref.includes("inthedome.ca")) {
      channel = "Referral";
    }
    sourceMap.set(channel, (sourceMap.get(channel) || 0) + 1);
  });

  const trafficSources = Array.from(sourceMap.entries())
    .map(([source, count]) => ({
      source,
      sessions: count,
      visitors: count,
      percentage:
        sourceItems.length > 0 ? Math.round((count / sourceItems.length) * 1000) / 10 : 0,
      breakdown: [{ name: source.toLowerCase(), sessions: count }],
    }))
    .sort((a, b) => b.sessions - a.sessions);

  // Device Breakdown
  const deviceMap = new Map<string, number>();
  sourceItems.forEach((item) => {
    const raw = String(item.device_type || "desktop").toLowerCase();
    const label =
      raw.includes("mobile") || raw.includes("phone")
        ? "Mobile"
        : raw.includes("tablet") || raw.includes("ipad")
          ? "Tablet"
          : "Desktop";
    deviceMap.set(label, (deviceMap.get(label) || 0) + 1);
  });

  const deviceBreakdown = Array.from(deviceMap.entries())
    .map(([device, count]) => ({
      device,
      sessions: count,
      visitors: count,
      percentage:
        sourceItems.length > 0 ? Math.round((count / sourceItems.length) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.sessions - a.sessions);

  // Daily Breakdown across the requested interval (capped to last 90 days for chart readability)
  const dailyMap = new Map<
    string,
    { date: string; sessions: number; visitors: Set<string>; pageViews: number }
  >();

  try {
    const startObj = parseISO(startDate);
    const endObj = parseISO(endDate);
    const effectiveStart =
      endObj.getTime() - startObj.getTime() > 90 * 86400000
        ? new Date(endObj.getTime() - 30 * 86400000)
        : startObj;
    for (const day of eachDayOfInterval({ start: effectiveStart, end: endObj })) {
      const dStr = format(day, "yyyy-MM-dd");
      dailyMap.set(dStr, { date: dStr, sessions: 0, visitors: new Set(), pageViews: 0 });
    }
  } catch {
    // Fallback if dates fail to parse
  }

  sessions.forEach((s) => {
    const dStr = String(s.started_at || s.created_at || "").slice(0, 10);
    if (!dStr) return;
    if (!dailyMap.has(dStr)) {
      dailyMap.set(dStr, { date: dStr, sessions: 0, visitors: new Set(), pageViews: 0 });
    }
    const entry = dailyMap.get(dStr)!;
    entry.sessions += 1;
    if (s.visitor_id) entry.visitors.add(String(s.visitor_id));
  });

  pageViews.forEach((pv) => {
    const dStr = String(pv.viewed_at || pv.created_at || "").slice(0, 10);
    if (!dStr) return;
    if (!dailyMap.has(dStr)) {
      dailyMap.set(dStr, { date: dStr, sessions: 0, visitors: new Set(), pageViews: 0 });
    }
    const entry = dailyMap.get(dStr)!;
    entry.pageViews += 1;
    if (pv.visitor_id) entry.visitors.add(String(pv.visitor_id));
  });

  const dailyBreakdown = Array.from(dailyMap.values())
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((d) => ({
      date: d.date,
      sessions: d.sessions > 0 ? d.sessions : d.visitors.size,
      visitors: d.visitors.size,
      pageViews: d.pageViews,
    }));

  // Top Pages
  const pageMap = new Map<string, { url: string; path: string; views: number; title: string | null }>();
  pageViews.forEach((pv) => {
    const path = String(pv.page_url || "/").trim() || "/";
    const title = pv.page_title ? String(pv.page_title) : null;
    if (!pageMap.has(path)) {
      pageMap.set(path, { url: path, path, views: 1, title });
    } else {
      const existing = pageMap.get(path)!;
      existing.views += 1;
      if (!existing.title && title) existing.title = title;
    }
  });

  const topPages = Array.from(pageMap.values()).sort((a, b) => b.views - a.views);

  // Countries
  const countryMap = new Map<string, number>();
  sourceItems.forEach((item) => {
    const c = String(item.country || "").trim();
    if (c && c !== "XX") {
      countryMap.set(c, (countryMap.get(c) || 0) + 1);
    }
  });

  const countries = Array.from(countryMap.entries())
    .map(([country, count]) => ({ country, count, sessions: count }))
    .sort((a, b) => b.count - a.count);

  const analytics = {
    totalSessions,
    pageViews: totalPageViews,
    totalPageViews,
    uniqueVisitors,
    visitors: uniqueVisitors,
    bounceRate,
    avgDuration: avgSessionDuration,
    avgSessionDuration,
    pagesPerVisit: avgPagesPerSession,
    summary: {
      totalSessions,
      totalPageViews,
      uniqueVisitors,
      bounceRate,
      avgSessionDuration,
      avgPagesPerSession,
    },
    trafficSources,
    deviceBreakdown,
    dailyBreakdown,
    topPages,
    countries,
  };

  return {
    ok: true,
    clientId,
    clientName,
    dateRange: { startDate, endDate },
    analytics,
  };
}
