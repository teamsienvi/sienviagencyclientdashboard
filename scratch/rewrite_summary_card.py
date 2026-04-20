import os

def rewrite_summary_card():
    path = "components/AnalyticsSummaryCard.tsx"
    content = """import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Sparkles, RefreshCw, ThumbsUp, AlertTriangle, Target, Star,
    ChevronDown, ChevronUp, ExternalLink, PlaySquare, Heart, MessageCircle, 
    Share2, ArrowUpRight, BarChart3, Users
} from "lucide-react";
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
}

export function AnalyticsSummaryCard({ clientId, type, title, icon, dateRange = "7d" }: AnalyticsSummaryCardProps) {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [sessionReady, setSessionReady] = useState(false);

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
    const { data: metricsData, isLoading: isLoadingMetrics } = useSummaryMetrics(clientId, dateRange);

    // 3. Fetch Top Post (Hero)
    const { data: topPosts, isLoading: isLoadingTopPosts } = useAllTimeTopPosts(clientId, 1);

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

    useEffect(() => {
        if (isLoadingCache || generateMutation.isPending) return;
        
        let needsRegen = !cachedSummary;
        if (cachedSummary) {
           if (isDataStale((cachedSummary as any).generated_at, 'summary')) {
               needsRegen = true;
           }
        }

        if (needsRegen) {
            // Uncomment internally if fully enabling background refresh for AI
            // setTimeout(() => generateMutation.mutate(), 100);
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
    
    // Find highest engagement platform 
    const bestPlatform = [...platformData].sort((a,b) => b.engagementRate - a.engagementRate)[0];

    const formatNumber = (num: number) => {
        if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
        if (num >= 1000) return (num / 1000).toFixed(1) + "K";
        return num.toString();
    };

    // Helper for rendering chips in the 'What's working' and 'Needs Attention' areas
    const renderMiniChip = (text: string, type: 'success' | 'warning') => {
        const point = text.split(':')[0].replace(/\\*\\*/g, '').trim();
        const colors = type === 'success' ? 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20' : 'bg-amber-500/10 text-amber-700 border-amber-500/20';
        return (
            <div className={`px-2.5 py-1.5 rounded-md text-xs font-medium border ${colors} leading-relaxed`}>
                {point}
            </div>
        );
    };

    const hasDataToRender = summary || totalViews > 0;

    return (
        <Card className="border-border/50 bg-card shadow-sm overflow-hidden flex flex-col relative w-full">
            {/* Header Area */}
            <CardHeader className="pb-4 bg-muted/20 border-b border-border/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-6 z-10">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-gradient-to-br from-violet-500/10 to-fuchsia-500/10 border border-violet-500/20">
                        {icon}
                    </div>
                    <div>
                        <CardTitle className="text-lg flex items-center gap-2 font-bold tracking-tight">
                            {title}
                        </CardTitle>
                        <CardDescription className="text-xs uppercase tracking-wider font-medium mt-0.5">
                            Executive Portal Integration
                        </CardDescription>
                    </div>
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => generateMutation.mutate()}
                    disabled={isGenerating}
                    className="h-8 text-xs font-medium shadow-sm w-fit"
                >
                    <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isGenerating ? 'animate-spin' : ''}`} />
                    {isGenerating ? "Analyzing..." : "Refresh Insights"}
                </Button>
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
                    <div className="w-full flex">
                       <div className="p-5 sm:p-6 w-full bg-background/50 grid grid-cols-1 lg:grid-cols-12 gap-6">
                            
                            {/* Left Column: True Hero Top Content Card */}
                            <div className="lg:col-span-5 flex flex-col h-full">
                                <h3 className="text-xs font-bold tracking-widest text-muted-foreground uppercase mb-3 flex items-center gap-1.5">
                                    <Star className="h-3.5 w-3.5 text-violet-500" /> Top Content Driver
                                </h3>
                                
                                <div className="flex-1 bg-gradient-to-b from-card to-muted/20 border border-border/80 rounded-2xl overflow-hidden shadow-sm flex flex-col group relative">
                                    {topPosts && topPosts.length > 0 ? (
                                        <>
                                            <div className="relative w-full h-48 bg-muted/50 overflow-hidden flex items-center justify-center border-b border-border/40">
                                                {/* Simulated thumbnail background if generic */}
                                                <div className="absolute inset-0 bg-gradient-to-br from-violet-500/10 to-transparent z-0" />
                                                <PlaySquare className="h-10 w-10 text-muted-foreground/30 z-10" />
                                                
                                                <div className="absolute top-3 left-3 z-20">
                                                    <Badge variant="secondary" className="bg-background/80 backdrop-blur text-xs font-bold border-none shadow-sm capitalize">
                                                        {topPosts[0].platform}
                                                    </Badge>
                                                </div>
                                            </div>
                                            
                                            <div className="p-5 flex flex-col flex-1">
                                                <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider mb-2">
                                                    {format(new Date(topPosts[0].published_at), "MMM d, yyyy")}
                                                </p>
                                                <h4 className="text-[15px] font-bold text-foreground leading-snug line-clamp-3 mb-4 flex-1">
                                                    {topPosts[0].title || "Untitled Post"}
                                                </h4>
                                                
                                                <div className="grid grid-cols-3 gap-2 mt-auto pt-4 border-t border-border/50">
                                                    <div>
                                                        <p className="text-[10px] text-muted-foreground uppercase font-semibold">Views</p>
                                                        <p className="text-sm font-bold">{formatNumber(topPosts[0].views)}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-[10px] text-muted-foreground uppercase font-semibold">Engagements</p>
                                                        <p className="text-sm font-bold">
                                                            {formatNumber(topPosts[0].likes + topPosts[0].comments + topPosts[0].shares)}
                                                        </p>
                                                    </div>
                                                    <div className="text-right">
                                                        <a href={topPosts[0].post_url} target="_blank" rel="noopener noreferrer">
                                                            <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full hover:bg-violet-500/10 hover:text-violet-600">
                                                                <ArrowUpRight className="h-4 w-4" />
                                                            </Button>
                                                        </a>
                                                    </div>
                                                </div>
                                            </div>
                                        </>
                                    ) : (
                                        <div className="p-6 flex flex-col h-full justify-center text-center">
                                            <div className="h-12 w-12 rounded-full bg-violet-500/10 text-violet-500 flex items-center justify-center mx-auto mb-4">
                                                <Sparkles className="h-6 w-6" />
                                            </div>
                                            <p className="text-sm font-medium text-foreground mb-2">No top content found</p>
                                            <p className="text-xs text-muted-foreground">Generating placeholder insight based on analytics.</p>
                                            {strengths.length > 0 && (
                                                <div className="mt-6 p-4 bg-muted/30 rounded-xl text-left border">
                                                    <p className="text-[13px] font-medium leading-relaxed">{strengths[0].replace(/\\*\\*/g, '')}</p>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                            
                            {/* Right Column Matrix */}
                            <div className="lg:col-span-7 flex flex-col gap-6">
                                
                                {/* Top Row KPIs */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-card border border-border/60 rounded-2xl p-4 shadow-sm relative overflow-hidden group">
                                        <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none transition-opacity group-hover:opacity-10">
                                            <Eye className="h-16 w-16" />
                                        </div>
                                        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1.5 flex items-center gap-1.5"><Eye className="h-3.5 w-3.5"/> Total Views</h4>
                                        <p className="text-2xl font-bold tracking-tight text-foreground">{formatNumber(totalViews)}</p>
                                    </div>
                                    <div className="bg-card border border-border/60 rounded-2xl p-4 shadow-sm relative overflow-hidden group">
                                        <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none transition-opacity group-hover:opacity-10">
                                            <Heart className="h-16 w-16" />
                                        </div>
                                        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1.5 flex items-center gap-1.5"><Heart className="h-3.5 w-3.5"/> Best Engagement</h4>
                                        <p className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                                            {bestPlatform ? `${bestPlatform.engagementRate.toFixed(1)}%` : '0%'} 
                                            {bestPlatform && <Badge variant="outline" className="text-[10px] py-0 h-5 capitalize">{bestPlatform.platform}</Badge>}
                                        </p>
                                    </div>
                                </div>
                                
                                {/* Middle Row Recommended Moves */}
                                {actions.length > 0 && (
                                    <div className="bg-blue-500/5 border border-blue-500/20 rounded-2xl p-5 shadow-sm">
                                         <h4 className="text-[11px] font-bold tracking-widest text-blue-700 uppercase mb-3 flex items-center gap-1.5">
                                            <Target className="h-3.5 w-3.5" /> Recommended Next Moves
                                        </h4>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            {actions.slice(0, 4).map((act, i) => {
                                                const actParts = act.split(':');
                                                const hasActColon = actParts.length > 1;
                                                return (
                                                    <div key={i} className="bg-card/60 rounded-xl p-3 border border-border/50 text-sm flex items-start gap-2 shadow-sm">
                                                        <div className="h-5 w-5 rounded-full bg-blue-500/10 text-blue-600 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">{i+1}</div>
                                                        <p className="font-medium text-[13px] leading-tight text-foreground/90">{hasActColon ? actParts[0].replace(/\\*\\*/g, '') : act.replace(/\\*\\*/g, '')}</p>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                                
                                {/* Bottom Row: Diagnostics and Mini Charts */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 flex-1">
                                    <div className="bg-card border border-border/60 rounded-2xl p-4 shadow-sm flex flex-col justify-between h-full">
                                        <h4 className="text-[11px] font-bold tracking-widest text-muted-foreground uppercase mb-3 text-center sm:text-left">Working / Needs Attention</h4>
                                        <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
                                            {strengths.slice(0,2).map((s,i) => renderMiniChip(s, 'success'))}
                                            {weaknesses.slice(0,2).map((w,i) => renderMiniChip(w, 'warning'))}
                                        </div>
                                    </div>
                                    
                                    <div className="bg-card border border-border/60 rounded-2xl p-4 shadow-sm flex flex-col justify-between h-full min-h-[140px]">
                                        <h4 className="text-[11px] font-bold tracking-widest text-muted-foreground uppercase mb-4 text-center sm:text-left flex items-center gap-1.5">
                                           <BarChart3 className="h-3.5 w-3.5"/> Views by Platform
                                        </h4>
                                        <div className="space-y-2.5 w-full">
                                            {platformData.slice(0, 3).map((p, i) => {
                                                const maxViews = Math.max(...platformData.map(d => d.views));
                                                const pct = maxViews > 0 ? (p.views / maxViews) * 100 : 0;
                                                return (
                                                    <div key={i} className="flex items-center gap-3 w-full">
                                                        <span className="text-[10px] font-bold w-12 capitalize text-right truncate">{p.platform}</span>
                                                        <div className="flex-1 h-2.5 bg-muted rounded-full overflow-hidden relative">
                                                            <div className="absolute top-0 left-0 h-full bg-violet-500/80 rounded-full" style={{ width: `${pct}%` }}></div>
                                                        </div>
                                                        <span className="text-[10px] font-medium w-10 text-muted-foreground">{formatNumber(p.views)}</span>
                                                    </div>
                                                );
                                            })}
                                            {platformData.length === 0 && (
                                                <div className="text-center text-xs text-muted-foreground opacity-50 py-2">No metric data available</div>
                                            )}
                                        </div>
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
"""
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)

rewrite_summary_card()
