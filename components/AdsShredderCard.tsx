import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Crosshair,
    RefreshCw,
    ThumbsUp,
    AlertTriangle,
    Target,
    Star,
    Skull,
    Upload,
    FileSpreadsheet,
    ChevronDown,
    ChevronUp,
    X,
    Trash2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

interface AdsSummaryData {
    strengths: string[];
    weaknesses: string[];
    smartActions: string[];
    highlights: string[];
    hardTruths: string[];
}

interface AdsShredderCardProps {
    clientId: string;
    adPlatform: string; // "meta" | "google" | "tiktok" | "all"
    title?: string;
}

export function AdsShredderCard({ clientId, adPlatform, title }: AdsShredderCardProps) {
    const [expanded, setExpanded] = useState(true);
    const [file, setFile] = useState<File | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [analysisResult, setAnalysisResult] = useState<AdsSummaryData | null>(null);
    const { toast } = useToast();

    const [isClearing, setIsClearing] = useState(false);
    const displayTitle = title || `Ads Shredder Analysis — ${adPlatform.charAt(0).toUpperCase() + adPlatform.slice(1)}`;

    // Fetch cached summary
    const { data: cachedSummary, isLoading: isLoadingCache, refetch } = useQuery({
        queryKey: ["ads-analytics-summary", clientId, adPlatform],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("ads_analytics_summaries" as any)
                .select("summary_data, generated_at, file_name")
                .eq("client_id", clientId)
                .eq("type", adPlatform)
                .order("generated_at", { ascending: false })
                .limit(1)
                .maybeSingle();

            if (error) {
                console.warn("No cached ads summary:", error.message);
                return null;
            }
            return data;
        },
    });

    const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            const validExtensions = [".csv", ".xlsx", ".xls"];
            const ext = selectedFile.name.substring(selectedFile.name.lastIndexOf(".")).toLowerCase();
            if (!validExtensions.includes(ext)) {
                toast({
                    title: "Invalid file",
                    description: "Please upload a .xlsx or .csv file",
                    variant: "destructive",
                });
                return;
            }
            setFile(selectedFile);
        }
    }, [toast]);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        const droppedFile = e.dataTransfer.files?.[0];
        if (droppedFile) {
            setFile(droppedFile);
        }
    }, []);

    const handleAnalyze = async () => {
        if (!file) {
            toast({
                title: "No file selected",
                description: "Please upload an Excel or CSV file with your ad metrics",
                variant: "destructive",
            });
            return;
        }

        setIsAnalyzing(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();

            const formData = new FormData();
            formData.append("clientId", clientId);
            formData.append("adPlatform", adPlatform);
            formData.append("file", file);

            const response = await fetch(
                `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/generate-ads-summary`,
                {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${session?.access_token}`,
                        apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
                    },
                    body: formData,
                }
            );

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || "Failed to analyze ads");
            }

            const result = await response.json();
            setAnalysisResult(result);
            refetch(); // Refresh cached data
            toast({
                title: "Analysis complete!",
                description: "The Ads Shredder has dissected your campaigns.",
            });
        } catch (error: any) {
            toast({
                title: "Analysis failed",
                description: error.message,
                variant: "destructive",
            });
        } finally {
            setIsAnalyzing(false);
        }
    };

    const summary: AdsSummaryData | null =
        analysisResult || (cachedSummary as any)?.summary_data || null;
    const generatedAt = (cachedSummary as any)?.generated_at;
    const cachedFileName = (cachedSummary as any)?.file_name;

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
                        <div className="p-2 rounded-lg bg-gradient-to-br from-red-500/20 to-orange-500/20">
                            <Crosshair className="h-5 w-5 text-red-400" />
                        </div>
                        <div>
                            <CardTitle className="text-base flex items-center gap-2">
                                {displayTitle}
                                <Skull className="h-4 w-4 text-red-400" />
                            </CardTitle>
                            {generatedAt && (
                                <p className="text-xs text-muted-foreground mt-0.5">
                                    Updated {new Date(generatedAt).toLocaleDateString("en-US", {
                                        month: "short", day: "numeric", hour: "numeric", minute: "2-digit"
                                    })}
                                    {cachedFileName && ` • ${cachedFileName}`}
                                </p>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
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
                    {/* File Upload Area */}
                    <div className="mb-4">
                        <div
                            className="border-2 border-dashed border-border/60 rounded-lg p-4 text-center hover:border-primary/40 transition-colors cursor-pointer"
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={handleDrop}
                            onClick={() => document.getElementById(`file-upload-${clientId}-${adPlatform}`)?.click()}
                        >
                            <input
                                id={`file-upload-${clientId}-${adPlatform}`}
                                type="file"
                                accept=".xlsx,.xls,.csv"
                                onChange={handleFileChange}
                                className="hidden"
                            />
                            {file ? (
                                <div className="flex items-center justify-center gap-3">
                                    <FileSpreadsheet className="h-5 w-5 text-emerald-400" />
                                    <span className="text-sm font-medium">{file.name}</span>
                                    <Badge variant="secondary" className="text-[10px]">
                                        {(file.size / 1024).toFixed(1)} KB
                                    </Badge>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 w-6 p-0"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setFile(null);
                                        }}
                                    >
                                        <X className="h-3 w-3" />
                                    </Button>
                                </div>
                            ) : (
                                <div className="space-y-1">
                                    <Upload className="h-6 w-6 mx-auto text-muted-foreground/60" />
                                    <p className="text-sm text-muted-foreground">
                                        Drop your ad metrics file here or click to upload
                                    </p>
                                    <p className="text-xs text-muted-foreground/60">
                                        Supports .xlsx, .csv (exported from Meta Ads Manager, Google Ads, TikTok Ads)
                                    </p>
                                </div>
                            )}
                        </div>

                        <div className="flex items-center gap-2 mt-3">
                            <Button
                                size="sm"
                                onClick={handleAnalyze}
                                disabled={isAnalyzing || !file}
                                className="h-8 text-xs bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700"
                            >
                                <Crosshair className={`h-3 w-3 mr-1.5 ${isAnalyzing ? 'animate-spin' : ''}`} />
                                {isAnalyzing ? "Shredding..." : "Analyze with Shredder"}
                            </Button>
                            {summary && (
                                <>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={handleAnalyze}
                                        disabled={isAnalyzing || !file}
                                        className="h-8 text-xs"
                                    >
                                        <RefreshCw className={`h-3 w-3 mr-1.5 ${isAnalyzing ? 'animate-spin' : ''}`} />
                                        Re-analyze
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={async () => {
                                            setIsClearing(true);
                                            try {
                                                await supabase
                                                    .from("ads_analytics_summaries" as any)
                                                    .delete()
                                                    .eq("client_id", clientId)
                                                    .eq("type", adPlatform);
                                                setAnalysisResult(null);
                                                setFile(null);
                                                refetch();
                                                toast({ title: "Summary cleared" });
                                            } catch (err: any) {
                                                toast({ title: "Failed to clear", description: err.message, variant: "destructive" });
                                            } finally {
                                                setIsClearing(false);
                                            }
                                        }}
                                        disabled={isClearing}
                                        className="h-8 text-xs text-red-400 hover:text-red-300 border-red-500/30 hover:border-red-500/50"
                                    >
                                        <Trash2 className={`h-3 w-3 mr-1.5 ${isClearing ? 'animate-spin' : ''}`} />
                                        Clear
                                    </Button>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Results */}
                    {isLoadingCache || isAnalyzing ? (
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
                        <div className="text-center py-6 text-muted-foreground">
                            <Crosshair className="h-8 w-8 mx-auto mb-3 opacity-40" />
                            <p className="text-sm">No analysis yet</p>
                            <p className="text-xs mt-1">Upload a file and click "Analyze with Shredder" to get a brutally honest ad analysis</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {/* Hard Truths Section (if available) */}
                            {summary.hardTruths && summary.hardTruths.length > 0 && (
                                <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-3.5">
                                    <div className="flex items-center gap-2 mb-2.5 text-red-400">
                                        <Skull className="h-4 w-4" />
                                        <span className="font-semibold text-sm">Hard Truths</span>
                                        <Badge variant="secondary" className="ml-auto text-[10px] h-5 px-1.5">
                                            {summary.hardTruths.length}
                                        </Badge>
                                    </div>
                                    <ul className="space-y-1.5">
                                        {summary.hardTruths.map((item, i) => (
                                            <li key={i} className="text-xs text-foreground/80 flex gap-2">
                                                <span className="mt-1.5 h-1 w-1 rounded-full shrink-0 bg-red-500/60" />
                                                {item}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {/* Four Analysis Sections */}
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
                        </div>
                    )}
                </CardContent>
            )}
        </Card>
    );
}
