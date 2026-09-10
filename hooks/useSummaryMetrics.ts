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

            // HAIRtamin and Web/GA4/GSC-first clients route directly to computeWebOrGA4Metrics
            const isHairtamin = clientId === "6c14388a-b7da-48fe-a8e4-57172f1f862a";
            if (isHairtamin) {
                return computeWebOrGA4Metrics(clientId, dateRange, periodStartStr, periodEndStr);
            }

            // 1. Query client's social_content rows directly (fast index lookup)
            // Order by published_at DESC so recent posts are always included even if limit is hit
            const { data: postsRaw, error: postsError } = await supabase
                .from("social_content")
                .select("id, platform, published_at, title, url, content_id")
                .eq("client_id", clientId)
                .order("published_at", { ascending: false })
                .limit(2000);

            if (postsError || !postsRaw || postsRaw.length === 0) {
                return computeWebOrGA4Metrics(clientId, dateRange, periodStartStr, periodEndStr);
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

    const platformFollowers: Record<string, number> = {};
    const platformCurrentFollowers: Record<string, number> = {};
    const platformBaselineFollowers: Record<string, number> = {};

    // Query social_account_metrics to compute exact horizon follower gains & current follower totals.
    // We sort and filter by period_end to ensure accurate reporting per timeframe.
    const { data: accountMetrics } = await supabase
        .from("social_account_metrics")
        .select("platform, followers, new_followers, period_start, period_end, collected_at")
        .eq("client_id", clientId)
        .order("period_end", { ascending: true });

    if (accountMetrics && accountMetrics.length > 0) {
        const byPlatform: Record<string, any[]> = {};
        accountMetrics.forEach((m) => {
            const plat = String(m.platform || "").toLowerCase();
            if (!byPlatform[plat]) byPlatform[plat] = [];
            byPlatform[plat].push(m);
        });
        
        Object.entries(byPlatform).forEach(([platform, points]) => {
            const sorted = [...points].sort((a, b) => 
                (a.period_end || "").localeCompare(b.period_end || "")
            );

            // Helper: compute the span in days between period_start and period_end
            const getSpanDays = (p: any) => {
                if (!p.period_start || !p.period_end) return 0;
                return Math.round(
                    (new Date(p.period_end).getTime() - new Date(p.period_start).getTime()) / 86400000
                );
            };

            // Separate weekly rows (5-8 day span) from rolling 30-day windows.
            // The table stores BOTH types, and summing across overlapping 30-day
            // windows causes massive over-counting (e.g., +72 instead of 0).
            const weeklyRows = sorted.filter(p => {
                const span = getSpanDays(p);
                return span >= 5 && span <= 8;
            });
            
            // Filter to rows whose period_end falls within the selected date range
            const weeklyInPeriod = weeklyRows.filter(p => {
                const date = (p.period_end || "").split("T")[0];
                return date >= periodStartStr && date <= periodEndStr;
            });
            const weeklyBefore = weeklyRows.filter(p => 
                (p.period_end || "").split("T")[0] < periodStartStr
            );

            // Also compute the full set (all spans) as fallback for platforms
            // that don't have weekly-span rows
            const allInPeriod = sorted.filter(p => {
                const date = (p.period_end || "").split("T")[0];
                return date >= periodStartStr && date <= periodEndStr;
            });
            const allBefore = sorted.filter(p => 
                (p.period_end || "").split("T")[0] < periodStartStr
            );

            // Choose the best set: prefer weekly rows if available
            const useWeekly = weeklyRows.length > 0;
            const inPeriod = useWeekly ? weeklyInPeriod : allInPeriod;
            const beforePeriod = useWeekly ? weeklyBefore : allBefore;

            const validInPeriod = inPeriod.filter(p => p.followers != null && p.followers > 0);
            const validBefore = beforePeriod.filter(p => p.followers != null && p.followers > 0);

            let gain = 0;
            if (validInPeriod.length > 0) {
                // Use the most recent in-period row's new_followers if available
                const newest = validInPeriod[validInPeriod.length - 1];
                if (newest.new_followers != null && newest.new_followers > 0) {
                    gain = newest.new_followers;
                } else {
                    // Fallback: diff between newest in-period and baseline
                    const baseline = validBefore.length > 0 
                        ? validBefore[validBefore.length - 1].followers 
                        : validInPeriod[0].followers;
                    gain = newest.followers - baseline;
                }
            } else if (allInPeriod.length > 0) {
                // No weekly rows in period; use the most recent rolling row's new_followers
                const validAll = allInPeriod.filter(p => p.followers != null && p.followers > 0);
                if (validAll.length > 0) {
                    const newest = validAll[validAll.length - 1];
                    if (newest.new_followers != null && newest.new_followers > 0) {
                        gain = newest.new_followers;
                    } else {
                        const allValidBefore = allBefore.filter(p => p.followers != null && p.followers > 0);
                        const baseline = allValidBefore.length > 0
                            ? allValidBefore[allValidBefore.length - 1].followers
                            : validAll[0].followers;
                        gain = newest.followers - baseline;
                    }
                }
            }

            platformFollowers[platform] = gain;

            // Set baseline followers (start of period)
            if (validBefore.length > 0) {
                platformBaselineFollowers[platform] = validBefore[validBefore.length - 1].followers;
            } else if (validInPeriod.length > 0) {
                platformBaselineFollowers[platform] = validInPeriod[0].followers;
            }
            
            // Set current followers from the latest row (any span) that has a valid count
            const withFollowers = [...sorted].reverse().find(p => p.followers != null && p.followers > 0);
            if (withFollowers) {
                platformCurrentFollowers[platform] = withFollowers.followers;
            }
        });
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

async function computeWebOrGA4Metrics(
    clientId: string,
    dateRange: string,
    periodStartStr: string,
    periodEndStr: string
) {
    const periodStartDate = new Date(periodStartStr + "T00:00:00Z");
    const periodEndDate = new Date(periodEndStr + "T00:00:00Z");
    const periodLengthMs = periodEndDate.getTime() - periodStartDate.getTime();
    const priorEndDate = new Date(periodStartDate.getTime() - 86400000);
    const priorStartDate = new Date(priorEndDate.getTime() - periodLengthMs);
    const priorStartStr = priorStartDate.toISOString().split("T")[0];
    const priorEndStr = priorEndDate.toISOString().split("T")[0];

    // 1. Fetch GA4 config and GSC report data in parallel
    const [{ data: ga4Config }, { data: gscData }] = await Promise.all([
        supabase
            .from("client_ga4_config" as any)
            .select("website_url, ga4_property_id")
            .eq("client_id", clientId)
            .eq("is_active", true)
            .maybeSingle(),
        supabase
            .from("report_gsc_metrics" as any)
            .select("*")
            .eq("client_id", clientId)
            .order("collected_at", { ascending: false })
            .limit(1)
            .maybeSingle(),
    ]);

    // Process GSC metrics if available (HAIRtamin only)
    const isHairtaminClient = clientId === "6c14388a-b7da-48fe-a8e4-57172f1f862a";
    let gscCurClicks = 0;
    let gscCurImpressions = 0;
    let gscCurCtr = 0;
    let gscPrevClicks = 0;
    let gscPrevImpressions = 0;
    let gscPrevCtr = 0;
    let gscTopQueries: any[] = [];
    let gscTopPages: any[] = [];
    let hasGsc = false;

    if (gscData && isHairtaminClient) {
        hasGsc = true;
        const daily = Array.isArray(gscData.daily_breakdown) ? gscData.daily_breakdown : [];
        gscTopQueries = Array.isArray(gscData.top_queries) ? gscData.top_queries : [];
        gscTopPages = Array.isArray(gscData.top_pages) ? gscData.top_pages : [];

        // Current period GSC
        const curDaily = daily.filter((d: any) => d.date >= periodStartStr && d.date <= periodEndStr);
        if (curDaily.length > 0) {
            gscCurClicks = curDaily.reduce((s: number, d: any) => s + (d.clicks || 0), 0);
            gscCurImpressions = curDaily.reduce((s: number, d: any) => s + (d.impressions || 0), 0);
            gscCurCtr = gscCurImpressions > 0 ? (gscCurClicks / gscCurImpressions) * 100 : 0;
        } else {
            gscCurClicks = gscData.total_clicks || 0;
            gscCurImpressions = gscData.total_impressions || 0;
            gscCurCtr = parseFloat(gscData.avg_ctr) || 0;
        }

        // Previous period GSC
        const prevDaily = daily.filter((d: any) => d.date >= priorStartStr && d.date <= priorEndStr);
        if (prevDaily.length > 0) {
            gscPrevClicks = prevDaily.reduce((s: number, d: any) => s + (d.clicks || 0), 0);
            gscPrevImpressions = prevDaily.reduce((s: number, d: any) => s + (d.impressions || 0), 0);
            gscPrevCtr = gscPrevImpressions > 0 ? (gscPrevClicks / gscPrevImpressions) * 100 : 0;
        } else {
            gscPrevClicks = Math.round(gscCurClicks * 0.95);
            gscPrevImpressions = Math.round(gscCurImpressions * 0.95);
            gscPrevCtr = gscCurCtr;
        }
    }

    if (ga4Config) {
        try {
            const [curResp, prevResp] = await Promise.all([
                supabase.functions.invoke("fetch-ga4-analytics", {
                    body: { clientId, startDate: periodStartStr, endDate: periodEndStr },
                }),
                supabase.functions.invoke("fetch-ga4-analytics", {
                    body: { clientId, startDate: priorStartStr, endDate: priorEndStr },
                }),
            ]);

            const curAnalytics = curResp.data?.analytics;
            const prevAnalytics = prevResp.data?.analytics;

            if (curAnalytics || prevAnalytics || hasGsc) {
                const curBounce = curAnalytics?.summary?.bounceRate ?? 45;
                const curEngRate = Math.max(0, 100 - curBounce);
                const totalSessions = curAnalytics?.summary?.totalSessions || 0;
                const totalPageViews = curAnalytics?.summary?.totalPageViews || 0;
                const totalViews = totalSessions > 0 ? totalSessions : totalPageViews;
                const totalEngagements = Math.round(totalSessions * (curEngRate / 100));

                const prevBounce = prevAnalytics?.summary?.bounceRate ?? 45;
                const prevEngRate = Math.max(0, 100 - prevBounce);
                const prevTotalSessions = prevAnalytics?.summary?.totalSessions || 0;
                const prevTotalPageViews = prevAnalytics?.summary?.totalPageViews || 0;
                const prevTotalViews = prevTotalSessions > 0 ? prevTotalSessions : prevTotalPageViews;
                const prevTotalEngagements = Math.round(prevTotalSessions * (prevEngRate / 100));

                const curSources = curAnalytics?.trafficSources || [];
                const platformData: PlatformMetric[] = curSources.map((s: any) => {
                    const views = s.sessions || 0;
                    const engagements = Math.round(views * (curEngRate / 100));
                    return {
                        platform: s.source,
                        views,
                        engagements,
                        engagementRate: Number(curEngRate.toFixed(1)),
                        followersGained: 0,
                        followers: 0,
                        postsPublished: 0,
                    };
                });

                const prevSources = prevAnalytics?.trafficSources || [];
                const previousPlatformData = prevSources.map((s: any) => {
                    const views = s.sessions || 0;
                    const engagements = Math.round(views * (prevEngRate / 100));
                    return {
                        platform: s.source,
                        views,
                        engagements,
                        postsPublished: 0,
                    };
                });

                // Add Google Search Console platform entry if GSC data is connected
                if (hasGsc) {
                    const gscEngagements = Math.round(gscCurClicks * (Math.max(1, gscCurCtr) / 100));
                    platformData.push({
                        platform: "Google Search Console",
                        views: gscCurClicks,
                        engagements: gscEngagements,
                        engagementRate: Number(gscCurCtr.toFixed(1)),
                        followersGained: 0,
                        followers: 0,
                        postsPublished: gscTopQueries.length || gscTopPages.length || 0,
                    });

                    const prevGscEngagements = Math.round(gscPrevClicks * (Math.max(1, gscPrevCtr) / 100));
                    previousPlatformData.push({
                        platform: "Google Search Console",
                        views: gscPrevClicks,
                        engagements: prevGscEngagements,
                        postsPublished: gscTopQueries.length || 0,
                    });
                }

                platformData.sort((a: any, b: any) => b.views - a.views);

                // Build timelineMap
                const timelineMap: Record<string, { date: string; views: number; engagement: number; [key: string]: any }> = {};
                for (let d = new Date(periodStartDate); d <= periodEndDate; d.setDate(d.getDate() + 1)) {
                    const dStr = d.toISOString().split("T")[0];
                    const dFormatted = d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
                    timelineMap[dStr] = { date: dFormatted, views: 0, engagement: 0 };
                }
                (curAnalytics?.dailyBreakdown || []).forEach((day: any) => {
                    if (timelineMap[day.date]) {
                        const dayBounce = day.bounceRate != null ? day.bounceRate : curBounce;
                        const dayEngRate = Math.max(0, 100 - dayBounce);
                        const dayViews = day.sessions || day.pageViews || 0;
                        timelineMap[day.date].views = dayViews;
                        timelineMap[day.date].engagement = Math.round(dayViews * (dayEngRate / 100));
                    }
                });

                // Build previousTimelineMap
                const previousTimelineMap: Record<string, { date: string; views: number; engagement: number; [key: string]: any }> = {};
                for (let d = new Date(priorStartDate); d <= priorEndDate; d.setDate(d.getDate() + 1)) {
                    const dStr = d.toISOString().split("T")[0];
                    const dFormatted = d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
                    previousTimelineMap[dStr] = { date: dFormatted, views: 0, engagement: 0 };
                }
                (prevAnalytics?.dailyBreakdown || []).forEach((day: any) => {
                    if (previousTimelineMap[day.date]) {
                        const dayBounce = day.bounceRate != null ? day.bounceRate : prevBounce;
                        const dayEngRate = Math.max(0, 100 - dayBounce);
                        const dayViews = day.sessions || day.pageViews || 0;
                        previousTimelineMap[day.date].views = dayViews;
                        previousTimelineMap[day.date].engagement = Math.round(dayViews * (dayEngRate / 100));
                    }
                });

                // Top pages and top Search Console queries as content drivers
                const siteBase = (ga4Config as any)?.website_url || "https://hairtamin.com";
                const landingPagePosts = (curAnalytics?.topPages || []).map((page: any, idx: number) => {
                    const pViews = page.views || 0;
                    const contrib = totalViews > 0 ? Math.round((pViews / totalViews) * 100) : 0;
                    const cleanUrl = page.url?.startsWith("http")
                        ? page.url
                        : `${siteBase.replace(/\/$/, "")}${page.url?.startsWith("/") ? "" : "/"}${page.url}`;
                    return {
                        id: page.url || `page-${idx}`,
                        platform: "Website",
                        publishedAt: "",
                        title: page.title || page.url,
                        url: cleanUrl,
                        currentValue: pViews,
                        engagements: Math.round(pViews * (curEngRate / 100)),
                        engagementRate: Number(curEngRate.toFixed(1)),
                        contributionToCurrentTotal: contrib,
                    };
                });

                const gscQueryPosts = gscTopQueries.slice(0, 3).map((q: any, idx: number) => {
                    const clicks = q.clicks || 0;
                    const ctr = typeof q.ctr === "number" ? q.ctr : (parseFloat(q.ctr) || 0);
                    const posStr = q.position ? ` (Pos ${typeof q.position === "number" ? q.position.toFixed(1) : q.position})` : "";
                    const contrib = totalViews > 0 ? Math.round((clicks / totalViews) * 100) : 0;
                    return {
                        id: `gsc-query-${idx}-${q.query}`,
                        platform: "Google Search Console",
                        publishedAt: "",
                        title: `Search Query: "${q.query}"${posStr}`,
                        url: `${siteBase.replace(/\/$/, "")}/search?q=${encodeURIComponent(q.query)}`,
                        currentValue: clicks,
                        engagements: Math.round(clicks * (Math.max(1, ctr) / 100)),
                        engagementRate: Number(ctr.toFixed(1)),
                        contributionToCurrentTotal: contrib,
                    };
                });

                const topPosts = [...landingPagePosts.slice(0, 4), ...gscQueryPosts].slice(0, 6);

                return {
                    totalViews,
                    totalEngagements,
                    platformData,
                    followersGained: 0,
                    totalCurrentFollowers: 0,
                    totalBaselineFollowers: 0,
                    timelineData: Object.values(timelineMap),
                    timelineMap,
                    previousTimelineMap,
                    topPosts,
                    previousViews: prevTotalViews,
                    previousEngagements: prevTotalEngagements,
                    previousPlatformData,
                    previousPostsPublished: previousPlatformData.length,
                    prevFollowersStart: null,
                    prevFollowersEnd: null,
                    postsPublished: platformData.length,
                };
            }
        } catch (e) {
            console.error("Error fetching GA4 metrics for summary:", e);
        }
    } else if (hasGsc) {
        // GSC-only standalone client
        const gscEngagements = Math.round(gscCurClicks * (Math.max(1, gscCurCtr) / 100));
        const prevGscEngagements = Math.round(gscPrevClicks * (Math.max(1, gscPrevCtr) / 100));
        const platformData: PlatformMetric[] = [{
            platform: "Google Search Console",
            views: gscCurClicks,
            engagements: gscEngagements,
            engagementRate: Number(gscCurCtr.toFixed(1)),
            followersGained: 0,
            followers: 0,
            postsPublished: gscTopQueries.length || 0,
        }];

        const previousPlatformData = [{
            platform: "Google Search Console",
            views: gscPrevClicks,
            engagements: prevGscEngagements,
            postsPublished: gscTopQueries.length || 0,
        }];

        const timelineMap: Record<string, { date: string; views: number; engagement: number }> = {};
        for (let d = new Date(periodStartDate); d <= periodEndDate; d.setDate(d.getDate() + 1)) {
            const dStr = d.toISOString().split("T")[0];
            const dFormatted = d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
            timelineMap[dStr] = { date: dFormatted, views: 0, engagement: 0 };
        }
        if (gscData && Array.isArray(gscData.daily_breakdown)) {
            gscData.daily_breakdown.forEach((day: any) => {
                if (timelineMap[day.date]) {
                    timelineMap[day.date].views = day.clicks || 0;
                    timelineMap[day.date].engagement = Math.round((day.clicks || 0) * ((day.ctr || 5) / 100));
                }
            });
        }

        const topPosts = gscTopQueries.slice(0, 5).map((q: any, idx: number) => ({
            id: `gsc-query-${idx}`,
            platform: "Google Search Console",
            publishedAt: "",
            title: `Query: "${q.query}" (Rank ${typeof q.position === "number" ? q.position.toFixed(1) : q.position})`,
            url: undefined,
            currentValue: q.clicks || 0,
            engagements: Math.round((q.clicks || 0) * (((q.ctr || 5)) / 100)),
            engagementRate: Number((q.ctr || 0).toFixed(1)),
            contributionToCurrentTotal: gscCurClicks > 0 ? Math.round(((q.clicks || 0) / gscCurClicks) * 100) : 0,
        }));

        return {
            totalViews: gscCurClicks,
            totalEngagements: gscEngagements,
            platformData,
            followersGained: 0,
            totalCurrentFollowers: 0,
            totalBaselineFollowers: 0,
            timelineData: Object.values(timelineMap),
            timelineMap,
            previousTimelineMap: {},
            topPosts,
            previousViews: gscPrevClicks,
            previousEngagements: prevGscEngagements,
            previousPlatformData,
            previousPostsPublished: 1,
            prevFollowersStart: null,
            prevFollowersEnd: null,
            postsPublished: 1,
        };
    }

    // Default fallback to standard computeMetrics
    return computeMetrics([], dateRange, periodStartStr, periodEndStr, clientId);
}

