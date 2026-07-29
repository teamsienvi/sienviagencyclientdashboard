/**
 * React Query hook for fetching OxiSure Retention App sales analytics.
 * Calls the server-side API route at /api/oxisure-sales.
 */
import { useQuery } from "@tanstack/react-query";
import type { OxiOrderStats } from "@/types/oxisure";

type TimeRange = "7d" | "30d" | "90d" | "all";

/**
 * Fetches OxiSure sales stats from the API route.
 * @param range — Time range for ordersOverTime series.
 */
export function useOxiSureStats(range: TimeRange = "30d") {
  return useQuery<OxiOrderStats>({
    queryKey: ["oxisure-sales", range],
    queryFn: async () => {
      const res = await fetch(`/api/oxisure-sales?range=${range}`);
      if (!res.ok) {
        throw new Error(`OxiSure sales fetch failed: ${res.status}`);
      }
      return res.json();
    },
    staleTime: 60_000,        // 60 seconds — fresh data on each visit
    gcTime: 5 * 60_000,       // 5-minute garbage collection
    refetchOnWindowFocus: false,
  });
}
