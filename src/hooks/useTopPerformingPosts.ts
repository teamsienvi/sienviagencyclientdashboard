import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { rankTopInsights, TopInsightContent, RankedTopInsight } from "@/utils/topPerformingInsights";
import { format } from "date-fns";
import { getCurrentReportingWeek } from "@/utils/weeklyDateRange";

export const useTopPerformingPosts = (clientId: string, limit: number = 3) => {
  return useQuery({
    queryKey: ["top-performing-posts", clientId, limit],
    queryFn: async (): Promise<RankedTopInsight[]> => {
      // Use the current reporting period (last completed Mon-Sun week)
      const { start, end } = getCurrentReportingWeek();
      const periodStartStr = format(start, "yyyy-MM-dd");
      const periodEndStr = format(end, "yyyy-MM-dd");

      // Fetch content with metrics for this client across all platforms
      // Filter by metrics period_end (most recent data collection) instead of published_at
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
        .order("published_at", { ascending: false })
        .limit(500);

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
      // Filter by metrics that have period_end within the reporting period
      const topInsightContent: TopInsightContent[] = content
        .filter((c) => {
          // Must have metrics
          if (!c.social_content_metrics || c.social_content_metrics.length === 0) return false;
          
          // Check if any metric has a period_end within the reporting period
          const hasRecentMetrics = c.social_content_metrics.some((m: any) => {
            if (!m.period_end) return false;
            // Metric period_end should be within or after the reporting period start
            return m.period_end >= periodStartStr && m.period_end <= periodEndStr;
          });
          
          return hasRecentMetrics;
        })
        .map((c) => {
          // Get the most recent metric (by period_end, then collected_at)
          const sortedMetrics = [...c.social_content_metrics].sort((a: any, b: any) => {
            // First by period_end descending
            const periodCompare = (b.period_end || "").localeCompare(a.period_end || "");
            if (periodCompare !== 0) return periodCompare;
            // Then by collected_at descending
            return new Date(b.collected_at || 0).getTime() - new Date(a.collected_at || 0).getTime();
          });
          
          const latestMetric = sortedMetrics[0];

          // Use views first, then impressions as fallback
          const viewsValue = latestMetric?.views || latestMetric?.impressions || 0;
          const reachValue = latestMetric?.reach || 0;

          return {
            id: c.id,
            post_url: c.url || "",
            platform: c.platform,
            published_at: c.published_at,
            views: viewsValue,
            reach: reachValue > 0 ? reachValue : viewsValue,
            likes: latestMetric?.likes || 0,
            comments: latestMetric?.comments || 0,
            shares: latestMetric?.shares || 0,
            followers_at_post_time: platformFollowers[c.platform] || 0,
          };
        })
        // Filter out posts with no views/impressions
        .filter((c) => c.views > 0);

      // Rank by views DESC and return top posts
      return rankTopInsights(topInsightContent, limit);
    },
    enabled: !!clientId,
  });
};
