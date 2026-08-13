import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PlatformMetric {
    platform: string;
    views: number;
    engagements: number;
    engagementRate: number;
    followersGained: number;
    followers: number;
}

export interface TimelineDataPoint {
    date: string;
    views: number;
    engagement: number;
}

export function useSummaryMetrics(clientId: string, dateRange: string = "7d", customDateRange?: { start: Date; end: Date }, isActive: boolean = true) {
    return useQuery({
        queryKey: ["summary-metrics", clientId, dateRange, customDateRange?.start, customDateRange?.end],
        queryFn: async (): Promise<{ totalViews: number; totalEngagements: number; platformData: PlatformMetric[]; followersGained: number; totalCurrentFollowers: number; timelineData: TimelineDataPoint[] }> => {
            if (!clientId) return { totalViews: 0, totalEngagements: 0, platformData: [], followersGained: 0, totalCurrentFollowers: 0, timelineData: [] };

            let periodStartStr: string;
            let periodEndStr: string;

            if (dateRange === "custom" && customDateRange) {
                periodStartStr = customDateRange.start.toISOString().split("T")[0];
                periodEndStr = customDateRange.end.toISOString().split("T")[0];
            } else {
                const days = dateRange === "365d" ? 365 : dateRange === "90d" ? 90 : dateRange === "60d" ? 60 : dateRange === "30d" ? 30 : dateRange === "14d" ? 14 : 7;
                const now = new Date();
                const start = new Date(now);
                start.setDate(start.getDate() - days);
                periodStartStr = start.toISOString().split("T")[0];
                periodEndStr = now.toISOString().split("T")[0];
            }

            // Metricool always reports through "yesterday" — if a client's last sync was 1-2 days
            // before the window start, their period_end will be just outside the window.
            // Use a 2-day buffer on the lower bound so we never miss recent syncs.
            const fetchStartDate = new Date(periodStartStr);
            fetchStartDate.setDate(fetchStartDate.getDate() - 2);
            const fetchStartStr = fetchStartDate.toISOString().split("T")[0];

            // 1. Query client's social_content rows directly (fast index lookup)
            // Order by published_at DESC so recent posts are always included even if limit is hit
            const { data: postsRaw, error: postsError } = await supabase
                .from("social_content")
                .select("id, platform, published_at, title, url, content_id")
                .eq("client_id", clientId)
                .order("published_at", { ascending: false })
                .limit(2000);

            if (postsError || !postsRaw || postsRaw.length === 0) {
                return computeMetrics([], dateRange, periodStartStr, periodEndStr, clientId);
            }

            // 2. Query metrics for these posts in URL-safe batches of 100
            const postIds = postsRaw.map(p => p.id);
            const chunkSize = 100;
            const metricsRaw: any[] = [];

            for (let i = 0; i < postIds.length; i += chunkSize) {
                const chunk = postIds.slice(i, i + chunkSize);
                const { data: chunkMetrics } = await supabase
                    .from("social_content_metrics")
                    .select("social_content_id, views, impressions, likes, comments, shares, period_end, collected_at, platform")
                    .in("social_content_id", chunk);
                if (chunkMetrics && chunkMetrics.length > 0) {
                    metricsRaw.push(...chunkMetrics);
                }
            }

            // Group metrics by post ID
            const posts = postsRaw.map(post => {
                const postMetrics = metricsRaw.filter(m => m.social_content_id === post.id);
                let postUrl = post.url || undefined;
                if (!postUrl && post.content_id) {
                    const plat = String(post.platform || "").toLowerCase();
                    const cleanId = String(post.content_id).replace(/^(youtube|tiktok|fb|facebook|ig|instagram)_/i, "");
                    if (plat === "youtube") postUrl = `https://www.youtube.com/watch?v=${cleanId}`;
                    else if (plat === "tiktok") postUrl = `https://www.tiktok.com/video/${cleanId}`;
                    else if (plat === "facebook") postUrl = `https://facebook.com/${cleanId}`;
                    else if (plat === "instagram") postUrl = `https://www.instagram.com/p/${cleanId}`;
                }
                return {
                    id: post.id,
                    title: post.title || "Untitled Post",
                    url: postUrl,
                    platform: post.platform,
                    published_at: post.published_at,
                    metrics: postMetrics
                };
            });

            return computeMetrics(posts, dateRange, periodStartStr, periodEndStr, clientId);
        },
        enabled: !!clientId,
        staleTime: 0, // Always fetch fresh metrics on horizon change
        gcTime: 7 * 24 * 60 * 60 * 1000,
        refetchOnWindowFocus: false,
        refetchOnMount: "always",
    });
}

// Shared computation logic used by both primary and fallback paths
async function computeMetrics(
    posts: Array<{ id?: string; platform: string; title?: string; url?: string; published_at: string | null; metrics: any[] }>,
    dateRange: string,
    periodStartStr: string,
    periodEndStr: string,
    clientId: string
) {
    const days = dateRange === "365d" ? 365 : dateRange === "90d" ? 90 : dateRange === "60d" ? 60 : dateRange === "30d" ? 30 : dateRange === "14d" ? 14 : 7;

    // Fetch Follower Timeline (fetch all to get accurate baseline before period)
    const { data: timelineDataRaw } = await supabase
        .from("social_follower_timeline")
        .select("platform, date, followers")
        .eq("client_id", clientId)
        .order("date", { ascending: true });

    const platformFollowers: Record<string, number> = {};
    const platformCurrentFollowers: Record<string, number> = {};
    const platformBaselineFollowers: Record<string, number> = {};
    
    if (timelineDataRaw && timelineDataRaw.length > 0) {
        const byPlatform: Record<string, any[]> = {};
        timelineDataRaw.forEach((f) => {
            if (!byPlatform[f.platform]) byPlatform[f.platform] = [];
            byPlatform[f.platform].push(f);
        });
        Object.values(byPlatform).forEach((points) => {
            // Ensure platform matching is case-insensitive
            const platform = String(points[0].platform || "").toLowerCase();

            // Split into points before the period and points within the period
            const beforePoints = points.filter(p => p.date < periodStartStr);
            const periodPoints = points.filter(p => p.date >= periodStartStr && p.date <= periodEndStr);
            
            if (periodPoints.length > 0) {
                // Baseline is the last known follower count BEFORE the period,
                // or if none exists, the first count inside the period.
                const baseline = beforePoints.length > 0 
                    ? beforePoints[beforePoints.length - 1].followers 
                    : periodPoints[0].followers;
                    
                const last = periodPoints[periodPoints.length - 1].followers;
                const diff = last - baseline;
                
                platformFollowers[platform] = diff;
                platformBaselineFollowers[platform] = baseline;
            } else {
                platformFollowers[platform] = 0;
                // If no period data, baseline is the latest before-period point
                platformBaselineFollowers[platform] = beforePoints.length > 0
                    ? beforePoints[beforePoints.length - 1].followers
                    : 0;
            }
            // Always set current followers to the absolute latest point within the period we have
            platformCurrentFollowers[platform] = periodPoints.length > 0 
                ? periodPoints[periodPoints.length - 1].followers 
                : (beforePoints.length > 0 ? beforePoints[beforePoints.length - 1].followers : 0);
        });
    } else {
        // Always query social_account_metrics to compute exact horizon follower gains & current follower totals
        const { data: accountMetrics } = await supabase
            .from("social_account_metrics")
            .select("platform, followers, new_followers, collected_at")
            .eq("client_id", clientId)
            .order("collected_at", { ascending: true });

        if (accountMetrics && accountMetrics.length > 0) {
            const byPlatform: Record<string, any[]> = {};
            accountMetrics.forEach((m) => {
                const plat = String(m.platform || "").toLowerCase();
                if (!byPlatform[plat]) byPlatform[plat] = [];
                byPlatform[plat].push(m);
            });
            
            Object.entries(byPlatform).forEach(([platform, points]) => {
                const sorted = [...points].sort((a, b) => 
                    (a.collected_at || "").localeCompare(b.collected_at || "")
                );
                
                const inPeriod = sorted.filter(p => {
                    const date = (p.collected_at || "").split("T")[0];
                    return date >= periodStartStr && date <= periodEndStr;
                });
                const beforePeriod = sorted.filter(p => (p.collected_at || "").split("T")[0] < periodStartStr);

                const validInPeriod = inPeriod.filter(p => p.followers != null && p.followers > 0);
                const validBefore = beforePeriod.filter(p => p.followers != null && p.followers > 0);

                let gain = 0;
                if (validInPeriod.length > 0) {
                    const newest = validInPeriod[validInPeriod.length - 1].followers;
                    const baseline = validBefore.length > 0 
                        ? validBefore[validBefore.length - 1].followers 
                        : validInPeriod[0].followers;
                    gain = newest - baseline;
                } else if (inPeriod.length > 0) {
                    const dailyMap: Record<string, number> = {};
                    inPeriod.forEach(p => {
                        const date = (p.collected_at || "").split("T")[0];
                        if (p.new_followers != null) dailyMap[date] = p.new_followers;
                    });
                    gain = Object.values(dailyMap).reduce((acc, val) => acc + Number(val), 0);
                }

                platformFollowers[platform] = gain;

                // Set baseline followers (start of period)
                if (validBefore.length > 0) {
                    platformBaselineFollowers[platform] = validBefore[validBefore.length - 1].followers;
                } else if (validInPeriod.length > 0) {
                    platformBaselineFollowers[platform] = validInPeriod[0].followers;
                }
                
                // Set current followers from the latest row that has a valid count
                const withFollowers = [...sorted].reverse().find(p => p.followers != null && p.followers > 0);
                if (withFollowers) {
                    platformCurrentFollowers[platform] = withFollowers.followers;
                }
            });
        }
    }

    let totalViews = 0;
    let totalEngagements = 0;
    const pMap: Record<string, { views: number; engagements: number; postsPublished: number }> = {};
    const timelineMap: Record<string, { date: string; views: number; engagement: number; [key: string]: any }> = {};

    // Use UTC midnight dates to ensure timezone-agnostic matching with DB timestamps
    const startDate = new Date(periodStartStr + "T00:00:00Z");
    const endDate = new Date(periodEndStr + "T00:00:00Z");

    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        const dStr = d.toISOString().split("T")[0];
        const dFormatted = d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
        timelineMap[dStr] = { date: dFormatted, views: 0, engagement: 0, youtube: 0, tiktok: 0, facebook: 0, instagram: 0, x: 0, linkedin: 0 };
    }

    posts.forEach(post => {
        if (!post.metrics || post.metrics.length === 0) return;
        
        const postDate = post.published_at ? post.published_at.split("T")[0] : null;

        // Sort metrics from oldest to newest by collected_at
        const sortedMetrics = [...post.metrics].sort((a: any, b: any) => {
            return new Date(a.collected_at || 0).getTime() - new Date(b.collected_at || 0).getTime();
        });

        // Filter points inside the selected period
        const periodPoints = sortedMetrics.filter((m: any) => {
            const date = (m.collected_at || m.period_end || "").split("T")[0];
            return date >= periodStartStr && date <= periodEndStr;
        });

        // Filter points before the selected period (needed for baseline calculation)
        const beforePoints = sortedMetrics.filter((m: any) => {
            const date = (m.collected_at || m.period_end || "").split("T")[0];
            return date < periodStartStr;
        });

        const publishedDuringPeriod = postDate && postDate >= periodStartStr && postDate <= periodEndStr;

        let postViews = 0;
        let postEngagements = 0;

        if (periodPoints.length > 0) {
            const latest = periodPoints[periodPoints.length - 1];
            const latestViews = Math.max(latest.views || 0, latest.impressions || 0);
            const latestEngagements = (latest.likes || 0) + (latest.comments || 0) + (latest.shares || 0);

            let baselineViews = 0;
            let baselineEngagements = 0;

            if (!publishedDuringPeriod) {
                const baseline = beforePoints.length > 0
                    ? beforePoints[beforePoints.length - 1]
                    : periodPoints[0];
                baselineViews = Math.max(baseline.views || 0, baseline.impressions || 0);
                baselineEngagements = (baseline.likes || 0) + (baseline.comments || 0) + (baseline.shares || 0);
            }

            postViews = Math.max(0, latestViews - baselineViews);
            postEngagements = Math.max(0, latestEngagements - baselineEngagements);
        } else if (publishedDuringPeriod && sortedMetrics.length > 0) {
            const latest = sortedMetrics[sortedMetrics.length - 1];
            postViews = Math.max(latest.views || 0, latest.impressions || 0);
            postEngagements = (latest.likes || 0) + (latest.comments || 0) + (latest.shares || 0);
        }

        if (postViews > 0 || postEngagements > 0 || publishedDuringPeriod) {
            const plat = (post.platform || "unknown").toLowerCase();
            if (!pMap[plat]) pMap[plat] = { views: 0, engagements: 0, postsPublished: 0 };

            pMap[plat].views += postViews;
            pMap[plat].engagements += postEngagements;
            pMap[plat].postsPublished += 1;
            totalViews += postViews;
            totalEngagements += postEngagements;

            // Accumulate daily view increments into timelineMap by exact snapshot date (mDate)
            for (let i = 0; i < sortedMetrics.length; i++) {
                const m = sortedMetrics[i];
                const mDate = (m.collected_at || m.period_end || "").split("T")[0];

                if (mDate >= periodStartStr && mDate <= periodEndStr) {
                    const curViews = Math.max(m.views || 0, m.impressions || 0);
                    const curEng = (m.likes || 0) + (m.comments || 0) + (m.shares || 0);

                    let prevViews = 0;
                    let prevEng = 0;

                    if (i > 0) {
                        const prevM = sortedMetrics[i - 1];
                        prevViews = Math.max(prevM.views || 0, prevM.impressions || 0);
                        prevEng = (prevM.likes || 0) + (prevM.comments || 0) + (prevM.shares || 0);
                    }

                    const incViews = Math.max(0, curViews - prevViews);
                    const incEng = Math.max(0, curEng - prevEng);

                    if (timelineMap[mDate]) {
                        timelineMap[mDate].views += incViews;
                        timelineMap[mDate].engagement += incEng;
                        if (timelineMap[mDate][plat] != null) {
                            timelineMap[mDate][plat] += incViews;
                        } else {
                            timelineMap[mDate][plat] = incViews;
                        }
                    }
                }
            }
        }
    });

    // Also include platforms that have follower data but no posts
    Object.keys(platformFollowers).forEach(plat => {
        if (!pMap[plat]) pMap[plat] = { views: 0, engagements: 0, postsPublished: 0 };
    });

    const platformData: PlatformMetric[] = Object.entries(pMap).map(([platform, stats]) => {
        const engagementRate = stats.views > 0 ? (stats.engagements / stats.views) * 100 : 0;
        const plToLower = String(platform).toLowerCase();
        return { 
            platform, 
            views: stats.views, 
            engagements: stats.engagements, 
            engagementRate,
            followersGained: platformFollowers[plToLower] || 0,
            followers: platformCurrentFollowers[plToLower] || 0,
            postsPublished: stats.postsPublished || 0
        };
    }).sort((a, b) => b.views - a.views);

    const timelineData = Object.values(timelineMap);
    const totalFollowersGained = Object.values(platformFollowers).reduce((sum, val) => sum + val, 0);
    const totalCurrentFollowers = Object.values(platformCurrentFollowers).reduce((sum, val) => sum + val, 0);
    const totalBaselineFollowers = Object.values(platformBaselineFollowers).reduce((sum, val) => sum + val, 0);

    const topPosts = posts
        .map((p: any) => {
            const periodPoints = (p.metrics || []).filter((m: any) => {
                const date = (m.collected_at || m.period_end || "").split("T")[0];
                return date >= periodStartStr && date <= periodEndStr;
            });
            const latest = periodPoints.length > 0 ? periodPoints[periodPoints.length - 1] : null;
            const pViews = latest ? Math.max(latest.views || 0, latest.impressions || 0) : 0;
            const pEng = latest ? (latest.likes || 0) + (latest.comments || 0) + (latest.shares || 0) : 0;
            const er = pViews > 0 ? (pEng / pViews) * 100 : 0;
            const contrib = totalViews > 0 ? Math.round((pViews / totalViews) * 100) : 0;

            return {
                id: p.id || String(Math.random()),
                platform: p.platform || "social",
                publishedAt: p.published_at ? p.published_at.split("T")[0] : "",
                title: p.title || "Untitled Post",
                url: p.url || undefined,
                currentValue: pViews,
                engagements: pEng,
                engagementRate: Number(er.toFixed(1)),
                contributionToCurrentTotal: contrib,
            };
        })
        .filter((p: any) => p.currentValue > 0 || p.url)
        .sort((a: any, b: any) => b.currentValue - a.currentValue)
        .slice(0, 5);

    let cumulativeViews = 0;
    posts.forEach(p => {
        if (!p.metrics || p.metrics.length === 0) return;
        const sorted = [...p.metrics].sort((a: any, b: any) => new Date(a.collected_at || 0).getTime() - new Date(b.collected_at || 0).getTime());
        const latest = sorted[sorted.length - 1];
        cumulativeViews += Math.max(latest.views || 0, latest.impressions || 0);
    });

    const finalViews = totalViews > 0 ? totalViews : cumulativeViews;

    // === PRIOR PERIOD COMPUTATION ===
    // Calculate prior period boundaries (same length, immediately preceding)
    const periodStartDate = new Date(periodStartStr + "T00:00:00Z");
    const periodEndDate = new Date(periodEndStr + "T00:00:00Z");
    const periodLengthMs = periodEndDate.getTime() - periodStartDate.getTime();
    const priorEndDate = new Date(periodStartDate.getTime() - 86400000); // day before current start
    const priorStartDate = new Date(priorEndDate.getTime() - periodLengthMs);
    const priorStartStr = priorStartDate.toISOString().split("T")[0];
    const priorEndStr = priorEndDate.toISOString().split("T")[0];

    let prevTotalViews = 0;
    let prevTotalEngagements = 0;
    let prevPostsPublished = 0;
    const prevPMap: Record<string, { views: number; engagements: number; postsPublished: number }> = {};

    // Build a day-by-day timeline for the prior period (mirrors timelineMap logic)
    const previousTimelineMap: Record<string, { date: string; views: number; engagement: number; [key: string]: any }> = {};
    for (let d = new Date(priorStartDate); d <= priorEndDate; d.setDate(d.getDate() + 1)) {
        const dStr = d.toISOString().split("T")[0];
        const dFormatted = d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
        previousTimelineMap[dStr] = { date: dFormatted, views: 0, engagement: 0, youtube: 0, tiktok: 0, facebook: 0, instagram: 0, x: 0, linkedin: 0 };
    }

    posts.forEach(post => {
        if (!post.metrics || post.metrics.length === 0) return;
        const postDate = post.published_at ? post.published_at.split("T")[0] : null;
        const sortedMetrics = [...post.metrics].sort((a: any, b: any) =>
            new Date(a.collected_at || 0).getTime() - new Date(b.collected_at || 0).getTime()
        );

        const priorPeriodPoints = sortedMetrics.filter((m: any) => {
            const date = (m.collected_at || m.period_end || "").split("T")[0];
            return date >= priorStartStr && date <= priorEndStr;
        });
        const priorBeforePoints = sortedMetrics.filter((m: any) => {
            const date = (m.collected_at || m.period_end || "").split("T")[0];
            return date < priorStartStr;
        });

        const pubDuringPrior = postDate && postDate >= priorStartStr && postDate <= priorEndStr;
        if (pubDuringPrior) prevPostsPublished++;

        let pv = 0, pe = 0;

        if (priorPeriodPoints.length > 0) {
            const latest = priorPeriodPoints[priorPeriodPoints.length - 1];
            const lv = Math.max(latest.views || 0, latest.impressions || 0);
            const le = (latest.likes || 0) + (latest.comments || 0) + (latest.shares || 0);
            let bv = 0, be = 0;
            if (!pubDuringPrior) {
                const bl = priorBeforePoints.length > 0
                    ? priorBeforePoints[priorBeforePoints.length - 1]
                    : priorPeriodPoints[0];
                bv = Math.max(bl.views || 0, bl.impressions || 0);
                be = (bl.likes || 0) + (bl.comments || 0) + (bl.shares || 0);
            }
            pv = Math.max(0, lv - bv);
            pe = Math.max(0, le - be);
        } else if (pubDuringPrior && sortedMetrics.length > 0) {
            const latest = sortedMetrics[sortedMetrics.length - 1];
            pv = Math.max(latest.views || 0, latest.impressions || 0);
            pe = (latest.likes || 0) + (latest.comments || 0) + (latest.shares || 0);
        }

        if (pv > 0 || pe > 0 || pubDuringPrior) {
            const plat = (post.platform || "unknown").toLowerCase();
            if (!prevPMap[plat]) prevPMap[plat] = { views: 0, engagements: 0, postsPublished: 0 };
            prevPMap[plat].views += pv;
            prevPMap[plat].engagements += pe;
            prevPMap[plat].postsPublished += 1;
            prevTotalViews += pv;
            prevTotalEngagements += pe;

            // Accumulate daily view increments into previousTimelineMap
            for (let i = 0; i < sortedMetrics.length; i++) {
                const m = sortedMetrics[i];
                const mDate = (m.collected_at || m.period_end || "").split("T")[0];

                if (mDate >= priorStartStr && mDate <= priorEndStr) {
                    const curViews = Math.max(m.views || 0, m.impressions || 0);
                    const curEng = (m.likes || 0) + (m.comments || 0) + (m.shares || 0);

                    let prevViewsBaseline = 0;
                    let prevEngBaseline = 0;

                    if (i > 0) {
                        const prevM = sortedMetrics[i - 1];
                        prevViewsBaseline = Math.max(prevM.views || 0, prevM.impressions || 0);
                        prevEngBaseline = (prevM.likes || 0) + (prevM.comments || 0) + (prevM.shares || 0);
                    }

                    const incViews = Math.max(0, curViews - prevViewsBaseline);
                    const incEng = Math.max(0, curEng - prevEngBaseline);

                    if (previousTimelineMap[mDate]) {
                        previousTimelineMap[mDate].views += incViews;
                        previousTimelineMap[mDate].engagement += incEng;
                        if (previousTimelineMap[mDate][plat] != null) {
                            previousTimelineMap[mDate][plat] += incViews;
                        } else {
                            previousTimelineMap[mDate][plat] = incViews;
                        }
                    }
                }
            }
        }
    });

    // Prior follower snapshots
    let prevFollowersStart = 0;
    let prevFollowersEnd = 0;
    Object.entries(platformCurrentFollowers).forEach(([plat]) => {
        // We already have sorted account metrics — recompute prior baseline from them
        // For simplicity, estimate from currentFollowers - gained
        const curF = platformCurrentFollowers[plat] || 0;
        const gained = platformFollowers[plat] || 0;
        prevFollowersEnd += Math.max(0, curF - gained);
        prevFollowersStart += Math.max(0, curF - gained);
    });

    const previousPlatformData = Object.entries(prevPMap).map(([platform, stats]) => ({
        platform,
        views: stats.views,
        engagements: stats.engagements,
        postsPublished: stats.postsPublished || 0,
    }));

    return {
        totalViews: finalViews,
        totalEngagements,
        platformData,
        followersGained: totalFollowersGained,
        totalCurrentFollowers,
        totalBaselineFollowers,
        timelineData,
        timelineMap,
        previousTimelineMap,
        topPosts,
        // Prior period data
        previousViews: prevTotalViews,
        previousEngagements: prevTotalEngagements,
        previousPlatformData,
        previousPostsPublished: prevPostsPublished,
        prevFollowersStart,
        prevFollowersEnd,
        // Current period posts published
        postsPublished: Object.values(pMap).reduce((sum, p) => sum + (p.postsPublished || 0), 0),
    };
}
