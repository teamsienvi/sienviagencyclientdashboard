import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { startOfDay, endOfDay } from "date-fns";
import { rankTopInsights, TopInsightContent, RankedTopInsight } from "@/utils/topPerformingInsights";
import { getDashboardDateRange, type DateRangePreset } from "@/utils/dashboardDateRange";

export function useTopPerformingPosts(
  clientId: string | undefined,
  dateRange: string = "7d",
  limit: number = 3,
  customRange?: { start: Date; end: Date }
) {
  return useQuery({
    queryKey: ["top-performing-posts", clientId, dateRange, customRange?.start?.toISOString(), customRange?.end?.toISOString(), limit],
    queryFn: async (): Promise<RankedTopInsight[]> => {
      if (!clientId) return [];

      let periodStartDate: Date;
      let periodEndDate: Date;

      if (dateRange === "custom" && customRange) {
        periodStartDate = startOfDay(customRange.start);
        periodEndDate = endOfDay(customRange.end);
      } else {
        const range = getDashboardDateRange(dateRange as DateRangePreset);
        periodStartDate = range.start;
        periodEndDate = endOfDay(range.end);
      }

      const periodStartStr = periodStartDate.toISOString().split("T")[0];
      const periodEndStr = periodEndDate.toISOString().split("T")[0];

      // Only return posts published within the reporting period.
      // Filter by published_at on the join so old videos whose metrics got refreshed
      // this week are excluded from Top Content.
      // Note: We do NOT filter by collected_at or period_end — the published_at filter
      // already correctly scopes to posts within the reporting window, and older
      // sync periods' metrics are still valid for ranking.
      let metricsQuery = supabase
        .from("social_content_metrics")
        .select(`
          views,
          impressions,
          reach,
          likes,
          comments,
          shares,
          period_end,
          collected_at,
          platform,
          social_content!inner (
            id,
            client_id,
            platform,
            published_at,
            url,
            title
          )
        `)
        .eq("social_content.client_id", clientId)
        .gte("social_content.published_at", periodStartStr)
        .lte("social_content.published_at", periodEndStr)
        .limit(2000);

      let { data: metricsRaw, error: contentError } = await metricsQuery;

      if (contentError) throw contentError;
      
      if (!metricsRaw || metricsRaw.length === 0) {
        // Fallback: query via published_at directly
        const { data: fallbackContent } = await supabase
          .from("social_content")
          .select(`
            id,
            client_id,
            platform,
            published_at,
            url,
            title,
            social_content_metrics (
              views, impressions, reach, likes, comments, shares, period_end, collected_at
            )
          `)
          .eq("client_id", clientId)
          .gte("published_at", periodStartStr)
          .lte("published_at", periodEndStr)
          .order('published_at', { ascending: false })
          .limit(200);

        if (fallbackContent && fallbackContent.length > 0) {
            metricsRaw = fallbackContent.flatMap((post: any) => {
                if (!post.social_content_metrics || post.social_content_metrics.length === 0) return [];
                const latestMetric = [...post.social_content_metrics].sort((a: any, b: any) =>
                    new Date(b.collected_at || 0).getTime() - new Date(a.collected_at || 0).getTime()
                )[0];
                return [{
                    ...latestMetric,
                    social_content: {
                        id: post.id,
                        client_id: post.client_id,
                        platform: post.platform,
                        published_at: post.published_at,
                        url: post.url,
                        title: post.title
                    }
                }];
            });
        }
      }

      if (!metricsRaw || metricsRaw.length === 0) return [];

      // Deduplicate: for each post, keep only the row with the latest period_end
      const groupedByPost: Record<string, any> = {};
      metricsRaw.forEach((row: any) => {
        const key = row.social_content?.id;
        if (!key) return;
        const existing = groupedByPost[key];
        if (!existing || (row.period_end || "") > (existing.period_end || "")) {
          groupedByPost[key] = row;
        }
      });

      const dedupedRows = Object.values(groupedByPost);

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

      // Transform deduplicated metrics to the TopInsightContent format
      const topInsightContent: TopInsightContent[] = dedupedRows
        .map((row: any) => {
          const content = row.social_content;
          const viewsValue = row.views || 0;
          const impressionsValue = row.impressions || 0;
          const primaryMetric = Math.max(viewsValue, impressionsValue);
          const reachValue = row.reach || 0;

          return {
            id: content.id,
            post_url: content.url || "",
            title: content.title || null,
            platform: content.platform,
            published_at: content.published_at,
            views: primaryMetric,
            reach: reachValue > 0 ? reachValue : primaryMetric,
            likes: row.likes || 0,
            comments: row.comments || 0,
            shares: row.shares || 0,
            followers_at_post_time: platformFollowers[content.platform] || 0,
          };
        })
        .filter((c) => c.views > 0);

      return rankTopInsights(topInsightContent, limit);
    },
    enabled: !!clientId,
  });
};
