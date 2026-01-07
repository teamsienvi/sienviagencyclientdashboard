import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ExternalLink, TrendingUp } from "lucide-react";
import { useTopPerformingPosts } from "@/hooks/useTopPerformingPosts";
import { getEngagementTierColor, getReachTierColor, getInfluenceDisplay } from "@/utils/topPerformingInsights";

interface TopPerformingPostsProps {
  clientId: string;
}

const formatNumber = (num: number): string => {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
};

const getPlatformIcon = (platform: string): string => {
  const icons: Record<string, string> = {
    youtube: "🎬",
    tiktok: "🎵",
    instagram: "📸",
    facebook: "📘",
    x: "𝕏",
    linkedin: "💼",
  };
  return icons[platform.toLowerCase()] || "📱";
};

export const TopPerformingPosts = ({ clientId }: TopPerformingPostsProps) => {
  const { data: posts, isLoading, error } = useTopPerformingPosts(clientId);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Top Performing Posts
          </CardTitle>
          <CardDescription>Based on live analytics data</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
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
          <CardDescription>Based on live analytics data</CardDescription>
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
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Top Performing Posts
        </CardTitle>
        <CardDescription>Ranked by engagement percentage from live analytics</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {posts.map((post, index) => (
            <div
              key={post.id}
              className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
            >
              <span className="text-sm font-medium text-muted-foreground w-6">
                #{index + 1}
              </span>
              
              <span className="text-lg" title={post.platform}>
                {getPlatformIcon(post.platform)}
              </span>

              <div className="flex-1 min-w-0">
                {post.post_url ? (
                  <a
                    href={post.post_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium hover:underline flex items-center gap-1 truncate"
                  >
                    {post.post_url.length > 40 
                      ? `${post.post_url.substring(0, 40)}...` 
                      : post.post_url}
                    <ExternalLink className="h-3 w-3 flex-shrink-0" />
                  </a>
                ) : (
                  <span className="text-sm text-muted-foreground">No URL</span>
                )}
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                <div className="text-right">
                  <span className="text-sm font-medium">{formatNumber(post.views)}</span>
                  <span className="text-xs text-muted-foreground ml-1">views</span>
                </div>

                <Badge 
                  variant="secondary" 
                  className={`${getEngagementTierColor(post.engagement_tier)} text-white text-xs`}
                >
                  {post.engagement_percentage.toFixed(1)}%
                </Badge>

                <Badge 
                  variant="outline" 
                  className={`${getReachTierColor(post.reach_tier)} text-white text-xs`}
                >
                  {post.reach_tier}
                </Badge>

                <span className="text-yellow-500 text-sm" title={`Influence: ${post.influence_score}/5`}>
                  {getInfluenceDisplay(post.influence_score)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
