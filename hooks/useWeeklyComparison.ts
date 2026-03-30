import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { subDays, format, startOfDay } from "date-fns";
import type { Database } from "@/integrations/supabase/types";

type PlatformType = Database["public"]["Enums"]["platform_type"];

export interface WeeklyMetrics {
  followers: number | null;
  newFollowers: number | null;
  totalViews: number | null;
  totalLikes: number | null;
  engagementRate: number | null;
  totalPosts: number | null;
}

export interface WeeklyComparison {
  platform: string;
  current: WeeklyMetrics;
  previous: WeeklyMetrics;
  changes: {
    followers: { delta: number; percent: number | null };
    newFollowers: { delta: number; percent: number | null };
    views: { delta: number; percent: number | null };
    likes: { delta: number; percent: number | null };
    engagementRate: { delta: number }; // percentage points
    posts: { delta: number; percent: number | null };
  };
}

const toDateStr = (d: Date) => format(d, "yyyy-MM-dd");

// Get rolling 7-day windows
const getWeeklyPeriods = () => {
  const now = new Date();
  const today = startOfDay(now);
  
  // Current week: last 7 days (today - 6 days to today)
  const currentEnd = today;
  const currentStart = subDays(today, 6);
  
  // Previous week: 7 days before that
  const previousEnd = subDays(currentStart, 1);
  const previousStart = subDays(previousEnd, 6);
  
  return {
    current: {
      start: toDateStr(currentStart),
      end: toDateStr(currentEnd),
    },
    previous: {
      start: toDateStr(previousStart),
      end: toDateStr(previousEnd),
    },
  };
};

const calculateChange = (current: number | null, previous: number | null): { delta: number; percent: number | null } => {
  const curr = current ?? 0;
  const prev = previous ?? 0;
  const delta = curr - prev;
  const percent = prev !== 0 ? ((curr - prev) / prev) * 100 : null;
  return { delta, percent };
};

export const useWeeklyComparison = (clientId: string, platform?: PlatformType) => {
  return useQuery({
    queryKey: ["weekly-comparison", clientId, platform],
    queryFn: async (): Promise<WeeklyComparison[]> => {
      const periods = getWeeklyPeriods();
      const allPlatforms: PlatformType[] = ["instagram", "facebook", "tiktok", "x", "linkedin", "youtube"];
      const platforms: PlatformType[] = platform ? [platform] : allPlatforms;
      const results: WeeklyComparison[] = [];

      for (const plat of platforms) {
        // Fetch account metrics for both periods
        const { data: currentMetrics } = await supabase
          .from("social_account_metrics")
          .select("*")
          .eq("client_id", clientId)
          .eq("platform", plat)
          .gte("period_start", periods.current.start)
          .lte("period_end", periods.current.end)
          .order("collected_at", { ascending: false })
          .limit(1);

        const { data: previousMetrics } = await supabase
          .from("social_account_metrics")
          .select("*")
          .eq("client_id", clientId)
          .eq("platform", plat)
          .gte("period_start", periods.previous.start)
          .lte("period_end", periods.previous.end)
          .order("collected_at", { ascending: false })
          .limit(1);

        // Fetch content for both periods to calculate views/likes/posts
        const { data: currentContent } = await supabase
          .from("social_content")
          .select("id, published_at")
          .eq("client_id", clientId)
          .eq("platform", plat)
          .gte("published_at", periods.current.start)
          .lte("published_at", periods.current.end + "T23:59:59");

        const { data: previousContent } = await supabase
          .from("social_content")
          .select("id, published_at")
          .eq("client_id", clientId)
          .eq("platform", plat)
          .gte("published_at", periods.previous.start)
          .lte("published_at", periods.previous.end + "T23:59:59");

        // Fetch content metrics for current period
        let currentViews = 0, currentLikes = 0;
        if (currentContent && currentContent.length > 0) {
          const contentIds = currentContent.map(c => c.id);
          const { data: contentMetrics } = await supabase
            .from("social_content_metrics")
            .select("views, likes, impressions")
            .in("social_content_id", contentIds);

          if (contentMetrics) {
            currentViews = contentMetrics.reduce((sum, m) => sum + (m.views || m.impressions || 0), 0);
            currentLikes = contentMetrics.reduce((sum, m) => sum + (m.likes || 0), 0);
          }
        }

        // Fetch content metrics for previous period
        let previousViews = 0, previousLikes = 0;
        if (previousContent && previousContent.length > 0) {
          const contentIds = previousContent.map(c => c.id);
          const { data: contentMetrics } = await supabase
            .from("social_content_metrics")
            .select("views, likes, impressions")
            .in("social_content_id", contentIds);

          if (contentMetrics) {
            previousViews = contentMetrics.reduce((sum, m) => sum + (m.views || m.impressions || 0), 0);
            previousLikes = contentMetrics.reduce((sum, m) => sum + (m.likes || 0), 0);
          }
        }

        const currM = currentMetrics?.[0];
        const prevM = previousMetrics?.[0];

        // Skip platform if no data at all
        if (!currM && !prevM && (!currentContent || currentContent.length === 0) && (!previousContent || previousContent.length === 0)) {
          continue;
        }

        const current: WeeklyMetrics = {
          followers: currM?.followers ?? null,
          newFollowers: currM?.new_followers ?? null,
          totalViews: currentViews || null,
          totalLikes: currentLikes || null,
          engagementRate: currM?.engagement_rate ?? null,
          totalPosts: currentContent?.length ?? null,
        };

        const previous: WeeklyMetrics = {
          followers: prevM?.followers ?? null,
          newFollowers: prevM?.new_followers ?? null,
          totalViews: previousViews || null,
          totalLikes: previousLikes || null,
          engagementRate: prevM?.engagement_rate ?? null,
          totalPosts: previousContent?.length ?? null,
        };

        results.push({
          platform: plat,
          current,
          previous,
          changes: {
            followers: calculateChange(current.followers, previous.followers),
            newFollowers: calculateChange(current.newFollowers, previous.newFollowers),
            views: calculateChange(current.totalViews, previous.totalViews),
            likes: calculateChange(current.totalLikes, previous.totalLikes),
            engagementRate: {
              delta: (current.engagementRate ?? 0) - (previous.engagementRate ?? 0),
            },
            posts: calculateChange(current.totalPosts, previous.totalPosts),
          },
        });
      }

      return results;
    },
    enabled: !!clientId,
    staleTime: 5 * 60 * 1000,
  });
};

// Hook to get the weekly periods for display
export const useWeeklyPeriods = () => {
  return getWeeklyPeriods();
};
