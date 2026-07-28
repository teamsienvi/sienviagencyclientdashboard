import React from "react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Info } from "lucide-react";
import type { MetricComparison } from "@/types/social-analytics";
import {
  formatNum,
  formatDeltaValue,
  formatRelativeDelta,
  formatPercentagePointDelta,
  getDirectionSymbol,
  getDirectionLabel,
} from "@/lib/analytics/formatting.ts";

interface MetricDeltaCardProps {
  metric: MetricComparison;
  icon: React.ReactNode;
  isRateMetric?: boolean;
}

export const MetricDeltaCard: React.FC<MetricDeltaCardProps> = ({
  metric,
  icon,
  isRateMetric = false,
}) => {
  const {
    label,
    currentValue,
    previousValue,
    absoluteDelta,
    relativeDelta,
    percentagePointDelta,
    denominatorLabel,
  } = metric;

  const symbol = getDirectionSymbol(absoluteDelta);
  const directionLabel = getDirectionLabel(absoluteDelta);

  const isPositive = absoluteDelta > 0;
  const isNegative = absoluteDelta < 0;

  // Accessibility contrast-safe colors + explicit non-color text labels & arrows
  const badgeClass = isPositive
    ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
    : isNegative
    ? "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30"
    : "bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/30";

  return (
    <div className="bg-card border border-border/60 rounded-2xl p-4 shadow-xs relative overflow-hidden min-w-0 flex flex-col justify-between space-y-3">
      
      {/* Top Label & Icon */}
      <div className="flex items-center justify-between text-muted-foreground gap-1">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-xs font-semibold text-foreground/80 truncate">{label}</span>
          {denominatorLabel && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground cursor-pointer" />
                </TooltipTrigger>
                <TooltipContent className="text-xs">
                  <p>Formula: {denominatorLabel}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
        <div className="p-2 rounded-xl bg-violet-500/10 text-violet-600 dark:text-violet-400">
          {icon}
        </div>
      </div>

      {/* Hero Value */}
      <div>
        <p className="text-2xl font-bold tracking-tight text-foreground">
          {isRateMetric ? `${currentValue.toFixed(1)}%` : formatNum(currentValue)}
        </p>
      </div>

      {/* Delta Badge & Previous Period Comparison */}
      <div className="space-y-1 pt-1 border-t border-border/40">
        <div className="flex items-center justify-between gap-1">
          <Badge className={`text-[11px] font-bold px-2 py-0.5 border gap-1 ${badgeClass}`}>
            <span aria-hidden="true">{symbol}</span>
            <span>{directionLabel}</span>
            <span>
              ({isRateMetric ? formatPercentagePointDelta(percentagePointDelta) : formatRelativeDelta(relativeDelta)})
            </span>
          </Badge>
        </div>

        <p className="text-[11px] text-muted-foreground flex items-center justify-between pt-0.5">
          <span>Prior Period:</span>
          <span className="font-semibold text-foreground/80">
            {isRateMetric ? `${previousValue.toFixed(1)}%` : formatNum(previousValue)}
          </span>
        </p>
      </div>

    </div>
  );
};
