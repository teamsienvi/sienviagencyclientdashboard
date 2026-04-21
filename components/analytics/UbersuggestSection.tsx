import React, { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, TrendingUp, TrendingDown, Minus, Calendar, Key, ArrowUpRight, ArrowDownRight, RefreshCw, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface UbersuggestSectionProps {
  clientId: string;
  dateRange?: "7d" | "30d" | "60d" | "custom";
  customDateRange?: { start: Date; end: Date };
}

import { isDataStale } from "@/lib/freshnessPolicy";

export function UbersuggestSection({ clientId, dateRange = "30d", customDateRange }: UbersuggestSectionProps) {
  const queryClient = useQueryClient();
  const autoSyncAttemptedRef = useRef<string | null>(null);

  const { data: allMetrics, isLoading } = useQuery({
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
    enabled: !!clientId,
  });

  // Sync mutation — calls the sync-ubersuggest edge function
  const [syncError, setSyncError] = useState<string | null>(null);
  const syncMutation = useMutation({
    mutationFn: async () => {
      setSyncError(null);
      const { data, error } = await supabase.functions.invoke("sync-ubersuggest", {
        body: { clientId },
      });
      if (error) {
        // Extract the real error from the edge function response body
        let errMsg = error.message;
        try {
          const body = await (error as any).context?.json?.();
          if (body?.error) errMsg = body.error;
        } catch (_) {}
        throw new Error(errMsg);
      }
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client-seo-metrics", clientId] });
    },
    onError: (err: Error) => {
      console.warn("SEO sync failed:", err.message);
      setSyncError(err.message);
    },
  });

  // Auto-sync: trigger when data is stale (>24h) or missing
  useEffect(() => {
    if (isLoading || syncMutation.isPending) return;

    const latestEntry = allMetrics && allMetrics.length > 0
      ? allMetrics[allMetrics.length - 1]
      : null;

    const isStale = !latestEntry || isDataStale(latestEntry.collected_at, 'seo');

    if (isStale && autoSyncAttemptedRef.current !== clientId) {
      autoSyncAttemptedRef.current = clientId;
      console.log(`SEO data stale for ${clientId}, auto-syncing...`);
      syncMutation.mutate();
    }
  }, [clientId, allMetrics, isLoading, syncMutation.isPending]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-32 rounded-xl border bg-muted/30">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!allMetrics || allMetrics.length === 0) {
    return (
      <div className="flex flex-col justify-center items-center gap-3 py-8 rounded-xl border bg-muted/30 text-muted-foreground">
        <p className="text-sm">{syncMutation.isPending ? "Syncing SEO data..." : "No SEO metrics synced yet."}</p>
        {syncError && (
          <div className="flex items-center gap-2 text-xs text-red-500 max-w-xs text-center">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            <span>{syncError}</span>
          </div>
        )}
        <Button
          size="sm"
          variant="outline"
          onClick={() => syncMutation.mutate()}
          disabled={syncMutation.isPending}
          className="gap-1.5"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${syncMutation.isPending ? "animate-spin" : ""}`} />
          {syncMutation.isPending ? "Syncing..." : "Sync SEO Data"}
        </Button>
      </div>
    );
  }

  const latest = allMetrics?.[allMetrics.length - 1];
  if (!latest) {
    return (
      <div className="flex flex-col justify-center items-center h-32 rounded-xl border bg-muted/30 text-muted-foreground">
        <p className="text-sm">No SEO metrics synced yet.</p>
      </div>
    );
  }

  const score = latest.site_audit_score || 0;
  const issues = typeof latest.site_audit_issues === 'string' ? JSON.parse(latest.site_audit_issues) : latest.site_audit_issues;
  const keywords = typeof latest.tracked_keywords === 'string' ? JSON.parse(latest.tracked_keywords) : (latest.tracked_keywords || []);
  const totalIssues = issues?.total || 0;
  const scoreChange = issues?.score_change ?? null;
  const fromDate = issues?.from_date;
  const toDate = issues?.to_date;
  const kwReportType = issues?.keyword_report_type;
  const allTrackedKeywords = issues?.all_tracked_keywords || [];
  const keywordQuota = issues?.keyword_quota || { used: 0, limit: 150 };

  // Derive start/end of the reporting period
  const periodEnd = customDateRange?.end ?? new Date();
  const periodDays = dateRange === "7d" ? 7 : dateRange === "60d" ? 60 : 30;
  const periodStart = customDateRange?.start ?? new Date(periodEnd.getTime() - periodDays * 86400000);

  // Filter metrics to the selected reporting period for charts/history
  const periodMetrics = (allMetrics ?? []).filter(m => {
    const d = new Date(m.collected_at);
    return d >= periodStart && d <= periodEnd;
  });

  const issuesTrend = periodMetrics
    .filter(m => m.site_audit_score !== null)
    .map(m => {
      const iss = typeof m.site_audit_issues === 'string' ? JSON.parse(m.site_audit_issues) : m.site_audit_issues;
      return { total: iss?.total || 0, date: m.collected_at };
    });

  const keywordHistory: Record<string, { date: string; position: number | null }[]> = {};
  for (const row of periodMetrics) {
    const kws = typeof row.tracked_keywords === 'string' ? JSON.parse(row.tracked_keywords) : (row.tracked_keywords || []);
    for (const kw of kws) {
      if (!keywordHistory[kw.keyword]) keywordHistory[kw.keyword] = [];
      keywordHistory[kw.keyword].push({ date: row.collected_at, position: kw.desktop_new });
    }
  }

  const fmt = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const scoreColor = score >= 80 ? 'text-emerald-500' : score >= 60 ? 'text-amber-500' : 'text-red-500';
  const scoreStroke = score >= 80 ? 'stroke-emerald-500' : score >= 60 ? 'stroke-amber-500' : 'stroke-red-500';
  const circumference = 2 * Math.PI * 36;

  return (
    <div className="space-y-4">

      {/* Row 1: Score + Stats + Trend */}
      <div className="grid grid-cols-12 gap-3">

        {/* Score Circle */}
        <div
          className="col-span-12 sm:col-span-3 lg:col-span-2 bg-card rounded-xl border p-4 flex flex-col items-center justify-center"
        >
          <div className="relative w-20 h-20">
            <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
              <circle cx="40" cy="40" r="36" fill="none" strokeWidth="6" className="stroke-muted" />
              <circle cx="40" cy="40" r="36" fill="none" strokeWidth="6"
                className={scoreStroke} strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={circumference - (circumference * score) / 100}
                style={{ transition: 'stroke-dashoffset 1s ease' }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={`text-2xl font-bold ${scoreColor}`}>{score}</span>
            </div>
          </div>
          {scoreChange !== null && (
            <div className={`flex items-center gap-0.5 mt-1 text-xs font-medium ${scoreChange > 0 ? 'text-emerald-500' : scoreChange < 0 ? 'text-red-500' : 'text-muted-foreground'}`}>
              {scoreChange > 0 ? <ArrowUpRight className="h-3 w-3" /> : scoreChange < 0 ? <ArrowDownRight className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
              {scoreChange > 0 ? '+' : ''}{scoreChange} pts
            </div>
          )}
          <div className="text-[10px] text-muted-foreground mt-1 uppercase tracking-wider font-semibold">Audit Score</div>
          <div className="text-[9px] text-muted-foreground/70 text-center mt-2 leading-tight">
            80+ is healthy<br />&lt;60 critical
          </div>
        </div>

        {/* Quick Stats */}
        <div className="col-span-12 sm:col-span-5 lg:col-span-4 grid grid-cols-3 gap-2">
          <div className="bg-card rounded-xl border p-2 flex flex-col items-center justify-center text-center">
            <span className="text-xl font-bold text-red-500">{totalIssues}</span>
            <span className="text-[10px] text-muted-foreground uppercase mt-0.5 font-semibold">Total</span>
            <span className="text-[9px] text-muted-foreground/70 mt-1 leading-tight">All issues</span>
          </div>
          <div className="bg-card rounded-xl border p-2 flex flex-col items-center justify-center text-center">
            <span className="text-xl font-bold text-amber-500">{issues?.new ?? 0}</span>
            <span className="text-[10px] text-muted-foreground uppercase mt-0.5 font-semibold">New</span>
            <span className="text-[9px] text-muted-foreground/70 mt-1 leading-tight">Need attention</span>
          </div>
          <div className="bg-card rounded-xl border p-2 flex flex-col items-center justify-center text-center">
            <span className="text-xl font-bold text-emerald-500">{issues?.fixed ?? 0}</span>
            <span className="text-[10px] text-muted-foreground uppercase mt-0.5 font-semibold">Fixed</span>
            <span className="text-[9px] text-muted-foreground/70 mt-1 leading-tight">Resolved</span>
          </div>
          {fromDate && toDate && (
            <div className="col-span-3 bg-muted/30 rounded-lg px-3 py-1.5 flex items-center gap-2">
              <Calendar className="h-3 w-3 text-muted-foreground shrink-0" />
              <span className="text-[11px] text-muted-foreground">{fmt(fromDate)} – {fmt(toDate)}</span>
            </div>
          )}
        </div>

        {/* Issues Trend */}
        {issuesTrend.length > 1 && (
          <div className="col-span-12 sm:col-span-4 lg:col-span-3 bg-card rounded-xl border p-4">
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2 font-semibold">Issues Over Time</div>
            <div className="h-16 flex items-end gap-[3px]">
              {(() => {
                const vals = issuesTrend.map(t => t.total);
                const max = Math.max(...vals);
                const min = Math.min(...vals);
                const range = max - min || 1;
                return issuesTrend.map((t, i) => {
                  const pct = ((t.total - min) / range) * 80 + 20;
                  const isLast = i === issuesTrend.length - 1;
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center justify-end h-full" title={`${fmt(t.date)}: ${t.total} issues`}>
                      <div className={`w-full rounded-sm ${isLast ? 'bg-primary' : 'bg-muted-foreground/30'}`} style={{ height: `${pct}%` }} />
                    </div>
                  );
                });
              })()}
            </div>
            <div className="flex justify-between text-[9px] text-muted-foreground/60 mt-1">
              <span>{fmt(issuesTrend[0].date)}</span>
              <span>{fmt(issuesTrend[issuesTrend.length - 1].date)}</span>
            </div>
          </div>
        )}

        {/* Top Issues */}
        {issues?.highest_impact && issues.highest_impact.length > 0 && (
          <div className="col-span-12 lg:col-span-3 bg-card rounded-xl border p-4">
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2 font-semibold">Top Issues</div>
            <div className="space-y-2">
              {issues.highest_impact.map((issue: any, i: number) => (
                <div key={i} className="flex justify-between items-center text-xs">
                  <span className="text-foreground truncate mr-2 capitalize">{issue.id.replace(/_/g, ' ')}</span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className={`w-1.5 h-1.5 rounded-full ${issue.difficulty === 'easy' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                    <span className="text-muted-foreground font-mono text-[11px]">{issue.count}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Row 2: Keywords */}
      {(keywords.length > 0 || Object.keys(keywordHistory).length > 0) && (
        <div className="grid grid-cols-12 gap-3">
          {keywords.length > 0 && (
            <div className="col-span-12 lg:col-span-6 bg-card rounded-xl border p-4">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Keyword Alerts</span>
                {kwReportType && (
                  <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${kwReportType === 'improved' ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : 'bg-red-500/15 text-red-600 dark:text-red-400'}`}>
                    {kwReportType}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground mb-3">Google search ranking positions — <span className="font-medium text-emerald-600 dark:text-emerald-400">#1 is best</span>. A lower number means a higher position on the results page.</p>
              <div className="space-y-0.5">
                {keywords.map((kw: any, idx: number) => {
                  const improved = kw.desktop_change > 0 || (!kw.desktop_old && kw.desktop_new);
                  const dropped = kw.desktop_change < 0 || (kw.desktop_old && !kw.desktop_new);
                  return (
                    <div key={idx} className="flex items-center justify-between py-2 px-2 rounded-lg hover:bg-muted/50 transition-colors">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-foreground font-medium truncate">{kw.keyword}</div>
                        <div className="text-[11px] text-muted-foreground">{kw.volume.toLocaleString()} mo/searches</div>
                      </div>
                      <div className="flex items-center gap-3 ml-3">
                        <span className="text-sm text-muted-foreground font-mono">{kw.desktop_old ?? '–'}</span>
                        <span className="text-muted-foreground/40">→</span>
                        <div className="flex items-center gap-1">
                          <span className={`text-sm font-bold font-mono ${improved ? 'text-emerald-600 dark:text-emerald-400' : dropped ? 'text-red-600 dark:text-red-400' : 'text-foreground'}`}>
                            {kw.desktop_new ?? 'Out'}
                          </span>
                          {improved && <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />}
                          {dropped && <TrendingDown className="h-3.5 w-3.5 text-red-500" />}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {Object.keys(keywordHistory).length > 0 && (
            <div className={`col-span-12 ${keywords.length > 0 ? 'lg:col-span-6' : ''} bg-card rounded-xl border p-4`}>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mb-3">Position History</div>
              <div className="space-y-2.5">
                {Object.entries(keywordHistory).slice(0, 5).map(([kw, history]) => {
                  const positions = history.map(h => h.position).filter(p => p !== null) as number[];
                  if (positions.length === 0) return null;
                  const current = positions[positions.length - 1];
                  const first = positions[0];
                  const change = first - current;
                  return (
                    <div key={kw} className="flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="text-xs text-foreground truncate">{kw}</div>
                      </div>
                      <div className="flex items-end gap-px h-5 w-20 shrink-0">
                        {history.map((h, i) => {
                          if (h.position === null) return <div key={i} className="flex-1 bg-muted h-px" />;
                          const height = Math.max(15, ((100 - Math.min(h.position, 100)) / 100) * 100);
                          return (
                            <div key={i} className="flex-1" title={`${fmt(h.date)}: #${h.position}`}>
                              <div className={`w-full rounded-[1px] ${h.position <= 20 ? 'bg-emerald-500' : h.position <= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                                style={{ height: `${height}%` }} />
                            </div>
                          );
                        })}
                      </div>
                      <div className="flex items-center gap-1 w-14 justify-end shrink-0">
                        <span className="text-xs font-mono text-foreground">#{current}</span>
                        <span className={`text-[10px] font-bold ${change > 0 ? 'text-emerald-500' : change < 0 ? 'text-red-500' : 'text-muted-foreground'}`}>
                          {change > 0 ? `↑${change}` : change < 0 ? `↓${Math.abs(change)}` : '–'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Row 3: Tracked Keywords */}
      {allTrackedKeywords.length > 0 && (
        <div className="bg-card rounded-xl border p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Key className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Tracked Keywords</span>
            </div>
            <span className="text-[11px] text-muted-foreground">
              <span className="text-primary font-semibold">{keywordQuota.used}</span>
              <span className="text-muted-foreground/50"> / {keywordQuota.limit}</span>
            </span>
          </div>
          <div className="w-full h-1 bg-muted rounded-full mb-3 overflow-hidden">
            <div className="h-full bg-primary rounded-full" style={{ width: `${(keywordQuota.used / keywordQuota.limit) * 100}%` }} />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {allTrackedKeywords.map((kw: string, i: number) => (
              <span key={i} className="text-[11px] bg-muted text-foreground px-2 py-0.5 rounded-md">{kw}</span>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="text-[10px] text-muted-foreground/60">
          {syncMutation.isPending ? (
            <span className="flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" /> Syncing SEO data...
            </span>
          ) : (
            <>Last synced {new Date(latest.collected_at).toLocaleDateString()}</>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 text-[10px] px-2 gap-1"
          onClick={() => syncMutation.mutate()}
          disabled={syncMutation.isPending}
        >
          <RefreshCw className={`h-3 w-3 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
          Sync Now
        </Button>
      </div>
      {syncError && (
        <div className="flex items-center gap-2 text-xs text-red-500 mt-1">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          <span>{syncError}</span>
        </div>
      )}
    </div>
  );
}
