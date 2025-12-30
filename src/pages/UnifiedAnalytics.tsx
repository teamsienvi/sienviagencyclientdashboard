import { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Loader2, Globe, Users, Eye, Clock, TrendingDown, Activity, 
  BarChart3, Youtube, Twitter, Music2, Linkedin, Instagram, 
  Facebook, ArrowLeft, ExternalLink, TrendingUp
} from "lucide-react";
import { format, subDays } from "date-fns";
import { useClientAnalytics } from "@/hooks/useClientAnalytics";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell } from "recharts";

type DateRangePreset = "7d" | "30d";

const COLORS = ['hsl(var(--primary))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

const UnifiedAnalytics = () => {
  const { clientId } = useParams<{ clientId: string }>();
  const navigate = useNavigate();
  const [dateRange, setDateRange] = useState<DateRangePreset>("7d");

  // Fetch client details
  const { data: client, isLoading: isLoadingClient } = useQuery({
    queryKey: ["client", clientId],
    queryFn: async () => {
      if (!clientId) return null;
      const { data, error } = await supabase
        .from("clients")
        .select("id, name, logo_url, supabase_url")
        .eq("id", clientId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!clientId,
  });

  // Check connected accounts
  const { data: connectedAccounts } = useQuery({
    queryKey: ["connected-accounts", clientId],
    queryFn: async () => {
      if (!clientId) return { x: false, meta: [], youtube: false, tiktok: false, linkedin: false };
      
      // Check X account
      const { data: xData } = await supabase
        .from("social_accounts")
        .select("id")
        .eq("client_id", clientId)
        .eq("platform", "x")
        .eq("is_active", true)
        .limit(1);

      // Check Meta OAuth accounts
      const { data: metaData } = await supabase
        .from("social_oauth_accounts")
        .select("platform")
        .eq("client_id", clientId)
        .eq("is_active", true);

      return {
        x: xData && xData.length > 0,
        meta: metaData || [],
        youtube: true, // YouTube doesn't require OAuth connection
        tiktok: true,
        linkedin: true,
      };
    },
    enabled: !!clientId,
  });

  // Fetch web analytics
  const { data: webAnalytics, isLoading: isLoadingWeb } = useClientAnalytics({
    clientId: clientId || "",
    dateRange,
    enabled: !!clientId && !!client?.supabase_url,
  });

  // Fetch social account metrics
  const { data: socialMetrics, isLoading: isLoadingSocial } = useQuery({
    queryKey: ["social-metrics", clientId, dateRange],
    queryFn: async () => {
      if (!clientId) return [];
      const days = dateRange === "30d" ? 30 : 7;
      const startDate = format(subDays(new Date(), days), "yyyy-MM-dd");
      const endDate = format(new Date(), "yyyy-MM-dd");
      
      const { data, error } = await supabase
        .from("social_account_metrics")
        .select("*")
        .eq("client_id", clientId)
        .gte("period_start", startDate)
        .lte("period_end", endDate)
        .order("collected_at", { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!clientId,
  });

  // Get latest metrics per platform
  const platformMetrics = useMemo(() => {
    if (!socialMetrics) return {};
    const latestByPlatform: Record<string, typeof socialMetrics[0]> = {};
    for (const metric of socialMetrics) {
      if (!latestByPlatform[metric.platform]) {
        latestByPlatform[metric.platform] = metric;
      }
    }
    return latestByPlatform;
  }, [socialMetrics]);

  // Prepare chart data
  const chartData = useMemo(() => {
    const platforms = Object.keys(platformMetrics);
    return platforms.map(platform => ({
      platform: platform.charAt(0).toUpperCase() + platform.slice(1),
      followers: platformMetrics[platform]?.followers || 0,
      engagement: (platformMetrics[platform]?.engagement_rate || 0) * 100,
    }));
  }, [platformMetrics]);

  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return `${mins}m ${secs}s`;
  };

  const normalizedWebAnalytics = webAnalytics?.analytics 
    ? {
        visitors: webAnalytics.analytics.visitors ?? 0,
        pageViews: webAnalytics.analytics.pageViews ?? 0,
        avgDuration: webAnalytics.analytics.avgDuration ?? 0,
        bounceRate: webAnalytics.analytics.bounceRate ?? 0,
      }
    : null;

  const totalFollowers = Object.values(platformMetrics).reduce((sum, m) => sum + (m?.followers || 0), 0);
  const avgEngagement = Object.values(platformMetrics).length > 0
    ? Object.values(platformMetrics).reduce((sum, m) => sum + ((m?.engagement_rate || 0) * 100), 0) / Object.values(platformMetrics).length
    : 0;

  if (!clientId) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              No client specified
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-8">
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-3xl font-bold flex items-center gap-2">
                  <BarChart3 className="h-8 w-8" />
                  {isLoadingClient ? "Loading..." : client?.name || "Client Analytics"}
                </h1>
                <p className="text-muted-foreground mt-1">
                  Unified analytics across all platforms
                </p>
              </div>
            </div>
            <Select value={dateRange} onValueChange={(v) => setDateRange(v as DateRangePreset)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">Last 7 days</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Overview Stats */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card className="border-primary/20">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Followers</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-primary">
                  {isLoadingSocial ? <Loader2 className="h-6 w-6 animate-spin" /> : totalFollowers.toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Across {Object.keys(platformMetrics).length} platforms
                </p>
              </CardContent>
            </Card>

            <Card className="border-primary/20">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Avg. Engagement</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {isLoadingSocial ? <Loader2 className="h-6 w-6 animate-spin" /> : `${avgEngagement.toFixed(2)}%`}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Average across platforms
                </p>
              </CardContent>
            </Card>

            <Card className="border-primary/20">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Website Visitors</CardTitle>
                <Globe className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {isLoadingWeb ? <Loader2 className="h-6 w-6 animate-spin" /> : 
                   normalizedWebAnalytics ? normalizedWebAnalytics.visitors.toLocaleString() : "N/A"}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {client?.supabase_url ? "Unique visitors" : "Not configured"}
                </p>
              </CardContent>
            </Card>

            <Card className="border-primary/20">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Page Views</CardTitle>
                <Eye className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {isLoadingWeb ? <Loader2 className="h-6 w-6 animate-spin" /> : 
                   normalizedWebAnalytics ? normalizedWebAnalytics.pageViews.toLocaleString() : "N/A"}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {normalizedWebAnalytics ? `${normalizedWebAnalytics.bounceRate.toFixed(1)}% bounce rate` : "Not configured"}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Tabs for Different Views */}
          <Tabs defaultValue="overview" className="space-y-6">
            <TabsList>
              <TabsTrigger value="overview" className="flex items-center gap-2">
                <Activity className="h-4 w-4" />
                Overview
              </TabsTrigger>
              <TabsTrigger value="social" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Social Media
              </TabsTrigger>
              <TabsTrigger value="web" className="flex items-center gap-2">
                <Globe className="h-4 w-4" />
                Website
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              {/* Platform Cards */}
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {/* Web Analytics Card - Only for Snarky Humans */}
                {client?.supabase_url && client?.name === "Snarky Humans" && (
                  <Card className="hover:border-primary/30 transition-colors cursor-pointer" onClick={() => navigate(`/web-analytics/${clientId}`)}>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-blue-500/10">
                          <Globe className="h-5 w-5 text-blue-500" />
                        </div>
                        <div>
                          <CardTitle className="text-base">Website</CardTitle>
                          <CardDescription>Web Analytics</CardDescription>
                        </div>
                      </div>
                      <ExternalLink className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="flex justify-between">
                        <div>
                          <p className="text-2xl font-bold">{normalizedWebAnalytics?.visitors.toLocaleString() || "—"}</p>
                          <p className="text-xs text-muted-foreground">Visitors</p>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold">{normalizedWebAnalytics ? formatDuration(normalizedWebAnalytics.avgDuration) : "—"}</p>
                          <p className="text-xs text-muted-foreground">Avg. Duration</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Instagram Card */}
                {connectedAccounts?.meta.some(m => m.platform === "instagram") && (
                  <Card className="hover:border-primary/30 transition-colors cursor-pointer" onClick={() => navigate(`/meta-analytics/${clientId}`)}>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-pink-500/10">
                          <Instagram className="h-5 w-5 text-pink-500" />
                        </div>
                        <div>
                          <CardTitle className="text-base">Instagram</CardTitle>
                          <CardDescription>Meta Analytics</CardDescription>
                        </div>
                      </div>
                      <Badge variant="secondary">Connected</Badge>
                    </CardHeader>
                    <CardContent>
                      <div className="flex justify-between">
                        <div>
                          <p className="text-2xl font-bold">{platformMetrics.instagram?.followers?.toLocaleString() || "—"}</p>
                          <p className="text-xs text-muted-foreground">Followers</p>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold">{platformMetrics.instagram?.engagement_rate ? `${(platformMetrics.instagram.engagement_rate * 100).toFixed(2)}%` : "—"}</p>
                          <p className="text-xs text-muted-foreground">Engagement</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Facebook Card */}
                {connectedAccounts?.meta.some(m => m.platform === "facebook") && (
                  <Card className="hover:border-primary/30 transition-colors cursor-pointer" onClick={() => navigate(`/meta-analytics/${clientId}`)}>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-blue-600/10">
                          <Facebook className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                          <CardTitle className="text-base">Facebook</CardTitle>
                          <CardDescription>Meta Analytics</CardDescription>
                        </div>
                      </div>
                      <Badge variant="secondary">Connected</Badge>
                    </CardHeader>
                    <CardContent>
                      <div className="flex justify-between">
                        <div>
                          <p className="text-2xl font-bold">{platformMetrics.facebook?.followers?.toLocaleString() || "—"}</p>
                          <p className="text-xs text-muted-foreground">Followers</p>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold">{platformMetrics.facebook?.engagement_rate ? `${(platformMetrics.facebook.engagement_rate * 100).toFixed(2)}%` : "—"}</p>
                          <p className="text-xs text-muted-foreground">Engagement</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* X Card */}
                {connectedAccounts?.x && (
                  <Card className="hover:border-primary/30 transition-colors cursor-pointer" onClick={() => navigate(`/x-analytics/${clientId}`)}>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-foreground/10">
                          <Twitter className="h-5 w-5" />
                        </div>
                        <div>
                          <CardTitle className="text-base">X (Twitter)</CardTitle>
                          <CardDescription>Social Analytics</CardDescription>
                        </div>
                      </div>
                      <Badge variant="secondary">Connected</Badge>
                    </CardHeader>
                    <CardContent>
                      <div className="flex justify-between">
                        <div>
                          <p className="text-2xl font-bold">{platformMetrics.x?.followers?.toLocaleString() || "—"}</p>
                          <p className="text-xs text-muted-foreground">Followers</p>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold">{platformMetrics.x?.engagement_rate ? `${(platformMetrics.x.engagement_rate * 100).toFixed(2)}%` : "—"}</p>
                          <p className="text-xs text-muted-foreground">Engagement</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* YouTube Card */}
                <Card className="hover:border-primary/30 transition-colors cursor-pointer" onClick={() => navigate(`/youtube-analytics/${clientId}`)}>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-red-500/10">
                        <Youtube className="h-5 w-5 text-red-500" />
                      </div>
                      <div>
                        <CardTitle className="text-base">YouTube</CardTitle>
                        <CardDescription>Video Analytics</CardDescription>
                      </div>
                    </div>
                    <ExternalLink className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="flex justify-between">
                      <div>
                        <p className="text-2xl font-bold">{platformMetrics.youtube?.followers?.toLocaleString() || "—"}</p>
                        <p className="text-xs text-muted-foreground">Subscribers</p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold">{platformMetrics.youtube?.total_content || "—"}</p>
                        <p className="text-xs text-muted-foreground">Videos</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* TikTok Card */}
                <Card className="hover:border-primary/30 transition-colors cursor-pointer" onClick={() => navigate(`/tiktok-analytics/${clientId}`)}>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-foreground/10">
                        <Music2 className="h-5 w-5" />
                      </div>
                      <div>
                        <CardTitle className="text-base">TikTok</CardTitle>
                        <CardDescription>Short-form Video</CardDescription>
                      </div>
                    </div>
                    <ExternalLink className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="flex justify-between">
                      <div>
                        <p className="text-2xl font-bold">{platformMetrics.tiktok?.followers?.toLocaleString() || "—"}</p>
                        <p className="text-xs text-muted-foreground">Followers</p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold">{platformMetrics.tiktok?.engagement_rate ? `${(platformMetrics.tiktok.engagement_rate * 100).toFixed(2)}%` : "—"}</p>
                        <p className="text-xs text-muted-foreground">Engagement</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* LinkedIn Card */}
                <Card className="hover:border-primary/30 transition-colors cursor-pointer" onClick={() => navigate(`/linkedin-analytics/${clientId}`)}>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-[#0A66C2]/10">
                        <Linkedin className="h-5 w-5 text-[#0A66C2]" />
                      </div>
                      <div>
                        <CardTitle className="text-base">LinkedIn</CardTitle>
                        <CardDescription>Professional Network</CardDescription>
                      </div>
                    </div>
                    <ExternalLink className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="flex justify-between">
                      <div>
                        <p className="text-2xl font-bold">{platformMetrics.linkedin?.followers?.toLocaleString() || "—"}</p>
                        <p className="text-xs text-muted-foreground">Followers</p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold">{platformMetrics.linkedin?.engagement_rate ? `${(platformMetrics.linkedin.engagement_rate * 100).toFixed(2)}%` : "—"}</p>
                        <p className="text-xs text-muted-foreground">Engagement</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Followers by Platform Chart */}
              {chartData.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Followers by Platform</CardTitle>
                    <CardDescription>Comparison of follower counts across platforms</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis dataKey="platform" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                          <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                          <Tooltip 
                            contentStyle={{
                              backgroundColor: "hsl(var(--card))",
                              border: "1px solid hsl(var(--border))",
                              borderRadius: "8px",
                            }}
                          />
                          <Bar dataKey="followers" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Followers" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="social" className="space-y-6">
              {/* Social Media Metrics Table */}
              <Card>
                <CardHeader>
                  <CardTitle>Platform Metrics</CardTitle>
                  <CardDescription>Detailed metrics for each connected platform</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {Object.entries(platformMetrics).map(([platform, metrics]) => (
                      <div key={platform} className="flex items-center justify-between p-4 rounded-lg bg-accent/50 hover:bg-accent transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-background">
                            {platform === "instagram" && <Instagram className="h-5 w-5 text-pink-500" />}
                            {platform === "facebook" && <Facebook className="h-5 w-5 text-blue-600" />}
                            {platform === "x" && <Twitter className="h-5 w-5" />}
                            {platform === "youtube" && <Youtube className="h-5 w-5 text-red-500" />}
                            {platform === "tiktok" && <Music2 className="h-5 w-5" />}
                            {platform === "linkedin" && <Linkedin className="h-5 w-5 text-[#0A66C2]" />}
                          </div>
                          <div>
                            <p className="font-medium capitalize">{platform}</p>
                            <p className="text-sm text-muted-foreground">{metrics?.total_content || 0} posts</p>
                          </div>
                        </div>
                        <div className="flex gap-8">
                          <div className="text-center">
                            <p className="text-xl font-bold">{metrics?.followers?.toLocaleString() || 0}</p>
                            <p className="text-xs text-muted-foreground">Followers</p>
                          </div>
                          <div className="text-center">
                            <p className="text-xl font-bold text-green-500">+{metrics?.new_followers || 0}</p>
                            <p className="text-xs text-muted-foreground">New</p>
                          </div>
                          <div className="text-center">
                            <p className="text-xl font-bold">{metrics?.engagement_rate ? `${(metrics.engagement_rate * 100).toFixed(2)}%` : "0%"}</p>
                            <p className="text-xs text-muted-foreground">Engagement</p>
                          </div>
                        </div>
                      </div>
                    ))}
                    {Object.keys(platformMetrics).length === 0 && (
                      <p className="text-center text-muted-foreground py-8">No social platform data available yet</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="web" className="space-y-6">
              {client?.supabase_url ? (
                <>
                  {/* Web Stats */}
                  <div className="grid gap-4 md:grid-cols-4">
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Visitors</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-2xl font-bold">{normalizedWebAnalytics?.visitors.toLocaleString() || "—"}</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Page Views</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-2xl font-bold">{normalizedWebAnalytics?.pageViews.toLocaleString() || "—"}</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Avg. Duration</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-2xl font-bold">{normalizedWebAnalytics ? formatDuration(normalizedWebAnalytics.avgDuration) : "—"}</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Bounce Rate</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-2xl font-bold">{normalizedWebAnalytics ? `${normalizedWebAnalytics.bounceRate.toFixed(1)}%` : "—"}</p>
                      </CardContent>
                    </Card>
                  </div>
                  <Button onClick={() => navigate(`/web-analytics/${clientId}`)} className="gap-2">
                    <ExternalLink className="h-4 w-4" />
                    View Detailed Web Analytics
                  </Button>
                </>
              ) : (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground">
                    Web analytics not configured for this client. Add a Supabase URL in client settings to enable.
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
};

export default UnifiedAnalytics;
