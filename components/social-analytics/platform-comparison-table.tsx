import React from "react";
import type { CanonicalComparisonResponse } from "@/lib/analytics/comparison-contract.ts";
import { DataStatusBadge } from "./data-status-badge";
import { formatNum, formatPercentagePointDelta } from "@/lib/analytics/formatting.ts";

interface PlatformComparisonTableProps {
  comparison: CanonicalComparisonResponse;
}

export const PlatformComparisonTable: React.FC<PlatformComparisonTableProps> = ({ comparison }) => {
  const { channels } = comparison;

  const channelColors: Record<string, string> = {
    youtube: "#ef4444",
    tiktok: "#f43f5e",
    facebook: "#3b82f6",
    instagram: "#d946ef",
    x: "#64748b",
    linkedin: "#0a66c2",
    other: "#a855f7",
  };

  return (
    <div className="bg-card border border-border/60 rounded-2xl p-5 shadow-xs space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-base font-bold tracking-tight text-foreground">Full Channel Union & PoP Comparison Matrix</h4>
          <p className="text-xs text-muted-foreground">Includes all active, prior-only, and unattributed channel buckets (100% reconciled)</p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border/60 text-muted-foreground text-left">
              <th className="pb-2.5 font-semibold">Channel</th>
              <th className="pb-2.5 font-semibold text-right">Prior Reach</th>
              <th className="pb-2.5 font-semibold text-right">Current Reach</th>
              <th className="pb-2.5 font-semibold text-right">Signed Delta</th>
              <th className="pb-2.5 font-semibold text-right">Prior Share</th>
              <th className="pb-2.5 font-semibold text-right">Current Share</th>
              <th className="pb-2.5 font-semibold text-right">Share Delta (pp)</th>
              <th className="pb-2.5 font-semibold text-right">Contribution %</th>
              <th className="pb-2.5 font-semibold text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {channels.map((plat) => {
              const color = channelColors[plat.platform.toLowerCase()] || "#8b5cf6";
              const isPositiveViews = plat.signedDelta >= 0;
              const isPositiveShare = plat.shareDeltaPp >= 0;

              return (
                <tr key={plat.platform} className={plat.isOtherCategory ? "bg-purple-500/5 hover:bg-purple-500/10" : "hover:bg-muted/20"}>
                  <td className="py-3 font-semibold capitalize flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full inline-block shadow-xs" style={{ backgroundColor: color }} />
                    <span>{plat.label}</span>
                    {plat.isOtherCategory && (
                      <span className="text-[10px] text-purple-600 dark:text-purple-400 font-normal border border-purple-500/30 px-1.5 py-0.5 rounded">
                        Unattributed
                      </span>
                    )}
                  </td>
                  <td className="py-3 text-right font-medium text-muted-foreground">{formatNum(plat.previousValue)}</td>
                  <td className="py-3 text-right font-bold text-foreground">{formatNum(plat.currentValue)}</td>
                  <td className={`py-3 text-right font-semibold ${isPositiveViews ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                    {isPositiveViews ? "+" : ""}{formatNum(plat.signedDelta)}
                  </td>
                  <td className="py-3 text-right font-medium text-muted-foreground">{plat.previousShare.toFixed(1)}%</td>
                  <td className="py-3 text-right font-semibold text-foreground">{plat.currentShare.toFixed(1)}%</td>
                  <td className={`py-3 text-right font-medium ${isPositiveShare ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                    {formatPercentagePointDelta(plat.shareDeltaPp)}
                  </td>
                  <td className="py-3 text-right font-semibold text-violet-600 dark:text-violet-400">{plat.contributionToNetDelta}%</td>
                  <td className="py-3 text-center">
                    <DataStatusBadge status={plat.dataStatus} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
