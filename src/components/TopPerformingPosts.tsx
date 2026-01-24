import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ExternalLink, TrendingUp } from "lucide-react";
import { useTopPerformingPosts } from "@/hooks/useTopPerformingPosts";
import { 
  getEngagementTierColor, 
  getReachTierColor, 
  getPerformanceTierColor,
  formatPlatformName 
} from "@/utils/topPerformingInsights";
import { format } from "date-fns";
import { getCurrentReportingWeek, formatDateRange } from "@/utils/weeklyDateRange";

interface TopPerformingPostsProps {
  clientId: string;
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

export const TopPerformingPosts = ({ clientId }: TopPerformingPostsProps) => {
  const [rankingChoice, setRankingChoice] = useState<RankingChoice>("all");
  
  // Always show top 3 posts from last 7 days, ranked by views
  const { data: allPosts, isLoading, error } = useTopPerformingPosts(clientId, 10); // Fetch more, filter client-side
  
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
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
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
                const { start, end } = getCurrentReportingWeek();
                return formatDateRange(start, end);
              })()}
            </Badge>
          </div>
        </div>
        <CardDescription>Top 3 posts ranked by {rankingLabels[rankingChoice].toLowerCase()}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="pb-2 pr-4 font-medium text-muted-foreground">Post Link</th>
                <th className="pb-2 px-3 font-medium text-muted-foreground">Date</th>
                <th className="pb-2 px-3 font-medium text-muted-foreground text-right">Views</th>
                <th className="pb-2 px-3 font-medium text-muted-foreground text-right">Engage %</th>
                <th className="pb-2 px-3 font-medium text-muted-foreground">Platform</th>
                <th className="pb-2 px-3 font-medium text-muted-foreground text-right">Followers</th>
                <th className="pb-2 px-3 font-medium text-muted-foreground text-center">Reach Tier</th>
                <th className="pb-2 px-3 font-medium text-muted-foreground text-center">Engage Tier</th>
                <th className="pb-2 px-3 font-medium text-muted-foreground text-center">Impact</th>
                <th className="pb-2 px-3 font-medium text-muted-foreground text-right">Score</th>
                <th className="pb-2 pl-3 font-medium text-muted-foreground text-center">Tier</th>
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
                        className="font-medium hover:underline flex items-center gap-1 max-w-[200px] truncate"
                      >
                        <span className="truncate">
                          {post.post_url.length > 30 
                            ? `${post.post_url.substring(0, 30)}...` 
                            : post.post_url}
                        </span>
                        <ExternalLink className="h-3 w-3 flex-shrink-0" />
                      </a>
                    ) : (
                      <span className="text-muted-foreground">No URL</span>
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
        </div>
      </CardContent>
    </Card>
  );
};
