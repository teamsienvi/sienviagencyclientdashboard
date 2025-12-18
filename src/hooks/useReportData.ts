import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAnalyticsSource, useSocialAccountMetrics, useSocialContentWithMetrics } from "./useSocialAnalytics";

// Types matching existing dashboard structure
export interface PlatformDataDisplay {
  id: string;
  platform: string;
  followers: number;
  new_followers: number | null;
  engagement_rate: number | null;
  last_week_engagement_rate: number | null;
  total_content: number | null;
  last_week_total_content: number | null;
}

export interface PlatformContentDisplay {
  id: string;
  platform_data_id: string;
  content_type: string;
  post_date: string;
  reach: number | null;
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  interactions: number | null;
  impressions: number | null;
  engagements: number | null;
  profile_visits: number | null;
  link_clicks: number | null;
  duration: string | null;
  played_to_watch_percent: number | null;
  watch_time_hours: number | null;
  subscribers: number | null;
  click_through_rate: number | null;
}

// Hook to get unified platform data (works with both CSV and API sources)
export const useUnifiedPlatformData = (
  clientId: string,
  reportId?: string,
  periodStart?: string,
  periodEnd?: string
) => {
  const { data: analyticsSource } = useAnalyticsSource();
  
  // API-based data
  const apiMetrics = useSocialAccountMetrics(
    clientId,
    undefined,
    periodStart,
    periodEnd
  );

  // CSV-based data (from reports)
  const csvData = useQuery({
    queryKey: ["csv-platform-data", reportId],
    queryFn: async () => {
      if (!reportId) return [];

      const { data, error } = await supabase
        .from("platform_data")
        .select("*")
        .eq("report_id", reportId);

      if (error) {
        console.error("Error fetching CSV platform data:", error);
        throw error;
      }

      return data as PlatformDataDisplay[];
    },
    enabled: !!reportId && analyticsSource === "csv",
  });

  // Transform API data to match CSV structure
  const transformedApiData: PlatformDataDisplay[] = apiMetrics.data
    ? Object.values(
        apiMetrics.data.reduce((acc, metric) => {
          const key = metric.platform;
          if (!acc[key]) {
            acc[key] = {
              id: metric.id,
              platform: metric.platform.charAt(0).toUpperCase() + metric.platform.slice(1),
              followers: metric.followers,
              new_followers: metric.new_followers,
              engagement_rate: metric.engagement_rate,
              last_week_engagement_rate: null,
              total_content: metric.total_content,
              last_week_total_content: null,
            };
          }
          return acc;
        }, {} as Record<string, PlatformDataDisplay>)
      )
    : [];

  return {
    data: analyticsSource === "api" ? transformedApiData : csvData.data || [],
    isLoading: analyticsSource === "api" ? apiMetrics.isLoading : csvData.isLoading,
    error: analyticsSource === "api" ? apiMetrics.error : csvData.error,
    source: analyticsSource,
  };
};

// Hook to get unified content data (works with both CSV and API sources)
export const useUnifiedContentData = (
  clientId: string,
  platform: string,
  platformDataId?: string,
  periodStart?: string,
  periodEnd?: string
) => {
  const { data: analyticsSource } = useAnalyticsSource();

  // API-based data
  const apiContent = useSocialContentWithMetrics(
    clientId,
    platform.toLowerCase(),
    periodStart,
    periodEnd
  );

  // CSV-based data (from platform_content)
  const csvContent = useQuery({
    queryKey: ["csv-platform-content", platformDataId],
    queryFn: async () => {
      if (!platformDataId) return [];

      const { data, error } = await supabase
        .from("platform_content")
        .select("*")
        .eq("platform_data_id", platformDataId)
        .order("post_date", { ascending: true });

      if (error) {
        console.error("Error fetching CSV content:", error);
        throw error;
      }

      return data as PlatformContentDisplay[];
    },
    enabled: !!platformDataId && analyticsSource === "csv",
  });

  // Transform API data to match CSV structure
  const transformedApiContent: PlatformContentDisplay[] = apiContent.data
    ? apiContent.data.map((content) => ({
        id: content.id,
        platform_data_id: "", // Not used for API data
        content_type: content.content_type.charAt(0).toUpperCase() + content.content_type.slice(1),
        post_date: content.published_at.split("T")[0],
        reach: content.metrics?.reach || 0,
        views: content.metrics?.views || 0,
        likes: content.metrics?.likes || 0,
        comments: content.metrics?.comments || 0,
        shares: content.metrics?.shares || 0,
        interactions: content.metrics?.interactions || 0,
        impressions: content.metrics?.impressions || 0,
        engagements: content.metrics?.engagements || 0,
        profile_visits: content.metrics?.profile_visits || 0,
        link_clicks: content.metrics?.link_clicks || 0,
        duration: null,
        played_to_watch_percent: null,
        watch_time_hours: content.metrics?.watch_time_hours || 0,
        subscribers: content.metrics?.subscribers || 0,
        click_through_rate: content.metrics?.click_through_rate || 0,
      }))
    : [];

  return {
    data: analyticsSource === "api" ? transformedApiContent : csvContent.data || [],
    isLoading: analyticsSource === "api" ? apiContent.isLoading : csvContent.isLoading,
    error: analyticsSource === "api" ? apiContent.error : csvContent.error,
    source: analyticsSource,
  };
};

// Hook to toggle analytics source (admin only)
export const useToggleAnalyticsSource = () => {
  const toggle = async (newSource: "csv" | "api") => {
    const { error } = await supabase
      .from("feature_flags")
      .update({ flag_value: newSource, updated_at: new Date().toISOString() })
      .eq("flag_name", "analytics_source");

    if (error) {
      console.error("Error updating analytics source:", error);
      throw error;
    }

    return newSource;
  };

  return { toggle };
};
