import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { subDays, format } from "date-fns";
import { fetchLocalWebAnalyticsFallback } from "@/lib/analytics/localWebAnalyticsFallback";

export interface TrafficSource {
  source: string;
  visitors?: number;
  sessions?: number;
  percentage: number;
}

export interface DeviceBreakdown {
  device: string;
  visitors?: number;
  sessions?: number;
  percentage: number;
}

export interface DailyBreakdown {
  date: string;
  visitors?: number;
  sessions?: number;
  pageViews: number;
  bounceRate?: number;
  avgDuration?: number;
}

export interface TopPage {
  url?: string;
  path?: string;
  views: number;
  uniqueVisitors?: number;
}

export interface BrowserBreakdown {
  browser: string;
  sessions?: number;
  percentage: number;
}

export interface AnalyticsSummary {
  totalSessions?: number;
  totalPageViews?: number;
  uniqueVisitors?: number;
  bounceRate?: number;
  avgPagesPerSession?: number;
  avgSessionDuration?: number;
}

export interface AnalyticsData {
  // Legacy format (external sources)
  visitors?: number;
  pageViews?: number;
  avgDuration?: number;
  bounceRate?: number;
  pagesPerVisit?: number;
  totalSessions?: number;
  // Alternative field names from different get-analytics implementations
  uniqueVisitors?: number;
  totalPageViews?: number;
  avgSessionDuration?: number;
  // New format (local analytics)
  summary?: AnalyticsSummary;
  trafficSources?: TrafficSource[];
  deviceBreakdown?: DeviceBreakdown[];
  dailyBreakdown?: DailyBreakdown[];
  topPages?: TopPage[];
  browsers?: BrowserBreakdown[];
  countries?: { country: string; count: number; sessions?: number }[];
  // External API format (sources/devices arrays)
  sources?: { source: string; count: number }[];
  devices?: { device: string; count: number }[];
  // Outbound click tracking (client-specific)
  airbnbClicks?: number;
  amazonClicks?: number;
  // Extended metrics from external analytics APIs
  avgScrollDepth?: number;
  dailyTimeSeries?: { date: string; visitors: number; pageViews: number; sessions?: number }[];
  breakdowns?: {
    countries?: { key: string; value: number }[];
    devices?: { key: string; value: number }[];
    os?: { key: string; value: number }[];
    browsers?: { key: string; value: number }[];
    sources?: { key: string; value: number }[];
    top_pages?: { key: string; value: number }[];
  };
}

export type AnalyticsErrorType =
  | 'not_configured'
  | 'inactive'
  | 'auth_failed'
  | 'no_endpoint'
  | 'server_error'
  | 'fetch_failed'
  | 'no_data';

export interface ClientAnalyticsResponse {
  clientId: string;
  clientName: string;
  analytics: AnalyticsData | null;
  dateRange: {
    startDate: string;
    endDate: string;
  };
  errorType?: AnalyticsErrorType;
  errorDetails?: string;
}

export type DateRangePreset = "7d" | "30d" | "90d" | "365d" | "all" | "custom";

interface UseClientAnalyticsOptions {
  clientId: string;
  dateRange?: DateRangePreset;
  startDate?: Date;
  endDate?: Date;
  enabled?: boolean;
}

const getDateRange = (
  preset: DateRangePreset,
  customStart?: Date,
  customEnd?: Date
): { startDate: string; endDate: string } => {
  const end = customEnd || new Date();
  let start: Date;

  switch (preset) {
    case "7d":
      start = subDays(end, 7);
      break;
    case "30d":
      start = subDays(end, 30);
      break;
    case "90d":
      start = subDays(end, 90);
      break;
    case "365d":
      start = subDays(end, 365);
      break;
    case "all":
      // Use a very old start date to capture all data
      start = new Date("2020-01-01");
      break;
    case "custom":
      start = customStart || subDays(end, 7);
      break;
    default:
      start = subDays(end, 7);
  }

  return {
    startDate: format(start, "yyyy-MM-dd"),
    endDate: format(end, "yyyy-MM-dd"),
  };
};

export const useClientAnalytics = ({
  clientId,
  dateRange = "30d",
  startDate,
  endDate,
  enabled = true,
}: UseClientAnalyticsOptions) => {
  const dates = getDateRange(dateRange, startDate, endDate);

  return useQuery({
    queryKey: ["client-analytics", clientId, dates.startDate, dates.endDate],
    queryFn: async (): Promise<ClientAnalyticsResponse> => {
      const { data, error } = await supabase.functions.invoke("fetch-client-analytics", {
        body: {
          clientId,
          startDate: dates.startDate,
          endDate: dates.endDate,
        },
      });

      if (error || data?.ok === false || data?.errorType) {
        if (data?.errorType === "inactive") {
          return {
            clientId: data.clientId || clientId,
            clientName: data.clientName || "",
            analytics: null,
            dateRange: dates,
            errorType: "inactive",
            errorDetails: data.details || data.error,
          };
        }
        try {
          const fallback = await fetchLocalWebAnalyticsFallback(
            clientId,
            dates.startDate,
            dates.endDate
          );
          return {
            clientId: fallback.clientId,
            clientName: fallback.clientName,
            analytics: fallback.analytics,
            dateRange: fallback.dateRange,
          };
        } catch {
          if (error) {
            throw new Error(error.message || "Failed to fetch analytics");
          }
          return {
            clientId: data?.clientId || clientId,
            clientName: data?.clientName || "",
            analytics: null,
            dateRange: dates,
            errorType: data?.errorType as AnalyticsErrorType,
            errorDetails: data?.details || data?.error,
          };
        }
      }

      // Handle nested analytics structure from the edge function
      let analytics = data.analytics?.analytics || data.analytics;
      let effectiveDateRange = data.dateRange || dates;

      const totalSessions =
        analytics?.summary?.totalSessions ?? analytics?.totalSessions ?? 0;
      const totalPageViews =
        analytics?.summary?.totalPageViews ?? analytics?.pageViews ?? 0;

      if (totalSessions === 0 && totalPageViews === 0) {
        try {
          const localFallback = await fetchLocalWebAnalyticsFallback(
            clientId,
            dates.startDate,
            dates.endDate
          );
          if (
            (localFallback.analytics.totalSessions || 0) > 0 ||
            (localFallback.analytics.totalPageViews || 0) > 0
          ) {
            return {
              clientId: localFallback.clientId,
              clientName: localFallback.clientName,
              analytics: localFallback.analytics,
              dateRange: localFallback.dateRange,
            };
          }
        } catch {
          // ignore local fallback error
        }

        // If 7d window has 0 GA4 sessions (e.g. during a recent tag recovery), fall back to 30d GA4 data
        if (dateRange === "7d") {
          const dates30 = getDateRange("30d");
          const { data: data30, error: err30 } = await supabase.functions.invoke(
            "fetch-client-analytics",
            {
              body: {
                clientId,
                startDate: dates30.startDate,
                endDate: dates30.endDate,
              },
            }
          );
          if (!err30 && data30?.ok !== false && !data30?.errorType) {
            const analytics30 = data30.analytics?.analytics || data30.analytics;
            const s30 =
              analytics30?.summary?.totalSessions ?? analytics30?.totalSessions ?? 0;
            if (s30 > 0) {
              analytics = analytics30;
              effectiveDateRange = data30.dateRange || dates30;
            }
          }
        }
      }

      return {
        clientId: data.clientId,
        clientName: data.clientName,
        analytics,
        dateRange: effectiveDateRange,
      };
    },
    enabled: enabled && !!clientId,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    retry: 2,
  });
};

export const useMultipleClientAnalytics = (
  clientIds: string[],
  dateRange: DateRangePreset = "30d"
) => {
  const dates = getDateRange(dateRange);

  return useQuery({
    queryKey: ["all-client-analytics", clientIds, dates.startDate, dates.endDate],
    queryFn: async (): Promise<ClientAnalyticsResponse[]> => {
      const results = await Promise.all(
        clientIds.map(async (clientId) => {
          try {
            const { data, error } = await supabase.functions.invoke("fetch-client-analytics", {
              body: {
                clientId,
                startDate: dates.startDate,
                endDate: dates.endDate,
              },
            });

            if (error) {
              console.error(`Failed to fetch analytics for client ${clientId}:`, error);
              return null;
            }

            return data;
          } catch (err) {
            console.error(`Error fetching analytics for client ${clientId}:`, err);
            return null;
          }
        })
      );

      return results.filter(Boolean) as ClientAnalyticsResponse[];
    },
    enabled: clientIds.length > 0,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
};
