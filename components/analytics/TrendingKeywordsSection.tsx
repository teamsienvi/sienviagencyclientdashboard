import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Flame,
  TrendingUp,
  Globe,
  Sparkles,
  RefreshCw,
  Copy,
  Check,
  Video,
  FileText,
  Layers,
  Mail,
  Search,
  ExternalLink,
  ChevronRight,
  ArrowUpRight,
  HelpCircle,
  Share2,
  BookmarkCheck,
  Activity,
  Zap,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";

interface TrendingKeywordsSectionProps {
  clientId: string;
  clientName?: string;
  defaultCollapsed?: boolean;
}

export function TrendingKeywordsSection({
  clientId,
  clientName = "OxiSure Tech",
  defaultCollapsed = true,
}: TrendingKeywordsSectionProps) {
  const [selectedGeo, setSelectedGeo] = useState<string>("worldwide");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedAll, setCopiedAll] = useState<boolean>(false);
  const [activeSubTab, setActiveSubTab] = useState<string>("radar");
  const [isCollapsed, setIsCollapsed] = useState<boolean>(defaultCollapsed);

  React.useEffect(() => {
    const handleExpand = () => setIsCollapsed(false);
    window.addEventListener("expand-trending-radar", handleExpand);
    return () => window.removeEventListener("expand-trending-radar", handleExpand);
  }, []);

  // Query /api/trends
  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["client-trending-radar", clientId, selectedGeo],
    queryFn: async () => {
      const res = await fetch(`/api/trends?clientId=${clientId}&geo=${selectedGeo}`);
      if (!res.ok) throw new Error("Failed to fetch trends data");
      return res.json();
    },
    staleTime: 1000 * 60 * 30, // 30 mins
  });

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCopyAll = () => {
    if (!data) return;
    const brief = `
# 🚀 Weekly Content Radar & Trending Keywords Report
Client: ${data.client || clientName}
Week: ${data.weekRange || "Current Week"}
Region: ${selectedGeo.toUpperCase()}

## 🔍 TOP TRENDING KEYWORDS
${(data.trendingKeywords || [])
  .map((k: any) => `- ${k.keyword} (${k.growth}, ${k.searchVolume}) [${k.source} - ${k.intent}]`)
  .join("\n")}

## 🎬 SHORT-FORM VIDEO HOOKS (TikTok / Reels / Shorts)
${(data.contentBriefs?.videoHooks || [])
  .map(
    (h: any, i: number) => `
### Video Idea ${i + 1}: ${h.title}
- Hook: "${h.hook}"
- Scene/Visual: ${h.visualDirection}
- Audience: ${h.targetAudience}
- CTA: ${h.recommendedCTA}`
  )
  .join("\n")}

## ✍️ SEO BLOG ARTICLES & GUIDES
${(data.contentBriefs?.seoArticles || [])
  .map(
    (a: any, i: number) => `
### Article ${i + 1}: ${a.title}
- Target Keywords: ${a.targetKeywords.join(", ")}
- Traffic Potential: ${a.estimatedMonthlyTrafficPotential}
- Outline:
${a.outline.map((o: string) => `  * ${o}`).join("\n")}`
  )
  .join("\n")}

## 📱 SOCIAL CAROUSELS
${(data.contentBriefs?.socialCarousels || [])
  .map(
    (c: any) => `
### ${c.title} (${c.platform})
${c.slides.map((s: string) => `* ${s}`).join("\n")}`
  )
  .join("\n")}

## ✉️ RETENTION & EMAIL HOOKS
${(data.contentBriefs?.newsletterAngles || [])
  .map(
    (n: any) => `
### Subject: ${n.subjectLine}
- Preview: ${n.previewText}
- Hook: ${n.hook}
- CTA: ${n.cta}`
  )
  .join("\n")}
    `.trim();

    navigator.clipboard.writeText(brief);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2500);
  };

  return (
    <TooltipProvider>
      <div className="space-y-6" id="trending-radar">
        {/* Header Hero Card */}
        <div className="relative overflow-hidden rounded-3xl border-2 border-violet-500/20 bg-gradient-to-br from-violet-500/10 via-purple-500/5 to-background p-6 md:p-8 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20 gap-1.5 py-1 px-3">
                  <Flame className="h-3.5 w-3.5 text-violet-500 fill-violet-500" />
                  Weekly Trend Radar & Content Engine
                </Badge>
                {data?.weekRange && (
                  <span className="text-xs text-muted-foreground font-mono bg-background/60 px-2.5 py-1 rounded-full border">
                    {data.weekRange}
                  </span>
                )}
              </div>
              <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
                Trending Topics & Content Ideation Studio
              </h2>
              <p className="text-sm text-muted-foreground max-w-2xl">
                Real-time search engine & social media trend signals synthesized specifically for{" "}
                <span className="font-semibold text-foreground">{clientName}</span> into high-converting video hooks, SEO articles, and retention campaigns.
              </p>
            </div>

            {/* Controls Bar */}
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Region Selector */}
              <div className="flex items-center gap-2 bg-background/80 backdrop-blur-sm border rounded-xl p-1 shadow-sm">
                <Globe className="h-4 w-4 ml-2 text-muted-foreground" />
                <Select value={selectedGeo} onValueChange={setSelectedGeo}>
                  <SelectTrigger className="h-8 border-0 bg-transparent text-xs font-semibold focus:ring-0 w-[150px]">
                    <SelectValue placeholder="Select Region" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="worldwide">🌍 Worldwide</SelectItem>
                    <SelectItem value="us">🇺🇸 United States</SelectItem>
                    <SelectItem value="uk">🇬🇧 United Kingdom</SelectItem>
                    <SelectItem value="ca">🇨🇦 Canada</SelectItem>
                    <SelectItem value="au">🇦🇺 Australia</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Refresh Button */}
              <Button
                size="sm"
                variant="outline"
                onClick={() => refetch()}
                disabled={isFetching}
                className="gap-2 h-10 px-3 bg-background/80 hover:bg-background border shadow-sm"
              >
                <RefreshCw className={`h-3.5 w-3.5 text-violet-500 ${isFetching ? "animate-spin" : ""}`} />
                <span className="text-xs">{isFetching ? "Syncing..." : "Refresh"}</span>
              </Button>

              {/* Master Copy Brief Button */}
              <Button
                size="sm"
                onClick={handleCopyAll}
                disabled={isLoading}
                className="gap-2 h-10 px-4 bg-violet-600 hover:bg-violet-700 text-white shadow-sm transition-all"
              >
                {copiedAll ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                <span className="text-xs font-medium">{copiedAll ? "Brief Copied!" : "Copy Full Weekly Brief"}</span>
              </Button>

              {/* Collapsible Toggle Button */}
              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="gap-1.5 h-10 px-3 bg-background/80 hover:bg-background border shadow-sm"
              >
                {isCollapsed ? (
                  <>
                    <ChevronDown className="h-4 w-4 text-violet-500" />
                    <span className="text-xs font-semibold">Expand</span>
                  </>
                ) : (
                  <>
                    <ChevronUp className="h-4 w-4 text-violet-500" />
                    <span className="text-xs font-semibold">Collapse</span>
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Compact Summary Teaser when Collapsed */}
          {isCollapsed && data && (
            <div
              onClick={() => setIsCollapsed(false)}
              className="mt-6 pt-4 border-t border-violet-500/15 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer group hover:bg-violet-500/[0.03] -mx-4 -mb-4 p-4 rounded-b-2xl transition-colors"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Top Breakout Trends:</span>
                {(data.trendingKeywords || []).slice(0, 3).map((kw: any, i: number) => (
                  <Badge key={i} variant="outline" className="bg-background/80 text-xs font-medium border-violet-500/20 text-foreground py-0.5">
                    {kw.keyword} <span className="text-emerald-600 font-bold ml-1">{kw.growth}</span>
                  </Badge>
                ))}
              </div>

              <div className="flex items-center gap-3 text-xs text-muted-foreground group-hover:text-foreground transition-colors">
                <span>
                  <strong>{data.contentBriefs?.videoHooks?.length || 0}</strong> Video Hooks
                </span>
                <span>•</span>
                <span>
                  <strong>{data.contentBriefs?.seoArticles?.length || 0}</strong> SEO Articles
                </span>
                <span>•</span>
                <span>
                  <strong>{data.contentBriefs?.socialCarousels?.length || 0}</strong> Carousels
                </span>
                <span className="text-violet-600 dark:text-violet-400 font-semibold flex items-center gap-0.5">
                  Click to Expand <ChevronDown className="h-3.5 w-3.5 group-hover:translate-y-0.5 transition-transform" />
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Loading State */}
        {isLoading && !isCollapsed && (
          <div className="space-y-4">
            <Skeleton className="h-12 w-full rounded-2xl" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Skeleton className="h-48 rounded-2xl" />
              <Skeleton className="h-48 rounded-2xl" />
              <Skeleton className="h-48 rounded-2xl" />
            </div>
          </div>
        )}

        {/* Content Tabs (Hidden when Collapsed) */}
        {!isLoading && !isCollapsed && data && (
          <Tabs value={activeSubTab} onValueChange={setActiveSubTab} className="space-y-6 animate-in slide-in-from-top-2 duration-200">
            <TabsList className="grid grid-cols-2 md:grid-cols-5 w-full bg-muted/50 p-1.5 rounded-2xl border">
              <TabsTrigger value="radar" className="gap-2 text-xs font-semibold data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-xl py-2.5">
                <Search className="h-3.5 w-3.5 text-violet-500" />
                <span>Search Trends</span>
              </TabsTrigger>
              <TabsTrigger value="video" className="gap-2 text-xs font-semibold data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-xl py-2.5">
                <Video className="h-3.5 w-3.5 text-pink-500" />
                <span>Video Hooks ({data.contentBriefs?.videoHooks?.length || 0})</span>
              </TabsTrigger>
              <TabsTrigger value="seo" className="gap-2 text-xs font-semibold data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-xl py-2.5">
                <FileText className="h-3.5 w-3.5 text-emerald-500" />
                <span>SEO Articles ({data.contentBriefs?.seoArticles?.length || 0})</span>
              </TabsTrigger>
              <TabsTrigger value="social" className="gap-2 text-xs font-semibold data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-xl py-2.5">
                <Layers className="h-3.5 w-3.5 text-amber-500" />
                <span>Carousels</span>
              </TabsTrigger>
              <TabsTrigger value="email" className="gap-2 text-xs font-semibold data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-xl py-2.5">
                <Mail className="h-3.5 w-3.5 text-blue-500" />
                <span>Email & Retention</span>
              </TabsTrigger>
            </TabsList>

            {/* TAB 1: SEARCH & SOCIAL TREND RADAR */}
            <TabsContent value="radar" className="space-y-6 animate-in fade-in-50 duration-200">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {(data.trendingKeywords || []).map((item: any, idx: number) => (
                  <Card key={idx} className="group hover:border-violet-500/40 hover:shadow-md transition-all rounded-2xl overflow-hidden bg-card/80 backdrop-blur-sm">
                    <CardHeader className="p-5 pb-3">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <Badge
                          variant="outline"
                          className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full ${
                            item.isBreakout
                              ? "bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/30"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {item.isBreakout ? "🔥 Breakout" : item.source}
                        </Badge>
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                          <TrendingUp className="h-3 w-3" />
                          {item.growth}
                        </span>
                      </div>
                      <CardTitle className="text-base font-semibold text-foreground group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors leading-snug">
                        {item.keyword}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-5 pt-0 space-y-3">
                      <div className="flex items-center justify-between text-xs text-muted-foreground pt-3 border-t">
                        <span className="flex items-center gap-1">
                          <Activity className="h-3.5 w-3.5 text-muted-foreground/70" />
                          Vol: <strong className="text-foreground">{item.searchVolume}</strong>
                        </span>
                        <Badge variant="secondary" className="text-[10px] font-medium bg-muted">
                          {item.intent}
                        </Badge>
                      </div>

                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleCopy(item.keyword, `kw-${idx}`)}
                        className="w-full h-8 text-xs font-medium text-muted-foreground hover:text-foreground gap-1.5 bg-muted/40 hover:bg-muted"
                      >
                        {copiedId === `kw-${idx}` ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                        <span>{copiedId === `kw-${idx}` ? "Keyword Copied" : "Copy Keyword"}</span>
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Macro & Regional Cultural Signals */}
              {data.generalTrends && data.generalTrends.length > 0 && (
                <div className="bg-muted/30 border rounded-2xl p-5 space-y-3">
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-amber-500" />
                    <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Macro Surges ({selectedGeo.toUpperCase()} Google Trends)
                    </h4>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {data.generalTrends.map((trend: any, i: number) => (
                      <span key={i} className="inline-flex items-center gap-1.5 text-xs bg-background border px-3 py-1.5 rounded-xl font-medium shadow-2xs">
                        <span className="font-semibold text-foreground capitalize">{trend.title}</span>
                        <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-md font-mono">
                          {trend.traffic} searches
                        </span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </TabsContent>

            {/* TAB 2: VIRAL SHORT-FORM VIDEO HOOKS */}
            <TabsContent value="video" className="space-y-4 animate-in fade-in-50 duration-200">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {(data.contentBriefs?.videoHooks || []).map((hook: any) => (
                  <Card key={hook.id} className="rounded-2xl border bg-card/90 overflow-hidden flex flex-col justify-between hover:border-pink-500/30 transition-all">
                    <CardHeader className="p-5 pb-3 bg-pink-500/[0.03] border-b border-pink-500/10">
                      <div className="flex items-center justify-between gap-2">
                        <Badge variant="outline" className="bg-pink-500/10 text-pink-600 dark:text-pink-400 border-pink-500/20 text-xs">
                          {hook.platform}
                        </Badge>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleCopy(`Hook: "${hook.hook}"\nVisual: ${hook.visualDirection}\nCTA: ${hook.recommendedCTA}`, hook.id)}
                          className="h-7 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground"
                        >
                          {copiedId === hook.id ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                          <span>{copiedId === hook.id ? "Copied" : "Copy"}</span>
                        </Button>
                      </div>
                      <CardTitle className="text-base font-bold text-foreground mt-2">{hook.title}</CardTitle>
                    </CardHeader>
                    <CardContent className="p-5 space-y-4 flex-1 flex flex-col justify-between">
                      <div className="space-y-3">
                        <div className="p-3 bg-pink-500/5 dark:bg-pink-500/10 rounded-xl border border-pink-500/15">
                          <p className="text-[11px] font-bold text-pink-600 dark:text-pink-400 uppercase tracking-wider mb-1">
                            Opening Hook (First 3 Seconds)
                          </p>
                          <p className="text-sm font-semibold text-foreground italic">"{hook.hook}"</p>
                        </div>

                        <div className="space-y-1">
                          <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Visual & Action Direction</p>
                          <p className="text-xs text-muted-foreground leading-relaxed">{hook.visualDirection}</p>
                        </div>
                      </div>

                      <div className="pt-3 border-t space-y-1.5 text-xs text-muted-foreground">
                        <div>
                          <strong className="text-foreground">Audience:</strong> {hook.targetAudience}
                        </div>
                        <div>
                          <strong className="text-pink-600 dark:text-pink-400">Recommended CTA:</strong> {hook.recommendedCTA}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            {/* TAB 3: SEO ARTICLES */}
            <TabsContent value="seo" className="space-y-4 animate-in fade-in-50 duration-200">
              <div className="space-y-4">
                {(data.contentBriefs?.seoArticles || []).map((article: any) => (
                  <Card key={article.id} className="rounded-2xl border bg-card/90 overflow-hidden hover:border-emerald-500/30 transition-all">
                    <CardHeader className="p-5 pb-3 bg-emerald-500/[0.03] border-b border-emerald-500/10">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-xs">
                            SEO Authority Guide
                          </Badge>
                          <span className="text-xs text-muted-foreground font-medium">Est. Potential: {article.estimatedMonthlyTrafficPotential}</span>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleCopy(`Title: ${article.title}\nKeywords: ${article.targetKeywords.join(", ")}\nOutline:\n${article.outline.join("\n")}`, article.id)}
                          className="h-7 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground self-start sm:self-auto"
                        >
                          {copiedId === article.id ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                          <span>{copiedId === article.id ? "Copied" : "Copy Brief"}</span>
                        </Button>
                      </div>
                      <CardTitle className="text-lg font-bold text-foreground mt-2">{article.title}</CardTitle>
                    </CardHeader>
                    <CardContent className="p-5 space-y-4">
                      <div>
                        <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Target Search Queries</p>
                        <div className="flex flex-wrap gap-1.5">
                          {article.targetKeywords.map((kw: string, i: number) => (
                            <Badge key={i} variant="secondary" className="text-xs bg-muted font-normal">
                              {kw}
                            </Badge>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Recommended Content Outline</p>
                        <ul className="space-y-1.5 text-xs text-muted-foreground">
                          {article.outline.map((item: string, idx: number) => (
                            <li key={idx} className="flex items-start gap-2">
                              <span className="h-5 w-5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                                {idx + 1}
                              </span>
                              <span className="leading-relaxed">{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            {/* TAB 4: CAROUSELS */}
            <TabsContent value="social" className="space-y-4 animate-in fade-in-50 duration-200">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {(data.contentBriefs?.socialCarousels || []).map((carousel: any) => (
                  <Card key={carousel.id} className="rounded-2xl border bg-card/90 overflow-hidden hover:border-amber-500/30 transition-all">
                    <CardHeader className="p-5 pb-3 bg-amber-500/[0.03] border-b border-amber-500/10">
                      <div className="flex items-center justify-between gap-2">
                        <Badge variant="outline" className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 text-xs">
                          {carousel.platform}
                        </Badge>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleCopy(`Title: ${carousel.title}\nSlides:\n${carousel.slides.join("\n")}`, carousel.id)}
                          className="h-7 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground"
                        >
                          {copiedId === carousel.id ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                          <span>{copiedId === carousel.id ? "Copied" : "Copy Slides"}</span>
                        </Button>
                      </div>
                      <CardTitle className="text-base font-bold text-foreground mt-2">{carousel.title}</CardTitle>
                    </CardHeader>
                    <CardContent className="p-5 space-y-3">
                      <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Slide-by-Slide Design Flow</p>
                      <div className="space-y-2">
                        {carousel.slides.map((slide: string, i: number) => (
                          <div key={i} className="p-2.5 rounded-xl bg-muted/40 border border-border/50 text-xs leading-relaxed text-foreground font-medium">
                            {slide}
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            {/* TAB 5: EMAIL & RETENTION */}
            <TabsContent value="email" className="space-y-4 animate-in fade-in-50 duration-200">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {(data.contentBriefs?.newsletterAngles || [])?.map((item: any) => (
                  <Card key={item.id} className="rounded-2xl border bg-card/90 overflow-hidden hover:border-blue-500/30 transition-all flex flex-col justify-between">
                    <CardHeader className="p-5 pb-3 bg-blue-500/[0.03] border-b border-blue-500/10">
                      <div className="flex items-center justify-between gap-2">
                        <Badge variant="outline" className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20 text-xs">
                          Customer Email Broadcast
                        </Badge>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleCopy(`Subject: ${item.subjectLine}\nPreview: ${item.previewText}\nHook: ${item.hook}\nCTA: ${item.cta}`, item.id)}
                          className="h-7 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground"
                        >
                          {copiedId === item.id ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                          <span>{copiedId === item.id ? "Copied" : "Copy Email"}</span>
                        </Button>
                      </div>
                      <CardTitle className="text-base font-bold text-foreground mt-2 leading-snug">
                        {item.subjectLine}
                      </CardTitle>
                      <p className="text-xs text-muted-foreground mt-1">Preview: {item.previewText}</p>
                    </CardHeader>
                    <CardContent className="p-5 space-y-4 flex-1 flex flex-col justify-between">
                      <div className="space-y-2">
                        <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Story Opener / Hook</p>
                        <p className="text-xs text-foreground bg-muted/30 p-3 rounded-xl border leading-relaxed italic">
                          "{item.hook}"
                        </p>
                      </div>
                      <div className="pt-3 border-t text-xs">
                        <strong className="text-blue-600 dark:text-blue-400">Target Action / CTA:</strong> {item.cta}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </TooltipProvider>
  );
}
