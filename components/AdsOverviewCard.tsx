import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Target, RefreshCw, AlertTriangle, CheckCircle2, Lightbulb, ShoppingBag,
    TrendingUp, ArrowUpRight, DollarSign, Megaphone, Sparkles, Layers,
    ChevronDown, Eye, MousePointerClick
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format, formatDistanceToNow } from "date-fns";

interface AdsOverviewCardProps {
    clientId: string;
    title?: string;
    isActive?: boolean;
    onScrollToDrilldown?: () => void;
}

type Num = number | null | undefined;

const fmt = (n: Num) => {
    if (n === null || n === undefined || Number.isNaN(n)) return "—";
    if (Math.abs(n) >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
    if (Math.abs(n) >= 1_000) return (n / 1_000).toFixed(1) + "K";
    return Number.isInteger(n) ? n.toString() : n.toFixed(1);
};

const money = (n: Num) => {
    if (n === null || n === undefined || Number.isNaN(n)) return "—";
    return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const clean = (s: string) => s.replace(/\*\*/g, "").trim();

function Stat({ label, value, sub }: { label: string; value: string; sub?: React.ReactNode }) {
    return (
        <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">{label}</p>
            <p className="text-2xl font-bold tracking-tight mt-1">{value}</p>
            {sub && <div className="text-[11px] text-muted-foreground mt-0.5">{sub}</div>}
        </div>
    );
}

function ChannelSection({
    icon,
    title,
    badge,
    accent,
    children
}: {
    icon: React.ReactNode;
    title: string;
    badge?: string;
    accent: string;
    children: React.ReactNode;
}) {
    return (
        <div className="bg-card border border-border/80 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
            <div>
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <div className={`p-2 rounded-lg ${accent}`}>{icon}</div>
                        <p className="font-semibold text-base">{title}</p>
                    </div>
                    {badge && <Badge variant="outline" className="text-[10px] font-medium">{badge}</Badge>}
                </div>
                {children}
            </div>
        </div>
    );
}

export function AdsOverviewCard({
    clientId,
    title = "Advertising Overview",
    isActive = true,
    onScrollToDrilldown
}: AdsOverviewCardProps) {
    const queryClient = useQueryClient();

    // 1. Fetch latest Amazon Ads Report
    const { data: amazonData, isLoading: isLoadingAmz } = useQuery({
        queryKey: ["amazon-ads-overview", clientId],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("amazon_ads_reports" as any)
                .select("parsed_data, generated_at, report_period, source_file_name, generation_status")
                .eq("client_id", clientId)
                .order("report_period", { ascending: false })
                .limit(1)
                .maybeSingle();
            if (error) return null;
            return data as any;
        },
        enabled: !!clientId,
    });

    // 2. Fetch latest Google Ads Report
    const { data: googleData, isLoading: isLoadingGoogle } = useQuery({
        queryKey: ["google-ads-overview", clientId],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("google_ads_reports" as any)
                .select("parsed_data, generated_at, report_period, source_file_name, generation_status")
                .eq("client_id", clientId)
                .order("report_period", { ascending: false })
                .limit(1)
                .maybeSingle();
            if (error) return null;
            return data as any;
        },
        enabled: !!clientId,
    });

    // 3. Fetch latest TikTok Ads Report
    const { data: tiktokData, isLoading: isLoadingTikTok } = useQuery({
        queryKey: ["tiktok-ads-overview", clientId],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("ads_analytics_summaries" as any)
                .select("summary_data, generated_at, file_name")
                .eq("client_id", clientId)
                .eq("type", "tiktok")
                .order("generated_at", { ascending: false })
                .limit(1)
                .maybeSingle();
            if (error) return null;
            return data as any;
        },
        enabled: !!clientId,
    });

    // 4. Fetch generic ads AI summary if available
    const { data: genericAdsData, isLoading: isLoadingGeneric } = useQuery({
        queryKey: ["generic-ads-overview", clientId],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("analytics_summaries" as any)
                .select("summary_data, generated_at, period_start, period_end")
                .eq("client_id", clientId)
                .eq("type", "ads")
                .order("generated_at", { ascending: false })
                .limit(1)
                .maybeSingle();
            if (error) return null;
            return data as any;
        },
        enabled: !!clientId,
    });

    const isLoading = isLoadingAmz && isLoadingGoogle && isLoadingTikTok && isLoadingGeneric;

    // Process Amazon Ads KPIs
    const amz = useMemo(() => {
        if (!amazonData?.parsed_data?.kpis) return null;
        const k = amazonData.parsed_data.kpis;
        return {
            spend: Number(k.adSpend ?? k.spend ?? 0),
            sales: Number(k.adSales ?? k.sales ?? 0),
            roas: Number(k.roas ?? 0),
            orders: Number(k.orders ?? 0),
            acos: Number(k.acos ?? 0),
            avgCpc: Number(k.avgCpc ?? k.cpc ?? 0),
            ctr: Number(k.ctr ?? 0),
            cvr: Number(k.cvr ?? 0),
            summary: amazonData.parsed_data.executiveSummary || null,
            actionPlan: amazonData.parsed_data.actionPlan || null,
            fileName: amazonData.source_file_name || null,
            period: amazonData.report_period || null,
            generatedAt: amazonData.generated_at || null,
        };
    }, [amazonData]);

    // Process Google Ads KPIs
    const google = useMemo(() => {
        if (!googleData?.parsed_data?.kpis) return null;
        const k = googleData.parsed_data.kpis;
        return {
            spend: Number(k.spend ?? 0),
            sales: Number(k.convValue ?? k.sales ?? 0),
            roas: Number(k.roas ?? (k.spend > 0 ? (k.convValue || 0) / k.spend : 0)),
            orders: Number(k.conversions ?? 0),
            cpc: Number(k.avgCpc ?? k.cpc ?? 0),
            ctr: Number(k.ctr ?? 0),
            summary: googleData.parsed_data.executiveSummary || null,
            fileName: googleData.source_file_name || null,
            period: googleData.report_period || null,
            generatedAt: googleData.generated_at || null,
        };
    }, [googleData]);

    // Process TikTok Ads KPIs
    const tiktok = useMemo(() => {
        if (!tiktokData?.summary_data?.performanceSnapshot) return null;
        const s = tiktokData.summary_data.performanceSnapshot;
        return {
            spend: Number(s.totalSpend ?? 0),
            sales: Number(s.conversionValue ?? 0),
            orders: Number(s.conversions ?? 0),
            cpc: Number(s.cpc ?? 0),
            cpa: Number(s.cpa ?? 0),
            ctr: Number(s.ctr ?? 0),
            cvr: Number(s.cvr ?? 0),
            summary: tiktokData.summary_data.executiveSummary || null,
            fileName: tiktokData.file_name || null,
            generatedAt: tiktokData.generated_at || null,
        };
    }, [tiktokData]);

    // Process Generic / Meta Ads
    const metaOrGeneric = useMemo(() => {
        const m = genericAdsData?.summary_data?.metrics;
        if (!m || (m.total_spend === 0 && m.total_conversions === 0)) return null;
        return {
            spend: Number(m.total_spend ?? 0),
            sales: Number(m.total_conv_value ?? 0),
            roas: Number(m.roas ?? 0),
            orders: Number(m.total_conversions ?? 0),
            summary: genericAdsData.summary_data.highlights?.[0] || null,
            strengths: genericAdsData.summary_data.strengths || [],
            weaknesses: genericAdsData.summary_data.weaknesses || [],
            actions: genericAdsData.summary_data.smartActions || [],
            generatedAt: genericAdsData.generated_at || null,
        };
    }, [genericAdsData]);

    // Blended Totals across all active channels
    const totals = useMemo(() => {
        let spend = 0;
        let sales = 0;
        let orders = 0;
        let channelCount = 0;

        if (amz) {
            spend += amz.spend;
            sales += amz.sales;
            orders += amz.orders;
            channelCount++;
        }
        if (google) {
            spend += google.spend;
            sales += google.sales;
            orders += google.orders;
            channelCount++;
        }
        if (tiktok) {
            spend += tiktok.spend;
            sales += tiktok.sales;
            orders += tiktok.orders;
            channelCount++;
        }
        if (metaOrGeneric && !amz && !google && !tiktok) {
            spend += metaOrGeneric.spend;
            sales += metaOrGeneric.sales;
            orders += metaOrGeneric.orders;
            channelCount++;
        }

        const roas = spend > 0 ? (sales > 0 ? sales / spend : 0) : 0;
        const acos = sales > 0 ? (spend / sales) * 100 : 0;

        return { spend, sales, orders, roas, acos, channelCount };
    }, [amz, google, tiktok, metaOrGeneric]);

const extractSummaryText = (summary: any): string | null => {
    if (!summary) return null;
    if (typeof summary === "string") return summary;
    if (Array.isArray(summary) && summary.length > 0) {
        const first = summary[0];
        return typeof first === "string" ? first : JSON.stringify(first);
    }
    if (typeof summary === "object") {
        return summary.text || summary.summary || summary.narrative || null;
    }
    return String(summary);
};

    // Top insight narrative
    const topInsight = useMemo(() => {
        const amzText = extractSummaryText(amz?.summary);
        if (amzText) return amzText;

        const gglText = extractSummaryText(google?.summary);
        if (gglText) return gglText;

        const ttText = extractSummaryText(tiktok?.summary);
        if (ttText) return ttText;

        const metaText = extractSummaryText(metaOrGeneric?.summary);
        if (metaText) return metaText;

        return null;
    }, [amz, google, tiktok, metaOrGeneric]);

    // Best available generated timestamp
    const latestGeneratedAt = amz?.generatedAt || google?.generatedAt || tiktok?.generatedAt || metaOrGeneric?.generatedAt;

    const handleRefresh = () => {
        queryClient.invalidateQueries({ queryKey: ["amazon-ads-overview", clientId] });
        queryClient.invalidateQueries({ queryKey: ["google-ads-overview", clientId] });
        queryClient.invalidateQueries({ queryKey: ["tiktok-ads-overview", clientId] });
        queryClient.invalidateQueries({ queryKey: ["generic-ads-overview", clientId] });
    };

    return (
        <Card className="border-border/50 bg-card shadow-sm overflow-hidden flex flex-col relative w-full h-[850px] md:h-[750px]">
            {/* Header Area */}
            <CardHeader className="pb-4 bg-background border-b border-border/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-6 z-10 pt-6">
                <div className="flex items-center gap-3">
                    <CardTitle className="text-xl flex items-center gap-2 font-bold tracking-tight">
                        <Target className="h-5 w-5 text-amber-500" />
                        {title}
                    </CardTitle>
                    {totals.channelCount > 0 && (
                        <Badge variant="secondary" className="text-[10px] font-medium">
                            {totals.channelCount} active ad {totals.channelCount === 1 ? "channel" : "channels"}
                        </Badge>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    {latestGeneratedAt && (
                        <div className="text-[10px] text-muted-foreground/60 flex items-center gap-1 font-medium bg-muted/40 px-2 py-0.5 rounded-full">
                            <Sparkles className="h-2.5 w-2.5" />
                            Report active · {formatDistanceToNow(new Date(latestGeneratedAt), { addSuffix: true })}
                        </div>
                    )}
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleRefresh}
                        className="h-9 text-xs font-medium shadow-sm gap-2 cursor-pointer"
                    >
                        <RefreshCw className="h-4 w-4" />
                        Refresh
                    </Button>
                </div>
            </CardHeader>

            <CardContent className="p-0 flex-1 overflow-y-auto min-h-0">
                {isLoading ? (
                    <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                        {[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-44 w-full rounded-2xl" />)}
                    </div>
                ) : totals.channelCount === 0 ? (
                    <div className="p-12 text-center text-muted-foreground flex flex-col items-center justify-center gap-3">
                        <Target className="h-10 w-10 opacity-20" />
                        <p className="text-sm font-medium">No advertising reports uploaded or active for this client yet.</p>
                        <p className="text-xs text-muted-foreground/80 max-w-md">
                            Upload Amazon Ads Excel reports, Google Ads CSVs, or connect Meta/TikTok ad platforms to see performance.
                        </p>
                    </div>
                ) : (
                    <div className="p-6 flex flex-col gap-6 bg-background/30">
                        {/* Top Highlights Banner */}
                        {topInsight && (
                            <div className="py-4 px-5 rounded-xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/60 flex items-center gap-3">
                                <Sparkles className="h-5 w-5 text-amber-500 shrink-0" />
                                <p className="text-sm font-medium text-foreground/90">{clean(topInsight)}</p>
                            </div>
                        )}

                        {/* Top Blended KPI Summary Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div className="bg-card border border-border/80 rounded-xl p-5 shadow-xs">
                                <p className="text-sm font-semibold text-foreground mb-1">Total Ad Spend</p>
                                <p className="text-3xl font-bold tracking-tight text-foreground">{money(totals.spend)}</p>
                                <p className="text-xs text-muted-foreground mt-1">Across all uploaded channels</p>
                            </div>

                            <div className="bg-card border border-border/80 rounded-xl p-5 shadow-xs">
                                <p className="text-sm font-semibold text-foreground mb-1">Attributed Sales</p>
                                <p className="text-3xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">{money(totals.sales)}</p>
                                <p className="text-xs text-muted-foreground mt-1">Direct ad-attributed revenue</p>
                            </div>

                            <div className="bg-card border border-border/80 rounded-xl p-5 shadow-xs">
                                <p className="text-sm font-semibold text-foreground mb-1">Blended ROAS</p>
                                <p className="text-3xl font-bold tracking-tight text-foreground">
                                    {totals.roas > 0 ? `${totals.roas.toFixed(2)}x` : "—"}
                                </p>
                                <p className="text-xs text-muted-foreground mt-1">
                                    {totals.acos > 0 ? `${totals.acos.toFixed(1)}% ACoS` : "Return on ad spend"}
                                </p>
                            </div>

                            <div className="bg-card border border-border/80 rounded-xl p-5 shadow-xs">
                                <p className="text-sm font-semibold text-foreground mb-1">Total Orders</p>
                                <p className="text-3xl font-bold tracking-tight text-foreground">{fmt(totals.orders)}</p>
                                <p className="text-xs text-muted-foreground mt-1">Conversions generated</p>
                            </div>
                        </div>

                        {/* Active Channel Breakdown Grid */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <p className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Active Ad Channels</p>
                                {onScrollToDrilldown && (
                                    <button
                                        onClick={onScrollToDrilldown}
                                        className="text-xs font-semibold text-primary hover:underline flex items-center gap-1 cursor-pointer"
                                    >
                                        Detailed breakdown below <ChevronDown className="h-3.5 w-3.5" />
                                    </button>
                                )}
                            </div>

                            <div className={`grid grid-cols-1 ${totals.channelCount > 1 ? "md:grid-cols-2" : ""} gap-6`}>
                                {/* Amazon Ads Channel Card */}
                                {amz && (
                                    <ChannelSection
                                        icon={<ShoppingBag className="h-4 w-4" />}
                                        title="Amazon Ads"
                                        badge={amz.period || "Uploaded Excel"}
                                        accent="bg-amber-500/10 text-amber-500"
                                    >
                                        <div className="grid grid-cols-3 gap-3 my-2">
                                            <Stat label="Spend" value={money(amz.spend)} />
                                            <Stat label="Sales" value={money(amz.sales)} sub={`${amz.orders} orders`} />
                                            <Stat
                                                label="ROAS / ACoS"
                                                value={`${amz.roas.toFixed(2)}x`}
                                                sub={`${amz.acos.toFixed(1)}% ACoS`}
                                            />
                                        </div>
                                        <div className="mt-3 pt-3 border-t border-border/40 grid grid-cols-3 gap-2 text-xs">
                                            <div>
                                                <span className="text-muted-foreground">Avg CPC:</span>{" "}
                                                <span className="font-semibold">{money(amz.avgCpc)}</span>
                                            </div>
                                            <div>
                                                <span className="text-muted-foreground">CTR:</span>{" "}
                                                <span className="font-semibold">{amz.ctr > 0 ? `${amz.ctr.toFixed(2)}%` : "—"}</span>
                                            </div>
                                            <div>
                                                <span className="text-muted-foreground">CVR:</span>{" "}
                                                <span className="font-semibold">{amz.cvr > 0 ? `${amz.cvr.toFixed(2)}%` : "—"}</span>
                                            </div>
                                        </div>
                                        {amz.fileName && (
                                            <p className="text-[11px] text-muted-foreground mt-3 truncate">
                                                Source: <span className="font-medium text-foreground">{amz.fileName}</span>
                                            </p>
                                        )}
                                    </ChannelSection>
                                )}

                                {/* Google Ads Channel Card */}
                                {google && (
                                    <ChannelSection
                                        icon={<Target className="h-4 w-4" />}
                                        title="Google Ads"
                                        badge={google.period || "Uploaded CSV"}
                                        accent="bg-blue-500/10 text-blue-500"
                                    >
                                        <div className="grid grid-cols-3 gap-3 my-2">
                                            <Stat label="Spend" value={money(google.spend)} />
                                            <Stat label="Conv. Value" value={money(google.sales)} sub={`${google.orders} conversions`} />
                                            <Stat label="ROAS" value={google.roas > 0 ? `${google.roas.toFixed(2)}x` : "—"} />
                                        </div>
                                        {google.fileName && (
                                            <p className="text-[11px] text-muted-foreground mt-3 truncate">
                                                Source: <span className="font-medium text-foreground">{google.fileName}</span>
                                            </p>
                                        )}
                                    </ChannelSection>
                                )}

                                {/* TikTok Ads Channel Card */}
                                {tiktok && (
                                    <ChannelSection
                                        icon={<Megaphone className="h-4 w-4" />}
                                        title="TikTok Ads"
                                        badge="Uploaded CSV"
                                        accent="bg-pink-500/10 text-pink-500"
                                    >
                                        <div className="grid grid-cols-3 gap-3 my-2">
                                            <Stat label="Spend" value={money(tiktok.spend)} />
                                            <Stat label="Conversions" value={fmt(tiktok.orders)} sub={tiktok.cpa > 0 ? `CPA ${money(tiktok.cpa)}` : undefined} />
                                            <Stat label="CTR / CVR" value={tiktok.ctr > 0 ? `${tiktok.ctr.toFixed(2)}%` : "—"} sub={tiktok.cvr > 0 ? `${tiktok.cvr.toFixed(2)}% CVR` : undefined} />
                                        </div>
                                        {tiktok.fileName && (
                                            <p className="text-[11px] text-muted-foreground mt-3 truncate">
                                                Source: <span className="font-medium text-foreground">{tiktok.fileName}</span>
                                            </p>
                                        )}
                                    </ChannelSection>
                                )}

                                {/* Meta Ads / Metricool Channel Card */}
                                {metaOrGeneric && !amz && (
                                    <ChannelSection
                                        icon={<Megaphone className="h-4 w-4" />}
                                        title="Meta Ads"
                                        badge="Metricool"
                                        accent="bg-indigo-500/10 text-indigo-500"
                                    >
                                        <div className="grid grid-cols-3 gap-3 my-2">
                                            <Stat label="Spend" value={money(metaOrGeneric.spend)} />
                                            <Stat label="Conversions" value={fmt(metaOrGeneric.orders)} />
                                            <Stat label="ROAS" value={metaOrGeneric.roas > 0 ? `${metaOrGeneric.roas.toFixed(2)}x` : "—"} />
                                        </div>
                                    </ChannelSection>
                                )}
                            </div>
                        </div>

                        {/* Strategic Recommendations / Action Plan */}
                        {amz?.actionPlan && Array.isArray(amz.actionPlan) && amz.actionPlan.length > 0 && (
                            <div className="bg-primary/5 border border-primary/20 rounded-2xl p-5 shadow-sm">
                                <p className="font-semibold text-base mb-3 flex items-center gap-2 text-primary">
                                    <Lightbulb className="h-4 w-4" /> Advertising Strategic Action Plan
                                </p>
                                <div className="space-y-2.5">
                                    {amz.actionPlan.map((act: any, i: number) => {
                                        const text = typeof act === 'string' ? act : (act.action || act.item || JSON.stringify(act));
                                        return (
                                            <div key={i} className="flex gap-3 items-start">
                                                <div className="h-6 w-6 rounded-md bg-background border border-primary/20 flex items-center justify-center shrink-0 text-primary font-bold text-xs mt-0.5">
                                                    {i + 1}
                                                </div>
                                                <p className="text-sm text-foreground leading-relaxed font-medium">{clean(text)}</p>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
