import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PlatformMetric {
    platform: string;
    views: number;
    engagements: number;
    engagementRate: number;
}

export interface TimelineDataPoint {
    date: string;
    views: number;
    engagement: number;
}

export function useSummaryMetrics(clientId: string, dateRange: string = "7d", customDateRange?: { start: Date; end: Date }) {
    return useQuery({
        queryKey: ["summary-metrics", clientId, dateRange, customDateRange?.start, customDateRange?.end],
        queryFn: async (): Promise<{ totalViews: number; totalEngagements: number; platformData: PlatformMetric[]; followersGained: number; timelineData: TimelineDataPoint[] }> => {
            if (!clientId) return { totalViews: 0, totalEngagements: 0, platformData: [], followersGained: 0, timelineData: [] };
            
            let periodStartStr: string;
            let periodEndStr: string | undefined;

            if (dateRange === "custom" && customDateRange) {
                periodStartStr = customDateRange.start.toISOString();
                periodEndStr = customDateRange.end.toISOString();
            } else {
                const days = dateRange === "30d" ? 30 : dateRange === "60d" ? 60 : 7;
                const periodStart = new Date();
                periodStart.setDate(periodStart.getDate() - days);
                periodStartStr = periodStart.toISOString();
            }

            // Fetch metrics from social_content joined with social_content_metrics for recent data
            let query = supabase
                .from("social_content")
                .select(`
                    platform,
                    published_at,
                    social_content_metrics (
                        views,
                        impressions,
                        likes,
                        comments,
                        shares,
                        collected_at
                    )
                `)
                .eq("client_id", clientId)
                .gte("published_at", periodStartStr)
                // limit to avoid huge payload, adjust as needed or use a summarized table if available
                .limit(2000);
            if (periodEndStr) query = query.lte("published_at", periodEndStr);
            const { data, error } = await query;

            if (error) throw error;

            // Fetch Follower Timeline
            const { data: timelineDataRaw } = await supabase
                .from("social_follower_timeline")
                .select("platform, date, followers")
                .eq("client_id", clientId)
                .gte("date", periodStartStr.split("T")[0])
                .order("date", { ascending: true });

            let followersGained = 0;
            if (timelineDataRaw && timelineDataRaw.length > 0) {
                const byPlatform: Record<string, any[]> = {};
                timelineDataRaw.forEach((f) => {
                    if (!byPlatform[f.platform]) byPlatform[f.platform] = [];
                    byPlatform[f.platform].push(f);
                });
                Object.values(byPlatform).forEach((points) => {
                    const first = points[0]?.followers || 0;
                    const last = points[points.length - 1]?.followers || 0;
                    followersGained += (last - first);
                });
            }
            
            let totalViews = 0;
            let totalEngagements = 0;
            
            const pMap: Record<string, { views: number; engagements: number }> = {};
            const timelineMap: Record<string, { date: string, views: number, engagement: number }> = {};
            
            const days = dateRange === "30d" ? 30 : dateRange === "60d" ? 60 : 7;
            for (let i = days; i >= 0; i--) {
                const d = new Date();
                d.setDate(d.getDate() - i);
                const dStr = d.toISOString().split("T")[0];
                const dFormatted = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
                timelineMap[dStr] = { date: dFormatted, views: 0, engagement: 0 };
            }
            
            data?.forEach(post => {
                if (!post.social_content_metrics || post.social_content_metrics.length === 0) return;
                
                // Get the most recent metric collection for this post
                const sortedMetrics = [...post.social_content_metrics].sort((a: any, b: any) => {
                    return new Date(b.collected_at || 0).getTime() - new Date(a.collected_at || 0).getTime();
                });
                
                const m = sortedMetrics[0];
                const postViews = Math.max(m.views || 0, m.impressions || 0);
                const postEngagements = (m.likes || 0) + (m.comments || 0) + (m.shares || 0);
                
                const plat = post.platform || "unknown";
                if (!pMap[plat]) pMap[plat] = { views: 0, engagements: 0 };
                
                pMap[plat].views += postViews;
                pMap[plat].engagements += postEngagements;
                
                totalViews += postViews;
                totalEngagements += postEngagements;

                const postDate = post.published_at ? post.published_at.split("T")[0] : null;
                if (postDate && timelineMap[postDate]) {
                    timelineMap[postDate].views += postViews;
                    timelineMap[postDate].engagement += postEngagements;
                }
            });
            
            const platformData: PlatformMetric[] = Object.entries(pMap).map(([platform, stats]) => {
                const engagementRate = stats.views > 0 ? (stats.engagements / stats.views) * 100 : 0;
                return {
                    platform,
                    views: stats.views,
                    engagements: stats.engagements,
                    engagementRate
                };
            }).sort((a, b) => b.views - a.views);

            const timelineData = Object.values(timelineMap);

            return {
                totalViews,
                totalEngagements,
                platformData,
                followersGained,
                timelineData
            };
        },
        enabled: !!clientId,
        staleTime: 5 * 60 * 1000 // 5 min
    });
}
