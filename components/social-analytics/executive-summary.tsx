import React from "react";
import { TrendingUp, Flame } from "lucide-react";
import type { SocialAnalyticsComparison } from "@/types/social-analytics";

interface ExecutiveSummaryProps {
  comparison: SocialAnalyticsComparison;
}

export const ExecutiveSummary: React.FC<ExecutiveSummaryProps> = ({ comparison }: any) => {
  const executiveSummaryText = comparison?.executiveSummaryText || "Data is processing for this period.";
  const currentPeriod = comparison?.meta?.currentPeriod || comparison?.currentPeriod || { label: "Current Period" };

  return (
    <div className="p-4 rounded-2xl bg-gradient-to-r from-violet-500/10 via-purple-500/10 to-pink-500/10 border border-violet-500/20 shadow-xs flex items-start gap-3.5">
      <div className="p-2.5 rounded-xl bg-violet-500/20 text-violet-600 dark:text-violet-400 shrink-0 mt-0.5 shadow-xs">
        <Flame className="h-5 w-5" />
      </div>
      <div className="w-full">
        <div className="flex items-center justify-between gap-2 mb-1">
          <span className="text-xs font-bold uppercase tracking-wider text-violet-700 dark:text-violet-300 flex items-center gap-1.5">
            <TrendingUp className="h-3.5 w-3.5" />
            Executive Performance Story ({currentPeriod.label})
          </span>
          <span className="text-[10px] text-muted-foreground font-semibold">Factual Comparison</span>
        </div>
        <p className="text-sm font-medium text-foreground/90 leading-relaxed">
          {executiveSummaryText}
        </p>
      </div>
    </div>
  );
};
