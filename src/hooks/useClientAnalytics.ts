import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { subDays, format } from "date-fns";

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
}

export interface TopPage {
  url?: string;
  path?: string;
  views: number;
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
  // External API format (sources/devices arrays)
  sources?: { source: string; count: number }[];
  devices?: { device: string; count: number }[];
  // Outbound click tracking (client-specific)
  airbnbClicks?: number;
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

export type DateRangePreset = "7d" | "30d" | "all" | "custom";

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
  dateRange = "7d",
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

      if (error) {
        throw new Error(error.message || "Failed to fetch analytics");
      }

      // Check if the response contains an error/not configured state
      if (data?.ok === false || data?.errorType) {
        return {
          clientId: data.clientId || clientId,
          clientName: data.clientName || '',
          analytics: null,
          dateRange: dates,
          errorType: data.errorType as AnalyticsErrorType,
          errorDetails: data.details || data.error,
        };
      }

      // Handle nested analytics structure from the edge function
      const analytics = data.analytics?.analytics || data.analytics;
      
      return {
        clientId: data.clientId,
        clientName: data.clientName,
        analytics,
        dateRange: data.dateRange,
      };
    },
    enabled: enabled && !!clientId,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    retry: 2,
  });
};

export const useMultipleClientAnalytics = (
  clientIds: string[],
  dateRange: DateRangePreset = "7d"
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
