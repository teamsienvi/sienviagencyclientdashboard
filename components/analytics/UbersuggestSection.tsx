import React from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, TrendingUp, TrendingDown, Minus, Calendar, Key, ArrowUpRight, ArrowDownRight } from "lucide-react";

interface UbersuggestSectionProps {
  clientId: string;
}

export function UbersuggestSection({ clientId }: UbersuggestSectionProps) {
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

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-32 bg-slate-900/50 rounded-xl border border-slate-800">
        <Loader2 className="h-6 w-6 animate-spin text-cyan-500" />
      </div>
    );
  }

  if (!allMetrics || allMetrics.length === 0) {
    return (
      <div className="flex flex-col justify-center items-center h-32 bg-slate-900/50 rounded-xl border border-slate-800 text-slate-500">
        <p className="text-sm">No SEO metrics synced yet.</p>
      </div>
    );
  }

  const latest = allMetrics?.[allMetrics.length - 1];
  if (!latest) {
    return (
      <div className="flex flex-col justify-center items-center h-32 bg-slate-900/50 rounded-xl border border-slate-800 text-slate-500">
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

  // Build issues trend
  const issuesTrend = allMetrics
    .filter(m => m.site_audit_score !== null)
    .map(m => {
      const iss = typeof m.site_audit_issues === 'string' ? JSON.parse(m.site_audit_issues) : m.site_audit_issues;
      return { total: iss?.total || 0, date: m.collected_at };
    });

  // Build keyword history
  const keywordHistory: Record<string, { date: string; position: number | null }[]> = {};
  for (const row of allMetrics) {
    const kws = typeof row.tracked_keywords === 'string' ? JSON.parse(row.tracked_keywords) : (row.tracked_keywords || []);
    for (const kw of kws) {
      if (!keywordHistory[kw.keyword]) keywordHistory[kw.keyword] = [];
      keywordHistory[kw.keyword].push({ date: row.collected_at, position: kw.desktop_new });
    }
  }

  const fmt = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const scoreColor = score >= 80 ? 'text-emerald-400' : score >= 60 ? 'text-amber-400' : 'text-rose-400';
  const scoreStroke = score >= 80 ? 'stroke-emerald-500' : score >= 60 ? 'stroke-amber-500' : 'stroke-rose-500';
  const circumference = 2 * Math.PI * 36;

  return (
    <div className="space-y-4">

      {/* ── Row 1: Score + Stats + Trend ── */}
      <div className="grid grid-cols-12 gap-4">

        {/* Score Circle */}
        <div className="col-span-12 sm:col-span-3 lg:col-span-2 bg-slate-800/50 rounded-xl border border-slate-700/50 p-4 flex flex-col items-center justify-center">
          <div className="relative w-20 h-20">
            <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
              <circle cx="40" cy="40" r="36" fill="none" strokeWidth="6" className="stroke-slate-700" />
              <circle cx="40" cy="40" r="36" fill="none" strokeWidth="6"
                className={scoreStroke}
                strokeLinecap="round"
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
            <div className={`flex items-center gap-0.5 mt-1 text-xs font-medium ${scoreChange > 0 ? 'text-emerald-400' : scoreChange < 0 ? 'text-rose-400' : 'text-slate-500'}`}>
              {scoreChange > 0 ? <ArrowUpRight className="h-3 w-3" /> : scoreChange < 0 ? <ArrowDownRight className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
              {scoreChange > 0 ? '+' : ''}{scoreChange} pts
            </div>
          )}
          <div className="text-[10px] text-slate-500 mt-1 uppercase tracking-wider">Audit Score</div>
        </div>

        {/* Quick Stats Grid */}
        <div className="col-span-12 sm:col-span-5 lg:col-span-4 grid grid-cols-3 gap-2">
          <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-3 flex flex-col items-center justify-center">
            <span className="text-xl font-bold text-rose-400">{totalIssues}</span>
            <span className="text-[10px] text-slate-500 uppercase mt-0.5">Total</span>
          </div>
          <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-3 flex flex-col items-center justify-center">
            <span className="text-xl font-bold text-amber-400">{issues?.new ?? 0}</span>
            <span className="text-[10px] text-slate-500 uppercase mt-0.5">New</span>
          </div>
          <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-3 flex flex-col items-center justify-center">
            <span className="text-xl font-bold text-emerald-400">{issues?.fixed ?? 0}</span>
            <span className="text-[10px] text-slate-500 uppercase mt-0.5">Fixed</span>
          </div>

          {/* Reporting Period */}
          {fromDate && toDate && (
            <div className="col-span-3 bg-slate-800/30 rounded-lg px-3 py-1.5 flex items-center gap-2">
              <Calendar className="h-3 w-3 text-slate-500 shrink-0" />
              <span className="text-[11px] text-slate-400">{fmt(fromDate)} – {fmt(toDate)}</span>
            </div>
          )}
        </div>

        {/* Issues Trend Sparkline */}
        {issuesTrend.length > 1 && (
          <div className="col-span-12 sm:col-span-4 lg:col-span-3 bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
            <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-2 font-semibold">Issues Over Time</div>
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
                      <div
                        className={`w-full rounded-sm ${isLast ? 'bg-cyan-500' : 'bg-slate-600'}`}
                        style={{ height: `${pct}%` }}
                      />
                    </div>
                  );
                });
              })()}
            </div>
            <div className="flex justify-between text-[9px] text-slate-600 mt-1">
              <span>{fmt(issuesTrend[0].date)}</span>
              <span>{fmt(issuesTrend[issuesTrend.length - 1].date)}</span>
            </div>
          </div>
        )}

        {/* Top Issues */}
        {issues?.highest_impact && issues.highest_impact.length > 0 && (
          <div className="col-span-12 lg:col-span-3 bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
            <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-2 font-semibold">Top Issues</div>
            <div className="space-y-1.5">
              {issues.highest_impact.map((issue: any, i: number) => (
                <div key={i} className="flex justify-between items-center text-xs">
                  <span className="text-slate-300 truncate mr-2 capitalize">{issue.id.replace(/_/g, ' ')}</span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className={`w-1.5 h-1.5 rounded-full ${issue.difficulty === 'easy' ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                    <span className="text-slate-400 font-mono text-[11px]">{issue.count}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Row 2: Keyword Alerts + History ── */}
      {(keywords.length > 0 || Object.keys(keywordHistory).length > 0) && (
        <div className="grid grid-cols-12 gap-4">

          {/* Keyword Alerts Table */}
          {keywords.length > 0 && (
            <div className="col-span-12 lg:col-span-6 bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
              <div className="flex justify-between items-center mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Keyword Alerts</span>
                  {kwReportType && (
                    <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${kwReportType === 'improved' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                      {kwReportType}
                    </span>
                  )}
                </div>
              </div>
              <div className="space-y-0.5">
                {keywords.map((kw: any, idx: number) => {
                  const improved = kw.desktop_change > 0 || (!kw.desktop_old && kw.desktop_new);
                  const dropped = kw.desktop_change < 0 || (kw.desktop_old && !kw.desktop_new);
                  return (
                    <div key={idx} className="flex items-center justify-between py-2 px-2 rounded-lg hover:bg-slate-700/30 transition-colors">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-slate-200 font-medium truncate">{kw.keyword}</div>
                        <div className="text-[11px] text-slate-500">{kw.volume.toLocaleString()} monthly searches</div>
                      </div>
                      <div className="flex items-center gap-3 ml-3">
                        <span className="text-sm text-slate-500 font-mono">{kw.desktop_old ?? '–'}</span>
                        <span className="text-slate-600">→</span>
                        <div className="flex items-center gap-1">
                          <span className={`text-sm font-bold font-mono ${improved ? 'text-emerald-400' : dropped ? 'text-rose-400' : 'text-slate-300'}`}>
                            {kw.desktop_new ?? 'Out'}
                          </span>
                          {improved && <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />}
                          {dropped && <TrendingDown className="h-3.5 w-3.5 text-rose-500" />}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Keyword Position History */}
          {Object.keys(keywordHistory).length > 0 && (
            <div className={`col-span-12 ${keywords.length > 0 ? 'lg:col-span-6' : 'lg:col-span-12'} bg-slate-800/50 rounded-xl border border-slate-700/50 p-4`}>
              <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-3">Position History</div>
              <div className="space-y-2">
                {Object.entries(keywordHistory).slice(0, 5).map(([kw, history]) => {
                  const positions = history.map(h => h.position).filter(p => p !== null) as number[];
                  if (positions.length === 0) return null;
                  const current = positions[positions.length - 1];
                  const first = positions[0];
                  const change = first - current;

                  return (
                    <div key={kw} className="flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="text-xs text-slate-300 truncate">{kw}</div>
                      </div>
                      {/* Mini sparkline */}
                      <div className="flex items-end gap-px h-5 w-20 shrink-0">
                        {history.map((h, i) => {
                          if (h.position === null) return <div key={i} className="flex-1 bg-slate-700/30 h-px" />;
                          const height = Math.max(15, ((100 - Math.min(h.position, 100)) / 100) * 100);
                          return (
                            <div key={i} className="flex-1" title={`${fmt(h.date)}: #${h.position}`}>
                              <div
                                className={`w-full rounded-[1px] ${h.position <= 20 ? 'bg-emerald-500' : h.position <= 50 ? 'bg-amber-500' : 'bg-rose-500'}`}
                                style={{ height: `${height}%` }}
                              />
                            </div>
                          );
                        })}
                      </div>
                      <div className="flex items-center gap-1 w-14 justify-end shrink-0">
                        <span className="text-xs font-mono text-slate-300">#{current}</span>
                        <span className={`text-[10px] font-bold ${change > 0 ? 'text-emerald-400' : change < 0 ? 'text-rose-400' : 'text-slate-500'}`}>
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

      {/* ── Row 3: Tracked Keywords + Quota ── */}
      {allTrackedKeywords.length > 0 && (
        <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Key className="h-3.5 w-3.5 text-slate-500" />
              <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Tracked Keywords</span>
            </div>
            <span className="text-[11px] text-slate-400">
              <span className="text-cyan-400 font-semibold">{keywordQuota.used}</span>
              <span className="text-slate-600"> / {keywordQuota.limit}</span>
            </span>
          </div>
          <div className="w-full h-1 bg-slate-700 rounded-full mb-3 overflow-hidden">
            <div className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full" style={{ width: `${(keywordQuota.used / keywordQuota.limit) * 100}%` }} />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {allTrackedKeywords.map((kw: string, i: number) => (
              <span key={i} className="text-[11px] bg-slate-700/60 text-slate-300 px-2 py-0.5 rounded-md">{kw}</span>
            ))}
          </div>
        </div>
      )}

      <div className="text-[10px] text-slate-600 text-right">
        Last synced {new Date(latest.collected_at).toLocaleDateString()}
      </div>
    </div>
  );
}
