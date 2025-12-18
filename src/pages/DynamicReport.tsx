import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { Header } from "@/components/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { Activity, Search, Download, TrendingUp, TrendingDown, ExternalLink, Info, ArrowLeft } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend } from "recharts";
import { supabase } from "@/integrations/supabase/client";

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
  id: string;
  platform: string;
  followers: number;
  new_followers: number | null;
  engagement_rate: number | null;
  last_week_engagement_rate: number | null;
  total_content: number | null;
  last_week_total_content: number | null;
}

interface PlatformContent {
  id: string;
  platform_data_id: string;
  content_type: string;
  post_date: string;
  reach: number | null;
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  interactions: number | null;
  impressions: number | null;
  engagements: number | null;
  profile_visits: number | null;
  link_clicks: number | null;
  // YouTube-specific fields
  duration: string | null;
  played_to_watch_percent: number | null;
  watch_time_hours: number | null;
  subscribers: number | null;
  click_through_rate: number | null;
}

interface Report {
  id: string;
  date_range: string;
  week_start: string;
  week_end: string;
  client_id: string;
}

interface Client {
  id: string;
  name: string;
  logo_url: string | null;
}

const DynamicReport = () => {
  const { reportId } = useParams<{ reportId: string }>();
  const [report, setReport] = useState<Report | null>(null);
  const [client, setClient] = useState<Client | null>(null);
  const [topPosts, setTopPosts] = useState<TopPost[]>([]);
  const [platformData, setPlatformData] = useState<PlatformData[]>([]);
  const [platformContent, setPlatformContent] = useState<Record<string, PlatformContent[]>>({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [contentSearchTerm, setContentSearchTerm] = useState("");
  const [contentFilter, setContentFilter] = useState("All");
  const [activePlatform, setActivePlatform] = useState("");

  useEffect(() => {
    if (reportId) {
      fetchReportData();
    }
  }, [reportId]);

  const fetchReportData = async () => {
    try {
      setLoading(true);

      // Fetch report
      const { data: reportData, error: reportError } = await supabase
        .from("reports")
        .select("*")
        .eq("id", reportId)
        .single();

      if (reportError) throw reportError;
      setReport(reportData);

      // Fetch client
      const { data: clientData, error: clientError } = await supabase
        .from("clients")
        .select("*")
        .eq("id", reportData.client_id)
        .single();

      if (!clientError) setClient(clientData);

      // Fetch top posts
      const { data: topPostsData, error: topPostsError } = await supabase
        .from("top_performing_posts")
        .select("*")
        .eq("report_id", reportId);

      if (!topPostsError) setTopPosts(topPostsData || []);

      // Fetch platform data
      const { data: platformDataResult, error: platformError } = await supabase
        .from("platform_data")
        .select("*")
        .eq("report_id", reportId);

      if (!platformError && platformDataResult) {
        setPlatformData(platformDataResult);
        if (platformDataResult.length > 0) {
          setActivePlatform(platformDataResult[0].platform);
        }

        // Fetch content for each platform
        const contentMap: Record<string, PlatformContent[]> = {};
        for (const pd of platformDataResult) {
          const { data: contentData } = await supabase
            .from("platform_content")
            .select("*")
            .eq("platform_data_id", pd.id)
            .order("post_date", { ascending: true });

          contentMap[pd.platform] = contentData || [];
        }
        setPlatformContent(contentMap);
      }
    } catch (error) {
      console.error("Error fetching report:", error);
    } finally {
      setLoading(false);
    }
  };

  const getPlatformColor = (platform: string) => {
    const colors: Record<string, string> = {
      Instagram: "bg-pink-500",
      Facebook: "bg-blue-600",
      TikTok: "bg-black",
      X: "bg-gray-800",
      Youtube: "bg-red-500",
      YouTube: "bg-red-500",
      LinkedIn: "bg-blue-700",
    };
    return colors[platform] || "bg-primary";
  };

  const getTypeBadgeColor = (type: string) => {
    const colors: Record<string, string> = {
      Reel: "bg-violet-500 text-white",
      Photo: "bg-secondary text-secondary-foreground",
      Post: "bg-secondary text-secondary-foreground",
      Video: "bg-violet-500 text-white",
    };
    return colors[type] || "bg-secondary text-secondary-foreground";
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
  };

  const filteredTopPosts = topPosts.filter(
    (post) =>
      post.platform.toLowerCase().includes(searchTerm.toLowerCase()) ||
      post.link.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getChartData = () => {
    return platformData.map((pd) => {
      const content = platformContent[pd.platform] || [];
      const totalViews = content.reduce((sum, c) => sum + (c.views || 0), 0);
      const totalInteractions = content.reduce((sum, c) => sum + (c.interactions || 0), 0);

      return {
        name: pd.platform,
        Followers: pd.followers,
        "Total Views": totalViews,
        "Total Interactions": totalInteractions,
      };
    });
  };

  const exportToCSV = (data: Record<string, unknown>[], filename: string) => {
    if (data.length === 0) return;
    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(","),
      ...data.map((row) => headers.map((h) => row[h]).join(",")),
    ].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <Skeleton className="h-8 w-64 mb-4" />
          <Skeleton className="h-4 w-48 mb-8" />
          <div className="grid gap-6">
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-96 w-full" />
          </div>
        </main>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <p>Report not found.</p>
          <Link to="/" className="text-primary hover:underline">
            Back to Clients
          </Link>
        </main>
      </div>
    );
  }

  const currentPlatformData = platformData.find((pd) => pd.platform === activePlatform);
  const currentContent = platformContent[activePlatform] || [];
  const filteredContent = currentContent.filter(
    (c) =>
      (contentFilter === "All" || c.content_type === contentFilter) &&
      (c.content_type.toLowerCase().includes(contentSearchTerm.toLowerCase()) ||
        c.post_date.includes(contentSearchTerm))
  );

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <Link
            to="/"
            className="inline-flex items-center text-muted-foreground hover:text-foreground mb-4 transition-colors"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Clients
          </Link>
          <h1 className="text-3xl font-bold text-foreground">{client?.name || "Client"}</h1>
          <p className="text-muted-foreground">Weekly Performance Insights: {report.date_range}</p>
        </div>

        {/* Top Performing Insights */}
        <Card className="mb-8">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              Top Performing Insights
            </CardTitle>
            <div className="flex items-center gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search posts..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 w-48"
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  exportToCSV(
                    filteredTopPosts.map((p) => ({
                      Link: p.link,
                      Views: p.views,
                      "Engagement %": p.engagement_percent,
                      Platform: p.platform,
                      Followers: p.followers,
                      "Reach Tier": p.reach_tier || "",
                      "Engagement Tier": p.engagement_tier || "",
                      Influence: p.influence || 0,
                    })),
                    "top-posts.csv"
                  )
                }
              >
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <TooltipProvider>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Post Link</TableHead>
                    <TableHead>Views</TableHead>
                    <TableHead>Engagement %</TableHead>
                    <TableHead>Platform</TableHead>
                    <TableHead>Followers</TableHead>
                    <TableHead>
                      <div className="flex items-center gap-1">
                        Reach Tier
                        <Tooltip>
                          <TooltipTrigger>
                            <Info className="h-3 w-3" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Tier 1: &lt; 1k reach</p>
                            <p>Tier 2: 1k–5k reach</p>
                            <p>Tier 3: 5k–20k reach</p>
                            <p>Tier 4: 20k–100k reach</p>
                            <p>Tier 5: &gt; 100k reach</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </TableHead>
                    <TableHead>
                      <div className="flex items-center gap-1">
                        Engagement Tier
                        <Tooltip>
                          <TooltipTrigger>
                            <Info className="h-3 w-3" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Tier 1: ≥ 7%</p>
                            <p>Tier 2: 5–6.99%</p>
                            <p>Tier 3: 3–4.99%</p>
                            <p>Tier 4: 1–2.99%</p>
                            <p>Tier 5: &lt; 1%</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </TableHead>
                    <TableHead>Influence</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTopPosts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground">
                        No top posts data available
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredTopPosts.map((post) => (
                      <TableRow key={post.id}>
                        <TableCell>
                          <a
                            href={post.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline flex items-center gap-1"
                          >
                            View Post
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </TableCell>
                        <TableCell>{post.views.toLocaleString()}</TableCell>
                        <TableCell>{post.engagement_percent.toFixed(2)}%</TableCell>
                        <TableCell>
                          <Badge className={`${getPlatformColor(post.platform)} text-white`}>
                            {post.platform}
                          </Badge>
                        </TableCell>
                        <TableCell>{post.followers.toLocaleString()}</TableCell>
                        <TableCell>{post.reach_tier || "-"}</TableCell>
                        <TableCell>{post.engagement_tier || "-"}</TableCell>
                        <TableCell>{post.influence || "-"}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TooltipProvider>
          </CardContent>
        </Card>

        {/* Platform Performance Overview Chart */}
        {platformData.length > 0 && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Platform Performance Overview</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={getChartData()} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <RechartsTooltip />
                  <Legend />
                  <Bar dataKey="Followers" fill="hsl(var(--primary))" />
                  <Bar dataKey="Total Views" fill="hsl(var(--chart-2))" />
                  <Bar dataKey="Total Interactions" fill="hsl(var(--chart-3))" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Platform Content Performance */}
        {platformData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Platform Content Performance</CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs value={activePlatform} onValueChange={setActivePlatform}>
                <TabsList className="mb-6">
                  {platformData.map((pd) => (
                    <TabsTrigger key={pd.id} value={pd.platform}>
                      {pd.platform}
                    </TabsTrigger>
                  ))}
                </TabsList>

                {platformData.map((pd) => (
                  <TabsContent key={pd.id} value={pd.platform}>
                    {/* Metrics Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                      <Card className="bg-card">
                        <CardContent className="pt-6">
                          <p className="text-sm text-muted-foreground">Followers</p>
                          <div className="flex items-center gap-2">
                            <span className="text-3xl font-bold">{pd.followers.toLocaleString()}</span>
                            {pd.new_followers && pd.new_followers > 0 && (
                              <span className="text-sm text-green-500 flex items-center">
                                +{pd.new_followers}
                                <TrendingUp className="h-3 w-3 ml-1" />
                              </span>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                      <Card className="bg-card">
                        <CardContent className="pt-6">
                          <p className="text-sm text-muted-foreground">Engagement Rate %</p>
                          <div className="flex items-center gap-2">
                            <span className="text-3xl font-bold">{(pd.engagement_rate || 0).toFixed(2)}%</span>
                            {pd.last_week_engagement_rate !== null && (
                              <span
                                className={`text-sm flex items-center ${
                                  (pd.engagement_rate || 0) >= (pd.last_week_engagement_rate || 0)
                                    ? "text-green-500"
                                    : "text-red-500"
                                }`}
                              >
                                {(pd.engagement_rate || 0) >= (pd.last_week_engagement_rate || 0) ? (
                                  <TrendingUp className="h-3 w-3" />
                                ) : (
                                  <TrendingDown className="h-3 w-3" />
                                )}
                              </span>
                            )}
                          </div>
                          {pd.last_week_engagement_rate !== null && (
                            <p className="text-xs text-muted-foreground">
                              Last week: {(pd.last_week_engagement_rate || 0).toFixed(2)}%
                            </p>
                          )}
                        </CardContent>
                      </Card>
                      <Card className="bg-card">
                        <CardContent className="pt-6">
                          <p className="text-sm text-muted-foreground">Total Content</p>
                          <div className="flex items-center gap-2">
                            <span className="text-3xl font-bold">{pd.total_content || 0}</span>
                            {pd.last_week_total_content !== null && (
                              <span
                                className={`text-sm flex items-center ${
                                  (pd.total_content || 0) >= (pd.last_week_total_content || 0)
                                    ? "text-green-500"
                                    : "text-red-500"
                                }`}
                              >
                                {(pd.total_content || 0) >= (pd.last_week_total_content || 0) ? (
                                  <TrendingUp className="h-3 w-3" />
                                ) : (
                                  <TrendingDown className="h-3 w-3" />
                                )}
                              </span>
                            )}
                          </div>
                          {pd.last_week_total_content !== null && (
                            <p className="text-xs text-muted-foreground">
                              Last week: {pd.last_week_total_content}
                            </p>
                          )}
                        </CardContent>
                      </Card>
                    </div>

                    {/* Search and Filter */}
                    <div className="flex items-center gap-4 mb-4">
                      <div className="relative flex-1 max-w-xs">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Search content..."
                          value={contentSearchTerm}
                          onChange={(e) => setContentSearchTerm(e.target.value)}
                          className="pl-10"
                        />
                      </div>
                      <div className="flex gap-2">
                        {["All", "Reel", "Post"].map((filter) => (
                          <Button
                            key={filter}
                            variant={contentFilter === filter ? "default" : "outline"}
                            size="sm"
                            onClick={() => setContentFilter(filter)}
                          >
                            {filter}
                          </Button>
                        ))}
                      </div>
                    </div>

                    {/* Content Table */}
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Type</TableHead>
                          <TableHead>Date</TableHead>
                          {pd.platform === "YouTube" || pd.platform === "Youtube" ? (
                            <>
                              <TableHead>Duration</TableHead>
                              <TableHead>Likes</TableHead>
                              <TableHead>Comments</TableHead>
                              <TableHead>Shares</TableHead>
                              <TableHead>Stayed to Watch %</TableHead>
                              <TableHead>Views</TableHead>
                              <TableHead>Watch Time (hrs)</TableHead>
                              <TableHead>Subscribers</TableHead>
                              <TableHead>Impressions</TableHead>
                            </>
                          ) : pd.platform === "X" ? (
                            <>
                              <TableHead>Impressions</TableHead>
                              <TableHead>Engagements</TableHead>
                              <TableHead>Profile Visits</TableHead>
                              <TableHead>Link Clicks</TableHead>
                            </>
                          ) : (
                            <>
                              <TableHead>Reach</TableHead>
                              <TableHead>Views</TableHead>
                              <TableHead>Likes & Reactions</TableHead>
                              <TableHead>Comments</TableHead>
                              <TableHead>Shares</TableHead>
                              <TableHead>Interactions</TableHead>
                            </>
                          )}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredContent.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={pd.platform === "YouTube" || pd.platform === "Youtube" ? 11 : pd.platform === "X" ? 6 : 8} className="text-center text-muted-foreground">
                              No content data available
                            </TableCell>
                          </TableRow>
                        ) : (
                          filteredContent.map((content) => (
                            <TableRow key={content.id}>
                              <TableCell>
                                <Badge className={getTypeBadgeColor(content.content_type)}>
                                  {content.content_type}
                                </Badge>
                              </TableCell>
                              <TableCell>{formatDate(content.post_date)}</TableCell>
                              {pd.platform === "YouTube" || pd.platform === "Youtube" ? (
                                <>
                                  <TableCell>{content.duration || "-"}</TableCell>
                                  <TableCell>{(content.likes || 0).toLocaleString()}</TableCell>
                                  <TableCell>{(content.comments || 0).toLocaleString()}</TableCell>
                                  <TableCell>{(content.shares || 0).toLocaleString()}</TableCell>
                                  <TableCell>{content.played_to_watch_percent ? `${content.played_to_watch_percent}%` : "-"}</TableCell>
                                  <TableCell>{(content.views || 0).toLocaleString()}</TableCell>
                                  <TableCell>{content.watch_time_hours ? `${content.watch_time_hours}%` : "-"}</TableCell>
                                  <TableCell>{(content.subscribers || 0).toLocaleString()}</TableCell>
                                  <TableCell>{(content.impressions || 0).toLocaleString()}</TableCell>
                                </>
                              ) : pd.platform === "X" ? (
                                <>
                                  <TableCell>{(content.impressions || 0).toLocaleString()}</TableCell>
                                  <TableCell>{(content.engagements || 0).toLocaleString()}</TableCell>
                                  <TableCell>{(content.profile_visits || 0).toLocaleString()}</TableCell>
                                  <TableCell>{(content.link_clicks || 0).toLocaleString()}</TableCell>
                                </>
                              ) : (
                                <>
                                  <TableCell>{(content.reach || 0).toLocaleString()}</TableCell>
                                  <TableCell>{(content.views || 0).toLocaleString()}</TableCell>
                                  <TableCell>{(content.likes || 0).toLocaleString()}</TableCell>
                                  <TableCell>{(content.comments || 0).toLocaleString()}</TableCell>
                                  <TableCell>{(content.shares || 0).toLocaleString()}</TableCell>
                                  <TableCell>{(content.interactions || 0).toLocaleString()}</TableCell>
                                </>
                              )}
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </TabsContent>
                ))}
              </Tabs>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
};

export default DynamicReport;
