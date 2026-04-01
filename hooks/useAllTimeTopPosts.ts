import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { rankTopInsights, TopInsightContent, RankedTopInsight } from "@/utils/topPerformingInsights";

export function useAllTimeTopPosts(
  clientId: string | undefined,
  limit: number = 3,
  platformFilter?: string | string[]
) {
  return useQuery({
    queryKey: ["all-time-top-posts", clientId, limit, platformFilter],
    queryFn: async (): Promise<RankedTopInsight[]> => {
      if (!clientId) return [];

      let query = supabase
        .from("social_content")
        .select(`
          id,
          platform,
          published_at,
          url,
          title,
          social_content_metrics (
            collected_at,
            period_start,
            period_end,
            views,
            reach,
            impressions,
            likes,
            comments,
            shares,
            engagements
          )
        `)
        .eq("client_id", clientId)
        .limit(2000);

      // Apply platform filtering if specified
      if (platformFilter) {
        if (Array.isArray(platformFilter)) {
          query = query.in("platform", platformFilter as any[]);
        } else {
          query = query.eq("platform", platformFilter as any);
        }
      }

      const { data: content, error: contentError } = await query;

      if (contentError) throw contentError;
      if (!content || content.length === 0) return [];

      // Get follower counts for each platform from social_account_metrics
      const { data: accountMetrics } = await supabase
        .from("social_account_metrics")
        .select("platform, followers, collected_at")
        .eq("client_id", clientId)
        .not("followers", "is", null)
        .gt("followers", 0)
        .order("collected_at", { ascending: false });

      // Build platform -> followers map (latest follower count per platform)
      const platformFollowers: Record<string, number> = {};
      
      accountMetrics?.forEach((m) => {
        if (!m.followers) return;
        if (!platformFollowers[m.platform]) {
          platformFollowers[m.platform] = m.followers;
        }
      });

      // Transform to TopInsightContent format
      const topInsightContent: TopInsightContent[] = content
        .filter((c) => {
          // Must have metrics
          if (!c.social_content_metrics || c.social_content_metrics.length === 0) return false;
          if (!c.published_at) return false;
          return true;
        })
        .map((c) => {
          // Get the most recent metric (by period_end, then collected_at)
          const sortedMetrics = [...c.social_content_metrics].sort((a: any, b: any) => {
            const periodCompare = (b.period_end || "").localeCompare(a.period_end || "");
            if (periodCompare !== 0) return periodCompare;
            return new Date(b.collected_at || 0).getTime() - new Date(a.collected_at || 0).getTime();
          });
          
          const latestMetric = sortedMetrics[0];

          // Use the higher of views or impressions for proper cross-platform ranking
          const viewsValue = latestMetric?.views || 0;
          const impressionsValue = latestMetric?.impressions || 0;
          const primaryMetric = Math.max(viewsValue, impressionsValue);
          const reachValue = latestMetric?.reach || 0;

          return {
            id: c.id,
            post_url: c.url || "",
            platform: c.platform,
            published_at: c.published_at,
            views: primaryMetric,
            reach: reachValue > 0 ? reachValue : primaryMetric,
            likes: latestMetric?.likes || 0,
            comments: latestMetric?.comments || 0,
            shares: latestMetric?.shares || 0,
            followers_at_post_time: platformFollowers[c.platform] || 0,
          };
        })
        // Filter out posts with no views/impressions
        .filter((c) => c.views > 0);

      // Rank by views DESC and return top posts
      // Sienvi engine handles scoring and sorting by views
      return rankTopInsights(topInsightContent, limit);
    },
    enabled: !!clientId,
    staleTime: 15 * 60 * 1000, // cache for 15 minutes
  });
}
