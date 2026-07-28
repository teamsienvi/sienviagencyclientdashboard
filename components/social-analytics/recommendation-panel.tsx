import React from "react";
import { Badge } from "@/components/ui/badge";
import { Lightbulb, ArrowRight } from "lucide-react";
import type { SocialAnalyticsComparison } from "@/types/social-analytics";

interface RecommendationPanelProps {
  comparison: SocialAnalyticsComparison;
}

export const RecommendationPanel: React.FC<RecommendationPanelProps> = ({ comparison }: any) => {
  const recommendations = comparison?.recommendations || [];

  return (
    <div className="bg-card border border-border/60 rounded-2xl p-5 shadow-xs space-y-4">
      <div className="flex items-center gap-2">
        <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500">
          <Lightbulb className="h-5 w-5" />
        </div>
        <div>
          <h4 className="text-base font-bold tracking-tight text-foreground">Strategic Agency & Client Next Steps</h4>
          <p className="text-xs text-muted-foreground">
            Deterministic recommendations derived from period comparison rules
          </p>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 pt-1">
        {recommendations.map((rec: any, idx: number) => {
          const id = rec.id || rec.ruleId || `rec-${idx}`;
          const reasoning = rec.reasoning || rec.evidence || "Empirical period comparison recommendation.";
          const severity = rec.severity || rec.confidence || "medium";

          return (
            <div
              key={id}
              className="p-4 rounded-xl bg-muted/30 border border-border/50 hover:border-amber-500/30 transition-all flex flex-col justify-between space-y-3"
            >
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <Badge
                    className={
                      severity === "high"
                        ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20 text-[10px]"
                        : severity === "medium"
                        ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 text-[10px]"
                        : "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20 text-[10px]"
                    }
                  >
                    {String(severity).toUpperCase()} PRIORITY
                  </Badge>
                </div>
                <h5 className="text-sm font-bold text-foreground">{rec.title}</h5>
                <p className="text-xs text-muted-foreground leading-relaxed">{reasoning}</p>
              </div>

              <div className="pt-2 border-t border-border/40 flex items-start gap-2 text-xs font-semibold text-violet-600 dark:text-violet-400">
                <ArrowRight className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                <span>{rec.action}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
