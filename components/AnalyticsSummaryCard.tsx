import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Sparkles, RefreshCw, ThumbsUp, AlertTriangle, Target, Star,
    ChevronDown, ChevronUp, ExternalLink, Eye, PlaySquare, Heart, MessageCircle, 
    Share2, ArrowUpRight, BarChart3, Users, TrendingUp, CheckCircle2, ArrowRight, XCircle, Video, FileText,
    ShoppingBag, Globe, DollarSign, Megaphone, Zap, Loader2
} from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { createClient } from "@supabase/supabase-js";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { format, formatDistanceToNow } from "date-fns";
import { isDataStale, FRESHNESS_POLICIES } from "@/lib/freshnessPolicy";
import { useSummaryMetrics, PlatformMetric } from "@/hooks/useSummaryMetrics";
import { useAllTimeTopPosts } from "@/hooks/useAllTimeTopPosts";
import { AllTimeTopPostsModal } from "@/components/AllTimeTopPostsModal";
import { useSyncState } from "@/hooks/useSyncState";

interface SummaryData {
    strengths: string[];
    weaknesses: string[];
    smartActions: string[];
    highlights: string[];
}

interface AnalyticsSummaryCardProps {
    clientId: string;
    type: "social" | "website" | string;
    title: string;
    icon: React.ReactNode;
    dateRange?: string;
    customDateRange?: { start: Date; end: Date };
    isActive?: boolean;
    liveFollowers?: Record<string, number> | null;
    socialMetrics?: Record<string, any> | null;
}

export function AnalyticsSummaryCard({ 
    clientId, 
    type, 
    title, 
    icon, 
    dateRange = "7d", 
    customDateRange, 
    isActive = true,
    liveFollowers,
    socialMetrics
}: AnalyticsSummaryCardProps) {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    
    // Note: sessionReady removed — Supabase client handles auth internally.
    // Gating on sessionReady caused auth-state events to briefly set it false,
    // which dropped React Query cached data mid-session.
    const [chartMetric, setChartMetric] = useState<'views' | 'engagement'>('views');
    const [refreshPhase, setRefreshPhase] = useState<'idle' | 'syncing' | 'analyzing'>('idle');

    // sessionConfirmed logic removed to prevent dropping cache and gating requests

    const { status: syncStatus, isSyncing, isDegraded, retry } = useSyncState(clientId, type, `${type}_summary`);

    const prevSyncing = useRef(isSyncing);
    useEffect(() => {
        if (prevSyncing.current && !isSyncing) {
            queryClient.invalidateQueries({ queryKey: ["analytics-summary", clientId, type] });
        }
        prevSyncing.current = isSyncing;
    }, [isSyncing, queryClient, clientId, type]);

    // 1. Fetch AI Summary
    const [fetchError, setFetchError] = useState<string | null>(null);

    const { data: cachedSummary, isLoading: isLoadingCache, isFetching: isFetchingCache } = useQuery({
        queryKey: ["analytics-summary", clientId, type],
        queryFn: async () => {
            // Use the Next.js @supabase/ssr client which uses cookies and bypasses localStorage locks!
            const { createClient } = await import("@/lib/supabase/browser");
            const browserSupabase = createClient();

            // Verify session from cookies quickly
            const { data: { session } } = await browserSupabase.auth.getSession();
            if (!session) {
                console.log(`[AnalyticsSummaryCard] No session from cookies, cannot fetch`);
                return null;
            }

            console.log(`[AnalyticsSummaryCard] Starting fetch with Next.js SSR client for client_id=${clientId}, type=${type}`);
            
            const { data, error } = await browserSupabase
                .from("analytics_summaries" as any)
                .select("summary_data, generated_at, period_start, period_end")
                .eq("client_id", clientId)
                .eq("type", type)
                .order("generated_at", { ascending: false })
                .limit(1)
                .maybeSingle();

            if (error) {
                console.error('[AnalyticsSummaryCard] analytics_summaries fetch error:', error);
                setFetchError(JSON.stringify(error));
                return null;
            }
            
            setFetchError(null);
            console.log('[AnalyticsSummaryCard] Fetched summary:', data?.generated_at, 'keys:', data ? Object.keys((data as any)?.summary_data || {}) : 'null');
            return data;
        },
        enabled: !!clientId,
        staleTime: 0, // Force fetch on mount/focus to bypass bad caches
        retry: 3,
        retryDelay: 1000
    });

    // 2. Fetch Hard Metrics (Views by platform, Engagement)
    const isSocial = type === "social";

    // Calculate the actual string bounds for the dashboard date filter
    const getPeriodBounds = () => {
        if (dateRange === "custom" && customDateRange) {
            return {
                start: customDateRange.start.toISOString().split("T")[0],
                end: customDateRange.end.toISOString().split("T")[0]
            };
        }
        const now = new Date();
        const periodEnd = now.toISOString().split("T")[0];
        const daysToSubtract = dateRange === "90d" ? 90 : dateRange === "60d" ? 60 : dateRange === "30d" ? 30 : dateRange === "14d" ? 14 : 7;
        const periodStart = new Date(now);
        periodStart.setDate(periodStart.getDate() - daysToSubtract);
        return {
            start: periodStart.toISOString().split("T")[0],
            end: periodEnd
        };
    };
    const bounds = getPeriodBounds();
    
    const { data: metricsData, isLoading: isLoadingMetrics, isFetching: isFetchingMetrics } = useSummaryMetrics(isSocial ? clientId : "", dateRange, customDateRange, isActive);

    // 3. Fetch Top Posts
    const { data: topPosts, isLoading: isLoadingTopPosts } = useAllTimeTopPosts(isSocial ? clientId : undefined, isSocial ? 4 : 0, undefined, bounds.start, bounds.end);

    const summary: SummaryData | null = (cachedSummary as any)?.summary_data || null;
    const isGenerating = isSyncing;
    
    // Parse the lists, falling back to empty
    const strengths = summary?.strengths || [];
    const weaknesses = summary?.weaknesses || [];
    const actions = summary?.smartActions || [];
    
    // Derived Analytics - fallback to ai metrics for website/lms/ads, use hook metrics for social
    const aiMetrics = (summary as any)?.metrics || {};
    const platformData = metricsData?.platformData || [];
    
    // We want to combine platformData with any other platforms present in liveFollowers or socialMetrics.
    const allPlatforms = new Set<string>();
    platformData.forEach(p => allPlatforms.add(String(p.platform).toLowerCase()));
    
    if (liveFollowers) {
        Object.keys(liveFollowers).forEach(p => allPlatforms.add(p.toLowerCase()));
    }
    if (socialMetrics) {
        Object.keys(socialMetrics).forEach(p => allPlatforms.add(p.toLowerCase()));
    }

    // Process platformData to inject live followers directly so the Platform Breakdown table is perfect
    const optimizedPlatformData = Array.from(allPlatforms).map(plToLower => {
        const existingData = platformData.find(p => String(p.platform).toLowerCase() === plToLower);
        const fallbackViews = socialMetrics?.[plToLower]?.page_views || socialMetrics?.[plToLower]?.impressions || socialMetrics?.[plToLower]?.views || 0;
        const fallbackEngagements = socialMetrics?.[plToLower]?.engagements || 0;
        
        const finalViews = existingData?.views || fallbackViews;
        const finalEngagements = existingData?.engagements || fallbackEngagements;

        return {
            platform: plToLower,
            views: finalViews,
            engagementRate: existingData?.engagementRate || (finalViews > 0 ? (finalEngagements / finalViews) * 100 : 0),
            engagements: finalEngagements,
            followers: liveFollowers?.[plToLower] || socialMetrics?.[plToLower]?.followers || existingData?.followers || 0,
            followersGained: (existingData?.followersGained || 0) !== 0 
                ? existingData.followersGained 
                : (socialMetrics?.[plToLower]?.new_followers ?? 0)
        };
    });

    let optimizedTotalViews = 0;
    let optimizedTotalEngagements = 0;
    let optimizedTotalFollowersGained = 0;

    if (type === 'social') {
        optimizedPlatformData.forEach(plat => {
            optimizedTotalViews += plat.views;
            optimizedTotalEngagements += plat.engagements;
            optimizedTotalFollowersGained += (plat.followersGained || 0);
        });
    }

    const totalViews = type === 'social' 
        ? (optimizedTotalViews || metricsData?.totalViews || aiMetrics.total_views || 0) 
        : (aiMetrics.total_views || 0);
        
    const totalEngagements = type === 'social'
        ? (optimizedTotalEngagements || metricsData?.totalEngagements || 0)
        : (metricsData?.totalEngagements || 0);

    const followersGained = type === 'social'
        ? (optimizedTotalFollowersGained || aiMetrics.followers_gained || 0)
        : (aiMetrics.followers_gained || 0);

    // Calculate accurate total current followers directly from live props if available
    let totalCurrentFollowers = type === 'social' ? (metricsData?.totalCurrentFollowers || aiMetrics.total_followers || 0) : 0;
    if (type === 'social' && (liveFollowers || socialMetrics)) {
        let accurateTotal = 0;
        optimizedPlatformData.forEach(plat => {
            accurateTotal += plat.followers;
        });
        if (accurateTotal > 0) {
            totalCurrentFollowers = accurateTotal;
        }
    }

    const timelineData = metricsData?.timelineData || [];
    
    // Find highest platform by views (most intuitive for 'Primary Channel')
    const validTopPlatform = aiMetrics.top_platform && aiMetrics.top_platform !== "None" ? aiMetrics.top_platform : null;
    const bestPlatform = validTopPlatform || [...optimizedPlatformData].sort((a,b) => b.views - a.views)[0]?.platform || "None";

    
    // Extract thumbnail for YouTube videos
    const getThumbnailUrl = (url: string | null | undefined, platform: string | null | undefined) => {
        if (!url || !platform) return null;
        if (platform.toLowerCase() === 'youtube') {
            let videoId = '';
            if (url.includes('youtube.com/watch?v=')) {
                videoId = url.split('v=')[1]?.split('&')[0];
            } else if (url.includes('youtu.be/')) {
                videoId = url.split('youtu.be/')[1]?.split('?')[0];
            } else if (url.includes('youtube.com/shorts/')) {
                videoId = url.split('shorts/')[1]?.split('?')[0];
            }
            if (videoId) return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
        }
        return null;
    };
    
    // Dynamic thumbnail fetching for all top posts
    const [thumbnails, setThumbnails] = useState<Record<string, string>>({});

    useEffect(() => {
        const fetchAllThumbnails = async () => {
            if (!topPosts || topPosts.length === 0) return;
            
            await Promise.all(topPosts.map(async (post) => {
                if (!post.post_url) return;
                
                // If Youtube, do it natively without hitting the API
                const nativeThumb = getThumbnailUrl(post.post_url, post.platform);
                if (nativeThumb) {
                    setThumbnails(prev => ({ ...prev, [post.id]: nativeThumb }));
                    return;
                }

                // Skip if we already have it
                if (thumbnails[post.id]) return;

                // Otherwise, hit our generic proxy API route
                try {
                    const res = await fetch(`/api/thumbnail?url=${encodeURIComponent(post.post_url)}`);
                    if (res.ok) {
                        const data = await res.json();
                        if (data.url) {
                            setThumbnails(prev => ({ ...prev, [post.id]: data.url }));
                        }
                    }
                } catch (err) {
                    // silently fail for individual thumbnails
                }
            }));
        };

        fetchAllThumbnails();
    }, [topPosts]);
    
    const formatNumber = (num: number) => {
        if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
        if (num >= 1000) return (num / 1000).toFixed(1) + "K";
        return num.toString();
    };

    // Helper for rendering chips in the 'What's working' and 'Needs Attention' areas
    const renderMiniChip = (text: string, type: 'success' | 'warning') => {
        const point = text.split(':')[0].replace(/\*\*/g, '').trim();
        const colors = type === 'success' ? 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20' : 'bg-amber-500/10 text-amber-700 border-amber-500/20';
        return (
            <div className={`px-2.5 py-1.5 rounded-md text-xs font-medium border ${colors} leading-relaxed`}>
                {point}
            </div>
        );
    };

    const hasDataToRender = summary || (type === 'social' && totalViews > 0) || isGenerating;
    const engagementRate = type === 'social' 
        ? (totalViews > 0 ? (totalEngagements / totalViews) * 100 : 0)
        : (aiMetrics.engagement_rate || 0);
    const topInsight = summary?.highlights?.[0] || summary?.strengths?.[0];

    const dateRangeLabel = dateRange === "7d" ? "Last 7 Days" :
                           dateRange === "14d" ? "Last 14 Days" :
                           dateRange === "30d" ? "Last 30 Days" :
                           dateRange === "60d" ? "Last 60 Days" :
                           dateRange === "90d" ? "Last 90 Days" :
                           "Custom Range";

    return (
        <Card className="border-border/50 bg-card shadow-sm overflow-hidden flex flex-col relative w-full">
            {/* Header Area */}
            <CardHeader className="pb-4 bg-background border-b border-border/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-6 z-10 pt-6">
                <div className="flex items-center gap-3">
                    <CardTitle className="text-xl flex items-center gap-2 font-bold tracking-tight">
                        {title}
                        {(isFetchingCache || isFetchingMetrics || refreshPhase !== 'idle') && (
                            <RefreshCw className="h-4 w-4 animate-spin text-primary/40 ml-1" />
                        )}
                    </CardTitle>
                </div>
                <div className="flex items-center gap-2">
                    <div className="flex flex-col items-end gap-1 mr-2">
                        {isDegraded && (
                            <div className="text-[10px] text-amber-500 flex items-center gap-1 font-medium bg-amber-500/10 px-2 py-0.5 rounded-full">
                                <AlertTriangle className="h-2.5 w-2.5" />
                                Degraded (Showing Stale Data)
                            </div>
                        )}
                        {!isDegraded && (cachedSummary as any)?.generated_at && (
                            <div className="text-[10px] text-muted-foreground/60 flex items-center gap-1 font-medium bg-muted/40 px-2 py-0.5 rounded-full">
                                <Sparkles className="h-2.5 w-2.5" />
                                Generated {formatDistanceToNow(new Date((cachedSummary as any).generated_at), { addSuffix: true })}
                            </div>
                        )}
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => retry()}
                        disabled={isGenerating || !isActive}
                        className="h-9 text-xs font-medium shadow-sm w-fit gap-2"
                    >
                        {isSyncing ? <Sparkles className="h-4 w-4 animate-spin" /> : 
                         <RefreshCw className="h-4 w-4" />}
                        {isSyncing ? "Analyzing..." : 
                         "Refresh Analysis"}
                    </Button>
                </div>
            </CardHeader>

            <CardContent className="p-0 z-10 w-full relative">
                {(isLoadingCache || isLoadingMetrics) && !hasDataToRender ? (
                     <div className="p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 w-full">
                         <div className="lg:col-span-5"><Skeleton className="h-[400px] w-full rounded-2xl" /></div>
                         <div className="lg:col-span-7 space-y-4">
                             <div className="flex gap-4"><Skeleton className="h-24 w-1/2 rounded-xl" /><Skeleton className="h-24 w-1/2 rounded-xl" /></div>
                             <Skeleton className="h-32 w-full rounded-xl" />
                             <Skeleton className="h-40 w-full rounded-xl" />
                         </div>
                     </div>
                ) : !hasDataToRender && !isLoadingCache && !isLoadingMetrics ? (
                    <div className="p-12 text-center text-muted-foreground flex flex-col items-center justify-center">
                         <Target className="h-10 w-10 mb-4 opacity-20" />
                         <p className="text-sm font-medium">Insufficient data for executive summary</p>
                    </div>
                ) : (
                    <div className="w-full flex flex-col bg-background/30 p-6">
                        
                        {/* Highlights Banner */}
                        {topInsight && (
                            <div className="w-full mb-6 py-4 px-5 rounded-xl bg-violet-50/50 dark:bg-violet-950/20 border border-violet-100 dark:border-violet-900 flex items-center gap-3">
                                {type === 'social' ? <PlaySquare className="h-5 w-5 text-violet-500 shrink-0" /> : <Sparkles className="h-5 w-5 text-violet-500 shrink-0" />}
                                <p className="text-sm font-medium text-foreground/90">{topInsight.replace(/\*\*/g, '')}</p>
                            </div>
                        )}

                        {/* KPI Widgets */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                            <div className="bg-card border border-border/80 rounded-xl p-5 shadow-xs">
                                <p className="text-sm font-semibold text-foreground mb-3">
                                    {type === 'ads' ? `Ad Spend (${dateRangeLabel})` : `Total Views (${dateRangeLabel})`}
                                </p>
                                <p className="text-3xl font-bold tracking-tight mb-2">
                                    {type === 'ads' ? `$${formatNumber(aiMetrics.total_spend || 0)}` : formatNumber(totalViews)}
                                </p>
                                {timelineData.length > 0 && (
                                    <div className="h-8 w-full mt-2">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <AreaChart data={timelineData}>
                                                <defs>
                                                    <linearGradient id="colorViews" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="5%" stopColor={type === 'ads' ? "#10b981" : "#8b5cf6"} stopOpacity={0.2}/>
                                                        <stop offset="95%" stopColor={type === 'ads' ? "#10b981" : "#8b5cf6"} stopOpacity={0}/>
                                                    </linearGradient>
                                                </defs>
                                                <Area type="monotone" dataKey="views" stroke={type === 'ads' ? "#10b981" : "#8b5cf6"} strokeWidth={1.5} fill="url(#colorViews)" />
                                            </AreaChart>
                                        </ResponsiveContainer>
                                    </div>
                                )}
                            </div>
                            <div className="bg-card border border-border/80 rounded-xl p-5 shadow-xs">
                                <p className="text-sm font-semibold text-foreground mb-3">
                                    {type === 'ads' ? 'ROAS' : 'Avg. Engagement Rate'}
                                </p>
                                <p className="text-3xl font-bold tracking-tight mb-2">
                                    {type === 'ads' ? `${(aiMetrics.roas || 0).toFixed(2)}x` : `${engagementRate.toFixed(1)}%`}
                                </p>
                                {timelineData.length > 0 && (
                                    <div className="h-8 w-full mt-2">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <AreaChart data={timelineData}>
                                                <defs>
                                                    <linearGradient id="colorEngagement" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="5%" stopColor={type === 'ads' ? "#f59e0b" : "#3b82f6"} stopOpacity={0.2}/>
                                                        <stop offset="95%" stopColor={type === 'ads' ? "#f59e0b" : "#3b82f6"} stopOpacity={0}/>
                                                    </linearGradient>
                                                </defs>
                                                <Area type="monotone" dataKey="engagement" stroke={type === 'ads' ? "#f59e0b" : "#3b82f6"} strokeWidth={1.5} fill="url(#colorEngagement)" />
                                            </AreaChart>
                                        </ResponsiveContainer>
                                    </div>
                                )}
                            </div>
                            <div className="bg-card border border-border/80 rounded-xl p-5 shadow-xs">
                                <p className="text-sm font-semibold text-foreground mb-3">
                                    {type === 'social' ? 'Total Followers' : (type === 'ads' ? 'Total Conversions' : (aiMetrics.total_sales > 0 ? 'Total Sales' : 'Unique Visitors'))}
                                </p>
                                <p className="text-3xl font-bold tracking-tight mb-2">
                                    {type === 'social' 
                                        ? formatNumber(totalCurrentFollowers || 0) 
                                        : (type === 'ads' ? formatNumber(aiMetrics.total_conversions || 0) : (aiMetrics.total_sales > 0 ? `$${formatNumber(aiMetrics.total_sales)}` : formatNumber(aiMetrics.unique_visitors || 0)))
                                    }
                                </p>
                                <div className="h-8 w-full mt-2 flex items-center">
                                    {type === 'social' ? (
                                        followersGained !== 0 ? (
                                            <div className={`text-xs font-medium flex items-center gap-1.5 ${followersGained > 0 ? "text-emerald-600" : "text-rose-600"}`}>
                                                <TrendingUp className={`h-3.5 w-3.5 ${followersGained < 0 && "rotate-180"}`} /> 
                                                {followersGained > 0 ? `+${formatNumber(followersGained)}` : formatNumber(followersGained)} this period
                                            </div>
                                        ) : null
                                    ) : (
                                        <div className="text-xs font-medium text-emerald-600 flex items-center gap-1.5">
                                            {type === 'ads' ? <Target className="h-3.5 w-3.5" /> : (aiMetrics.total_sales > 0 ? <ShoppingBag className="h-3.5 w-3.5" /> : <Users className="h-3.5 w-3.5" />)}
                                            Active results
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="bg-card border border-border/80 rounded-xl p-5 shadow-xs">
                                <p className="text-sm font-semibold text-foreground mb-3">{type === 'social' ? 'Top Platform' : (type === 'ads' ? 'Top Campaign' : 'Top Source')}</p>
                                <div className="flex items-center gap-3">
                                    <div className={`${type === 'social' ? 'bg-rose-500/10 text-rose-500' : 'bg-emerald-500/10 text-emerald-500'} p-2.5 rounded-lg`}>
                                        {type === 'social' ? <PlaySquare className="h-5 w-5" /> : (type === 'ads' ? <Megaphone className="h-5 w-5" /> : <Globe className="h-5 w-5" />)}
                                    </div>
                                    <div>
                                        <p className="font-bold text-lg capitalize line-clamp-1">{typeof bestPlatform === 'string' ? bestPlatform : "None"}</p>
                                        <p className="text-xs text-muted-foreground mt-0.5">
                                            {type === 'ads' ? 'Best Performer' : 'Primary Channel'}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Main Grid */}
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                            {/* Left Column (Approx 60%) */}
                            <div className="lg:col-span-12 xl:col-span-7 flex flex-col gap-6">
                                
                                {/* Performance Over Time Chart */}
                                {timelineData.length > 0 && (
                                    <div className="bg-card border border-border/80 rounded-2xl p-5 shadow-sm">
                                        <div className="flex items-center justify-between mb-6">
                                            <p className="font-semibold text-base">Performance Over Time</p>
                                            <div className="flex bg-muted/60 p-1 rounded-md">
                                                <button 
                                                    onClick={() => setChartMetric('views')} 
                                                    className={`px-3 py-1.5 rounded-sm text-xs font-medium transition-all ${chartMetric === 'views' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                                                >
                                                    Views
                                                </button>
                                                <button 
                                                    onClick={() => setChartMetric('engagement')} 
                                                    className={`px-3 py-1.5 rounded-sm text-xs font-medium transition-all ${chartMetric === 'engagement' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                                                >
                                                    Engagement
                                                </button>
                                            </div>
                                        </div>
                                        <div className="h-[240px] w-full">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <AreaChart data={timelineData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                                    <defs>
                                                        <linearGradient id="colorMain" x1="0" y1="0" x2="0" y2="1">
                                                            <stop offset="5%" stopColor={chartMetric === 'views' ? "#8b5cf6" : "#3b82f6"} stopOpacity={0.3}/>
                                                            <stop offset="95%" stopColor={chartMetric === 'views' ? "#8b5cf6" : "#3b82f6"} stopOpacity={0}/>
                                                        </linearGradient>
                                                    </defs>
                                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.5} />
                                                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} dy={10} minTickGap={30} />
                                                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(val) => formatNumber(val)} />
                                                    <RechartsTooltip 
                                                        contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))', backgroundColor: 'hsl(var(--background))', fontSize: '12px' }}
                                                        formatter={(value: number) => [formatNumber(value), chartMetric === 'views' ? 'Views' : 'Engagement']}
                                                    />
                                                    <Area 
                                                        type="monotone" 
                                                        dataKey={chartMetric} 
                                                        stroke={chartMetric === 'views' ? "#8b5cf6" : "#3b82f6"} 
                                                        strokeWidth={2} 
                                                        fillOpacity={1} 
                                                        fill="url(#colorMain)" 
                                                    />
                                                </AreaChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>
                                )}

                                {/* Top Content List */}
                                <div className="bg-transparent">
                                    <div className="flex items-center justify-between mb-4">
                                        <p className="font-semibold text-lg leading-none">{type === 'social' ? 'Top Content' : (type === 'ads' ? 'Active Campaigns' : 'Top Pages')}</p>
                                        {type === 'social' && (
                                            <AllTimeTopPostsModal clientId={clientId} buttonLabel="🏆 View Hall of Fame" buttonSize="sm" buttonVariant="outline" />
                                        )}
                                    </div>
                                    <div className="flex flex-col gap-3">
                                        {topPosts && topPosts.length > 0 ? topPosts.map((post, idx) => (
                                            <a 
                                                key={idx} 
                                                href={post.post_url} 
                                                target="_blank" 
                                                rel="noopener noreferrer"
                                                className="flex gap-4 p-3 bg-card border border-border/80 rounded-xl hover:bg-muted/30 hover:border-primary/30 transition-all group block hover:shadow-sm"
                                            >
                                                {/* Mini Thumbnail */}
                                                <div className="h-16 w-16 sm:h-20 sm:w-24 rounded-lg bg-muted flex-shrink-0 relative overflow-hidden flex items-center justify-center">
                                                    {(getThumbnailUrl(post.post_url, post.platform) || thumbnails[post.id]) ? (
                                                        <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${getThumbnailUrl(post.post_url, post.platform) || thumbnails[post.id]})` }}></div>
                                                    ) : (
                                                        type === 'social' ? <Video className="h-6 w-6 text-muted-foreground/40" /> : (type === 'ads' ? <Megaphone className="h-6 w-6 text-muted-foreground/40" /> : <Eye className="h-6 w-6 text-muted-foreground/40" />)
                                                    )}
                                                    <div className="absolute inset-0 bg-black/10 flex items-center justify-center group-hover:bg-black/20 transition-colors">
                                                        {type === 'social' ? <PlaySquare className="h-6 w-6 text-white/80 drop-shadow-sm" /> : (type === 'ads' ? <ArrowUpRight className="h-6 w-6 text-white/80 drop-shadow-sm" /> : <ArrowRight className="h-6 w-6 text-white/80 drop-shadow-sm" />)}
                                                    </div>
                                                </div>
                                                {/* Details */}
                                                <div className="flex-1 min-w-0 pr-2">
                                                    <div className="flex items-center justify-between mb-1">
                                                        <h5 className="font-semibold text-sm line-clamp-1 group-hover:text-primary transition-colors" title={post.title || 'Untitled Post'}>
                                                            {post.title || 'Untitled Post'}
                                                        </h5>
                                                        <ExternalLink className="h-3 w-3 text-muted-foreground/50 opacity-0 group-hover:opacity-100 transition-opacity" />
                                                    </div>
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <Badge variant="secondary" className="text-[10px] h-5 py-0 px-1.5 capitalize font-medium">{post.platform}</Badge>
                                                        <span className="text-[11px] text-muted-foreground">{post.published_at ? format(new Date(post.published_at), "MMM d") : ""}</span>
                                                    </div>
                                                    <div className="flex items-center gap-4 text-xs font-semibold text-muted-foreground">
                                                        <span className="flex items-center gap-1 shrink-0"><Eye className="h-3.5 w-3.5"/> {formatNumber(post.views)} views</span>
                                                        <span className="flex items-center gap-1 shrink-0"><Heart className="h-3.5 w-3.5"/> {formatNumber(post.likes + post.comments + post.shares)} eng</span>
                                                    </div>
                                                </div>
                                            </a>
                                        )) : (
                                            <div className="p-8 border border-border/80 border-dashed rounded-xl text-center flex flex-col items-center">
                                                <FileText className="h-8 w-8 text-muted-foreground/30 mb-2" />
                                                <p className="text-sm font-medium text-foreground">No recent top content found</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Right Column (Approx 40%) */}
                            <div className="lg:col-span-12 xl:col-span-5 flex flex-col gap-6">
                                {/* Platform Breakdown Table */}
                                <div className="bg-card border border-border/80 rounded-2xl p-5 shadow-sm">
                                    <p className="font-semibold text-base mb-4">{type === 'social' ? 'Platform Breakdown' : (type === 'ads' ? 'Spend Distribution' : 'Traffic Sources')}</p>
                                    <div className="w-full">
                                        <div className="flex text-xs font-semibold text-muted-foreground mb-3 pb-2 border-b border-border/40 px-2">
                                            <div className={type === 'social' ? "w-1/4" : "w-1/3"}>Platform</div>
                                            {type === 'social' && <div className="w-1/4 text-center">Followers</div>}
                                            <div className={type === 'social' ? "w-1/4 text-center" : "w-1/3 text-center"}>Engagement rate</div>
                                            <div className={type === 'social' ? "w-1/4 text-right" : "w-1/3 text-right"}>Engagements</div>
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            {optimizedPlatformData.map((plat, idx) => (
                                                <div key={idx} className="flex items-center text-sm py-2 px-2 hover:bg-muted/40 rounded-lg group">
                                                    <div className={type === 'social' ? "w-1/4 flex items-center gap-2" : "w-1/3 flex items-center gap-2"}>
                                                        <Badge variant="outline" className="text-[10px] capitalize h-5">{plat.platform}</Badge>
                                                    </div>
                                                    {type === 'social' && (
                                                        <div className="w-1/4 text-center font-medium flex items-center justify-center gap-1.5 flex-wrap">
                                                            <span className="text-foreground">
                                                                {formatNumber(plat.followers || 0)}
                                                            </span>
                                                            {plat.followersGained !== 0 && (
                                                                <span className={`text-[10px] px-1.5 py-0.5 rounded-sm bg-muted/50 ${plat.followersGained > 0 ? "text-emerald-500" : "text-rose-500"}`}>
                                                                    {plat.followersGained > 0 ? `+${formatNumber(plat.followersGained)}` : formatNumber(plat.followersGained)}
                                                                </span>
                                                            )}
                                                        </div>
                                                    )}
                                                    <div className={type === 'social' ? "w-1/4 text-center font-medium" : "w-1/3 text-center font-medium"}>{plat.engagementRate.toFixed(1)}%</div>
                                                    <div className={type === 'social' ? "w-1/4 text-right font-medium text-muted-foreground" : "w-1/3 text-right font-medium text-muted-foreground"}>{formatNumber(plat.engagements)}</div>
                                                </div>
                                            ))}
                                            {optimizedPlatformData.length === 0 && (
                                                <p className="text-xs text-center text-muted-foreground py-4">No platform data available.</p>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* What's Working */}
                                {fetchError && (
                                    <div className="bg-red-500/10 border border-red-500/50 p-2 text-xs font-mono break-all mb-4">
                                        FETCH ERROR: {fetchError}
                                    </div>
                                )}
                                <div className="bg-card border border-border/80 rounded-2xl p-5 shadow-sm">
                                    <p className="font-semibold text-base mb-3">What's Working</p>
                                    <div className="flex flex-col gap-3">
                                        {isGenerating && strengths.length === 0 ? (
                                            <div className="flex items-center gap-2 text-muted-foreground text-sm py-2">
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                                Generating insights...
                                            </div>
                                        ) : strengths.length > 0 ? strengths.map((s, i) => (
                                            <div key={i} className="flex gap-3 items-start">
                                                <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                                                <p className="text-sm font-medium leading-snug">{s.replace(/\*\*/g, '')}</p>
                                            </div>
                                        )) : (
                                            <p className="text-xs text-muted-foreground py-2">No strengths identified yet.</p>
                                        )}
                                    </div>
                                </div>

                                {/* Needs Fixing */}
                                <div className="bg-card border border-border/80 rounded-2xl p-5 shadow-sm">
                                    <p className="font-semibold text-base mb-3">Needs Fixing</p>
                                    <div className="flex flex-col gap-3">
                                        {isGenerating && weaknesses.length === 0 ? (
                                            <div className="flex items-center gap-2 text-muted-foreground text-sm py-2">
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                                Analyzing performance...
                                            </div>
                                        ) : weaknesses.length > 0 ? weaknesses.map((w, i) => (
                                            <div key={i} className="flex gap-3 items-start">
                                                <XCircle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                                                <p className="text-sm font-medium leading-snug text-foreground/90">{w.replace(/\*\*/g, '')}</p>
                                            </div>
                                        )) : (
                                            <p className="text-xs text-muted-foreground py-2">No areas needing fixing identified yet.</p>
                                        )}
                                    </div>
                                </div>

                                {/* Recommended Actions */}
                                <div className="bg-blue-50/40 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900 rounded-2xl p-5 shadow-sm mt-2">
                                    <p className="font-semibold text-base mb-4 text-blue-900 dark:text-blue-100 flex items-center gap-2">
                                        Recommended Actions
                                    </p>
                                    <div className="flex flex-col gap-4 text-sm font-medium">
                                        {isGenerating && actions.length === 0 ? (
                                            <div className="flex items-center gap-2 text-blue-700/70 dark:text-blue-300/70 text-sm py-2">
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                                Formulating recommendations...
                                            </div>
                                        ) : actions.length > 0 ? actions.map((act, i) => {
                                            const parts = act.split(':');
                                            const hasColon = parts.length > 1;
                                            return (
                                                <div key={i} className="flex gap-3 items-start group">
                                                    <span className="font-bold text-blue-600 dark:text-blue-400 mt-0.5 text-xs">{i+1}</span>
                                                    <div className="leading-snug text-blue-950 dark:text-blue-100">
                                                        {hasColon ? parts[0].replace(/\*\*/g, '') : act.replace(/\*\*/g, '')}
                                                    </div>
                                                </div>
                                            );
                                        }) : (
                                            <p className="text-xs text-blue-700/60 dark:text-blue-300/60 py-2">No recommended actions available.</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
