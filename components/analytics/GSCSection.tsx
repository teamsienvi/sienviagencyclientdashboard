import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Search, TrendingUp, TrendingDown, MousePointerClick, Eye, Target, Globe,
  Smartphone, Monitor, Tablet, ChevronDown, ChevronUp, ExternalLink, Info
} from "lucide-react";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, PieChart, Pie, Cell
} from "recharts";
import { Tooltip as UITooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface GSCSectionProps {
  clientId: string;
  isActive?: boolean;
}

const COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16"];
const DEVICE_ICONS: Record<string, React.ReactNode> = {
  Mobile: <Smartphone className="h-4 w-4" />,
  Desktop: <Monitor className="h-4 w-4" />,
  Tablet: <Tablet className="h-4 w-4" />,
};

export function GSCSection({ clientId, isActive = true }: GSCSectionProps) {
  const [showAllQueries, setShowAllQueries] = useState(false);
  const [showAllPages, setShowAllPages] = useState(false);
  const [showAllCountries, setShowAllCountries] = useState(false);
  const [dateFilter, setDateFilter] = useState<"7d" | "14d" | "30d" | "90d" | "all">("all");

  const { data: gscData, isLoading } = useQuery({
    queryKey: ["client-gsc-metrics", clientId],
    queryFn: async () => {
      if (!clientId) return null;
      const { data, error } = await supabase
        .from("report_gsc_metrics" as any)
        .select("*")
        .eq("client_id", clientId)
        .order("collected_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
    enabled: !!clientId && isActive,
  });

  const metrics = gscData;

  // Date filtering logic
  const filterDays: Record<string, number> = { "7d": 7, "14d": 14, "30d": 30, "90d": 90, "all": 9999 };

  const allDailyBreakdown = useMemo(() => (metrics?.daily_breakdown || []) as any[], [metrics]);
  
  const filteredDaily = useMemo(() => {
    if (dateFilter === "all" || allDailyBreakdown.length === 0) return allDailyBreakdown;
    const days = filterDays[dateFilter];
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffStr = cutoff.toISOString().slice(0, 10);
    return allDailyBreakdown.filter((d: any) => d.date >= cutoffStr);
  }, [allDailyBreakdown, dateFilter]);

  // Recalculate KPIs from filtered daily data
  const filteredTotalClicks = filteredDaily.reduce((s: number, d: any) => s + d.clicks, 0);
  const filteredTotalImpressions = filteredDaily.reduce((s: number, d: any) => s + d.impressions, 0);
  const filteredAvgCtr = filteredTotalImpressions > 0 ? (filteredTotalClicks / filteredTotalImpressions) * 100 : 0;
  const filteredAvgPosition = filteredDaily.length > 0
    ? filteredDaily.reduce((s: number, d: any) => s + d.position, 0) / filteredDaily.length
    : 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500" />
      </div>
    );
  }

  if (!metrics) return null;

  const topQueries = (metrics.top_queries || []) as any[];
  const topPages = (metrics.top_pages || []) as any[];
  const deviceBreakdown = (metrics.device_breakdown || []) as any[];
  const countryBreakdown = (metrics.country_breakdown || []) as any[];
  const searchAppearance = (metrics.search_appearance || []) as any[];

  const visibleQueries = showAllQueries ? topQueries.slice(0, 50) : topQueries.slice(0, 10);
  const visiblePages = showAllPages ? topPages.slice(0, 30) : topPages.slice(0, 10);
  const visibleCountries = showAllCountries ? countryBreakdown.slice(0, 30) : countryBreakdown.slice(0, 10);

  // Format daily data for charts (use filtered data)
  const chartData = filteredDaily.map((d: any) => ({
    date: d.date,
    label: new Date(d.date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    clicks: d.clicks,
    impressions: d.impressions,
  }));

  // Last 7 days vs previous 7 days for trend (from filtered set)
  const last7 = filteredDaily.slice(-7);
  const prev7 = filteredDaily.slice(-14, -7);
  const last7Clicks = last7.reduce((s: number, d: any) => s + d.clicks, 0);
  const prev7Clicks = prev7.reduce((s: number, d: any) => s + d.clicks, 0);
  const clicksTrend = prev7Clicks > 0 ? ((last7Clicks - prev7Clicks) / prev7Clicks) * 100 : 0;
  const last7Impressions = last7.reduce((s: number, d: any) => s + d.impressions, 0);
  const prev7Impressions = prev7.reduce((s: number, d: any) => s + d.impressions, 0);
  const impressionsTrend = prev7Impressions > 0 ? ((last7Impressions - prev7Impressions) / prev7Impressions) * 100 : 0;

  const totalDeviceClicks = deviceBreakdown.reduce((s: number, d: any) => s + d.clicks, 0);

  const formatUrl = (url: string) => {
    try {
      const u = new URL(url);
      return u.pathname === "/" ? "/" : u.pathname;
    } catch { return url; }
  };

  const dateFilterOptions = [
    { value: "7d", label: "7 Days" },
    { value: "14d", label: "14 Days" },
    { value: "30d", label: "30 Days" },
    { value: "90d", label: "90 Days" },
    { value: "all", label: "All Time" },
  ] as const;

  return (
    <div className="space-y-6">
      {/* Source badge + Date filter */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300">
            Google Search Console
          </span>
          <span className="text-xs text-muted-foreground">
            {metrics.date_range_start} → {metrics.date_range_end}
          </span>
          {metrics.source === "csv_import" && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400">
              CSV Import
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-0.5">
          {dateFilterOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setDateFilter(opt.value)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                dateFilter === opt.value
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Filtered range indicator */}
      {dateFilter !== "all" && (
        <p className="text-xs text-muted-foreground -mt-3">
          Showing <span className="font-semibold text-foreground">{filteredDaily.length}</span> days of data
          {filteredDaily.length > 0 && ` (${filteredDaily[0]?.date} → ${filteredDaily[filteredDaily.length - 1]?.date})`}
        </p>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPICard
          icon={<MousePointerClick className="h-4 w-4 text-emerald-600" />}
          label="Total Clicks"
          value={filteredTotalClicks.toLocaleString()}
          trend={clicksTrend}
          trendLabel="vs prev 7d"
          color="emerald"
        />
        <KPICard
          icon={<Eye className="h-4 w-4 text-blue-600" />}
          label="Impressions"
          value={filteredTotalImpressions.toLocaleString()}
          trend={impressionsTrend}
          trendLabel="vs prev 7d"
          color="blue"
        />
        <KPICard
          icon={<Target className="h-4 w-4 text-violet-600" />}
          label="Avg CTR"
          value={`${filteredAvgCtr.toFixed(2)}%`}
          color="violet"
        />
        <KPICard
          icon={<TrendingUp className="h-4 w-4 text-amber-600" />}
          label="Avg Position"
          value={filteredAvgPosition.toFixed(1)}
          color="amber"
          invertTrend
        />
      </div>

      {/* Daily Chart */}
      <div className="bg-white dark:bg-zinc-900/50 rounded-xl border p-4">
        <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <Search className="h-4 w-4 text-emerald-500" />
          Search Performance (Daily)
        </h4>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.4} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10 }}
              interval={Math.floor(chartData.length / 8)}
            />
            <YAxis yAxisId="left" tick={{ fontSize: 10 }} />
            <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} />
            <Tooltip
              contentStyle={{ fontSize: 12, borderRadius: 8 }}
              formatter={(value: number, name: string) => [value.toLocaleString(), name]}
            />
            <Line yAxisId="left" type="monotone" dataKey="clicks" stroke="#10b981" strokeWidth={2} dot={false} name="Clicks" />
            <Line yAxisId="right" type="monotone" dataKey="impressions" stroke="#3b82f6" strokeWidth={1.5} dot={false} name="Impressions" opacity={0.6} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Top Queries Table */}
      <div className="bg-white dark:bg-zinc-900/50 rounded-xl border p-4">
        <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <Search className="h-4 w-4 text-emerald-500" />
          Top Search Queries
          <span className="text-xs text-muted-foreground font-normal">({topQueries.length} total)</span>
        </h4>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="pb-2 pr-4">Query</th>
                <th className="pb-2 pr-3 text-right">Clicks</th>
                <th className="pb-2 pr-3 text-right">Impressions</th>
                <th className="pb-2 pr-3 text-right">CTR</th>
                <th className="pb-2 text-right">Position</th>
              </tr>
            </thead>
            <tbody>
              {visibleQueries.map((q: any, i: number) => (
                <tr key={i} className="border-b border-dashed border-muted/40 hover:bg-muted/30 transition-colors">
                  <td className="py-2 pr-4 font-medium max-w-[250px] truncate">{q.query}</td>
                  <td className="py-2 pr-3 text-right font-semibold text-emerald-600">{q.clicks?.toLocaleString()}</td>
                  <td className="py-2 pr-3 text-right text-muted-foreground">{q.impressions?.toLocaleString()}</td>
                  <td className="py-2 pr-3 text-right">{q.ctr?.toFixed(1)}%</td>
                  <td className="py-2 text-right">
                    <span className={`inline-flex px-1.5 py-0.5 rounded text-xs font-medium ${
                      q.position <= 3 ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300" :
                      q.position <= 10 ? "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300" :
                      "bg-zinc-100 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300"
                    }`}>
                      {q.position?.toFixed(1)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {topQueries.length > 10 && (
          <button
            onClick={() => setShowAllQueries(!showAllQueries)}
            className="mt-3 text-xs text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
          >
            {showAllQueries ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            {showAllQueries ? "Show less" : `Show top 50 of ${topQueries.length}`}
          </button>
        )}
      </div>

      {/* Two columns: Devices + Countries */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Device Breakdown */}
        <div className="bg-white dark:bg-zinc-900/50 rounded-xl border p-4">
          <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Monitor className="h-4 w-4 text-blue-500" />
            Device Breakdown
          </h4>
          <div className="space-y-3">
            {deviceBreakdown.map((d: any, i: number) => {
              const pct = totalDeviceClicks > 0 ? (d.clicks / totalDeviceClicks) * 100 : 0;
              return (
                <div key={i} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      {DEVICE_ICONS[d.device] || <Globe className="h-4 w-4" />}
                      {d.device}
                    </span>
                    <span className="font-semibold">{d.clicks?.toLocaleString()} <span className="text-xs text-muted-foreground font-normal">({pct.toFixed(1)}%)</span></span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${pct}%`,
                        backgroundColor: COLORS[i % COLORS.length]
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Top Countries */}
        <div className="bg-white dark:bg-zinc-900/50 rounded-xl border p-4">
          <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Globe className="h-4 w-4 text-violet-500" />
            Top Countries
          </h4>
          <div className="space-y-2">
            {visibleCountries.map((c: any, i: number) => (
              <div key={i} className="flex items-center justify-between text-sm py-1 border-b border-dashed border-muted/30 last:border-0">
                <span className="truncate max-w-[150px]">{c.country}</span>
                <div className="flex items-center gap-3">
                  <span className="text-emerald-600 font-semibold">{c.clicks?.toLocaleString()}</span>
                  <span className="text-xs text-muted-foreground w-16 text-right">{c.impressions?.toLocaleString()} imp</span>
                </div>
              </div>
            ))}
          </div>
          {countryBreakdown.length > 10 && (
            <button
              onClick={() => setShowAllCountries(!showAllCountries)}
              className="mt-2 text-xs text-violet-600 hover:text-violet-700 flex items-center gap-1"
            >
              {showAllCountries ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              {showAllCountries ? "Show less" : `Show ${Math.min(30, countryBreakdown.length)} countries`}
            </button>
          )}
        </div>
      </div>

      {/* Top Pages */}
      <div className="bg-white dark:bg-zinc-900/50 rounded-xl border p-4">
        <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <ExternalLink className="h-4 w-4 text-blue-500" />
          Top Pages
          <span className="text-xs text-muted-foreground font-normal">({topPages.length} total)</span>
        </h4>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="pb-2 pr-4">Page</th>
                <th className="pb-2 pr-3 text-right">Clicks</th>
                <th className="pb-2 pr-3 text-right">Impressions</th>
                <th className="pb-2 pr-3 text-right">CTR</th>
                <th className="pb-2 text-right">Position</th>
              </tr>
            </thead>
            <tbody>
              {visiblePages.map((p: any, i: number) => (
                <tr key={i} className="border-b border-dashed border-muted/40 hover:bg-muted/30 transition-colors">
                  <td className="py-2 pr-4 max-w-[300px] truncate">
                    <TooltipProvider>
                      <UITooltip>
                        <TooltipTrigger className="text-left">
                          <span className="text-blue-600 dark:text-blue-400 font-medium">{formatUrl(p.page)}</span>
                        </TooltipTrigger>
                        <TooltipContent><p className="text-xs max-w-md break-all">{p.page}</p></TooltipContent>
                      </UITooltip>
                    </TooltipProvider>
                  </td>
                  <td className="py-2 pr-3 text-right font-semibold text-emerald-600">{p.clicks?.toLocaleString()}</td>
                  <td className="py-2 pr-3 text-right text-muted-foreground">{p.impressions?.toLocaleString()}</td>
                  <td className="py-2 pr-3 text-right">{p.ctr?.toFixed(1)}%</td>
                  <td className="py-2 text-right">
                    <span className={`inline-flex px-1.5 py-0.5 rounded text-xs font-medium ${
                      p.position <= 3 ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300" :
                      p.position <= 10 ? "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300" :
                      "bg-zinc-100 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300"
                    }`}>
                      {p.position?.toFixed(1)}
                    </span>
                  </td>
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
            {showAllPages ? "Show less" : `Show top 30 of ${topPages.length}`}
          </button>
        )}
      </div>

      {/* Search Appearance */}
      {searchAppearance.length > 0 && (
        <div className="bg-white dark:bg-zinc-900/50 rounded-xl border p-4">
          <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Info className="h-4 w-4 text-cyan-500" />
            Search Appearance
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {searchAppearance.map((s: any, i: number) => (
              <div key={i} className="p-3 rounded-lg bg-muted/40 border">
                <p className="text-xs text-muted-foreground truncate">{s.type}</p>
                <p className="text-lg font-bold mt-1">{s.clicks?.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">{s.impressions?.toLocaleString()} imp</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── KPI Card sub-component ──
function KPICard({
  icon, label, value, trend, trendLabel, color, invertTrend
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  trend?: number;
  trendLabel?: string;
  color: string;
  invertTrend?: boolean;
}) {
  const isPositive = invertTrend ? (trend || 0) < 0 : (trend || 0) > 0;
  const colorMap: Record<string, string> = {
    emerald: "from-emerald-50 to-emerald-100/50 border-emerald-200 dark:from-emerald-500/10 dark:to-emerald-500/5 dark:border-emerald-500/20",
    blue: "from-blue-50 to-blue-100/50 border-blue-200 dark:from-blue-500/10 dark:to-blue-500/5 dark:border-blue-500/20",
    violet: "from-violet-50 to-violet-100/50 border-violet-200 dark:from-violet-500/10 dark:to-violet-500/5 dark:border-violet-500/20",
    amber: "from-amber-50 to-amber-100/50 border-amber-200 dark:from-amber-500/10 dark:to-amber-500/5 dark:border-amber-500/20",
  };

  return (
    <div className={`p-3 rounded-xl border bg-gradient-to-br ${colorMap[color] || colorMap.emerald}`}>
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <p className="text-xl font-bold">{value}</p>
      {trend !== undefined && trend !== 0 && (
        <div className={`flex items-center gap-1 mt-1 text-xs ${isPositive ? "text-emerald-600" : "text-red-500"}`}>
          {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
          <span>{Math.abs(trend).toFixed(1)}% {trendLabel}</span>
        </div>
      )}
    </div>
  );
}
