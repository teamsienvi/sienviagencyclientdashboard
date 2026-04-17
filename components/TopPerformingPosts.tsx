import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ExternalLink, TrendingUp, Info } from "lucide-react";
import { useTopPerformingPosts } from "@/hooks/useTopPerformingPosts";
import { 
  getEngagementTierColor, 
  getReachTierColor, 
  getPerformanceTierColor,
  formatPlatformName,
  REACH_TIER_DEFINITIONS,
  ENGAGEMENT_TIER_DEFINITIONS,
  PERFORMANCE_TIER_DEFINITIONS
} from "@/utils/topPerformingInsights";
import { format, subDays } from "date-fns";

// Tooltip content for each metric
const MetricTooltip = ({ children, content }: { children: React.ReactNode; content: React.ReactNode }) => (
  <Tooltip delayDuration={200}>
    <TooltipTrigger asChild>
      <span className="inline-flex items-center gap-1 cursor-help">
        {children}
        <Info className="h-3 w-3 text-muted-foreground/60" />
      </span>
    </TooltipTrigger>
    <TooltipContent side="top" className="max-w-xs text-xs">
      {content}
    </TooltipContent>
  </Tooltip>
);

const ReachTierTooltip = () => (
  <div className="space-y-1">
    <p className="font-semibold mb-1">Reach Tier (40% weight)</p>
    <p className="text-muted-foreground mb-2">Based on total views/impressions</p>
    {REACH_TIER_DEFINITIONS.map((t) => (
      <div key={t.tier} className="flex justify-between gap-4">
        <span>{t.tier.replace("Tier ", "T")}</span>
        <span className="text-muted-foreground">{t.range}</span>
      </div>
    ))}
  </div>
);

const EngageTierTooltip = () => (
  <div className="space-y-1">
    <p className="font-semibold mb-1">Engagement Tier (30% weight)</p>
    <p className="text-muted-foreground mb-2">Based on engagement rate %</p>
    {ENGAGEMENT_TIER_DEFINITIONS.map((t) => (
      <div key={t.tier} className="flex justify-between gap-4">
        <span>{t.tier.replace("Tier ", "T")}</span>
        <span className="text-muted-foreground">{t.range}</span>
      </div>
    ))}
  </div>
);

const ImpactTooltip = () => (
  <div className="space-y-1">
    <p className="font-semibold mb-1">Impact Score (20% weight)</p>
    <p className="text-muted-foreground">Measures brand positioning based on:</p>
    <ul className="list-disc list-inside text-muted-foreground mt-1">
      <li>High reach score (60+)</li>
      <li>High engagement score (60+)</li>
      <li>Views vs platform median</li>
      <li>Combined excellence (80+)</li>
    </ul>
    <p className="mt-1">Scale: 1/5 to 5/5</p>
  </div>
);

const ScoreTooltip = () => (
  <div className="space-y-1">
    <p className="font-semibold mb-1">Performance Score</p>
    <p className="text-muted-foreground">Weighted formula:</p>
    <p className="font-mono text-xs mt-1">
      (Reach×0.4) + (Engage×0.3) + (Impact×0.2) + (Conv×0.1)
    </p>
    <p className="text-muted-foreground mt-1">Range: 0-100</p>
  </div>
);

const TierTooltip = () => (
  <div className="space-y-1">
    <p className="font-semibold mb-1">Performance Tier</p>
    <p className="text-muted-foreground mb-2">Based on total score</p>
    {PERFORMANCE_TIER_DEFINITIONS.map((t) => (
      <div key={t.tier} className="flex justify-between gap-4">
        <span>{t.tier}</span>
        <span className="text-muted-foreground">{t.range}</span>
      </div>
    ))}
  </div>
);
interface TopPerformingPostsProps {
  clientId: string;
  dateRange?: string; // e.g. "7d" | "30d" | "custom"
  customDateRange?: { start: Date; end: Date };
}

type RankingChoice = "all" | "instagram" | "facebook" | "tiktok" | "youtube" | "x";

const rankingLabels: Record<RankingChoice, string> = {
  all: "All Views",
  instagram: "IG Organic Views",
  facebook: "FB Views",
  tiktok: "TikTok Views",
  youtube: "YouTube Views",
  x: "X Impressions",
};

const formatNumber = (num: number): string => {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
};

export const TopPerformingPosts = ({ clientId, dateRange = "7d", customDateRange }: TopPerformingPostsProps) => {
  const [rankingChoice, setRankingChoice] = useState<RankingChoice>("all");
  
  // Show top posts from the selected date range, ranked by views
  const { data: allPosts, isLoading, error } = useTopPerformingPosts(clientId, dateRange, 10, customDateRange); // Fetch more, filter client-side
  
  // Filter and re-rank based on ranking choice
  const posts = allPosts
    ?.filter(post => rankingChoice === "all" || post.platform === rankingChoice)
    .slice(0, 3) || [];

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Top Performing Posts
          </CardTitle>
          <CardDescription>Sienvi Performance Index</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Top Performing Posts
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">Unable to load top posts.</p>
        </CardContent>
      </Card>
    );
  }

  if (!posts || posts.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Top Performing Posts
          </CardTitle>
          <CardDescription>Sienvi Performance Index</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            No content data available yet. Connect your social accounts and sync data to see top performing posts.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/60 shadow-md overflow-hidden bg-card/80 backdrop-blur-sm rounded-2xl">
      <CardHeader className="bg-muted/30 border-b border-border/40 pb-4 pt-5">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="flex items-center gap-2.5 text-lg font-heading tracking-tight">
            <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
              <TrendingUp className="h-4 w-4" />
            </div>
            Top Performing Posts
          </CardTitle>
          <div className="flex items-center gap-2">
            <Select value={rankingChoice} onValueChange={(v) => setRankingChoice(v as RankingChoice)}>
              <SelectTrigger className="w-[160px] h-8 text-xs">
                <SelectValue placeholder="Rank by..." />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(rankingLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value} className="text-xs">
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Badge variant="outline" className="text-xs">
              {(() => {
                if (dateRange === "custom" && customDateRange) {
                  const start = customDateRange.start;
                  const end = customDateRange.end;
                  if (start.getMonth() === end.getMonth()) {
                    return `${format(start, "MMM d")}-${format(end, "d")}`;
                  }
                  return `${format(start, "MMM d")} - ${format(end, "MMM d")}`;
                }
                const daysToSubtract = dateRange === "60d" ? 60 : dateRange === "30d" ? 30 : 7;
                const end = new Date();
                const start = subDays(end, daysToSubtract);
                if (start.getMonth() === end.getMonth()) {
                  return `${format(start, "MMM d")}-${format(end, "d")}`;
                }
                return `${format(start, "MMM d")} - ${format(end, "MMM d")}`;
              })()}
            </Badge>
          </div>
        </div>
        <CardDescription>Top 3 posts ranked by {rankingLabels[rankingChoice].toLowerCase()}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <TooltipProvider>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="pb-2 pr-4 font-medium text-muted-foreground">Post Link</th>
                  <th className="pb-2 px-3 font-medium text-muted-foreground">Date</th>
                  <th className="pb-2 px-3 font-medium text-muted-foreground text-right">Views</th>
                  <th className="pb-2 px-3 font-medium text-muted-foreground text-right">Engage %</th>
                  <th className="pb-2 px-3 font-medium text-muted-foreground">Platform</th>
                  <th className="pb-2 px-3 font-medium text-muted-foreground text-right">Followers</th>
                  <th className="pb-2 px-3 font-medium text-muted-foreground text-center">
                    <MetricTooltip content={<ReachTierTooltip />}>Reach Tier</MetricTooltip>
                  </th>
                  <th className="pb-2 px-3 font-medium text-muted-foreground text-center">
                    <MetricTooltip content={<EngageTierTooltip />}>Engage Tier</MetricTooltip>
                  </th>
                  <th className="pb-2 px-3 font-medium text-muted-foreground text-center">
                    <MetricTooltip content={<ImpactTooltip />}>Impact</MetricTooltip>
                  </th>
                  <th className="pb-2 px-3 font-medium text-muted-foreground text-right">
                    <MetricTooltip content={<ScoreTooltip />}>Score</MetricTooltip>
                  </th>
                  <th className="pb-2 pl-3 font-medium text-muted-foreground text-center">
                    <MetricTooltip content={<TierTooltip />}>Tier</MetricTooltip>
                  </th>
                </tr>
              </thead>
            <tbody>
              {posts.map((post) => (
                <tr
                  key={post.id}
                  className="border-b last:border-0 hover:bg-muted/50 transition-colors"
                >
                  {/* Post Link */}
                  <td className="py-3 pr-4">
                    {post.post_url ? (
                      <a
                        href={post.post_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-primary hover:underline flex items-center gap-1.5"
                      >
                        View Post
                        <ExternalLink className="h-3 w-3 flex-shrink-0" />
                      </a>
                    ) : (
                      <span className="text-muted-foreground italic text-xs">No URL</span>
                    )}
                  </td>

                  {/* Date */}
                  <td className="py-3 px-3 text-muted-foreground whitespace-nowrap">
                    {post.published_at ? format(new Date(post.published_at), "EEE, MMM d") : "-"}
                  </td>

                  {/* Views */}
                  <td className="py-3 px-3 text-right font-medium">{formatNumber(post.views)}</td>

                  {/* Engagement % */}
                  <td className="py-3 px-3 text-right">{post.engagement_percentage.toFixed(1)}%</td>

                  {/* Platform */}
                  <td className="py-3 px-3 text-muted-foreground">
                    {formatPlatformName(post.platform)}
                  </td>

                  {/* Followers */}
                  <td className="py-3 px-3 text-right text-muted-foreground">
                    {formatNumber(post.followers_at_post_time || 0)}
                  </td>

                  {/* Reach Tier */}
                  <td className="py-3 px-3 text-center">
                    <Badge 
                      variant="outline" 
                      className={`${getReachTierColor(post.reach_tier)} text-white text-xs`}
                    >
                      {post.reach_tier?.replace("Tier ", "T") || "-"}
                    </Badge>
                  </td>

                  {/* Engagement Tier */}
                  <td className="py-3 px-3 text-center">
                    <Badge 
                      variant="secondary" 
                      className={`${getEngagementTierColor(post.engagement_tier)} text-white text-xs`}
                    >
                      {post.engagement_tier?.replace("Tier ", "T") || "-"}
                    </Badge>
                  </td>

                  {/* Impact (Influence Score) */}
                  <td className="py-3 px-3 text-center font-medium">
                    {post.influence_score / 20}/5
                  </td>

                  {/* Total Score */}
                  <td className="py-3 px-3 text-right font-bold">{post.total_score}</td>

                  {/* Performance Tier */}
                  <td className="py-3 pl-3 text-center">
                    <Badge 
                      className={`${getPerformanceTierColor(post.performance_tier)} text-white text-xs`}
                    >
                      {post.performance_tier}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </TooltipProvider>
        </div>
      </CardContent>
    </Card>
  );
};
