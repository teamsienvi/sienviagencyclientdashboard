import React from "react";
import type { SocialAnalyticsComparison } from "@/types/social-analytics";
import { formatPercentagePointDelta } from "@/lib/analytics/formatting.ts";

interface ChannelShareChangeProps {
  comparison: SocialAnalyticsComparison;
}

export const ChannelShareChange: React.FC<ChannelShareChangeProps> = ({ comparison }: any) => {
  const channelShare = comparison?.channelShare || (comparison?.channels || []).map((c: any) => ({
    platform: c.platform,
    label: c.label,
    currentSharePct: c.currentShare,
    previousSharePct: c.previousShare,
    shareDeltaPp: c.shareDeltaPp,
    color: c.platform === "youtube" ? "#ef4444" : c.platform === "tiktok" ? "#f43f5e" : c.platform === "facebook" ? "#3b82f6" : c.platform === "instagram" ? "#d946ef" : "#8b5cf6",
  }));

  return (
    <div className="bg-card border border-border/60 rounded-2xl p-5 shadow-xs space-y-4">
      <div>
        <h4 className="text-base font-bold tracking-tight text-foreground">Channel Reach Share Shifts (pp)</h4>
        <p className="text-xs text-muted-foreground">
          Percentage-point changes in audience reach share between periods
        </p>
      </div>

      <div className="space-y-4 pt-1">
        {channelShare.map((cs) => {
          const isPositive = cs.shareDeltaPp >= 0;
          return (
            <div key={cs.platform} className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold capitalize flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: cs.color }} />
                  {cs.label}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">
                    {cs.previousSharePct.toFixed(1)}% → {cs.currentSharePct.toFixed(1)}%
                  </span>
                  <span className={`font-bold ${isPositive ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                    {formatPercentagePointDelta(cs.shareDeltaPp)}
                  </span>
                </div>
              </div>

              <div className="h-3 w-full bg-muted/60 rounded-full overflow-hidden p-0.5 border border-border/40">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${Math.max(cs.currentSharePct, 2)}%`, backgroundColor: cs.color }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
