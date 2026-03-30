import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// Types for social analytics data
export interface SocialAccountMetric {
  id: string;
  client_id: string;
  platform: string;
  followers: number;
  new_followers: number;
  engagement_rate: number;
  total_content: number;
  period_start: string;
  period_end: string;
  collected_at: string;
}

export interface SocialContent {
  id: string;
  client_id: string;
  platform: string;
  content_id: string;
  content_type: string;
  published_at: string;
  url: string | null;
  title: string | null;
}

export interface SocialContentMetric {
  id: string;
  social_content_id: string;
  platform: string;
  reach: number;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  interactions: number;
  impressions: number;
  engagements: number;
  profile_visits: number;
  link_clicks: number;
  watch_time_hours: number;
  subscribers: number;
  click_through_rate: number;
  period_start: string;
  period_end: string;
  collected_at: string;
}

export interface ContentWithMetrics extends SocialContent {
  metrics: SocialContentMetric | null;
}

// Hook to get analytics data source setting
export const useAnalyticsSource = () => {
  return useQuery({
    queryKey: ["analytics-source"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("feature_flags")
        .select("flag_value")
        .eq("flag_name", "analytics_source")
        .single();

      if (error) {
        console.error("Error fetching analytics source:", error);
        return "csv"; // Default to CSV on error
      }

      return data?.flag_value || "csv";
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

// Platform type for type safety
type PlatformType = "facebook" | "instagram" | "linkedin" | "tiktok" | "x" | "youtube";

// Hook to get social account metrics for a client
export const useSocialAccountMetrics = (clientId: string, platform?: string, periodStart?: string, periodEnd?: string) => {
  return useQuery({
    queryKey: ["social-account-metrics", clientId, platform, periodStart, periodEnd],
    queryFn: async () => {
      let query = supabase
        .from("social_account_metrics")
        .select("*")
        .eq("client_id", clientId)
        .order("collected_at", { ascending: false });

      if (platform) {
        query = query.eq("platform", platform as PlatformType);
      }

      if (periodStart && periodEnd) {
        query = query.gte("period_start", periodStart).lte("period_end", periodEnd);
      }

      const { data, error } = await query;

      if (error) {
        console.error("Error fetching social account metrics:", error);
        throw error;
      }

      return data as SocialAccountMetric[];
    },
    enabled: !!clientId,
  });
};

// Hook to get social content with metrics for a client
export const useSocialContentWithMetrics = (
  clientId: string,
  platform?: string,
  periodStart?: string,
  periodEnd?: string
) => {
  return useQuery({
    queryKey: ["social-content-metrics", clientId, platform, periodStart, periodEnd],
    queryFn: async () => {
      // First get content
      let contentQuery = supabase
        .from("social_content")
        .select("*")
        .eq("client_id", clientId)
        .order("published_at", { ascending: true });

      if (platform) {
        contentQuery = contentQuery.eq("platform", platform as PlatformType);
      }

      if (periodStart && periodEnd) {
        contentQuery = contentQuery
          .gte("published_at", `${periodStart}T00:00:00Z`)
          .lte("published_at", `${periodEnd}T23:59:59Z`);
      }

      const { data: content, error: contentError } = await contentQuery;

      if (contentError) {
        console.error("Error fetching social content:", contentError);
        throw contentError;
      }

      if (!content || content.length === 0) {
        return [];
      }

      // Get metrics for this content
      const contentIds = content.map((c) => c.id);
      
      let metricsQuery = supabase
        .from("social_content_metrics")
        .select("*")
        .in("social_content_id", contentIds);

      if (periodStart && periodEnd) {
        metricsQuery = metricsQuery
          .gte("period_start", periodStart)
          .lte("period_end", periodEnd);
      }

      const { data: metrics, error: metricsError } = await metricsQuery;

      if (metricsError) {
        console.error("Error fetching content metrics:", metricsError);
        throw metricsError;
      }

      // Merge content with their latest metrics
      const contentWithMetrics: ContentWithMetrics[] = content.map((c) => {
        const contentMetrics = metrics?.filter((m) => m.social_content_id === c.id) || [];
        const latestMetric = contentMetrics.sort(
          (a, b) => new Date(b.collected_at).getTime() - new Date(a.collected_at).getTime()
        )[0] || null;

        return {
          ...c,
          metrics: latestMetric as SocialContentMetric | null,
        };
      });

      return contentWithMetrics;
    },
    enabled: !!clientId,
  });
};

// Hook to get connected social accounts for a client
export const useSocialAccounts = (clientId: string) => {
  return useQuery({
    queryKey: ["social-accounts", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("social_accounts")
        .select("*")
        .eq("client_id", clientId)
        .eq("is_active", true);

      if (error) {
        console.error("Error fetching social accounts:", error);
        throw error;
      }

      return data;
    },
    enabled: !!clientId,
  });
};

// Hook to trigger manual sync
export const useTriggerSync = () => {
  const triggerSync = async (clientId?: string, platform?: string) => {
    const { data, error } = await supabase.functions.invoke("sync-social-analytics", {
      body: { clientId, platform, manual: true },
    });

    if (error) {
      console.error("Error triggering sync:", error);
      throw error;
    }

    return data;
  };

  return { triggerSync };
};

// Hook to get sync logs
export const useSyncLogs = (clientId?: string) => {
  return useQuery({
    queryKey: ["sync-logs", clientId],
    queryFn: async () => {
      let query = supabase
        .from("social_sync_logs")
        .select("*")
        .order("started_at", { ascending: false })
        .limit(50);

      if (clientId) {
        query = query.eq("client_id", clientId);
      }

      const { data, error } = await query;

      if (error) {
        console.error("Error fetching sync logs:", error);
        throw error;
      }

      return data;
    },
    enabled: true,
  });
};
