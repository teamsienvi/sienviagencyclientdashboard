import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { subDays, format } from "date-fns";
import type { ClientAnalyticsResponse, DateRangePreset, AnalyticsErrorType } from "./useClientAnalytics";

interface UseSubstackAnalyticsOptions {
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
    case "7d":   start = subDays(end, 7); break;
    case "30d":  start = subDays(end, 30); break;
    case "90d":  start = subDays(end, 90); break;
    case "365d": start = subDays(end, 365); break;
    case "all":  start = new Date("2020-01-01"); break;
    case "custom": start = customStart || subDays(end, 7); break;
    default: start = subDays(end, 7);
  }

  return {
    startDate: format(start, "yyyy-MM-dd"),
    endDate: format(end, "yyyy-MM-dd"),
  };
};

export const useSubstackAnalytics = ({
  clientId,
  dateRange = "7d",
  startDate,
  endDate,
  enabled = true,
}: UseSubstackAnalyticsOptions) => {
  const dates = getDateRange(dateRange, startDate, endDate);

  return useQuery({
    queryKey: ["substack-analytics", clientId, dates.startDate, dates.endDate],
    queryFn: async (): Promise<ClientAnalyticsResponse> => {
      const { data, error } = await supabase.functions.invoke("fetch-substack-ga4", {
        body: {
          clientId,
          startDate: dates.startDate,
          endDate: dates.endDate,
        },
      });

      if (error) {
        throw new Error(error.message || "Failed to fetch Substack analytics");
      }

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

      const analytics = data.analytics?.analytics || data.analytics;

      return {
        clientId: data.clientId,
        clientName: data.clientName,
        analytics,
        dateRange: data.dateRange,
      };
    },
    enabled: enabled && !!clientId,
    staleTime: 5 * 60 * 1000,
    retry: 2,
  });
};
