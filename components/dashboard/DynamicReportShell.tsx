"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Activity, Search, Download, TrendingUp, TrendingDown,
  ExternalLink, Info, ArrowLeft, RefreshCw,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer, Legend,
} from "recharts";
import Link from "next/link";

// ── Types ──────────────────────────────────────────────
interface TopPost {
  id: string;
  link: string;
  views: number;
  engagement_percent: number;
  platform: string;
  followers: number;
  reach_tier: string | null;
  engagement_tier: string | null;
  influence: number | null;
}

interface PlatformData {
  id: string; platform: string; followers: number;
  new_followers: number | null; engagement_rate: number | null;
  last_week_engagement_rate: number | null; total_content: number | null;
  last_week_total_content: number | null;
}

interface PlatformContent {
  id: string; platform_data_id: string; content_type: string;
  post_date: string; reach: number | null; views: number | null;
  likes: number | null; comments: number | null; shares: number | null;
  interactions: number | null; impressions: number | null;
  engagements: number | null; profile_visits: number | null;
  link_clicks: number | null; duration: string | null;
  played_to_watch_percent: number | null; watch_time_hours: number | null;
  subscribers: number | null; click_through_rate: number | null;
  url: string | null; title: string | null;
}

interface Report {
  id: string; date_range: string; week_start: string;
  week_end: string; client_id: string;
}

interface Client { id: string; name: string; logo_url: string | null; }

// ── Component ──────────────────────────────────────────
export default function DynamicReportShell({ reportId }: { reportId: string }) {
  const router = useRouter();

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

  const [report, setReport] = useState<Report | null>(null);
  const [client, setClient] = useState<Client | null>(null);
  const [topPosts, setTopPosts] = useState<TopPost[]>([]);
  const [platformData, setPlatformData] = useState<PlatformData[]>([]);
  const [platformContent, setPlatformContent] = useState<Record<string, PlatformContent[]>>({});
  const [loading, setLoading] = useState(true);
  const [refreshingFollowers, setRefreshingFollowers] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [contentSearchTerm, setContentSearchTerm] = useState("");
  const [contentFilter, setContentFilter] = useState("All");
  const [activePlatform, setActivePlatform] = useState("");

  useEffect(() => { fetchReportData(); }, [reportId]);

  // ── Helpers ────────────────────────────────────────────
  const extractYoutubeVideoId = (url: string): string | null => {
    const patterns = [/youtube\.com\/watch\?v=([^&]+)/, /youtube\.com\/shorts\/([^?&]+)/, /youtu\.be\/([^?&]+)/];
    for (const p of patterns) { const m = url.match(p); if (m) return m[1]; }
    return null;
  };

  const getPlatformColor = (platform: string) => {
    const c: Record<string, string> = {
      Instagram: "bg-pink-500", Facebook: "bg-blue-600", TikTok: "bg-black",
      X: "bg-gray-800", Youtube: "bg-red-500", YouTube: "bg-red-500", LinkedIn: "bg-blue-700",
    };
    return c[platform] || "bg-primary";
  };

  const getTypeBadgeColor = (type: string) => {
    const c: Record<string, string> = {
      Reel: "bg-violet-500 text-white", Photo: "bg-secondary text-secondary-foreground",
      Post: "bg-secondary text-secondary-foreground", Video: "bg-red-500 text-white",
      video: "bg-red-500 text-white", Short: "bg-pink-500 text-white", short: "bg-pink-500 text-white",
    };
    return c[type] || "bg-secondary text-secondary-foreground";
  };

  const formatDate = (ds: string) =>
    new Date(ds).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });

  const exportToCSV = (data: Record<string, unknown>[], filename: string) => {
    if (data.length === 0) return;
    const headers = Object.keys(data[0]);
    const csvContent = [headers.join(","), ...data.map(r => headers.map(h => r[h]).join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.click();
  };

  // ── Data fetching ──────────────────────────────────────
  const fetchReportData = async () => {
    try {
      setLoading(true);
      const { data: reportData, error: reportError } = await supabase.from("reports").select("*").eq("id", reportId).single();
      if (reportError) throw reportError;
      setReport(reportData);

      const { data: clientData } = await supabase.from("clients").select("*").eq("id", reportData.client_id).single();
      if (clientData) setClient(clientData);

      const { data: topPostsData } = await supabase.from("top_performing_posts").select("*").eq("report_id", reportId);

      const { data: socialContent } = await supabase
        .from("social_content")
        .select("id, url, title, content_type, published_at, platform, social_content_metrics!inner(views, likes, comments, shares, reach, period_start, period_end)")
        .eq("client_id", reportData.client_id)
        .gte("published_at", `${reportData.week_start}T00:00:00Z`)
        .lte("published_at", `${reportData.week_end}T23:59:59Z`);

      const { data: allMetrics } = await supabase
        .from("social_account_metrics")
        .select("platform, followers")
        .eq("client_id", reportData.client_id)
        .order("collected_at", { ascending: false });

      const followerMap: Record<string, number> = {};
      if (allMetrics) { for (const m of allMetrics) { if (!followerMap[m.platform]) followerMap[m.platform] = m.followers || 0; } }

      let allTopPosts: TopPost[] = topPostsData || [];
      const existingPostUrls = new Set(allTopPosts.map(p => p.link?.toLowerCase()).filter(Boolean));

      if (socialContent && socialContent.length > 0) {
        const socialTopPosts: TopPost[] = (socialContent as any[])
          .map((content) => {
            const metrics = content.social_content_metrics?.[0] || {};
            const views = Math.max(metrics.views || 0, metrics.reach || 0);
            const likes = metrics.likes || 0; const comments = metrics.comments || 0; const shares = metrics.shares || 0;
            const ep = views > 0 ? ((likes + comments + shares) / views) * 100 : 0;
            const pn = content.platform.charAt(0).toUpperCase() + content.platform.slice(1);
            const pf = followerMap[content.platform] || 0;
            let rt = "Tier 1"; if (views >= 100000) rt = "Tier 5"; else if (views >= 20000) rt = "Tier 4"; else if (views >= 5000) rt = "Tier 3"; else if (views >= 1000) rt = "Tier 2";
            let et = "Tier 5"; if (ep >= 7) et = "Tier 1"; else if (ep >= 5) et = "Tier 2"; else if (ep >= 3) et = "Tier 3"; else if (ep >= 1) et = "Tier 4";
            return { id: content.id, link: content.url || "", views, engagement_percent: parseFloat(ep.toFixed(2)), platform: pn, followers: pf, reach_tier: rt, engagement_tier: et, influence: Math.min(Math.ceil(views / 100) + (ep >= 3 ? 1 : 0), 5) };
          })
          .filter((post: TopPost) => {
            if (post.link && existingPostUrls.has(post.link.toLowerCase())) return false;
            if (post.platform.toLowerCase() === "youtube") {
              const vid = extractYoutubeVideoId(post.link);
              const eIds = new Set(allTopPosts.filter(p => p.platform?.toLowerCase() === "youtube").map(p => extractYoutubeVideoId(p.link)).filter(Boolean));
              if (vid && eIds.has(vid)) return false;
            }
            return post.views > 0;
          });
        allTopPosts = [...allTopPosts, ...socialTopPosts];
      }

      const enhancedTopPosts = allTopPosts
        .map(post => { if (post.followers === 0) { const k = post.platform.toLowerCase(); const f = followerMap[k] || 0; if (f > 0) return { ...post, followers: f }; } return post; })
        .filter(post => post.views >= 50);
      enhancedTopPosts.sort((a, b) => { const sa = a.views * (1 + (a.engagement_percent || 0) / 100); const sb = b.views * (1 + (b.engagement_percent || 0) / 100); return sb - sa; });
      setTopPosts(enhancedTopPosts);

      const { data: pdResult } = await supabase.from("platform_data").select("*").eq("report_id", reportId);
      if (pdResult) {
        setPlatformData(pdResult);
        if (pdResult.length > 0) setActivePlatform(pdResult[0].platform);
        const contentMap: Record<string, PlatformContent[]> = {};
        for (const pd of pdResult) {
          const { data: cd } = await supabase.from("platform_content").select("*").eq("platform_data_id", pd.id).order("post_date", { ascending: true });
          contentMap[pd.platform] = cd || [];
        }
        setPlatformContent(contentMap);
      }
    } catch (err) { console.error("Error fetching report:", err); } finally { setLoading(false); }
  };

  const refreshFollowerCounts = async () => {
    if (!report?.client_id) return;
    setRefreshingFollowers(true);
    try {
      const { data: latestMetrics } = await supabase.from("social_account_metrics").select("platform, followers").eq("client_id", report.client_id).order("collected_at", { ascending: false });
      if (latestMetrics && latestMetrics.length > 0) {
        const fm: Record<string, number> = {};
        latestMetrics.forEach(m => { if (!fm[m.platform]) fm[m.platform] = m.followers || 0; });
        setTopPosts(prev => prev.map(p => { const k = p.platform.toLowerCase(); if (p.followers === 0 && fm[k]) return { ...p, followers: fm[k] }; return p; }));
      }
    } catch (err) { console.error("Error refreshing:", err); } finally { setRefreshingFollowers(false); }
  };

  // ── Render ─────────────────────────────────────────────
  const filteredTopPosts = topPosts.filter(p => p.platform.toLowerCase().includes(searchTerm.toLowerCase()) || p.link.toLowerCase().includes(searchTerm.toLowerCase())).slice(0, 3);
  const getChartData = () => platformData.map(pd => { const c = platformContent[pd.platform] || []; return { name: pd.platform, Followers: pd.followers, "Total Views": c.reduce((s, x) => s + (x.views || 0), 0), "Total Interactions": c.reduce((s, x) => s + (x.interactions || 0), 0) }; });

  if (loading) {
    return (
      <main className="container mx-auto px-4 py-8">
        <Skeleton className="h-8 w-64 mb-4" /><Skeleton className="h-4 w-48 mb-8" />
        <div className="grid gap-6"><Skeleton className="h-64 w-full" /><Skeleton className="h-96 w-full" /></div>
      </main>
    );
  }

  if (!report) {
    return (
      <main className="container mx-auto px-4 py-8">
        <p>Report not found.</p>
        <Link href="/" className="text-primary hover:underline">Back to Clients</Link>
      </main>
    );
  }

  const currentContent = platformContent[activePlatform] || [];
  const filteredContent = currentContent.filter(c =>
    (contentFilter === "All" || c.content_type.toLowerCase() === contentFilter.toLowerCase()) &&
    (c.content_type.toLowerCase().includes(contentSearchTerm.toLowerCase()) || c.post_date.includes(contentSearchTerm) || (c.title && c.title.toLowerCase().includes(contentSearchTerm.toLowerCase())))
  );

  return (
    <main className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <Link href="/" className="inline-flex items-center text-muted-foreground hover:text-foreground mb-4 transition-colors">
          <ArrowLeft className="h-4 w-4 mr-2" />Back to Clients
        </Link>
        <h1 className="text-3xl font-bold text-foreground">{client?.name || "Client"}</h1>
        <p className="text-muted-foreground">Weekly Performance Insights: {report.date_range}</p>
      </div>

      {/* Top Performing Insights */}
      <TooltipProvider>
        <Card className="mb-8">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />Top Performing Insights
              <Tooltip><TooltipTrigger><Info className="h-4 w-4 text-muted-foreground" /></TooltipTrigger>
                <TooltipContent className="max-w-xs"><p className="text-sm"><strong>Scoring:</strong> Posts are ranked by a weighted score combining views and engagement. Posts with fewer than 50 views are excluded.</p></TooltipContent>
              </Tooltip>
            </CardTitle>
            <div className="flex items-center gap-2">
              <div className="relative"><Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Search posts..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-10 w-48" /></div>
              <Tooltip><TooltipTrigger asChild><Button variant="outline" size="sm" onClick={refreshFollowerCounts} disabled={refreshingFollowers}><RefreshCw className={`h-4 w-4 ${refreshingFollowers ? "animate-spin" : ""}`} /></Button></TooltipTrigger><TooltipContent><p>Refresh follower counts</p></TooltipContent></Tooltip>
              <Button variant="outline" size="sm" onClick={() => exportToCSV(filteredTopPosts.map(p => ({ Link: p.link, Views: p.views, "Engagement %": p.engagement_percent, Platform: p.platform, Followers: p.followers, "Reach Tier": p.reach_tier || "", "Engagement Tier": p.engagement_tier || "", Influence: p.influence || 0 })), "top-posts.csv")}><Download className="h-4 w-4 mr-2" />Export CSV</Button>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>Post Link</TableHead><TableHead>Views</TableHead><TableHead>Engagement %</TableHead><TableHead>Platform</TableHead><TableHead>Followers</TableHead><TableHead>Reach Tier</TableHead><TableHead>Engagement Tier</TableHead><TableHead>Influence</TableHead></TableRow></TableHeader>
              <TableBody>
                {filteredTopPosts.length === 0 ? (<TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">No top posts data available</TableCell></TableRow>) : filteredTopPosts.map(post => (
                  <TableRow key={post.id}>
                    <TableCell><a href={post.link} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-1">View Post<ExternalLink className="h-3 w-3" /></a></TableCell>
                    <TableCell>{post.views.toLocaleString()}</TableCell><TableCell>{post.engagement_percent.toFixed(2)}%</TableCell>
                    <TableCell><Badge className={`${getPlatformColor(post.platform)} text-white`}>{post.platform}</Badge></TableCell>
                    <TableCell>{post.followers.toLocaleString()}</TableCell><TableCell>{post.reach_tier || "-"}</TableCell><TableCell>{post.engagement_tier || "-"}</TableCell><TableCell>{post.influence || "-"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </TooltipProvider>

      {/* Platform Performance Chart */}
      {platformData.length > 0 && (
        <Card className="mb-8">
          <CardHeader><CardTitle>Platform Performance Overview</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={getChartData()} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis /><RechartsTooltip /><Legend />
                <Bar dataKey="Followers" fill="hsl(var(--primary))" /><Bar dataKey="Total Views" fill="hsl(var(--chart-2))" /><Bar dataKey="Total Interactions" fill="hsl(var(--chart-3))" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Platform Content Performance */}
      {platformData.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Platform Content Performance</CardTitle></CardHeader>
          <CardContent>
            <Tabs value={activePlatform} onValueChange={setActivePlatform}>
              <TabsList className="mb-6">
                {platformData.map(pd => <TabsTrigger key={pd.id} value={pd.platform}>{pd.platform}</TabsTrigger>)}
              </TabsList>
              {platformData.map(pd => {
                const pc = platformContent[pd.platform] || [];
                const fc = pc.filter(c => (contentFilter === "All" || c.content_type.toLowerCase() === contentFilter.toLowerCase()) && (c.content_type.toLowerCase().includes(contentSearchTerm.toLowerCase()) || c.post_date.includes(contentSearchTerm) || (c.title && c.title.toLowerCase().includes(contentSearchTerm.toLowerCase()))));
                return (
                  <TabsContent key={pd.id} value={pd.platform}>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                      <Card className="bg-card"><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Followers</p><div className="flex items-center gap-2"><span className="text-3xl font-bold">{pd.followers.toLocaleString()}</span>{pd.new_followers && pd.new_followers > 0 && <span className="text-sm text-green-500 flex items-center">+{pd.new_followers}<TrendingUp className="h-3 w-3 ml-1" /></span>}</div></CardContent></Card>
                      <Card className="bg-card"><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Engagement Rate %</p><div className="flex items-center gap-2"><span className="text-3xl font-bold">{(pd.engagement_rate || 0).toFixed(2)}%</span>{pd.last_week_engagement_rate !== null && <span className={`text-sm flex items-center ${(pd.engagement_rate || 0) >= (pd.last_week_engagement_rate || 0) ? "text-green-500" : "text-red-500"}`}>{(pd.engagement_rate || 0) >= (pd.last_week_engagement_rate || 0) ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}</span>}</div>{pd.last_week_engagement_rate !== null && <p className="text-xs text-muted-foreground">Last week: {(pd.last_week_engagement_rate || 0).toFixed(2)}%</p>}</CardContent></Card>
                      <Card className="bg-card"><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Total Content</p><div className="flex items-center gap-2"><span className="text-3xl font-bold">{pd.total_content || 0}</span>{pd.last_week_total_content !== null && <span className={`text-sm flex items-center ${(pd.total_content || 0) >= (pd.last_week_total_content || 0) ? "text-green-500" : "text-red-500"}`}>{(pd.total_content || 0) >= (pd.last_week_total_content || 0) ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}</span>}</div>{pd.last_week_total_content !== null && <p className="text-xs text-muted-foreground">Last week: {pd.last_week_total_content}</p>}</CardContent></Card>
                    </div>

                    <div className="flex items-center gap-4 mb-4">
                      <div className="relative flex-1 max-w-xs"><Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Search content..." value={contentSearchTerm} onChange={e => setContentSearchTerm(e.target.value)} className="pl-10" /></div>
                      <div className="flex gap-2">
                        {(pd.platform === "YouTube" || pd.platform === "Youtube" ? ["All", "Video", "Short"] : ["All", "Reel", "Post"]).map(filter => (
                          <Button key={filter} variant={contentFilter === filter ? "default" : "outline"} size="sm" onClick={() => setContentFilter(filter.toLowerCase() === "all" ? "All" : filter.toLowerCase())}>{filter}</Button>
                        ))}
                      </div>
                    </div>

                    <Table>
                      <TableHeader><TableRow>
                        <TableHead>Type</TableHead>
                        {(pd.platform === "YouTube" || pd.platform === "Youtube") && <TableHead>Video</TableHead>}
                        <TableHead>Date</TableHead>
                        {(pd.platform === "YouTube" || pd.platform === "Youtube") ? (
                          <><TableHead>Duration</TableHead><TableHead>Likes</TableHead><TableHead>Comments</TableHead><TableHead>Shares</TableHead><TableHead>Avg. Duration %</TableHead><TableHead>Views</TableHead><TableHead>Subscribers</TableHead><TableHead>Impressions</TableHead></>
                        ) : pd.platform === "X" ? (
                          <><TableHead>Impressions</TableHead><TableHead>Engagements</TableHead><TableHead>Profile Visits</TableHead><TableHead>Link Clicks</TableHead></>
                        ) : (
                          <><TableHead>Reach</TableHead><TableHead>Likes</TableHead><TableHead>Comments</TableHead><TableHead>Shares</TableHead><TableHead>Views</TableHead></>
                        )}
                      </TableRow></TableHeader>
                      <TableBody>
                        {fc.length === 0 ? (<TableRow><TableCell colSpan={10} className="text-center text-muted-foreground">No content data available</TableCell></TableRow>) : fc.map(c => (
                          <TableRow key={c.id}>
                            <TableCell><Badge className={getTypeBadgeColor(c.content_type)}>{c.content_type}</Badge></TableCell>
                            {(pd.platform === "YouTube" || pd.platform === "Youtube") && <TableCell>{c.url ? <a href={c.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-1">{c.title || "View"}<ExternalLink className="h-3 w-3" /></a> : "-"}</TableCell>}
                            <TableCell>{formatDate(c.post_date)}</TableCell>
                            {(pd.platform === "YouTube" || pd.platform === "Youtube") ? (
                              <><TableCell>{c.duration || "-"}</TableCell><TableCell>{c.likes?.toLocaleString() ?? "-"}</TableCell><TableCell>{c.comments?.toLocaleString() ?? "-"}</TableCell><TableCell>{c.shares?.toLocaleString() ?? "-"}</TableCell><TableCell>{c.played_to_watch_percent != null ? `${c.played_to_watch_percent.toFixed(1)}%` : "-"}</TableCell><TableCell>{c.views?.toLocaleString() ?? "-"}</TableCell><TableCell>{c.subscribers?.toLocaleString() ?? "-"}</TableCell><TableCell>{c.impressions?.toLocaleString() ?? "-"}</TableCell></>
                            ) : pd.platform === "X" ? (
                              <><TableCell>{c.impressions?.toLocaleString() ?? "-"}</TableCell><TableCell>{c.engagements?.toLocaleString() ?? "-"}</TableCell><TableCell>{c.profile_visits?.toLocaleString() ?? "-"}</TableCell><TableCell>{c.link_clicks?.toLocaleString() ?? "-"}</TableCell></>
                            ) : (
                              <><TableCell>{c.reach?.toLocaleString() ?? "-"}</TableCell><TableCell>{c.likes?.toLocaleString() ?? "-"}</TableCell><TableCell>{c.comments?.toLocaleString() ?? "-"}</TableCell><TableCell>{c.shares?.toLocaleString() ?? "-"}</TableCell><TableCell>{c.views?.toLocaleString() ?? "-"}</TableCell></>
                            )}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TabsContent>
                );
              })}
            </Tabs>
          </CardContent>
        </Card>
      )}
    </main>
  );
}
