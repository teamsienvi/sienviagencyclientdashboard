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
            collected_at,
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
          const latestMetric = [...c.social_content_metrics].sort(
            (a: any, b: any) =>
              new Date(b.collected_at || 0).getTime() - new Date(a.collected_at || 0).getTime()
          )[0];

          return {
            id: c.id,
            post_url: c.url || "",
            platform: c.platform,
            published_at: c.published_at,
            views: latestMetric?.views || 0,
            reach: latestMetric?.reach || 0,
            likes: latestMetric?.likes || 0,
            comments: latestMetric?.comments || 0,
            shares: latestMetric?.shares || 0,
            followers_at_post_time: platformFollowers[c.platform] || 0,
          };
        });

      // Rank using Sienvi Performance Index and return top posts
      // rankTopInsights now sorts by total_score DESC, then views DESC
      return rankTopInsights(topInsightContent, limit);
    },
    enabled: !!clientId,
  });
};
