import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Sparkles,
    RefreshCw,
    ThumbsUp,
    AlertTriangle,
    Target,
    Star,
    ChevronDown,
    ChevronUp,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

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
    const [expanded, setExpanded] = useState(true);
    const { toast } = useToast();
    const queryClient = useQueryClient();

    // Fetch cached summary
    const { data: cachedSummary, isLoading: isLoadingCache } = useQuery({
        queryKey: ["analytics-summary", clientId, type],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("analytics_summaries" as any)
                .select("summary_data, generated_at, period_start, period_end")
                .eq("client_id", clientId)
                .eq("type", type)
                .order("generated_at", { ascending: false })
                .limit(1)
                .maybeSingle();

            if (error) {
                console.warn("No cached summary:", error.message);
                return null;
            }
            return data;
        },
    });

    // Generate summary mutation
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
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["analytics-summary", clientId, type] });
            toast({ title: "Summary updated!", description: `${title} analysis refreshed with latest data.` });
        },
        onError: (error: Error) => {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        },
    });

    const attemptRef = useRef<string | null>(null);

    useEffect(() => {
        // useQuery's isFetching would be better than isLoading, but we use strict ref check
        if (isLoadingCache || generateMutation.isPending) return;

        let needsRegen = false;

        if (!cachedSummary) {
            needsRegen = true;
        } else {
            const generatedTime = new Date((cachedSummary as any)?.generated_at || 0).getTime();
            const sixHoursAgo = Date.now() - 6 * 60 * 60 * 1000;
            
            needsRegen = generatedTime < sixHoursAgo;
            
            if (!needsRegen && (cachedSummary as any)?.period_start && (cachedSummary as any)?.period_end) {
                const pStart = new Date((cachedSummary as any).period_start).getTime();
                const pEnd = new Date((cachedSummary as any).period_end).getTime();
                const cachedDays = Math.round((pEnd - pStart) / (1000 * 60 * 60 * 24));
                const requestedDays = dateRange === "60d" ? 60 : dateRange === "30d" ? 30 : 7;
                
                // Regenerate if cached period length doesn't roughly match requested
                // Note: custom ranges are ignored in this logic block, they default to 7 internally
                if (Math.abs(cachedDays - requestedDays) > 5) {
                    needsRegen = true;
                }
            }
        }

        const currentSettingsKey = `${clientId}-${type}-${dateRange}`;

        if (needsRegen) {
            // Only fire if we haven't already attempted for this exact setting
            if (attemptRef.current !== currentSettingsKey) {
                attemptRef.current = currentSettingsKey;
                setTimeout(() => generateMutation.mutate(), 100);
            }
        } else {
            // Once we have a valid, un-expired cache for these settings, clear the ref 
            // so future expirations (6 hrs from now) can trigger again.
            if (attemptRef.current === currentSettingsKey) {
                attemptRef.current = null;
            }
        }
    }, [clientId, type, dateRange, cachedSummary, isLoadingCache, generateMutation.isPending]);

    const summary: SummaryData | null =
        generateMutation.data || (cachedSummary as any)?.summary_data || null;
    const generatedAt = (cachedSummary as any)?.generated_at;
    const isGenerating = generateMutation.isPending;

    const sections = [
        {
            key: "strengths",
            label: "Strengths",
            icon: <ThumbsUp className="h-4 w-4" />,
            color: "text-emerald-400",
            bgColor: "bg-emerald-500/10",
            borderColor: "border-emerald-500/20",
            items: summary?.strengths || [],
        },
        {
            key: "weaknesses",
            label: "Weaknesses",
            icon: <AlertTriangle className="h-4 w-4" />,
            color: "text-amber-400",
            bgColor: "bg-amber-500/10",
            borderColor: "border-amber-500/20",
            items: summary?.weaknesses || [],
        },
        {
            key: "smartActions",
            label: "Client Action Plan",
            icon: <Target className="h-4 w-4" />,
            color: "text-blue-400",
            bgColor: "bg-blue-500/10",
            borderColor: "border-blue-500/20",
            items: summary?.smartActions || [],
        },
        {
            key: "highlights",
            label: "Highlights",
            icon: <Star className="h-4 w-4" />,
            color: "text-purple-400",
            bgColor: "bg-purple-500/10",
            borderColor: "border-purple-500/20",
            items: summary?.highlights || [],
        },
    ];

    return (
        <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20">
                            {icon}
                        </div>
                        <div>
                            <CardTitle className="text-base flex items-center gap-2">
                                {title}
                                <Sparkles className="h-4 w-4 text-violet-400" />
                            </CardTitle>
                            {generatedAt && (
                                <p className="text-xs text-muted-foreground mt-0.5">
                                    Updated {new Date(generatedAt).toLocaleDateString("en-US", {
                                        month: "short", day: "numeric", hour: "numeric", minute: "2-digit"
                                    })}
                                </p>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => generateMutation.mutate()}
                            disabled={isGenerating}
                            className="h-8 text-xs"
                        >
                            <RefreshCw className={`h-3 w-3 mr-1.5 ${isGenerating ? 'animate-spin' : ''}`} />
                            {isGenerating ? "Analyzing..." : summary ? "Refresh" : "Generate"}
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setExpanded(!expanded)}
                            className="h-8 w-8 p-0"
                        >
                            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </Button>
                    </div>
                </div>
            </CardHeader>

            {expanded && (
                <CardContent className="pt-0">
                    {isLoadingCache || isGenerating ? (
                        <div className="space-y-4">
                            {[1, 2, 3, 4].map((i) => (
                                <div key={i} className="space-y-2">
                                    <Skeleton className="h-4 w-32" />
                                    <Skeleton className="h-3 w-full" />
                                    <Skeleton className="h-3 w-4/5" />
                                </div>
                            ))}
                        </div>
                    ) : !summary ? (
                        <div className="text-center py-8 text-muted-foreground">
                            <Sparkles className="h-8 w-8 mx-auto mb-3 opacity-40" />
                            <p className="text-sm">No analysis yet</p>
                            <p className="text-xs mt-1">Click "Generate" to create an AI-powered summary</p>
                        </div>
                    ) : (
                        <div className="grid gap-4 grid-cols-1 md:grid-cols-4">
                            {sections.map((section) => (
                                <div
                                    key={section.key}
                                    className={`rounded-lg border ${section.borderColor} ${section.bgColor} p-3.5`}
                                >
                                    <div className={`flex items-center gap-2 mb-2.5 ${section.color}`}>
                                        {section.icon}
                                        <span className="font-semibold text-sm">{section.label}</span>
                                        <Badge variant="secondary" className="ml-auto text-[10px] h-5 px-1.5">
                                            {section.items.length}
                                        </Badge>
                                    </div>
                                    <ul className="space-y-1.5">
                                        {section.items.map((item, i) => (
                                            <li key={i} className="text-xs text-foreground/80 flex gap-2">
                                                <span className={`mt-1.5 h-1 w-1 rounded-full shrink-0 ${section.bgColor.replace('/10', '/60')}`} />
                                                {item}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            )}
        </Card>
    );
}
