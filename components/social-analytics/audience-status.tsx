import React from "react";
import { Badge } from "@/components/ui/badge";
import { Users, Info, ShieldAlert } from "lucide-react";
import type { ReconciledAudience } from "@/lib/analytics/comparison-contract.ts";
import { formatNum } from "@/lib/analytics/formatting.ts";

interface AudienceStatusProps {
  audience: ReconciledAudience;
}

export const AudienceStatusCard: React.FC<AudienceStatusProps> = ({ audience }) => {
  const {
    currentBoundaryCount,
    previousBoundaryCount,
    netChange,
    status,
    statusLabel,
    coverageCount,
    missingPlatforms,
  } = audience;

  const isAvailable = status === "available";

  return (
    <div className="bg-card border border-border/60 rounded-2xl p-4 shadow-xs space-y-3 min-w-0 overflow-hidden flex flex-col justify-between">
      <div className="flex items-center justify-between gap-1">
        <span className="text-xs font-semibold text-foreground/80 flex items-center gap-1.5 truncate">
          <Users className="h-4 w-4 text-violet-500 shrink-0" />
          <span className="truncate">Audience Baselines</span>
        </span>
        <Badge
          className={
            isAvailable
              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 border-emerald-500/30 text-[10px] shrink-0"
              : "bg-amber-500/10 text-amber-600 dark:text-amber-300 border-amber-500/30 text-[10px] shrink-0"
          }
        >
          {statusLabel}
        </Badge>
      </div>

      {isAvailable && currentBoundaryCount != null && previousBoundaryCount != null ? (
        <div className="space-y-2">
          <div className="flex items-baseline justify-between gap-1">
            <span className="text-2xl font-bold tracking-tight text-foreground">
              {netChange != null && netChange > 0 ? `+${formatNum(netChange)}` : formatNum(netChange)}
            </span>
            <span className="text-[11px] text-muted-foreground font-medium truncate">Net Delta</span>
          </div>

          <div className="p-2.5 rounded-xl bg-muted/40 border border-border/40 text-xs space-y-1">
            <div className="flex justify-between items-center gap-2">
              <span className="text-muted-foreground truncate">Start Baseline:</span>
              <span className="font-semibold shrink-0">{formatNum(previousBoundaryCount)}</span>
            </div>
            <div className="flex justify-between items-center gap-2">
              <span className="text-muted-foreground truncate">End Snapshot:</span>
              <span className="font-semibold shrink-0">{formatNum(currentBoundaryCount)}</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs space-y-1.5">
          <div className="flex items-center gap-2 font-bold text-amber-700 dark:text-amber-300">
            <ShieldAlert className="h-4 w-4 shrink-0 text-amber-500" />
            <span>Follower Baseline Unavailable</span>
          </div>
          <p className="text-amber-800/80 dark:text-amber-300/80 leading-relaxed">
            Net follower delta requires verified boundary snapshots at both start and end dates. Displaying baseline status (—).
          </p>
        </div>
      )}

      {missingPlatforms.length > 0 && (
        <p className="text-[10px] text-muted-foreground flex items-center gap-1">
          <Info className="h-3 w-3 text-muted-foreground" />
          Uncollected boundary channels: {missingPlatforms.join(", ")}
        </p>
      )}
    </div>
  );
};
