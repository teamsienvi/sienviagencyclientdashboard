import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { subDays, format } from "date-fns";

export interface TrafficSource {
  source: string;
  visitors: number;
  percentage: number;
}

export interface DeviceBreakdown {
  device: string;
  visitors: number;
  percentage: number;
}

export interface DailyBreakdown {
  date: string;
  visitors: number;
  pageViews: number;
}

export interface AnalyticsData {
  visitors: number;
  pageViews: number;
  avgDuration: number;
  bounceRate: number;
  pagesPerVisit: number;
  totalSessions?: number;
  trafficSources?: TrafficSource[];
  deviceBreakdown?: DeviceBreakdown[];
  dailyBreakdown?: DailyBreakdown[];
}

export interface ClientAnalyticsResponse {
  clientId: string;
  clientName: string;
  analytics: AnalyticsData;
  dateRange: {
    startDate: string;
    endDate: string;
  };
}

type DateRangePreset = "7d" | "30d" | "custom";

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

      // Check if the response contains an error from the client's endpoint
      if (data?.error) {
        const status = data.status || "unknown";
        const errorMessage = status === 401 
          ? `Unauthorized (401) - Check API key configuration`
          : status === 404
          ? `Endpoint not found (404)`
          : `Error ${status}: ${data.error}`;
        throw new Error(errorMessage);
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
