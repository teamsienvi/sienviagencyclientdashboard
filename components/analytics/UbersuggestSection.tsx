import React, { useEffect, useRef, useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, TrendingUp, TrendingDown, Minus, Calendar, Key, ArrowUpRight, ArrowDownRight, RefreshCw, AlertCircle, Activity, Search, ShieldCheck, ShieldAlert, Info, History, ChevronDown, ChevronUp } from "lucide-react";
import { isDataStale, FRESHNESS_POLICIES } from "@/lib/freshnessPolicy";
import { useSyncState } from "@/hooks/useSyncState";
import { Button } from "@/components/ui/button";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from "recharts";
import { Tooltip as UITooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface UbersuggestSectionProps {
  clientId: string;
  dateRange?: "7d" | "30d" | "60d" | "custom";
  customDateRange?: { start: Date; end: Date };
  isActive?: boolean;
}

export function UbersuggestSection({ clientId, dateRange = "30d", customDateRange, isActive = true }: UbersuggestSectionProps) {
  const syncState = useSyncState(clientId, "seo", "ubersuggest");
  const [scoreHistoryExpanded, setScoreHistoryExpanded] = useState(false);

  const { data: allMetrics, isLoading, isFetching } = useQuery({
    queryKey: ["client-seo-metrics", clientId],
    queryFn: async () => {
      if (!clientId) return null;
      const { data, error } = await supabase
        .from("report_seo_metrics" as any)
        .select("*")
        .eq("client_id", clientId)
        .order("collected_at", { ascending: true });
      if (error) throw error;
      return data as any[];
    },
    enabled: !!clientId && isActive && (!syncState.isSyncing || syncState.isDegraded),
  });

  if (isLoading && (!allMetrics || (allMetrics as any[]).length === 0)) {
    return (
      <div className="flex justify-center items-center h-32 rounded-xl border bg-muted/30">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!allMetrics || allMetrics.length === 0) {
    return (
      <div className="flex flex-col justify-center items-center gap-3 py-8 rounded-xl border bg-muted/30 text-muted-foreground">
        <p className="text-sm">{syncState.isSyncing ? "Syncing SEO data..." : "No SEO metrics synced yet."}</p>
        <Button
          size="sm"
          variant="outline"
          onClick={() => syncState.retry()}
          disabled={syncState.isSyncing}
          className="gap-1.5"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${syncState.isSyncing ? "animate-spin" : ""}`} />
          {syncState.isSyncing ? "Syncing..." : "Sync SEO Data"}
        </Button>
      </div>
    );
  }

  const latest = allMetrics?.[allMetrics.length - 1];
  if (!latest) return null;

  const score = latest.site_audit_score || 0;
  const issues = typeof latest.site_audit_issues === 'string' ? JSON.parse(latest.site_audit_issues) : latest.site_audit_issues;
  const keywords = typeof latest.tracked_keywords === 'string' ? JSON.parse(latest.tracked_keywords) : (latest.tracked_keywords || []);
  const totalIssues = issues?.total || 0;
  const fromDate = issues?.from_date;
  const toDate = issues?.to_date;
  const allTrackedKeywords = issues?.all_tracked_keywords || [];
  const keywordQuota = issues?.keyword_quota || { 
    used: keywords.length, 
    limit: latest.raw_project_data?.limits?.keywords?.limit || 150 
  };

  // Compute score change from historical snapshots (not relying on issues.score_change which is often null)
  const scoreSnapshot = useMemo(() => {
    const validScoreRows = (allMetrics ?? []).filter(m => m.site_audit_score !== null && m.site_audit_score > 0);
    if (validScoreRows.length < 2) return { change: issues?.score_change ?? null, previousScore: null, snapshotDate: null };

    const currentRow = validScoreRows[validScoreRows.length - 1];
    const previousRow = validScoreRows[validScoreRows.length - 2];
    const change = currentRow.site_audit_score - previousRow.site_audit_score;
    return {
      change,
      previousScore: previousRow.site_audit_score,
      snapshotDate: new Date(previousRow.collected_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    };
  }, [allMetrics, issues]);

  // Build score history data for sparkline + timeline
  const scoreHistoryData = useMemo(() => {
    const validRows = (allMetrics ?? []).filter(m => m.site_audit_score !== null && m.site_audit_score > 0);
    // Deduplicate by date, keep last entry per day
    const byDay = new Map<string, { score: number; fullDate: string }>();
    validRows.forEach(m => {
      const dateStr = new Date(m.collected_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      byDay.set(dateStr, {
        score: m.site_audit_score,
        fullDate: new Date(m.collected_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      });
    });
    const entries = Array.from(byDay.entries()).map(([date, d]) => ({ date, score: d.score, fullDate: d.fullDate }));
    // Add change from previous snapshot
    return entries.map((entry, i) => ({
      ...entry,
      change: i === 0 ? null : entry.score - entries[i - 1].score
    }));
  }, [allMetrics]);

  const scoreChange = scoreSnapshot.change;

  const periodEnd = customDateRange?.end ?? new Date();
  const periodDays = dateRange === "7d" ? 7 : dateRange === "60d" ? 60 : 30;
  const periodStart = customDateRange?.start ?? new Date(periodEnd.getTime() - periodDays * 86400000);

  const periodMetrics = (allMetrics ?? []).filter(m => {
    const d = new Date(m.collected_at);
    return d >= periodStart && d <= periodEnd;
  });

  const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  // Formatting Data for Recharts
  const issuesTrendDataMap = new Map();
  periodMetrics
    .filter(m => m.site_audit_score !== null)
    .forEach(m => {
      const iss = typeof m.site_audit_issues === 'string' ? JSON.parse(m.site_audit_issues) : m.site_audit_issues;
      const dateStr = fmtDate(m.collected_at);
      issuesTrendDataMap.set(dateStr, {
        date: dateStr,
        issues: iss?.total || 0,
        score: m.site_audit_score
      });
    });
  const issuesTrendData = Array.from(issuesTrendDataMap.values());

  // Consolidate Keyword History for Line Chart
  const keywordHistoryDataMap = new Map();
  const trackedKeywordNames = keywords.map((k: any) => k.keyword);
  
  periodMetrics.forEach(row => {
    const kws = typeof row.tracked_keywords === 'string' ? JSON.parse(row.tracked_keywords) : (row.tracked_keywords || []);
    const dateStr = fmtDate(row.collected_at);
    
    // Start with existing data point for this day, or create a new one
    const dataPoint: any = keywordHistoryDataMap.get(dateStr) || { date: dateStr };
    let hasPositions = false;
    
    kws.forEach((kw: any) => {
      if (trackedKeywordNames.includes(kw.keyword) && kw.desktop_new !== null) {
        dataPoint[kw.keyword] = kw.desktop_new;
        hasPositions = true;
      }
    });
    
    // Only update if we actually have ranking positions
    if (hasPositions || keywordHistoryDataMap.has(dateStr)) {
      keywordHistoryDataMap.set(dateStr, dataPoint);
    }
  });
  
  const keywordHistoryData = Array.from(keywordHistoryDataMap.values());

  const scoreColor = score >= 80 ? 'text-emerald-500' : score >= 60 ? 'text-amber-500' : 'text-red-500';
  const scoreStroke = score >= 80 ? 'stroke-emerald-500' : score >= 60 ? 'stroke-amber-500' : 'stroke-red-500';
  const circumference = 2 * Math.PI * 36;
  const healthText = score >= 80 ? "Excellent" : score >= 60 ? "Needs Work" : "Critical";

  const renderCustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-background/95 border shadow-xl rounded-lg p-3 text-xs backdrop-blur-sm">
          <p className="font-semibold text-foreground mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center justify-between gap-4 mb-1">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                <span className="text-muted-foreground">{entry.name}</span>
              </div>
              <span className="font-mono font-medium">#{entry.value}</span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <TooltipProvider>
      <div className="space-y-6">

      {/* Row 1: Health, Issues & Trend */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        
        {/* Site Health Overview */}
        <div className="bg-card rounded-xl border flex flex-col overflow-hidden">
          <div className="p-5 border-b bg-muted/20 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary" />
              <h3 className="font-semibold text-sm">Site Health Overview</h3>
              <UITooltip>
                <TooltipTrigger asChild>
                  <span className="cursor-help text-muted-foreground/50 hover:text-muted-foreground transition-colors">
                    <Info className="h-3 w-3" />
                  </span>
                </TooltipTrigger>
                <TooltipContent className="max-w-[220px] text-xs p-2 normal-case font-normal">
                  Overall search optimization score of the website. A higher score means fewer technical SEO issues.
                </TooltipContent>
              </UITooltip>
            </div>
            {scoreChange !== null && scoreChange !== 0 && (
              <div className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${scoreChange > 0 ? 'bg-emerald-500/10 text-emerald-600' : 'bg-red-500/10 text-red-600'}`}>
                {scoreChange > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {scoreChange > 0 ? '+' : ''}{scoreChange} pts
              </div>
            )}
          </div>
          
          <div className="p-6 flex-1 flex flex-col justify-center items-center text-center gap-4 min-h-[220px]">
            {latest.site_audit_score === null || latest.site_audit_score === 0 ? (
               <div className="flex flex-col items-center justify-center space-y-3">
                 <ShieldAlert className="h-12 w-12 text-muted-foreground/30 animate-pulse" />
                 <div>
                   <p className="text-sm font-medium text-foreground">Awaiting Initial Crawl</p>
                   <p className="text-xs text-muted-foreground mt-1 max-w-[200px]">Ubersuggest is currently analyzing the site. The health score will appear here once the crawl completes.</p>
                 </div>
               </div>
            ) : (
              <>
                <div className="relative w-24 h-24 shrink-0 mx-auto">
                  <svg className="w-24 h-24 -rotate-90" viewBox="0 0 80 80">
                    <circle cx="40" cy="40" r="36" fill="none" strokeWidth="7" className="stroke-muted" />
                    <circle cx="40" cy="40" r="36" fill="none" strokeWidth="7"
                      className={scoreStroke} strokeLinecap="round"
                      strokeDasharray={circumference}
                      strokeDashoffset={circumference - (circumference * score) / 100}
                      style={{ transition: 'stroke-dashoffset 1s ease' }}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className={`text-3xl font-bold ${scoreColor}`}>{score}</span>
                  </div>
                </div>
    
                <div className="space-y-3 w-full">
                  <div>
                    <p className="text-sm font-medium text-foreground">Your site health is {healthText}</p>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                     <div className="bg-muted/40 rounded-lg p-2 text-center">
                      <span className="text-base font-bold text-red-500">{totalIssues}</span>
                      <p className="text-[9px] text-muted-foreground uppercase font-semibold mt-0.5">Total Issues</p>
                    </div>
                    <div className="bg-muted/40 rounded-lg p-2 text-center">
                      <span className="text-base font-bold text-amber-500">{issues?.new ?? 0}</span>
                      <p className="text-[9px] text-muted-foreground uppercase font-semibold mt-0.5">New</p>
                    </div>
                    <div className="bg-emerald-500/10 rounded-lg p-2 text-center">
                      <span className="text-base font-bold text-emerald-600">{issues?.fixed ?? 0}</span>
                      <p className="text-[9px] text-emerald-600/70 uppercase font-semibold mt-0.5">Fixed</p>
                    </div>
                  </div>
                </div>

                {/* View Score History toggle */}
                {scoreHistoryData.length >= 2 && (
                  <div className="w-full">
                    <button
                      onClick={() => setScoreHistoryExpanded(!scoreHistoryExpanded)}
                      className="w-full flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors py-1.5 border-t border-border/50"
                    >
                      <History className="h-3 w-3" />
                      {scoreHistoryExpanded ? 'Hide' : 'View'} Score History ({scoreHistoryData.length} snapshots)
                      {scoreHistoryExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    </button>

                    {scoreHistoryExpanded && (
                      <div className="pt-3 space-y-3 animate-in slide-in-from-top-2 duration-200">
                        {/* Chart with dates */}
                        <div className="w-full">
                          <ResponsiveContainer width="100%" height={80}>
                            <LineChart data={scoreHistoryData} margin={{ top: 4, right: 8, left: 8, bottom: 2 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" strokeOpacity={0.3} />
                              <XAxis
                                dataKey="date"
                                tick={{ fontSize: 9, fill: 'var(--muted-foreground)' }}
                                tickLine={false}
                                axisLine={false}
                                interval={Math.max(0, Math.floor(scoreHistoryData.length / 5) - 1)}
                              />
                              <YAxis
                                tick={{ fontSize: 9, fill: 'var(--muted-foreground)' }}
                                tickLine={false}
                                axisLine={false}
                                domain={['dataMin - 5', 'dataMax + 5']}
                                width={25}
                              />
                              <Line
                                type="monotone"
                                dataKey="score"
                                stroke={score >= 80 ? '#10b981' : score >= 60 ? '#f59e0b' : '#ef4444'}
                                strokeWidth={2}
                                dot={{ r: 3, fill: 'var(--card)', stroke: score >= 80 ? '#10b981' : score >= 60 ? '#f59e0b' : '#ef4444', strokeWidth: 2 }}
                                activeDot={{ r: 5 }}
                              />
                              <Tooltip
                                contentStyle={{ borderRadius: '8px', border: '1px solid var(--border)', fontSize: '11px', padding: '6px 10px', background: 'var(--card)' }}
                                labelStyle={{ fontWeight: 600, marginBottom: 2 }}
                                formatter={(value: number) => [`${value}`, 'Score']}
                              />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>

                        {/* Timeline table */}
                        <div className="max-h-[140px] overflow-y-auto space-y-0 scrollbar-thin">
                          {[...scoreHistoryData].reverse().map((entry, i) => (
                            <div key={entry.date} className={`flex items-center gap-3 py-1.5 px-2 ${i % 2 === 0 ? 'bg-muted/20' : ''} rounded`}>
                              {/* Date */}
                              <span className="text-[11px] text-muted-foreground font-mono w-[100px] shrink-0">
                                {entry.fullDate}
                              </span>
                              {/* Score */}
                              <span className={`text-[13px] font-bold font-mono w-[32px] text-right ${
                                entry.score >= 80 ? 'text-emerald-500' : entry.score >= 60 ? 'text-amber-500' : 'text-red-500'
                              }`}>
                                {entry.score}
                              </span>
                              {/* Change badge */}
                              <div className="flex-1">
                                {entry.change === null ? (
                                  <span className="text-[9px] text-muted-foreground/50 italic">First snapshot</span>
                                ) : entry.change === 0 ? (
                                  <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground/60 px-1.5 py-0.5 rounded bg-muted/30">
                                    <Minus className="h-2.5 w-2.5" /> No change
                                  </span>
                                ) : (
                                  <span className={`inline-flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded ${
                                    entry.change > 0 ? 'bg-emerald-500/10 text-emerald-600' : 'bg-red-500/10 text-red-500'
                                  }`}>
                                    {entry.change > 0 ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
                                    {entry.change > 0 ? '+' : ''}{entry.change}
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Top Issues List */}
        <div className="bg-card rounded-xl border flex flex-col overflow-hidden">
          <div className="p-5 border-b bg-muted/20 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-primary" />
              <h3 className="font-semibold text-sm">Top SEO Issues</h3>
              <UITooltip>
                <TooltipTrigger asChild>
                  <span className="cursor-help text-muted-foreground/50 hover:text-muted-foreground transition-colors">
                    <Info className="h-3 w-3" />
                  </span>
                </TooltipTrigger>
                <TooltipContent className="max-w-[220px] text-xs p-2 normal-case font-normal">
                  Technical and content issues identified on the website that are affecting its SEO performance.
                </TooltipContent>
              </UITooltip>
            </div>
            {totalIssues > 0 && (
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{totalIssues} Total</span>
            )}
          </div>
          <div className="p-5 flex-1 overflow-y-auto max-h-[250px]">
            {latest.site_audit_score === null || latest.site_audit_score === 0 ? (
               <div className="h-full flex flex-col items-center justify-center text-center text-xs text-muted-foreground px-4 py-8">
                 <Search className="h-6 w-6 text-muted-foreground/30 mb-2" />
                 <p>Pending site crawl. Issues will be listed here once discovered.</p>
               </div>
            ) : issues?.highest_impact && issues.highest_impact.length > 0 ? (
              <div className="space-y-3">
                {issues.highest_impact.map((issue: any, i: number) => (
                  <div key={i} className="flex justify-between items-center bg-muted/30 p-2.5 rounded-lg border border-border/50">
                    <div className="flex items-center gap-2.5 min-w-0 pr-2">
                      <div className={`w-2 h-2 rounded-full shrink-0 ${issue.difficulty === 'easy' ? 'bg-emerald-500' : 'bg-amber-500'}`} title={`Difficulty: ${issue.difficulty}`} />
                      <span className="text-xs font-medium text-foreground truncate capitalize" title={issue.id.replace(/_/g, ' ')}>
                        {issue.id.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <span className="text-xs font-mono font-semibold bg-background px-2 py-0.5 rounded-md border shrink-0">{issue.count}</span>
                  </div>
                ))}
              </div>
            ) : totalIssues > 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center text-xs text-muted-foreground px-4 py-8">
                 <Search className="h-6 w-6 text-muted-foreground/30 mb-2" />
                 <p>Issue details will populate on the next full site audit.</p>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center text-xs text-muted-foreground px-4 py-8">
                 <ShieldCheck className="h-6 w-6 text-emerald-500/50 mb-2" />
                 <p>No critical issues found! Your site is fully optimized.</p>
              </div>
            )}
          </div>
        </div>

        {/* Issues History Chart */}
        <div className="bg-card rounded-xl border flex flex-col overflow-hidden">
           <div className="p-5 border-b bg-muted/20 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              <h3 className="font-semibold text-sm">Issues Over Time</h3>
              <UITooltip>
                <TooltipTrigger asChild>
                  <span className="cursor-help text-muted-foreground/50 hover:text-muted-foreground transition-colors">
                    <Info className="h-3 w-3" />
                  </span>
                </TooltipTrigger>
                <TooltipContent className="max-w-[220px] text-xs p-2 normal-case font-normal">
                  A historical chart tracking the number of SEO issues identified during recent site audits.
                </TooltipContent>
              </UITooltip>
            </div>
          </div>
          <div className="flex-1 p-5 min-h-[200px]">
             {issuesTrendData.length > 1 ? (
               <ResponsiveContainer width="100%" height="100%">
                <BarChart data={issuesTrendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="text-muted/30" />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10 }} className="text-muted-foreground" />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10 }} className="text-muted-foreground" />
                  <Tooltip 
                    cursor={{ fill: 'currentColor', opacity: 0.05 }} 
                    contentStyle={{ borderRadius: '8px', border: '1px solid var(--border)', fontSize: '12px' }}
                  />
                  <Bar dataKey="issues" fill="currentColor" className="text-primary/60" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
             ) : (
               <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                 Not enough historical data to show trend.
               </div>
             )}
          </div>
        </div>

      </div>

      {/* Row 1.5: Extra Metrics */}
      {latest.raw_project_data?.domain_overview && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-card rounded-xl border p-4 flex flex-col justify-center items-center text-center">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Organic Traffic</span>
              <UITooltip>
                <TooltipTrigger asChild>
                  <span className="cursor-help text-muted-foreground/50 hover:text-muted-foreground transition-colors">
                    <Info className="h-3 w-3" />
                  </span>
                </TooltipTrigger>
                <TooltipContent className="max-w-[220px] text-xs p-2">
                  Estimated monthly organic search traffic the domain receives from Google search.
                </TooltipContent>
              </UITooltip>
            </div>
            <span className="text-xl font-bold text-foreground">
              {(latest.raw_project_data.domain_overview.traffic ?? 
                latest.raw_project_data.domain_overview.Total_Organic_Traffic ?? 0).toLocaleString()}
            </span>
            <span className="text-[9px] text-muted-foreground/70 mt-1">Est. monthly visits</span>
          </div>
          <div className="bg-card rounded-xl border p-4 flex flex-col justify-center items-center text-center">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Backlinks</span>
              <UITooltip>
                <TooltipTrigger asChild>
                  <span className="cursor-help text-muted-foreground/50 hover:text-muted-foreground transition-colors">
                    <Info className="h-3 w-3" />
                  </span>
                </TooltipTrigger>
                <TooltipContent className="max-w-[220px] text-xs p-2">
                  Total number of external links pointing to this website from other pages on the internet.
                </TooltipContent>
              </UITooltip>
            </div>
            <span className="text-xl font-bold text-primary">
              {(latest.raw_project_data.domain_overview.backlinks ?? 
                latest.raw_project_data.domain_overview.Total_Backlinks ?? 0).toLocaleString()}
            </span>
            <span className="text-[9px] text-muted-foreground/70 mt-1">Total inbound links</span>
          </div>
          <div className="bg-card rounded-xl border p-4 flex flex-col justify-center items-center text-center">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Referring Domains</span>
              <UITooltip>
                <TooltipTrigger asChild>
                  <span className="cursor-help text-muted-foreground/50 hover:text-muted-foreground transition-colors">
                    <Info className="h-3 w-3" />
                  </span>
                </TooltipTrigger>
                <TooltipContent className="max-w-[220px] text-xs p-2">
                  Number of unique websites that link to this site. Multiple links from the same domain count as one referring domain.
                </TooltipContent>
              </UITooltip>
            </div>
            <span className="text-xl font-bold text-primary/80">
              {(latest.raw_project_data.domain_overview.refDomains ?? 
                latest.raw_project_data.domain_overview.Total_RefDomains ?? 0).toLocaleString()}
            </span>
            <span className="text-[9px] text-muted-foreground/70 mt-1">Unique linking sites</span>
          </div>
          <div className="bg-card rounded-xl border p-4 flex flex-col justify-center items-center text-center">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Organic Keywords</span>
              <UITooltip>
                <TooltipTrigger asChild>
                  <span className="cursor-help text-muted-foreground/50 hover:text-muted-foreground transition-colors">
                    <Info className="h-3 w-3" />
                  </span>
                </TooltipTrigger>
                <TooltipContent className="max-w-[220px] text-xs p-2">
                  Total number of keywords this domain ranks for in Google's top 100 search results.
                </TooltipContent>
              </UITooltip>
            </div>
            <span className="text-xl font-bold text-amber-500">
              {(latest.raw_project_data.domain_overview.organic ?? 
                latest.raw_project_data.domain_overview.Organic_Keywords?.length ?? 0).toLocaleString()}
            </span>
            <span className="text-[9px] text-muted-foreground/70 mt-1">Ranking keywords</span>
          </div>
        </div>
      )}

      {/* Row 2: Keyword Performance */}
      <div className="bg-card rounded-xl border overflow-hidden">
        <div className="p-5 border-b bg-muted/20 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-primary" />
            <h3 className="font-semibold text-sm">Keyword Rankings Tracker</h3>
          </div>
           {keywordQuota && (
            <span className="text-[11px] text-muted-foreground bg-background border px-2 py-1 rounded-md shadow-sm">
              <span className="text-foreground font-semibold">{keywordQuota.used}</span> / {keywordQuota.limit} Tracked
            </span>
          )}
        </div>

        {keywords.length === 0 ? (
          <div className="p-12 flex flex-col items-center justify-center text-center">
            <Search className="h-8 w-8 text-muted-foreground/30 mb-3" />
            <h4 className="text-base font-semibold text-foreground mb-1">No Keyword Tracking Data</h4>
            <p className="text-sm text-muted-foreground max-w-md">
              We couldn't find any tracked keywords for this site. Add keywords to the project in Ubersuggest to see ranking alerts and position history here.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-muted/10 text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-5 py-3 font-semibold rounded-tl-xl">
                        <div className="flex items-center gap-1.5">
                          <span>Keyword</span>
                          <UITooltip>
                            <TooltipTrigger asChild>
                              <span className="cursor-help text-muted-foreground/50 hover:text-muted-foreground transition-colors">
                                <Info className="h-3 w-3" />
                              </span>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-[200px] text-xs p-2 normal-case font-normal">
                              The target search term being tracked for search rankings.
                            </TooltipContent>
                          </UITooltip>
                        </div>
                      </th>
                      <th className="px-5 py-3 font-semibold">
                        <div className="flex items-center gap-1.5">
                          <span>Volume</span>
                          <UITooltip>
                            <TooltipTrigger asChild>
                              <span className="cursor-help text-muted-foreground/50 hover:text-muted-foreground transition-colors">
                                <Info className="h-3 w-3" />
                              </span>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-[200px] text-xs p-2 normal-case font-normal">
                              The average number of monthly searches for this keyword in Google.
                            </TooltipContent>
                          </UITooltip>
                        </div>
                      </th>
                      <th className="px-5 py-3 font-semibold text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <span>Current Rank</span>
                          <UITooltip>
                            <TooltipTrigger asChild>
                              <span className="cursor-help text-muted-foreground/50 hover:text-muted-foreground transition-colors">
                                <Info className="h-3 w-3" />
                              </span>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-[200px] text-xs p-2 normal-case font-normal">
                              The website's current ranking position in Google search results.
                            </TooltipContent>
                          </UITooltip>
                        </div>
                      </th>
                      <th className="px-5 py-3 font-semibold text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <span>Change</span>
                          <UITooltip>
                            <TooltipTrigger asChild>
                              <span className="cursor-help text-muted-foreground/50 hover:text-muted-foreground transition-colors">
                                <Info className="h-3 w-3" />
                              </span>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-[200px] text-xs p-2 normal-case font-normal">
                              The change in ranking position compared to the previous week.
                            </TooltipContent>
                          </UITooltip>
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {keywords.map((kw: any, idx: number) => {
                      const improved = kw.desktop_change > 0 || (!kw.desktop_old && kw.desktop_new);
                      const dropped = kw.desktop_change < 0 || (kw.desktop_old && !kw.desktop_new);
                      const isPending = kw.desktop_new === null && kw.desktop_old === null && kw.volume === null;
                      
                      return (
                        <tr key={idx} className="hover:bg-muted/30 transition-colors">
                          <td className="px-5 py-4 font-medium text-foreground max-w-[200px] truncate" title={kw.keyword}>
                            {kw.keyword}
                          </td>
                          <td className="px-5 py-4 text-muted-foreground">
                            {kw.volume?.toLocaleString() ?? '—'}
                          </td>
                          <td className="px-5 py-4 text-right">
                            {isPending ? (
                              <span className="text-muted-foreground italic">Pending</span>
                            ) : (
                              <span className="font-mono font-bold text-foreground">
                                {kw.desktop_new ? `#${kw.desktop_new}` : 'Out'}
                              </span>
                            )}
                          </td>
                          <td className="px-5 py-4 text-right">
                            {isPending ? (
                              <span className="inline-block bg-muted text-muted-foreground text-[10px] px-2 py-1 rounded-full whitespace-nowrap">
                                Awaiting Crawl
                              </span>
                            ) : improved ? (
                              <span className="inline-flex items-center gap-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs px-2 py-1 rounded-full font-medium">
                                <TrendingUp className="h-3 w-3" />
                                {kw.desktop_change || 'New'}
                              </span>
                            ) : dropped ? (
                              <span className="inline-flex items-center gap-1 bg-red-500/10 text-red-600 dark:text-red-400 text-xs px-2 py-1 rounded-full font-medium">
                                <TrendingDown className="h-3 w-3" />
                                {Math.abs(kw.desktop_change) || 'Lost'}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-muted-foreground text-xs px-2 py-1 rounded-full font-medium">
                                <Minus className="h-3 w-3" />
                                0
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
        )}
      </div>

      <div className="flex items-center justify-between pt-2">
        <div className="text-[10px] text-muted-foreground/60 flex items-center gap-1.5">
          {syncState.isSyncing || isFetching ? (
            <span className="flex items-center gap-1.5 bg-primary/5 px-2 py-0.5 rounded-full text-primary/80 font-medium animate-pulse">
              <RefreshCw className="h-2.5 w-2.5 animate-spin" /> 
              {syncState.isSyncing ? "Syncing live data..." : "Checking for SEO updates..."}
            </span>
          ) : (
            <span className="bg-muted/50 px-2 py-0.5 rounded-full font-medium">
              Data as of {new Date(latest.collected_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 text-[10px] px-2 gap-1"
          onClick={() => syncState.retry()}
          disabled={syncState.isSyncing}
        >
          <RefreshCw className={`h-3 w-3 ${syncState.isSyncing ? 'animate-spin' : ''}`} />
          Sync Now
        </Button>
      </div>

      {syncState.isDegraded && (
        <div className="flex items-center gap-2 text-xs text-amber-500 mt-1">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          <span>Last known good data (Sync currently unavailable)</span>
        </div>
      )}
      </div>
    </TooltipProvider>
  );
}
