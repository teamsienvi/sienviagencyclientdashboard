import React from "react";
import { Badge } from "@/components/ui/badge";
import { Award, Zap, AlertTriangle, Play, ExternalLink } from "lucide-react";
import type { SocialAnalyticsComparison } from "@/types/social-analytics";
import { formatNum } from "@/lib/analytics/formatting.ts";

interface TopContentDriversProps {
  comparison: SocialAnalyticsComparison;
}

export const TopContentDrivers: React.FC<TopContentDriversProps> = ({ comparison }: any) => {
  const drivers = comparison?.drivers || {
    scaleLeader: comparison?.channels?.[0]?.label || "None",
    efficiencyLeader: comparison?.channels?.[0]?.label || "None",
    topDriverPosts: (comparison?.topContent || []).map((t: any) => ({
      id: t.id,
      date: t.publishedAt,
      platform: t.platform,
      title: t.title,
      url: t.url,
      views: t.currentValue,
      engagementRate: t.engagementRate,
      contributionPct: t.contributionToCurrentTotal,
    })),
    lowVolumeWarnings: [],
  };
  const { scaleLeader = "None", efficiencyLeader = "None", topDriverPosts = [], lowVolumeWarnings = [] } = drivers;

  return (
    <div className="bg-card border border-border/60 rounded-2xl p-5 shadow-xs space-y-4">
      
      {/* Header & Scale vs Efficiency Leaders */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-border/40 pb-4">
        <div>
          <h4 className="text-base font-bold tracking-tight text-foreground flex items-center gap-2">
            <span>What Drove the Change? (Drivers & Leaders)</span>
          </h4>
          <p className="text-xs text-muted-foreground">Content drivers and platform leadership analysis</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Scale Leader Badge */}
          <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 text-xs gap-1.5 py-1 px-2.5">
            <Award className="h-3.5 w-3.5 text-amber-500" />
            <span>Scale Leader: <strong>{scaleLeader}</strong></span>
          </Badge>
          {/* Efficiency Leader Badge */}
          <Badge className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 text-xs gap-1.5 py-1 px-2.5">
            <Zap className="h-3.5 w-3.5 text-blue-500" />
            <span>Efficiency Leader: <strong>{efficiencyLeader}</strong></span>
          </Badge>
        </div>
      </div>

      {/* Low Volume Sample Warnings */}
      {lowVolumeWarnings.length > 0 && (
        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-700 dark:text-amber-300 space-y-1">
          {lowVolumeWarnings.map((warn, i) => (
            <div key={i} className="flex items-center gap-2">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-500" />
              <span>{warn}</span>
            </div>
          ))}
        </div>
      )}

      {/* Top Driver Content Posts List */}
      <div>
        <h5 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
          Top Driver Content Posts (by Reach Contribution)
        </h5>
        {topDriverPosts.length > 0 ? (
          <div className="space-y-2.5">
            {topDriverPosts.map((post) => (
              <div
                key={post.id}
                className="p-3 rounded-xl bg-muted/30 border border-border/40 hover:border-violet-500/30 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 overflow-hidden"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="p-2 rounded-lg bg-violet-500/10 text-violet-600 dark:text-violet-400 shrink-0">
                    <Play className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <Badge className="text-[10px] uppercase font-bold px-1.5 py-0 bg-violet-500/20 text-violet-700 dark:text-violet-300 border-none shrink-0">
                        {post.platform}
                      </Badge>
                      <span className="text-[11px] text-muted-foreground shrink-0">{post.date}</span>
                    </div>
                    {post.url ? (
                      <a
                        href={post.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-semibold text-foreground hover:text-violet-600 dark:hover:text-violet-400 flex items-center gap-1.5 transition-colors group/link min-w-0"
                      >
                        <span className="truncate">{post.title}</span>
                        <ExternalLink className="h-3 w-3 shrink-0 text-violet-500 group-hover/link:translate-x-0.5 transition-transform" />
                      </a>
                    ) : (
                      <p className="text-xs font-semibold text-foreground truncate">{post.title}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 text-xs">
                  <div className="text-left sm:text-right shrink-0">
                    <p className="font-bold text-foreground">{formatNum(post.views)} views</p>
                    <p className="text-[11px] text-muted-foreground font-medium">
                      {post.engagementRate.toFixed(1)}% ER ({post.contributionPct}% share)
                    </p>
                  </div>
                  {post.url && (
                    <a
                      href={post.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-violet-700 dark:text-violet-300 bg-violet-500/10 hover:bg-violet-500/20 border border-violet-500/30 px-2.5 py-1 rounded-lg transition-all shrink-0"
                    >
                      <span>View</span>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground italic py-2">
            No specific post drivers available for this period.
          </p>
        )}
      </div>

    </div>
  );
};
