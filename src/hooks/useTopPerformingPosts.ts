import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { rankTopInsights, TopInsightContent, RankedTopInsight } from "@/utils/topPerformingInsights";

export const useTopPerformingPosts = (clientId: string, limit: number = 3) => {
  return useQuery({
    queryKey: ["top-performing-posts", clientId, limit],
    queryFn: async (): Promise<RankedTopInsight[]> => {
      // Fetch content with metrics for this client
      const { data: content, error: contentError } = await supabase
        .from("social_content")
        .select(`
          id,
          platform,
          published_at,
          url,
          title,
          social_content_metrics (
            views,
            reach,
            likes,
            comments,
            shares
          )
        `)
        .eq("client_id", clientId)
        .order("published_at", { ascending: false })
        .limit(100);

      if (contentError) throw contentError;
      if (!content || content.length === 0) return [];

      // Get follower counts for each platform from social_account_metrics
      const { data: accountMetrics } = await supabase
        .from("social_account_metrics")
        .select("platform, followers")
        .eq("client_id", clientId)
        .order("collected_at", { ascending: false });

      // Build platform -> followers map (latest follower count per platform)
      const platformFollowers: Record<string, number> = {};
      accountMetrics?.forEach((m) => {
        if (!platformFollowers[m.platform] && m.followers) {
          platformFollowers[m.platform] = m.followers;
        }
      });

      // Transform to TopInsightContent format
      const topInsightContent: TopInsightContent[] = content
        .filter((c) => c.social_content_metrics && c.social_content_metrics.length > 0)
        .map((c) => {
          const metrics = c.social_content_metrics[0];
          return {
            id: c.id,
            post_url: c.url || "",
            platform: c.platform,
            published_at: c.published_at,
            views: metrics.views || 0,
            reach: metrics.reach || 0,
            likes: metrics.likes || 0,
            comments: metrics.comments || 0,
            shares: metrics.shares || 0,
            followers_at_post_time: platformFollowers[c.platform] || 0,
          };
        });

      // Sort by views (descending) and return top posts
      const sortedByViews = topInsightContent
        .sort((a, b) => b.views - a.views)
        .slice(0, limit);

      // Still apply ranking to get tiers and scores, but maintain view-based order
      const ranked = rankTopInsights(sortedByViews, limit);
      return ranked.sort((a, b) => b.views - a.views);
    },
    enabled: !!clientId,
  });
};
