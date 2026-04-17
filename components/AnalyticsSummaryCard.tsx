import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Sparkles, RefreshCw, ThumbsUp, AlertTriangle, Target, Star,
    ChevronDown, ChevronUp, ExternalLink, Eye, PlaySquare, Heart, MessageCircle, 
    Share2, ArrowUpRight, BarChart3, Users, TrendingUp, CheckCircle2, ArrowRight, XCircle, Video, FileText
} from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { isDataStale } from "@/lib/freshnessPolicy";
import { useSummaryMetrics, PlatformMetric } from "@/hooks/useSummaryMetrics";
import { useAllTimeTopPosts } from "@/hooks/useAllTimeTopPosts";

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
}

export function AnalyticsSummaryCard({ clientId, type, title, icon, dateRange = "7d", customDateRange }: AnalyticsSummaryCardProps) {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [sessionReady, setSessionReady] = useState(false);
    const [chartMetric, setChartMetric] = useState<'views' | 'engagement'>('views');

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session) setSessionReady(true);
        });
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSessionReady(!!session);
        });
        return () => subscription.unsubscribe();
    }, []);

    // 1. Fetch AI Summary
    const { data: cachedSummary, isLoading: isLoadingCache } = useQuery({
        queryKey: ["analytics-summary", clientId, type, sessionReady],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("analytics_summaries" as any)
                .select("summary_data, generated_at, period_start, period_end")
                .eq("client_id", clientId)
                .eq("type", type)
                .order("generated_at", { ascending: false })
                .limit(1)
                .maybeSingle();

            if (error) return null;
            return data;
        },
        enabled: !!clientId && sessionReady,
        staleTime: 7 * 24 * 60 * 60 * 1000, 
        gcTime: 7 * 24 * 60 * 60 * 1000,
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
        const daysToSubtract = dateRange === "60d" ? 60 : dateRange === "30d" ? 30 : 7;
        const periodStart = new Date(now);
        periodStart.setDate(periodStart.getDate() - daysToSubtract);
        return {
            start: periodStart.toISOString().split("T")[0],
            end: periodEnd
        };
    };
    const bounds = getPeriodBounds();
    
    const { data: metricsData, isLoading: isLoadingMetrics } = useSummaryMetrics(isSocial ? clientId : "", dateRange, customDateRange);

    // 3. Fetch Top Posts
    const { data: topPosts, isLoading: isLoadingTopPosts } = useAllTimeTopPosts(isSocial ? clientId : undefined, isSocial ? 4 : 0, undefined, bounds.start, bounds.end);

    const generateMutation = useMutation({
        mutationFn: async () => {
            const { data: { session } } = await supabase.auth.getSession();
            const response = await fetch(
                `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/generate-analytics-summary`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${session?.access_token}`,
                        apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
                    },
                    body: JSON.stringify({ clientId, type, dateRange }),
                }
            );
            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || "Failed to generate summary");
            }
            return response.json();
        },
        onSuccess: async (summaryData: SummaryData) => {
            const now = new Date();
            const periodEnd = now.toISOString().split("T")[0];
            const daysToSubtract = dateRange === "60d" ? 60 : dateRange === "30d" ? 30 : 7;
            const periodStart = new Date(now);
            periodStart.setDate(periodStart.getDate() - daysToSubtract);
            
            await supabase
                .from("analytics_summaries" as any)
                .upsert(
                    {
                        client_id: clientId,
                        type,
                        summary_data: summaryData,
                        period_start: periodStart.toISOString().split("T")[0],
                        period_end: periodEnd,
                        generated_at: now.toISOString(),
                    },
                    { onConflict: "client_id,type" }
                );

            queryClient.invalidateQueries({ queryKey: ["analytics-summary", clientId, type] });
            toast({ title: "Summary updated!", description: `${title} analysis refreshed with latest data.` });
        },
        onError: (error: Error) => {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        },
    });
    const hasAttemptedAutoRefresh = useRef(false);

    useEffect(() => {
        if (isLoadingCache || generateMutation.isPending || hasAttemptedAutoRefresh.current) return;
        
        let needsRegen = !cachedSummary;
        if (cachedSummary) {
           if (isDataStale((cachedSummary as any).generated_at, 'summary')) {
               needsRegen = true;
           }
        }

        if (needsRegen) {
            hasAttemptedAutoRefresh.current = true;
            // Background refresh for AI enabled
            setTimeout(() => generateMutation.mutate(), 100);
        }
    }, [isLoadingCache, cachedSummary, generateMutation.isPending]);

    const summary: SummaryData | null = generateMutation.data || (cachedSummary as any)?.summary_data || null;
    const isGenerating = generateMutation.isPending;
    
    // Parse the lists, falling back to empty
    const strengths = summary?.strengths || [];
    const weaknesses = summary?.weaknesses || [];
    const actions = summary?.smartActions || [];
    
    // Derived Analytics Let's use real metrics if we have them, else sum
    const totalViews = metricsData?.totalViews || 0;
    const totalEngagements = metricsData?.totalEngagements || 0;
    const platformData = metricsData?.platformData || [];
    const followersGained = metricsData?.followersGained || 0;
    const timelineData = metricsData?.timelineData || [];
    
    // Find highest engagement platform 
    const bestPlatform = [...platformData].sort((a,b) => b.engagementRate - a.engagementRate)[0];

    
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
    
    // Dynamic thumbnail fetching
    const [fetchedThumbnail, setFetchedThumbnail] = useState<string | null>(null);

    useEffect(() => {
        const fetchDynamicThumbnail = async () => {
            if (!topPosts || topPosts.length === 0) return;
            const hero = topPosts[0];
            if (!hero.post_url) return;
            
            // If Youtube, do it natively without hitting the API
            const nativeThumb = getThumbnailUrl(hero.post_url, hero.platform);
            if (nativeThumb) {
                setFetchedThumbnail(nativeThumb);
                return;
            }

            // Otherwise, hit our generic proxy API route
            try {
                const res = await fetch(`/api/thumbnail?url=${encodeURIComponent(hero.post_url)}`);
                if (res.ok) {
                    const data = await res.json();
                    if (data.url) {
                        setFetchedThumbnail(data.url);
                    }
                }
            } catch (err) {
                console.error("Failed to fetch thumbnail", err);
            }
        };

        fetchDynamicThumbnail();
    }, [topPosts]);

    const thumbnailUrl = fetchedThumbnail;
    
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

    const hasDataToRender = summary || (isSocial && totalViews > 0);
    const engagementRate = totalViews > 0 ? (totalEngagements / totalViews) * 100 : 0;
    const topInsight = summary?.highlights?.[0] || summary?.strengths?.[0];

    return (
        <Card className="border-border/50 bg-card shadow-sm overflow-hidden flex flex-col relative w-full">
            {/* Header Area */}
            <CardHeader className="pb-4 bg-background border-b border-border/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-6 z-10 pt-6">
                <div className="flex items-center gap-3">
                    <CardTitle className="text-xl flex items-center gap-2 font-bold tracking-tight">
                        {title}
                    </CardTitle>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => generateMutation.mutate()}
                        disabled={isGenerating}
                        className="h-9 text-xs font-medium shadow-sm w-fit"
                    >
                        <RefreshCw className={`h-4 w-4 mr-2 ${isGenerating ? 'animate-spin' : ''}`} />
                        {isGenerating ? "Analyzing..." : "Refresh Insights"}
                    </Button>
                </div>
            </CardHeader>

            <CardContent className="p-0 z-10 w-full relative">
                {isLoadingCache || isLoadingMetrics ? (
                     <div className="p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 w-full">
                         <div className="lg:col-span-5"><Skeleton className="h-[400px] w-full rounded-2xl" /></div>
                         <div className="lg:col-span-7 space-y-4">
                             <div className="flex gap-4"><Skeleton className="h-24 w-1/2 rounded-xl" /><Skeleton className="h-24 w-1/2 rounded-xl" /></div>
                             <Skeleton className="h-32 w-full rounded-xl" />
                             <Skeleton className="h-40 w-full rounded-xl" />
                         </div>
                     </div>
                ) : !hasDataToRender ? (
                    <div className="p-12 text-center text-muted-foreground flex flex-col items-center justify-center">
                         <Target className="h-10 w-10 mb-4 opacity-20" />
                         <p className="text-sm font-medium">Insufficient data for executive summary</p>
                    </div>
                ) : (
                    <div className="w-full flex flex-col bg-background/30 p-6">
                        
                        {/* Highlights Banner */}
                        {topInsight && (
                            <div className="w-full mb-6 py-4 px-5 rounded-xl bg-violet-50/50 dark:bg-violet-950/20 border border-violet-100 dark:border-violet-900 flex items-center gap-3">
                                <PlaySquare className="h-5 w-5 text-violet-500 shrink-0" />
                                <p className="text-sm font-medium text-foreground/90">{topInsight.replace(/\*\*/g, '')}</p>
                            </div>
                        )}

                        {/* KPI Widgets */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                            <div className="bg-card border border-border/80 rounded-xl p-5 shadow-xs">
                                <p className="text-sm font-semibold text-foreground mb-3">Total Views</p>
                                <p className="text-3xl font-bold tracking-tight mb-2">{formatNumber(totalViews)}</p>
                                {timelineData.length > 0 && (
                                    <div className="h-8 w-full mt-2">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <AreaChart data={timelineData}>
                                                <defs>
                                                    <linearGradient id="colorViews" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.2}/>
                                                        <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                                                    </linearGradient>
                                                </defs>
                                                <Area type="monotone" dataKey="views" stroke="#8b5cf6" strokeWidth={1.5} fill="url(#colorViews)" />
                                            </AreaChart>
                                        </ResponsiveContainer>
                                    </div>
                                )}
                            </div>
                            <div className="bg-card border border-border/80 rounded-xl p-5 shadow-xs">
                                <p className="text-sm font-semibold text-foreground mb-3">Engagement Rate</p>
                                <p className="text-3xl font-bold tracking-tight mb-2">{engagementRate.toFixed(1)}%</p>
                                {timelineData.length > 0 && (
                                    <div className="h-8 w-full mt-2">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <AreaChart data={timelineData}>
                                                <defs>
                                                    <linearGradient id="colorEngagement" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/>
                                                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                                                    </linearGradient>
                                                </defs>
                                                <Area type="monotone" dataKey="engagement" stroke="#3b82f6" strokeWidth={1.5} fill="url(#colorEngagement)" />
                                            </AreaChart>
                                        </ResponsiveContainer>
                                    </div>
                                )}
                            </div>
                            <div className="bg-card border border-border/80 rounded-xl p-5 shadow-xs">
                                <p className="text-sm font-semibold text-foreground mb-3">Followers Gained</p>
                                <p className="text-3xl font-bold tracking-tight mb-2">{followersGained > 0 ? `+${followersGained}` : followersGained}</p>
                                <div className="h-8 w-full mt-2 flex items-center">
                                    <div className={`text-xs font-medium flex items-center gap-1.5 ${followersGained >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                                        <TrendingUp className={`h-3.5 w-3.5 ${followersGained < 0 && "rotate-180"}`} /> 
                                        {Math.abs(followersGained)} this period
                                    </div>
                                </div>
                            </div>
                            <div className="bg-card border border-border/80 rounded-xl p-5 shadow-xs">
                                <p className="text-sm font-semibold text-foreground mb-3">Top Platform</p>
                                <div className="flex items-center gap-3">
                                    <div className="bg-rose-500/10 p-2.5 rounded-lg text-rose-500">
                                        <PlaySquare className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <p className="font-bold text-lg capitalize">{bestPlatform ? bestPlatform.platform : "None"}</p>
                                        <p className="text-xs text-muted-foreground mt-0.5">
                                            {bestPlatform && totalViews > 0 ? `${((bestPlatform.views / totalViews) * 100).toFixed(0)}% of views` : "0% of views"}
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
                                    <p className="font-semibold text-lg mb-4 leading-none">Top Content</p>
                                    <div className="flex flex-col gap-3">
                                        {topPosts && topPosts.length > 0 ? topPosts.map((post, idx) => (
                                            <div key={idx} className="flex gap-4 p-3 bg-card border border-border/80 rounded-xl hover:bg-muted/30 transition-colors">
                                                {/* Mini Thumbnail */}
                                                <div className="h-16 w-16 sm:h-20 sm:w-24 rounded-lg bg-muted flex-shrink-0 relative overflow-hidden flex items-center justify-center">
                                                    {(getThumbnailUrl(post.post_url, post.platform) || fetchedThumbnail) ? (
                                                        <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${getThumbnailUrl(post.post_url, post.platform) || fetchedThumbnail})` }}></div>
                                                    ) : (
                                                        <Video className="h-6 w-6 text-muted-foreground/40" />
                                                    )}
                                                    <div className="absolute inset-0 bg-black/10 flex items-center justify-center pointer-events-none">
                                                        <PlaySquare className="h-6 w-6 text-white/80 drop-shadow-sm" />
                                                    </div>
                                                </div>
                                                {/* Details */}
                                                <div className="flex-1 min-w-0 pr-2">
                                                    <h5 className="font-semibold text-sm line-clamp-1 mb-1" title={post.title || 'Untitled Post'}>{post.title || 'Untitled Post'}</h5>
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <Badge variant="secondary" className="text-[10px] h-5 py-0 px-1.5 capitalize font-medium">{post.platform}</Badge>
                                                        <span className="text-[11px] text-muted-foreground">{post.published_at ? format(new Date(post.published_at), "MMM d") : ""}</span>
                                                    </div>
                                                    <div className="flex items-center gap-4 text-xs font-semibold text-muted-foreground">
                                                        <span className="flex items-center gap-1 shrink-0"><Eye className="h-3.5 w-3.5"/> {formatNumber(post.views)} views</span>
                                                        <span className="flex items-center gap-1 shrink-0"><Heart className="h-3.5 w-3.5"/> {formatNumber(post.likes + post.comments + post.shares)} eng</span>
                                                    </div>
                                                </div>
                                            </div>
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
                                    <p className="font-semibold text-base mb-4">Platform Breakdown</p>
                                    <div className="w-full">
                                        <div className="flex text-xs font-semibold text-muted-foreground mb-3 pb-2 border-b border-border/40 px-2">
                                            <div className="w-1/3">Views</div>
                                            <div className="w-1/3 text-center">Engagement rate</div>
                                            <div className="w-1/3 text-right">Engagements</div>
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            {platformData.map((plat, idx) => (
                                                <div key={idx} className="flex items-center text-sm py-2 px-2 hover:bg-muted/40 rounded-lg group">
                                                    <div className="w-1/3 flex items-center gap-2">
                                                        <Badge variant="outline" className="text-[10px] capitalize h-5">{plat.platform}</Badge>
                                                    </div>
                                                    <div className="w-1/3 text-center font-medium">{plat.engagementRate.toFixed(1)}%</div>
                                                    <div className="w-1/3 text-right font-medium text-muted-foreground">{formatNumber(plat.engagements)}</div>
                                                </div>
                                            ))}
                                            {platformData.length === 0 && (
                                                <p className="text-xs text-center text-muted-foreground py-4">No platform data available.</p>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* What's Working */}
                                <div className="bg-card border border-border/80 rounded-2xl p-5 shadow-sm">
                                    <p className="font-semibold text-base mb-3">What's Working</p>
                                    <div className="flex flex-col gap-3">
                                        {strengths.length > 0 ? strengths.map((s, i) => (
                                            <div key={i} className="flex gap-3 items-start">
                                                <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                                                <p className="text-sm font-medium leading-snug">{s.replace(/\*\*/g, '')}</p>
                                            </div>
                                        )) : (
                                            <p className="text-xs text-muted-foreground">No strength insights available.</p>
                                        )}
                                    </div>
                                </div>

                                {/* Needs Fixing */}
                                <div className="bg-card border border-border/80 rounded-2xl p-5 shadow-sm">
                                    <p className="font-semibold text-base mb-3">Needs Fixing</p>
                                    <div className="flex flex-col gap-3">
                                        {weaknesses.length > 0 ? weaknesses.map((w, i) => (
                                            <div key={i} className="flex gap-3 items-start">
                                                <XCircle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                                                <p className="text-sm font-medium leading-snug text-foreground/90">{w.replace(/\*\*/g, '')}</p>
                                            </div>
                                        )) : (
                                            <p className="text-xs text-muted-foreground">No weakness insights available.</p>
                                        )}
                                    </div>
                                </div>

                                {/* Recommended Actions */}
                                <div className="bg-blue-50/40 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900 rounded-2xl p-5 shadow-sm mt-2">
                                    <p className="font-semibold text-base mb-4 text-blue-900 dark:text-blue-100 flex items-center gap-2">
                                        Recommended Actions
                                    </p>
                                    <div className="flex flex-col gap-4 text-sm font-medium">
                                        {actions.length > 0 ? actions.map((act, i) => {
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
                                            <p className="text-xs text-blue-700/60 dark:text-blue-300/60">No recommended actions available.</p>
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
