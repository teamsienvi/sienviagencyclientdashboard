import { useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Sparkles, RefreshCw, AlertTriangle, CheckCircle2, Lightbulb, Globe, ShoppingBag,
    Search, MousePointerClick, TrendingUp, TrendingDown, Target,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format, formatDistanceToNow } from "date-fns";
import { useSyncState } from "@/hooks/useSyncState";

interface WebsiteOverviewCardProps {
    clientId: string;
    title?: string;
    isActive?: boolean;
}

type Num = number | null | undefined;

const fmt = (n: Num) => {
    if (n === null || n === undefined || Number.isNaN(n)) return "—";
    if (Math.abs(n) >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
    if (Math.abs(n) >= 1_000) return (n / 1_000).toFixed(1) + "K";
    return Number.isInteger(n) ? n.toString() : n.toFixed(1);
};
const money = (n: Num) => (n === null || n === undefined ? "—" : `$${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`);
const clean = (s: string) => s.replace(/\*\*/g, "");

function Stat({ label, value, sub }: { label: string; value: string; sub?: React.ReactNode }) {
    return (
        <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">{label}</p>
            <p className="text-2xl font-bold tracking-tight mt-1">{value}</p>
            {sub && <div className="text-[11px] text-muted-foreground mt-0.5">{sub}</div>}
        </div>
    );
}

function Section({ icon, title, accent, badge, children }: {
    icon: React.ReactNode; title: string; accent: string; badge?: string; children: React.ReactNode;
}) {
    return (
        <div className="bg-card border border-border/80 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <div className={`p-2 rounded-lg ${accent}`}>{icon}</div>
                    <p className="font-semibold text-base">{title}</p>
                </div>
                {badge && <Badge variant="outline" className="text-[10px] font-medium">{badge}</Badge>}
            </div>
            {children}
        </div>
    );
}

export function WebsiteOverviewCard({ clientId, title = "Website Overview", isActive = true }: WebsiteOverviewCardProps) {
    const queryClient = useQueryClient();
    const { isSyncing, isDegraded, retry } = useSyncState(clientId, "website", "website_summary");

    const prevSyncing = useRef(isSyncing);
    useEffect(() => {
        if (prevSyncing.current && !isSyncing) {
            queryClient.invalidateQueries({ queryKey: ["analytics-summary", clientId, "website"] });
        }
        prevSyncing.current = isSyncing;
    }, [isSyncing, queryClient, clientId]);

    const { data: row, isLoading } = useQuery({
        queryKey: ["analytics-summary", clientId, "website"],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("analytics_summaries" as any)
                .select("summary_data, generated_at, period_start, period_end")
                .eq("client_id", clientId)
                .eq("type", "website")
                .order("generated_at", { ascending: false })
                .limit(1)
                .maybeSingle();
            if (error) throw error;
            return data as any;
        },
        enabled: !!clientId,
        staleTime: 0,
    });

    const summary = row?.summary_data || null;
    const m = summary?.metrics || {};
    const web = m.web || null;
    const shop = m.shop || null;
    const seo = m.seo || null;
    const gsc = m.gsc || null;
    const isNewFormat = "web" in m || "seo" in m || "shop" in m || "gsc" in m;

    const strengths: string[] = summary?.strengths || [];
    const weaknesses: string[] = summary?.weaknesses || [];
    const actions: string[] = summary?.smartActions || [];
    const topInsight: string | undefined = summary?.highlights?.[0] || strengths[0];

    const periodLabel = row?.period_start && row?.period_end
        ? `${format(new Date(row.period_start + "T00:00:00"), "MMM d")} – ${format(new Date(row.period_end + "T00:00:00"), "MMM d")}`
        : null;

    const sectionsCount = [web, shop, seo, gsc].filter(Boolean).length;

    return (
        <Card className="border-border/50 bg-card shadow-sm overflow-hidden flex flex-col relative w-full h-[850px] md:h-[750px]">
            <CardHeader className="pb-4 bg-background border-b border-border/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-6 z-10 pt-6">
                <div className="flex items-center gap-3">
                    <CardTitle className="text-xl flex items-center gap-2 font-bold tracking-tight">
                        <Globe className="h-5 w-5 text-emerald-500" />
                        {title}
                        {isSyncing && <RefreshCw className="h-4 w-4 animate-spin text-primary/40 ml-1" />}
                    </CardTitle>
                    {periodLabel && <Badge variant="secondary" className="text-[10px] font-medium">{periodLabel}</Badge>}
                </div>
                <div className="flex items-center gap-2">
                    {isDegraded ? (
                        <div className="text-[10px] text-amber-500 flex items-center gap-1 font-medium bg-amber-500/10 px-2 py-0.5 rounded-full">
                            <AlertTriangle className="h-2.5 w-2.5" /> Degraded (Showing Stale Data)
                        </div>
                    ) : row?.generated_at ? (
                        <div className="text-[10px] text-muted-foreground/60 flex items-center gap-1 font-medium bg-muted/40 px-2 py-0.5 rounded-full">
                            <Sparkles className="h-2.5 w-2.5" />
                            Generated {formatDistanceToNow(new Date(row.generated_at), { addSuffix: true })}
                        </div>
                    ) : null}
                    <Button variant="outline" size="sm" onClick={() => retry()} disabled={isSyncing || !isActive} className="h-9 text-xs font-medium shadow-sm gap-2">
                        {isSyncing ? <Sparkles className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                        {isSyncing ? "Analyzing..." : "Refresh Analysis"}
                    </Button>
                </div>
            </CardHeader>

            <CardContent className="p-0 flex-1 overflow-y-auto min-h-0">
                {isLoading ? (
                    <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                        {[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-44 w-full rounded-2xl" />)}
                    </div>
                ) : !summary || (!isNewFormat && !isSyncing) ? (
                    <div className="p-12 text-center text-muted-foreground flex flex-col items-center justify-center gap-3">
                        <Target className="h-10 w-10 opacity-20" />
                        <p className="text-sm font-medium">
                            {isSyncing ? "Building the website report…" : "No website report yet. Click Refresh Analysis to generate it."}
                        </p>
                    </div>
                ) : (
                    <div className="p-6 flex flex-col gap-6 bg-background/30">
                        {topInsight && (
                            <div className="py-4 px-5 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900 flex items-center gap-3">
                                <Sparkles className="h-5 w-5 text-emerald-500 shrink-0" />
                                <p className="text-sm font-medium text-foreground/90">{clean(topInsight)}</p>
                            </div>
                        )}

                        {sectionsCount === 0 ? (
                            <div className="p-8 border border-dashed rounded-xl text-center text-sm text-muted-foreground">
                                No website, store, SEO or Search Console data is connected for this client yet.
                            </div>
                        ) : (
                            <div className={`grid grid-cols-1 ${sectionsCount > 1 ? "md:grid-cols-2" : ""} gap-6`}>
                                {web && (
                                    <Section icon={<Globe className="h-4 w-4" />} title="Web Traffic" accent="bg-emerald-500/10 text-emerald-500" badge={(web.sources || []).join(" · ")}>
                                        <div className="grid grid-cols-3 gap-4">
                                            <Stat label={web.page_views > 0 ? "Page Views" : "Sessions"} value={fmt(web.page_views > 0 ? web.page_views : web.sessions)} />
                                            <Stat label="Visitors" value={fmt(web.visitors)} />
                                            <Stat
                                                label="Engagement"
                                                value={web.engagement_rate != null ? `${web.engagement_rate.toFixed(1)}%` : "—"}
                                                sub={web.bounce_rate != null ? `${web.bounce_rate.toFixed(1)}% bounce` : "Not reported"}
                                            />
                                        </div>
                                    </Section>
                                )}

                                {shop && (
                                    <Section icon={<ShoppingBag className="h-4 w-4" />} title="E-Commerce" accent="bg-violet-500/10 text-violet-500" badge="Shopify">
                                        <div className="grid grid-cols-3 gap-4">
                                            <Stat label="Total Sales" value={money(shop.total_sales)} sub={`Net ${money(shop.net_sales)}`} />
                                            <Stat label="Orders" value={fmt(shop.orders)} sub={`${fmt(shop.new_customers)} new customers`} />
                                            <Stat label="Avg Order" value={money(shop.aov)} />
                                        </div>
                                    </Section>
                                )}

                                {seo && (
                                    <Section icon={<Search className="h-4 w-4" />} title="SEO Health" accent="bg-blue-500/10 text-blue-500" badge={seo.domain || "Ubersuggest"}>
                                        <div className="grid grid-cols-3 gap-4">
                                            <Stat
                                                label="Site Health"
                                                value={seo.health_score != null ? `${seo.health_score}/100` : "—"}
                                                sub={seo.health_score == null ? "Audit pending" : seo.health_change ? (
                                                    <span className={seo.health_change > 0 ? "text-emerald-600" : "text-rose-500"}>
                                                        {seo.health_change > 0 ? "+" : ""}{seo.health_change} this period
                                                    </span>
                                                ) : "No change"}
                                            />
                                            <Stat label="SEO Issues" value={seo.issues != null ? fmt(seo.issues) : "—"} sub={seo.issues == null ? "Audit pending" : undefined} />
                                            <Stat
                                                label="Ranking Keywords"
                                                value={seo.tracked_keywords > 0 ? `${seo.ranking_keywords}/${seo.tracked_keywords}` : "—"}
                                                sub={seo.tracked_keywords > 0 ? `${seo.top10} in top 10 · ${seo.top3} in top 3` : "No keywords tracked yet"}
                                            />
                                        </div>
                                        {seo.collected_at && (Date.now() - new Date(seo.collected_at).getTime()) > 14 * 86400000 && (
                                            <p className="text-[11px] text-amber-600 mt-3 flex items-center gap-1">
                                                <AlertTriangle className="h-3 w-3" /> SEO data last collected {format(new Date(seo.collected_at), "MMM d, yyyy")}
                                            </p>
                                        )}
                                        {(seo.improved > 0 || seo.declined > 0 || seo.pending > 0 || seo.unstable > 0) && (
                                            <div className="flex flex-wrap gap-2 mt-4 text-[11px] font-medium">
                                                {seo.improved > 0 && <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600"><TrendingUp className="h-3 w-3" />{seo.improved} improved</span>}
                                                {seo.declined > 0 && <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-500/10 text-rose-500"><TrendingDown className="h-3 w-3" />{seo.declined} declined</span>}
                                                {seo.unstable > 0 && <span className="px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-600">{seo.unstable} unconfirmed</span>}
                                                {seo.pending > 0 && <span className="px-2 py-0.5 rounded-md bg-muted text-muted-foreground">{seo.pending} pending first check</span>}
                                            </div>
                                        )}
                                        {Array.isArray(seo.top_keywords) && seo.top_keywords.length > 0 && (
                                            <div className="mt-4 border-t border-border/40 pt-3 space-y-1.5">
                                                {seo.top_keywords.map((k: any, i: number) => (
                                                    <div key={i} className="flex items-center justify-between text-xs">
                                                        <span className="truncate pr-2 text-foreground/90">{k.keyword}</span>
                                                        <span className="shrink-0 font-semibold">
                                                            #{k.position}
                                                            {k.previous != null && k.previous !== k.position && (
                                                                <span className={`ml-1.5 font-medium ${k.position < k.previous ? "text-emerald-600" : "text-rose-500"}`}>
                                                                    (was #{k.previous})
                                                                </span>
                                                            )}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </Section>
                                )}

                                {gsc && (
                                    <Section icon={<MousePointerClick className="h-4 w-4" />} title="Google Search" accent="bg-amber-500/10 text-amber-500" badge="Search Console">
                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                            <Stat label="Clicks" value={fmt(gsc.clicks)} />
                                            <Stat label="Impressions" value={fmt(gsc.impressions)} />
                                            <Stat label="CTR" value={gsc.ctr != null ? `${gsc.ctr.toFixed(2)}%` : "—"} />
                                            <Stat label="Avg Position" value={gsc.position != null ? gsc.position.toFixed(1) : "—"} />
                                        </div>
                                        {gsc.window && <p className="text-[11px] text-muted-foreground mt-3">{gsc.window}</p>}
                                    </Section>
                                )}
                            </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="bg-card border border-border/80 rounded-2xl p-5 shadow-sm">
                                <p className="font-semibold text-base mb-4 flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-500" /> What's Working</p>
                                <div className="space-y-3">
                                    {strengths.map((s, i) => <p key={i} className="text-sm text-muted-foreground leading-relaxed">{clean(s)}</p>)}
                                </div>
                            </div>
                            <div className="bg-card border border-border/80 rounded-2xl p-5 shadow-sm">
                                <p className="font-semibold text-base mb-4 flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-rose-500" /> Needs Fixing</p>
                                <div className="space-y-3">
                                    {weaknesses.map((w, i) => <p key={i} className="text-sm text-muted-foreground leading-relaxed">{clean(w)}</p>)}
                                </div>
                            </div>
                            <div className="bg-primary/5 border border-primary/20 rounded-2xl p-5 shadow-sm">
                                <p className="font-semibold text-base mb-4 flex items-center gap-2 text-primary"><Lightbulb className="h-4 w-4" /> Recommended Actions</p>
                                <div className="space-y-3">
                                    {actions.map((a, i) => (
                                        <div key={i} className="flex gap-3 items-start">
                                            <div className="h-6 w-6 rounded-md bg-background border border-primary/20 flex items-center justify-center shrink-0 text-primary font-bold text-xs">{i + 1}</div>
                                            <p className="text-sm text-foreground leading-relaxed font-medium">{clean(a)}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
