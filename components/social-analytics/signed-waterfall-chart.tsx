import React from "react";
import { Badge } from "@/components/ui/badge";
import type { CanonicalComparisonResponse } from "@/lib/analytics/comparison-contract.ts";
import { formatNum } from "@/lib/analytics/formatting.ts";

interface SignedWaterfallChartProps {
  comparison: CanonicalComparisonResponse;
}

export const SignedWaterfallChart: React.FC<SignedWaterfallChartProps> = ({ comparison }) => {
  const { totals, channels, meta } = comparison;
  const prevTotal = totals.views.previousValue || 0;
  const curTotal = totals.views.currentValue || 0;
  const netDelta = totals.views.absoluteDelta || 0;

  const channelColors: Record<string, string> = {
    youtube: "#ef4444",
    tiktok: "#f43f5e",
    facebook: "#3b82f6",
    instagram: "#d946ef",
    x: "#64748b",
    linkedin: "#0a66c2",
    other: "#a855f7",
  };

  // Separate positive and negative contributors for waterfall presentation
  const negativeContributors = channels.filter((c) => c.signedDelta < 0);
  const positiveContributors = channels.filter((c) => c.signedDelta > 0);

  const maxVal = Math.max(1, prevTotal, curTotal, ...channels.map((c) => Math.abs(c.signedDelta)));

  return (
    <div className="bg-card border border-border/60 rounded-2xl p-5 shadow-xs space-y-4">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/40 pb-3">
        <div>
          <h4 className="text-base font-bold tracking-tight text-foreground flex items-center gap-2">
            <span>Signed Channel Waterfall & Delta Attribution</span>
          </h4>
          <p className="text-xs text-muted-foreground">
            Prior Total ({formatNum(prevTotal)}) → Negative Contributors → Positive Contributors → Current Total ({formatNum(curTotal)})
          </p>
        </div>

        <Badge className={netDelta >= 0 ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-xs font-bold" : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30 text-xs font-bold"}>
          Net Change: {netDelta >= 0 ? "+" : ""}{formatNum(netDelta)}
        </Badge>
      </div>

      {/* Waterfall Visual Rows */}
      <div className="space-y-3 pt-1">
        
        {/* Row 1: Prior Period Total Baseline */}
        <div className="p-3 rounded-xl bg-slate-500/10 border border-slate-500/20 flex items-center justify-between text-xs">
          <span className="font-bold text-foreground flex items-center gap-2">
            <span className="w-3 h-3 rounded-md bg-slate-500 inline-block" />
            Prior Period Total ({meta.comparisonPeriod.label})
          </span>
          <span className="font-mono font-bold text-sm text-foreground">{formatNum(prevTotal)}</span>
        </div>

        {/* Row 2: Negative Contributors (e.g. -115 Other/Unattributed/Prior-Only) */}
        {negativeContributors.map((ch) => {
          const color = channelColors[ch.platform] || "#f43f5e";
          const pct = Math.round((Math.abs(ch.signedDelta) / maxVal) * 100);

          return (
            <div key={ch.platform} className="pl-4 border-l-2 border-rose-500/40 space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-foreground flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: color }} />
                  {ch.label} (Decline)
                </span>
                <span className="font-bold text-rose-600 dark:text-rose-400">
                  {formatNum(ch.signedDelta)} ({ch.contributionToNetDelta}%)
                </span>
              </div>
              <div className="h-2.5 w-full bg-muted/60 rounded-full overflow-hidden p-0.5 border border-border/30">
                <div className="h-full rounded-full bg-rose-500 transition-all duration-500" style={{ width: `${Math.max(pct, 3)}%` }} />
              </div>
            </div>
          );
        })}

        {/* Row 3: Positive Contributors (e.g. +313 FB, +132 TT, +90 YT, +46 IG) */}
        {positiveContributors.map((ch) => {
          const color = channelColors[ch.platform] || "#3b82f6";
          const pct = Math.round((ch.signedDelta / maxVal) * 100);

          return (
            <div key={ch.platform} className="pl-4 border-l-2 border-emerald-500/40 space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-foreground flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: color }} />
                  {ch.label} (Increase)
                </span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">
                  +{formatNum(ch.signedDelta)} ({ch.contributionToNetDelta}%)
                </span>
              </div>
              <div className="h-2.5 w-full bg-muted/60 rounded-full overflow-hidden p-0.5 border border-border/30">
                <div className="h-full rounded-full bg-emerald-500 transition-all duration-500" style={{ width: `${Math.max(pct, 3)}%` }} />
              </div>
            </div>
          );
        })}

        {/* Row 4: Current Period Total Endpoint */}
        <div className="p-3 rounded-xl bg-violet-500/10 border border-violet-500/30 flex items-center justify-between text-xs">
          <span className="font-bold text-violet-700 dark:text-violet-300 flex items-center gap-2">
            <span className="w-3 h-3 rounded-md bg-violet-600 inline-block" />
            Current Period Total ({meta.currentPeriod.label})
          </span>
          <span className="font-mono font-bold text-sm text-violet-700 dark:text-violet-300">{formatNum(curTotal)}</span>
        </div>

      </div>
    </div>
  );
};
