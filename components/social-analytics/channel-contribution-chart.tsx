import React from "react";
import { Badge } from "@/components/ui/badge";
import type { SocialAnalyticsComparison } from "@/types/social-analytics";
import { formatNum } from "@/lib/analytics/formatting.ts";

interface ChannelContributionChartProps {
  comparison: SocialAnalyticsComparison;
}

export const ChannelContributionChart: React.FC<ChannelContributionChartProps> = ({ comparison }) => {
  const { channelBreakdown, metrics } = comparison;
  const totalDelta = metrics.views.absoluteDelta;

  const channelColors: Record<string, string> = {
    youtube: "#ef4444",
    tiktok: "#f43f5e",
    facebook: "#3b82f6",
    instagram: "#d946ef",
    x: "#64748b",
    linkedin: "#0a66c2",
  };

  return (
    <div className="bg-card border border-border/60 rounded-2xl p-5 shadow-xs space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-base font-bold tracking-tight text-foreground">Channel Delta Contribution Waterfall</h4>
          <p className="text-xs text-muted-foreground">
            How each social channel contributed to the net view change ({totalDelta >= 0 ? "+" : ""}{formatNum(totalDelta)} views)
          </p>
        </div>
        <Badge className={totalDelta >= 0 ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-xs" : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20 text-xs"}>
          Net Change: {totalDelta >= 0 ? "+" : ""}{formatNum(totalDelta)}
        </Badge>
      </div>

      <div className="space-y-3 pt-2">
        {channelBreakdown.map((ch) => {
          const isPositive = ch.absoluteDelta >= 0;
          const absVal = Math.abs(ch.absoluteDelta);
          const maxDelta = Math.max(1, ...channelBreakdown.map((c) => Math.abs(c.absoluteDelta)));
          const widthPct = Math.round((absVal / maxDelta) * 100);
          const color = channelColors[ch.platform.toLowerCase()] || "#8b5cf6";

          return (
            <div key={ch.platform} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold capitalize flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: color }} />
                  {ch.label}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground text-[11px]">
                    {formatNum(ch.previousViews)} → {formatNum(ch.currentViews)}
                  </span>
                  <span className={`font-bold ${isPositive ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                    {isPositive ? "+" : ""}{formatNum(ch.absoluteDelta)} views ({ch.contributionPct}%)
                  </span>
                </div>
              </div>

              {/* Progress Diverging Bar */}
              <div className="h-3 w-full bg-muted/60 rounded-full overflow-hidden p-0.5 border border-border/40 flex items-center">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    isPositive ? "bg-emerald-500" : "bg-rose-500"
                  }`}
                  style={{ width: `${Math.max(widthPct, 4)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
