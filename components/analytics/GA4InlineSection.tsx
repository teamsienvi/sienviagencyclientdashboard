"use client";

import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, subDays } from "date-fns";
import {
  Users, Eye, Clock, TrendingDown, TrendingUp, Globe, Activity,
  Smartphone, Monitor, Tablet, ChevronDown, ChevronUp, ExternalLink, Info
} from "lucide-react";
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid
} from "recharts";

interface GA4InlineSectionProps {
  clientId: string;
  isActive?: boolean;
}

const COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16"];
const DEVICE_ICONS: Record<string, React.ReactNode> = {
  Mobile: <Smartphone className="h-4 w-4" />,
  Desktop: <Monitor className="h-4 w-4" />,
  Tablet: <Tablet className="h-4 w-4" />,
};

type DateFilter = "7d" | "14d" | "30d" | "90d";

export function GA4InlineSection({ clientId, isActive = true }: GA4InlineSectionProps) {
  const [showAllPages, setShowAllPages] = useState(false);
  const [showAllCountries, setShowAllCountries] = useState(false);
  const [dateFilter, setDateFilter] = useState<DateFilter>("7d");

  const dateRange = useMemo(() => {
    const days = dateFilter === "7d" ? 7 : dateFilter === "14d" ? 14 : dateFilter === "90d" ? 90 : 30;
    return {
      startDate: format(subDays(new Date(), days), "yyyy-MM-dd"),
      endDate: format(new Date(), "yyyy-MM-dd"),
    };
  }, [dateFilter]);

  const { data: analyticsData, isLoading } = useQuery({
    queryKey: ["ga4-inline", clientId, dateRange.startDate, dateRange.endDate],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("fetch-ga4-analytics", {
        body: {
          clientId,
          startDate: dateRange.startDate,
          endDate: dateRange.endDate,
        },
      });
      if (error) throw new Error(error.message);
      if (data?.error || data?.errorType) throw new Error(data.error || "GA4 not configured");
      return data;
    },
    enabled: !!clientId && isActive,
    staleTime: 5 * 60 * 1000,
    retry: 2,
  });

  const analytics = analyticsData?.analytics;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    );
  }

  if (!analytics) return null;

  // Extract data
  const totalSessions = analytics.totalSessions || analytics.summary?.totalSessions || 0;
  const totalPageViews = analytics.pageViews || analytics.summary?.totalPageViews || 0;
  const uniqueVisitors = analytics.uniqueVisitors || analytics.summary?.uniqueVisitors || 0;
  const bounceRate = analytics.bounceRate || analytics.summary?.bounceRate || 0;
  const avgDuration = analytics.avgDuration || analytics.summary?.avgSessionDuration || 0;
  const pagesPerSession = analytics.pagesPerVisit || analytics.summary?.avgPagesPerSession || 0;

  const dailyBreakdown = (analytics.dailyBreakdown || []) as any[];
  const trafficSources = (analytics.trafficSources || []) as any[];
  // Normalize and aggregate topPages
  const rawTopPages = (analytics.topPages || (analytics as any).top_pages || []) as any[];
  const aggregatedTopPagesMap = new Map<string, { url: string; path: string; views: number; title: string | null }>();
  rawTopPages.forEach((page: any) => {
    let url = String(page.url || page.path || page.page_path || '/').trim();
    if (!url || url.includes('127.0.0.1') || url.includes('localhost') || url.includes('lovable_test')) return;
    if (url.includes('/sandbox/modern/')) {
      const parts = url.split('/sandbox/modern/');
      url = parts[1] ? '/' + parts[1] : '';
    } else if (url.startsWith('/web-pixels@') || url.includes('/sandbox/')) {
      return;
    }
    url = url.replace(/<\/?[^>]+(>|$)/g, '');
    try {
      if (url.startsWith('http://') || url.startsWith('https://')) {
        url = new URL(url).pathname;
      } else if (url.includes('?')) {
        url = url.split('?')[0];
      }
    } catch (_) {}
    if (url.length > 1 && url.endsWith('/')) url = url.slice(0, -1);
    if (!url || url === '/**') url = '/';
    if (!url.startsWith('/')) url = '/' + url;

    const views = Number(page.views ?? page.count ?? 0) || 0;
    const rawTitle = page.display_name || page.title || null;
    const title = (rawTitle && rawTitle !== '(not set)' && rawTitle !== url && !rawTitle.startsWith('http')) ? rawTitle : null;

    if (!aggregatedTopPagesMap.has(url)) {
      aggregatedTopPagesMap.set(url, { url, path: url, views, title });
    } else {
      const item = aggregatedTopPagesMap.get(url)!;
      item.views += views;
      if (!item.title && title) item.title = title;
    }
  });

  const topPages = Array.from(aggregatedTopPagesMap.values()).sort((a, b) => b.views - a.views);
  const visiblePages = showAllPages ? topPages.slice(0, 30) : topPages.slice(0, 10);
  const visibleCountries = showAllCountries ? countries.slice(0, 30) : countries.slice(0, 10);

  // Chart data
  const chartData = dailyBreakdown.map((d: any) => ({
    date: d.date,
    label: new Date(d.date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    sessions: d.sessions || 0,
    visitors: d.visitors || 0,
    pageViews: d.pageViews || 0,
  }));

  // Trend: last 7 days vs previous 7 days
  const last7 = dailyBreakdown.slice(-7);
  const prev7 = dailyBreakdown.slice(-14, -7);
  const last7Sessions = last7.reduce((s: number, d: any) => s + (d.sessions || 0), 0);
  const prev7Sessions = prev7.reduce((s: number, d: any) => s + (d.sessions || 0), 0);
  const sessionsTrend = prev7Sessions > 0 ? ((last7Sessions - prev7Sessions) / prev7Sessions) * 100 : 0;
  const last7Visitors = last7.reduce((s: number, d: any) => s + (d.visitors || 0), 0);
  const prev7Visitors = prev7.reduce((s: number, d: any) => s + (d.visitors || 0), 0);
  const visitorsTrend = prev7Visitors > 0 ? ((last7Visitors - prev7Visitors) / prev7Visitors) * 100 : 0;

  const totalDeviceSessions = deviceBreakdown.reduce((s: number, d: any) => s + (d.sessions || 0), 0);
  const totalSourceSessions = trafficSources.reduce((s: number, t: any) => s + (t.sessions || 0), 0);

  const formatDuration = (seconds: number) => {
    if (!seconds) return "0s";
    if (seconds < 60) return `${Math.round(seconds)}s`;
    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return `${mins}m ${secs}s`;
  };

  const dateFilterOptions = [
    { value: "7d", label: "7 Days" },
    { value: "14d", label: "14 Days" },
    { value: "30d", label: "30 Days" },
    { value: "90d", label: "90 Days" },
  ] as const;

  return (
    <div className="space-y-6">
      {/* Source badge + Date filter */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-300">
            Google Analytics 4
          </span>
          <span className="text-xs text-muted-foreground">
            {dateRange.startDate} → {dateRange.endDate}
          </span>
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400">
            Live
          </span>
        </div>
        <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-0.5">
          {dateFilterOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setDateFilter(opt.value)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                dateFilter === opt.value
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <KPICard
          icon={<Users className="h-4 w-4 text-blue-600" />}
          label="Unique Visitors"
          value={uniqueVisitors.toLocaleString()}
          subtext="👤 Distinct people"
          trend={visitorsTrend}
          trendLabel="vs prev 7d"
          color="blue"
        />
        <KPICard
          icon={<Activity className="h-4 w-4 text-emerald-600" />}
          label="Total Sessions"
          value={totalSessions.toLocaleString()}
          subtext="🚪 Browsing visits"
          trend={sessionsTrend}
          trendLabel="vs prev 7d"
          color="emerald"
        />
        <KPICard
          icon={<Eye className="h-4 w-4 text-violet-600" />}
          label="Page Views"
          value={totalPageViews.toLocaleString()}
          subtext="📄 Total page loads"
          color="violet"
        />
        <KPICard
          icon={<TrendingDown className="h-4 w-4 text-amber-600" />}
          label="Bounce Rate"
          value={`${bounceRate.toFixed(1)}%`}
          subtext="📉 Single-page visits"
          color="amber"
          invertTrend
        />
        <KPICard
          icon={<Clock className="h-4 w-4 text-cyan-600" />}
          label="Avg. Duration"
          value={formatDuration(avgDuration)}
          subtext="⏱️ Time per visit"
          color="cyan"
        />
        <KPICard
          icon={<Eye className="h-4 w-4 text-pink-600" />}
          label="Pages / Session"
          value={pagesPerSession.toFixed(1)}
          subtext="📄 Views per visit"
          color="pink"
        />
      </div>

      {/* Daily Chart */}
      {chartData.length > 0 && (
        <div className="bg-white dark:bg-zinc-900/50 rounded-xl border p-4">
          <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Activity className="h-4 w-4 text-blue-500" />
            Website Traffic (Daily)
          </h4>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.4} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10 }}
                interval={Math.max(0, Math.floor(chartData.length / 8))}
              />
              <YAxis yAxisId="left" tick={{ fontSize: 10 }} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8 }}
                formatter={(value: number, name: string) => [value.toLocaleString(), name]}
              />
              <Area yAxisId="left" type="monotone" dataKey="sessions" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.15} strokeWidth={2} name="Sessions" />
              <Area yAxisId="right" type="monotone" dataKey="pageViews" stroke="#10b981" fill="#10b981" fillOpacity={0.08} strokeWidth={1.5} name="Page Views" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Two columns: Traffic Sources + Devices */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Traffic Sources */}
        {trafficSources.length > 0 && (
          <div className="bg-white dark:bg-zinc-900/50 rounded-xl border p-4">
            <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Globe className="h-4 w-4 text-blue-500" />
              Traffic Sources
            </h4>
            <div className="space-y-3">
              {trafficSources.map((s: any, i: number) => {
                const pct = s.percentage || (totalSourceSessions > 0 ? (s.sessions / totalSourceSessions) * 100 : 0);
                return (
                  <div key={i} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{s.source}</span>
                      <span className="font-semibold">
                        {s.sessions?.toLocaleString()}{" "}
                        <span className="text-xs text-muted-foreground font-normal">({pct.toFixed(1)}%)</span>
                      </span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${Math.min(pct, 100)}%`,
                          backgroundColor: COLORS[i % COLORS.length],
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Device Breakdown */}
        {deviceBreakdown.length > 0 && (
          <div className="bg-white dark:bg-zinc-900/50 rounded-xl border p-4">
            <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Monitor className="h-4 w-4 text-blue-500" />
              Device Breakdown
            </h4>
            <div className="space-y-3">
              {deviceBreakdown.map((d: any, i: number) => {
                const pct = d.percentage || (totalDeviceSessions > 0 ? (d.sessions / totalDeviceSessions) * 100 : 0);
                return (
                  <div key={i} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2">
                        {DEVICE_ICONS[d.device] || <Globe className="h-4 w-4" />}
                        {d.device}
                      </span>
                      <span className="font-semibold">
                        {d.sessions?.toLocaleString()}{" "}
                        <span className="text-xs text-muted-foreground font-normal">({pct.toFixed(1)}%)</span>
                      </span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${pct}%`,
                          backgroundColor: COLORS[i % COLORS.length],
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Top Pages */}
      {topPages.length > 0 && (
        <div className="bg-white dark:bg-zinc-900/50 rounded-xl border p-4">
          <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <ExternalLink className="h-4 w-4 text-blue-500" />
            Top Pages
            <span className="text-xs text-muted-foreground font-normal">({topPages.length} total · Total page loads per URL)</span>
          </h4>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="pb-2 pr-4">Page</th>
                  <th className="pb-2 text-right">Page Views (Loads)</th>
                </tr>
              </thead>
              <tbody>
                {visiblePages.map((p: any, i: number) => (
                  <tr key={i} className="border-b border-dashed border-muted/40 hover:bg-muted/30 transition-colors">
                    <td className="py-2 pr-4 max-w-[350px] truncate">
                      <span className="text-blue-600 dark:text-blue-400 font-medium">{p.url || p.path}</span>
                      {p.title && <span className="text-xs text-muted-foreground ml-2">— {p.title}</span>}
                    </td>
                    <td className="py-2 text-right font-semibold text-blue-600">{p.views?.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {topPages.length > 10 && (
            <button
              onClick={() => setShowAllPages(!showAllPages)}
              className="mt-3 text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              {showAllPages ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              {showAllPages ? "Show less" : `Show all ${topPages.length}`}
            </button>
          )}
        </div>
      )}

      {/* Top Countries */}
      {countries.length > 0 && (
        <div className="bg-white dark:bg-zinc-900/50 rounded-xl border p-4">
          <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Globe className="h-4 w-4 text-violet-500" />
            Top Countries
            <span className="text-xs text-muted-foreground font-normal">(Unique visitors / people)</span>
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
            {visibleCountries.map((c: any, i: number) => (
              <div key={i} className="flex items-center justify-between text-sm py-1.5 px-3 rounded-lg bg-muted/30 border border-border/30">
                <span className="truncate max-w-[120px]">{c.country}</span>
                <span className="font-semibold text-blue-600 ml-2">{c.count?.toLocaleString()} people</span>
              </div>
            ))}
          </div>
          {countries.length > 10 && (
            <button
              onClick={() => setShowAllCountries(!showAllCountries)}
              className="mt-2 text-xs text-violet-600 hover:text-violet-700 flex items-center gap-1"
            >
              {showAllCountries ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              {showAllCountries ? "Show less" : `Show ${Math.min(30, countries.length)} countries`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── KPI Card sub-component ──
function KPICard({
  icon, label, value, subtext, trend, trendLabel, color, invertTrend
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  subtext?: string;
  trend?: number;
  trendLabel?: string;
  color: string;
  invertTrend?: boolean;
}) {
  const isPositive = invertTrend ? (trend || 0) < 0 : (trend || 0) > 0;
  const colorMap: Record<string, string> = {
    blue: "from-blue-50 to-blue-100/50 border-blue-200 dark:from-blue-500/10 dark:to-blue-500/5 dark:border-blue-500/20",
    emerald: "from-emerald-50 to-emerald-100/50 border-emerald-200 dark:from-emerald-500/10 dark:to-emerald-500/5 dark:border-emerald-500/20",
    violet: "from-violet-50 to-violet-100/50 border-violet-200 dark:from-violet-500/10 dark:to-violet-500/5 dark:border-violet-500/20",
    amber: "from-amber-50 to-amber-100/50 border-amber-200 dark:from-amber-500/10 dark:to-amber-500/5 dark:border-amber-500/20",
    cyan: "from-cyan-50 to-cyan-100/50 border-cyan-200 dark:from-cyan-500/10 dark:to-cyan-500/5 dark:border-cyan-500/20",
    pink: "from-pink-50 to-pink-100/50 border-pink-200 dark:from-pink-500/10 dark:to-pink-500/5 dark:border-pink-500/20",
  };

  return (
    <div className={`p-3 rounded-xl border bg-gradient-to-br ${colorMap[color] || colorMap.blue}`}>
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <span className="text-xs text-muted-foreground font-medium">{label}</span>
      </div>
      <p className="text-xl font-bold">{value}</p>
      {subtext && (
        <p className="text-[10px] text-muted-foreground mt-0.5">{subtext}</p>
      )}
      {trend !== undefined && trend !== 0 && (
        <div className={`flex items-center gap-1 mt-1 text-xs ${isPositive ? "text-emerald-600" : "text-red-500"}`}>
          {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
          <span>{Math.abs(trend).toFixed(1)}% {trendLabel}</span>
        </div>
      )}
    </div>
  );
}
