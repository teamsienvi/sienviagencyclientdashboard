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
        <CardDescription>Ranked by views from live analytics</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {/* Column Headers */}
          <div className="grid grid-cols-[1fr_80px_90px_80px_90px_80px_100px_70px] gap-2 px-3 py-2 text-xs font-medium text-muted-foreground border-b">
            <span>Post Link</span>
            <span className="text-right">Views</span>
            <span className="text-right">Engage %</span>
            <span className="text-center">Platform</span>
            <span className="text-right">Followers</span>
            <span className="text-center">Reach</span>
            <span className="text-center">Engage Tier</span>
            <span className="text-center">Impact</span>
          </div>

          {posts.map((post) => (
            <div
              key={post.id}
              className="grid grid-cols-[1fr_80px_90px_80px_90px_80px_100px_70px] gap-2 items-center p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
            >
              {/* Post Link */}
              <div className="min-w-0">
                {post.post_url ? (
                  <a
                    href={post.post_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium hover:underline flex items-center gap-1 truncate"
                  >
                    {post.post_url.length > 35 
                      ? `${post.post_url.substring(0, 35)}...` 
                      : post.post_url}
                    <ExternalLink className="h-3 w-3 flex-shrink-0" />
                  </a>
                ) : (
                  <span className="text-sm text-muted-foreground">No URL</span>
                )}
              </div>

              {/* Views */}
              <span className="text-sm font-medium text-right">{formatNumber(post.views)}</span>

              {/* Engagement % */}
              <span className="text-sm font-medium text-right">{post.engagement_percentage.toFixed(1)}%</span>

              {/* Platform */}
              <span className="text-lg text-center" title={post.platform}>
                {getPlatformIcon(post.platform)}
              </span>

              {/* Followers */}
              <span className="text-sm text-muted-foreground text-right">
                {formatNumber(post.followers_at_post_time || 0)}
              </span>

              {/* Reach Tier */}
              <Badge 
                variant="outline" 
                className={`${getReachTierColor(post.reach_tier)} text-white text-xs justify-center`}
              >
                {post.reach_tier?.replace('Tier ', 'T') || '-'}
              </Badge>

              {/* Engagement Tier */}
              <Badge 
                variant="secondary" 
                className={`${getEngagementTierColor(post.engagement_tier)} text-white text-xs justify-center`}
              >
                {post.engagement_tier || '-'}
              </Badge>

              {/* Impact Score */}
              <span className="text-sm font-medium text-center" title={`Impact: ${post.influence_score}/5`}>
                {post.influence_score}/5
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
