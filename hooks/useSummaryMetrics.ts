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

export function useSummaryMetrics(clientId: string, dateRange: string = "7d", customDateRange?: { start: Date; end: Date }, isActive: boolean = true) {
    return useQuery({
        queryKey: ["summary-metrics", clientId, dateRange, customDateRange?.start, customDateRange?.end],
        queryFn: async (): Promise<{ totalViews: number; totalEngagements: number; platformData: PlatformMetric[]; followersGained: number; timelineData: TimelineDataPoint[] }> => {
            if (!clientId) return { totalViews: 0, totalEngagements: 0, platformData: [], followersGained: 0, timelineData: [] };

            let periodStartStr: string;
            let periodEndStr: string;

            if (dateRange === "custom" && customDateRange) {
                periodStartStr = customDateRange.start.toISOString().split("T")[0];
                periodEndStr = customDateRange.end.toISOString().split("T")[0];
            } else {
                const days = dateRange === "30d" ? 30 : dateRange === "60d" ? 60 : 7;
                const now = new Date();
                const start = new Date(now);
                start.setDate(start.getDate() - days);
                periodStartStr = start.toISOString().split("T")[0];
                periodEndStr = now.toISOString().split("T")[0];
            }

            // Primary approach: filter social_content_metrics by period_end (when data was synced)
            // This ensures all synced posts in the sync window are counted regardless of publish date
            const { data: metricsRaw, error } = await supabase
                .from("social_content_metrics")
                .select(`
                    views,
                    impressions,
                    likes,
                    comments,
                    shares,
                    period_end,
                    collected_at,
                    platform,
                    social_content!inner (
                        client_id,
                        platform,
                        published_at
                    )
                `)
                .eq("social_content.client_id", clientId)
                .gte("period_end", periodStartStr)
                .lte("period_end", periodEndStr)
                .limit(2000);

            if (error || !metricsRaw) {
                // Fallback: query via social_content.published_at if the join fails
                console.warn("Metrics primary query failed, using published_at fallback:", error?.message);
                const { data: fallbackContent } = await supabase
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
                    .limit(2000);

                const posts = (fallbackContent || []).map(post => ({
                    platform: post.platform,
                    published_at: post.published_at,
                    metrics: post.social_content_metrics || []
                }));
                return computeMetrics(posts, dateRange, periodStartStr, clientId);
            }

            // Deduplicate: for the same content+platform, keep only the row with the latest period_end
            const groupedByContent: Record<string, any> = {};
            metricsRaw.forEach((row: any) => {
                const key = (row.social_content?.published_at || "") + "_" + (row.social_content?.platform || row.platform);
                const existing = groupedByContent[key];
                if (!existing || (row.period_end || "") > (existing.period_end || "")) {
                    groupedByContent[key] = row;
                }
            });

            const normalizedPosts = Object.values(groupedByContent).map((row: any) => ({
                platform: row.social_content?.platform || row.platform,
                published_at: row.social_content?.published_at || null,
                metrics: [row]
            }));

            return computeMetrics(normalizedPosts, dateRange, periodStartStr, clientId);
        },
        enabled: !!clientId,
        staleTime: 5 * 60 * 1000, // 5 min
        gcTime: 7 * 24 * 60 * 60 * 1000,
        refetchOnWindowFocus: isActive,
        refetchOnMount: isActive,
    });
}

// Shared computation logic used by both primary and fallback paths
async function computeMetrics(
    posts: Array<{ platform: string; published_at: string | null; metrics: any[] }>,
    dateRange: string,
    periodStartStr: string,
    clientId: string
) {
    const days = dateRange === "30d" ? 30 : dateRange === "60d" ? 60 : 7;

    // Fetch Follower Timeline
    const { data: timelineDataRaw } = await supabase
        .from("social_follower_timeline")
        .select("platform, date, followers")
        .eq("client_id", clientId)
        .gte("date", periodStartStr)
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
    const timelineMap: Record<string, { date: string; views: number; engagement: number }> = {};

    for (let i = days; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dStr = d.toISOString().split("T")[0];
        const dFormatted = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
        timelineMap[dStr] = { date: dFormatted, views: 0, engagement: 0 };
    }

    posts.forEach(post => {
        if (!post.metrics || post.metrics.length === 0) return;

        // Use the most recently collected metric snapshot
        const sortedMetrics = [...post.metrics].sort((a: any, b: any) => {
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

        // Place in timeline by publish date (closest proxy for when impressions occurred)
        const postDate = post.published_at ? post.published_at.split("T")[0] : null;
        if (postDate && timelineMap[postDate]) {
            timelineMap[postDate].views += postViews;
            timelineMap[postDate].engagement += postEngagements;
        }
    });

    const platformData: PlatformMetric[] = Object.entries(pMap).map(([platform, stats]) => {
        const engagementRate = stats.views > 0 ? (stats.engagements / stats.views) * 100 : 0;
        return { platform, views: stats.views, engagements: stats.engagements, engagementRate };
    }).sort((a, b) => b.views - a.views);

    const timelineData = Object.values(timelineMap);

    return { totalViews, totalEngagements, platformData, followersGained, timelineData };
}
