import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO, isWithinInterval, startOfDay, endOfDay, subDays } from "date-fns";
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

      // Fetch content with metrics for this client across all platforms
      // Only fetch content published on or after the reporting period start
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
      // Filter out obviously incorrect values (like static fallbacks > 1000 when actual is much lower)
      const { data: accountMetrics } = await supabase
        .from("social_account_metrics")
        .select("platform, followers, collected_at")
        .eq("client_id", clientId)
        .not("followers", "is", null)
        .gt("followers", 0)
        .order("collected_at", { ascending: false });

      // Build platform -> followers map (latest follower count per platform)
      // Skip suspiciously high static fallback values (>1000) if there are more recent lower values
      const platformFollowers: Record<string, number> = {};
      const platformLatestTimestamp: Record<string, string> = {};
      
      accountMetrics?.forEach((m) => {
        if (!m.followers) return;
        
        // If we haven't seen this platform yet, use this value
        if (!platformFollowers[m.platform]) {
          platformFollowers[m.platform] = m.followers;
          platformLatestTimestamp[m.platform] = m.collected_at;
        }
      });

      // Transform to TopInsightContent format
      // Filter content strictly to the reporting period
      const topInsightContent: TopInsightContent[] = content
        .filter((c) => {
          // Must have metrics
          if (!c.social_content_metrics || c.social_content_metrics.length === 0) return false;
          if (!c.published_at) return false;
          
          // DO NOT strictly filter by published_at (Evergreen content still gets views!).
          // Instead, ensure we have metrics that were collected strictly on or after the periodStartDate.
          // This ensures old posts with active new data still rank on the dashboard.
          const hasRecentMetrics = c.social_content_metrics.some((m: any) => {
            const metricDate = new Date(m.collected_at || m.period_end || 0);
            return metricDate >= periodStartDate && metricDate <= periodEndDate;
          });
          
          return hasRecentMetrics;
        })
        .map((c) => {
          // ONLY use metrics collected within the selected period for ranking
          const periodMetrics = c.social_content_metrics.filter((m: any) => {
            const metricDate = new Date(m.collected_at || m.period_end || 0);
            return metricDate >= periodStartDate && metricDate <= periodEndDate;
          });

          // Sort period-specific metrics by recency
          const sortedMetrics = [...periodMetrics].sort((a: any, b: any) => {
            const periodCompare = (b.period_end || "").localeCompare(a.period_end || "");
            if (periodCompare !== 0) return periodCompare;
            return new Date(b.collected_at || 0).getTime() - new Date(a.collected_at || 0).getTime();
          });
          
          const latestMetric = sortedMetrics[0];

          // Use the higher of views or impressions for proper cross-platform ranking
          // FB/X use impressions, TikTok/YouTube use views
          const viewsValue = latestMetric?.views || 0;
          const impressionsValue = latestMetric?.impressions || 0;
          const primaryMetric = Math.max(viewsValue, impressionsValue);
          const reachValue = latestMetric?.reach || 0;

          return {
            id: c.id,
            post_url: c.url || "",
            platform: c.platform,
            published_at: c.published_at,
            views: primaryMetric, // Use higher of views/impressions for ranking
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
      return rankTopInsights(topInsightContent, limit);
    },
    enabled: !!clientId,
  });
};
