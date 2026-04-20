import os

def write_hook():
    path = "hooks/useSummaryMetrics.ts"
    content = """import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PlatformMetric {
    platform: string;
    views: number;
    engagements: number;
    engagementRate: number;
}

export function useSummaryMetrics(clientId: string, dateRange: string = "7d") {
    return useQuery({
        queryKey: ["summary-metrics", clientId, dateRange],
        queryFn: async (): Promise<{ totalViews: number; totalEngagements: number; platformData: PlatformMetric[] }> => {
            if (!clientId) return { totalViews: 0, totalEngagements: 0, platformData: [] };
            
            // Calculate date boundary
            const days = dateRange === "30d" ? 30 : dateRange === "60d" ? 60 : 7;
            const periodStart = new Date();
            periodStart.setDate(periodStart.getDate() - days);
            const periodStartStr = periodStart.toISOString();

            // Fetch metrics from social_content joined with social_content_metrics for recent data
            const { data, error } = await supabase
                .from("social_content")
                .select(`
                    platform,
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

            if (error) throw error;
            
            let totalViews = 0;
            let totalEngagements = 0;
            
            const pMap: Record<string, { views: number; engagements: number }> = {};
            
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

            return {
                totalViews,
                totalEngagements,
                platformData
            };
        },
        enabled: !!clientId,
        staleTime: 5 * 60 * 1000 // 5 min
    });
}
"""
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)

write_hook()
