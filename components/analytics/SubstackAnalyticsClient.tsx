"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Loader2, Users, Eye, Clock, TrendingDown, Activity, BarChart3, MousePointerClick, Info, ExternalLink, Layers } from "lucide-react";
import { TopCountriesWidget } from "@/components/TopCountriesWidget";
import { format, subDays } from "date-fns";
import { useSubstackAnalytics } from "@/hooks/useSubstackAnalytics";
import { DateRangePreset } from "@/hooks/useClientAnalytics";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, BarChart, Bar } from "recharts";
import { NextAnalyticsPageLayout as AnalyticsPageLayout } from "@/components/analytics/NextAnalyticsPageLayout";

const SubstackAnalyticsClient = ({ clientId }: { clientId: string }) => {
  const router = useRouter();
  const [dateRange, setDateRange] = useState<DateRangePreset>("7d");

  // Fetch client details
  const { data: client, isPending: isLoadingClient } = useQuery({
    queryKey: ["client", clientId],
    queryFn: async () => {
      if (!clientId) return null;
      const { data, error } = await supabase
        .from("clients")
        .select("id, name, logo_url")
        .eq("id", clientId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!clientId,
  });

  // Fetch substack config for external link
  const { data: substackConfig } = useQuery({
    queryKey: ["substack-config", clientId],
    queryFn: async () => {
      const { data } = await supabase
        .from("client_substack_config" as any)
        .select("substack_url, publication_name")
        .eq("client_id", clientId)
        .maybeSingle();
      return data as { substack_url: string; publication_name: string } | null;
    },
    enabled: !!clientId,
  });

  // Fetch analytics
  const { data: analyticsData, isLoading: isLoadingAnalytics, error: analyticsError } = useSubstackAnalytics({
    clientId: clientId || "",
    dateRange,
    enabled: !!clientId,
  });

  const errorType = analyticsData?.errorType;
  const analytics = analyticsData?.analytics || null;

  // Normalize data
  const normalizedAnalytics = analytics ? {
    visitors: analytics.visitors ?? analytics.uniqueVisitors ?? (analytics as any).summary?.uniqueVisitors ?? 0,
    pageViews: analytics.pageViews ?? analytics.totalPageViews ?? (analytics as any).summary?.totalPageViews ?? 0,
    totalSessions: analytics.totalSessions ?? (analytics as any).summary?.totalSessions ?? 0,
    avgDuration: (analytics as any).avgDuration ?? (analytics as any).avgSessionDuration ?? (analytics as any).summary?.avgSessionDuration ?? 0,
    bounceRate: analytics.bounceRate ?? (analytics as any).summary?.bounceRate ?? 0,
    pagesPerVisit: (analytics as any).pagesPerVisit ?? (analytics as any).summary?.avgPagesPerSession ?? 0,
    trafficSources: analytics.trafficSources,
    deviceBreakdown: analytics.deviceBreakdown,
    dailyBreakdown: analytics.dailyBreakdown,
    topPages: analytics.topPages,
    countries: (analytics as any).countries,
  } : null;

  const hasRealTrafficSources = normalizedAnalytics?.trafficSources && normalizedAnalytics.trafficSources.length > 0;
  const hasRealDeviceBreakdown = normalizedAnalytics?.deviceBreakdown && normalizedAnalytics.deviceBreakdown.length > 0;
  const hasRealDailyBreakdown = normalizedAnalytics?.dailyBreakdown && normalizedAnalytics.dailyBreakdown.length > 0;

  const dailyData = useMemo(() => {
    if (hasRealDailyBreakdown && normalizedAnalytics?.dailyBreakdown) {
      return normalizedAnalytics.dailyBreakdown.map((day: any) => ({
        date: format(new Date(day.date), "MMM d"),
        visitors: day.visitors ?? day.sessions ?? 0,
        sessions: day.sessions ?? day.visitors ?? 0,
        pageViews: day.pageViews,
      }));
    }
    return [];
  }, [normalizedAnalytics, hasRealDailyBreakdown]);

  const trafficSources = useMemo(() => {
    if (hasRealTrafficSources && normalizedAnalytics?.trafficSources) {
      const colors = ["bg-primary", "bg-green-500", "bg-blue-500", "bg-purple-500", "bg-orange-500", "bg-pink-500"];
      return normalizedAnalytics.trafficSources.map((ts: any, index: number) => ({
        source: ts.source,
        percentage: ts.percentage,
        visitors: ts.visitors ?? ts.sessions ?? 0,
        color: colors[index % colors.length],
      }));
    }
    return [];
  }, [normalizedAnalytics, hasRealTrafficSources]);

  const deviceBreakdown = useMemo(() => {
    if (hasRealDeviceBreakdown && normalizedAnalytics?.deviceBreakdown) {
      const colors = ["bg-primary", "bg-green-500", "bg-blue-500"];
      return normalizedAnalytics.deviceBreakdown.map((db: any, index: number) => ({
        device: db.device,
        percentage: db.percentage,
        visitors: db.visitors ?? db.sessions ?? 0,
        color: colors[index % colors.length],
      }));
    }
    return [];
  }, [normalizedAnalytics, hasRealDeviceBreakdown]);

  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return `${mins}m ${secs}s`;
  };

  return (
    <AnalyticsPageLayout
      clientId={clientId}
      clientName={client?.name}
      clientLogo={client?.logo_url}
      pageName="Substack Analytics"
      pageDescription="Newsletter traffic and readership analytics via Google Analytics"
      isLoading={isLoadingClient}
    >
      <div className="space-y-6">
        {/* Header row with Substack badge + date picker */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="bg-orange-500/10 text-orange-600 border-orange-200 dark:border-orange-800">
              <svg className="h-3.5 w-3.5 mr-1.5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M22.539 8.242H1.46V5.406h21.08v2.836zM1.46 10.812V24l9.56-5.39L21.08 24V10.812H1.46zM22.54 0H1.46v2.836h21.08V0z" />
              </svg>
              Substack · {substackConfig?.publication_name || "Newsletter"}
            </Badge>
            {substackConfig?.substack_url && (
              <a
                href={substackConfig.substack_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
              >
                <ExternalLink className="h-3 w-3" />
                Visit
              </a>
            )}
          </div>
          <Select value={dateRange} onValueChange={(v) => setDateRange(v as DateRangePreset)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
              <SelectItem value="365d">Last 365 days</SelectItem>
              <SelectItem value="all">All Time</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Powered by GA4 footnote */}
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <Activity className="h-3 w-3" />
          Powered by Google Analytics 4
        </p>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList>
            <TabsTrigger value="overview" className="flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="traffic" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Traffic
            </TabsTrigger>
            <TabsTrigger value="engagement" className="flex items-center gap-2">
              <MousePointerClick className="h-4 w-4" />
              Engagement
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {isLoadingAnalytics ? (
              <div className="grid gap-4 md:grid-cols-4">
                {[...Array(4)].map((_, i) => (
                  <Card key={i}>
                    <CardContent className="p-6">
                      <div className="animate-pulse space-y-2">
                        <div className="h-4 bg-muted rounded w-24" />
                        <div className="h-8 bg-muted rounded w-16" />
                        <div className="h-3 bg-muted rounded w-20" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : analyticsError || errorType ? (
              <Card className="border-border">
                <CardContent className="py-12 text-center">
                  <div className="flex flex-col items-center gap-4">
                    <div className="p-4 rounded-full bg-muted flex items-center justify-center">
                      <Info className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-muted-foreground">
                        {errorType === 'not_configured' ? 'Substack GA4 Not Configured' : analyticsError ? 'Error Fetching Information' : 'No Data Available'}
                      </h3>
                      <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
                        {errorType === 'not_configured'
                          ? 'Add a GA4 Measurement ID to your Substack Settings → Analytics to start tracking.'
                          : analyticsError 
                            ? 'Ensure that the GCP Service Account credentials are correct and the service account has Viewer access to this property.'
                            : 'No data available for this date range. GA4 data may take 24-48 hours to appear after initial setup.'}
                      </p>
                      {analyticsError && (
                        <p className="text-xs text-red-500/80 mt-4 rounded bg-red-500/10 p-2 inline-block max-w-lg text-left overflow-hidden text-ellipsis whitespace-nowrap">
                          {analyticsError instanceof Error ? analyticsError.message : String(analyticsError)}
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : normalizedAnalytics ? (
              <>
                {/* KPI Cards */}
                <div className="grid gap-4 md:grid-cols-4">
                  <Card className="border-orange-500/20">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Unique Readers</CardTitle>
                      <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold text-orange-600 dark:text-orange-400">
                        {normalizedAnalytics.visitors.toLocaleString()}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">Active users this period</p>
                    </CardContent>
                  </Card>
                  <Card className="border-orange-500/20">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Total Sessions</CardTitle>
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold">
                        {normalizedAnalytics.totalSessions.toLocaleString()}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {normalizedAnalytics.pagesPerVisit.toFixed(1)} pages per session
                      </p>
                    </CardContent>
                  </Card>
                  <Card className="border-orange-500/20">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Avg. Read Time</CardTitle>
                      <Clock className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold">
                        {formatDuration(normalizedAnalytics.avgDuration)}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">Time on newsletter</p>
                    </CardContent>
                  </Card>
                  <Card className="border-orange-500/20">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Bounce Rate</CardTitle>
                      <TrendingDown className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold">
                        {normalizedAnalytics.bounceRate.toFixed(1)}%
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">Single page visits</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Pages per visit */}
                <div className="grid gap-4 md:grid-cols-2">
                  <Card className="border-orange-500/20">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Pages Per Visit</CardTitle>
                      <Layers className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold">
                        {normalizedAnalytics.pagesPerVisit.toFixed(1)}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">Avg articles read per session</p>
                    </CardContent>
                  </Card>
                  <Card className="border-orange-500/20">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Page Views</CardTitle>
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold">
                        {normalizedAnalytics.pageViews.toLocaleString()}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">Total page views</p>
                    </CardContent>
                  </Card>
                </div>
              </>
            ) : null}

            {/* Traffic Over Time */}
            {dailyData.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Readership Over Time</CardTitle>
                  <CardDescription>Daily readers and page views</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={dailyData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                        <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "hsl(var(--card))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "8px",
                          }}
                        />
                        <Area type="monotone" dataKey="visitors" stroke="#f97316" fill="rgba(249, 115, 22, 0.2)" strokeWidth={2} name="Readers" />
                        <Area type="monotone" dataKey="pageViews" stroke="hsl(var(--chart-2))" fill="hsl(var(--chart-2) / 0.1)" strokeWidth={2} name="Page Views" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="traffic" className="space-y-6">
            {isLoadingAnalytics ? (
              <Card>
                <CardContent className="p-6 flex items-center justify-center h-[300px]">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </CardContent>
              </Card>
            ) : !normalizedAnalytics ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Info className="h-8 w-8 mx-auto text-muted-foreground mb-4" />
                  <h3 className="font-semibold text-muted-foreground">No Traffic Data Available</h3>
                </CardContent>
              </Card>
            ) : (
              <>
                {/* Sessions chart */}
                {dailyData.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Daily Sessions</CardTitle>
                      <CardDescription>Number of newsletter sessions per day</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={dailyData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                            <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                            <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                            <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }} />
                            <Bar dataKey="sessions" fill="#f97316" radius={[4, 4, 0, 0]} name="Sessions" />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Traffic Sources + Devices */}
                <div className="grid gap-4 md:grid-cols-2">
                  <Card>
                    <CardHeader>
                      <CardTitle>Traffic Sources</CardTitle>
                      <CardDescription>Where your readers come from</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {trafficSources.length > 0 ? (
                        <div className="space-y-4">
                          {trafficSources.map((item: any) => (
                            <div key={item.source} className="space-y-2">
                              <div className="flex justify-between text-sm">
                                <span>{item.source}</span>
                                <span className="text-muted-foreground">
                                  {item.visitors.toLocaleString()} ({item.percentage}%)
                                </span>
                              </div>
                              <div className="h-2 bg-muted rounded-full overflow-hidden">
                                <div className={`h-full ${item.color} rounded-full transition-all`} style={{ width: `${item.percentage}%` }} />
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground text-center py-4">No traffic source data available</p>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Device Breakdown</CardTitle>
                      <CardDescription>How readers access your newsletter</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {deviceBreakdown.length > 0 ? (
                        <div className="space-y-4">
                          {deviceBreakdown.map((item: any) => (
                            <div key={item.device} className="space-y-2">
                              <div className="flex justify-between text-sm">
                                <span>{item.device}</span>
                                <span className="text-muted-foreground">
                                  {item.visitors.toLocaleString()} ({item.percentage}%)
                                </span>
                              </div>
                              <div className="h-2 bg-muted rounded-full overflow-hidden">
                                <div className={`h-full ${item.color} rounded-full transition-all`} style={{ width: `${item.percentage}%` }} />
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground text-center py-4">No device data available</p>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Countries */}
                {normalizedAnalytics.countries && normalizedAnalytics.countries.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Top Countries</CardTitle>
                      <CardDescription>Geographic breakdown of readers</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {normalizedAnalytics.countries.map((item: any, index: number) => {
                          const total = normalizedAnalytics.countries.reduce((sum: number, c: any) => sum + c.count, 0);
                          const pct = total > 0 ? Math.round((item.count / total) * 1000) / 10 : 0;
                          const colors = [
                            "bg-primary", "bg-chart-2", "bg-chart-3", "bg-chart-4", "bg-chart-5",
                            "bg-accent", "bg-muted-foreground", "bg-primary/70", "bg-chart-2/70", "bg-chart-3/70",
                          ];
                          
                          // Convert country 2-letter code to flag emoji
                          let flag = "🌐";
                          if (item.country && item.country.length === 2 && item.country !== "XX") {
                            try {
                              flag = String.fromCodePoint(...item.country.split("").map((c: string) => 0x1f1e6 + c.charCodeAt(0) - 65));
                            } catch (e) {}
                          }

                          return (
                            <div key={item.country} className="space-y-1.5">
                              <div className="flex justify-between text-sm">
                                <span className="flex items-center gap-2">
                                  <span>{flag}</span>
                                  <span>{item.country}</span>
                                </span>
                                <span className="text-muted-foreground">
                                  {item.count.toLocaleString()} ({pct}%)
                                </span>
                              </div>
                              <div className="h-2 bg-muted rounded-full overflow-hidden">
                                <div
                                  className={`h-full ${colors[index % colors.length]} rounded-full transition-all`}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </TabsContent>

          <TabsContent value="engagement" className="space-y-6">
            {isLoadingAnalytics ? (
              <Card>
                <CardContent className="p-6 flex items-center justify-center h-[300px]">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </CardContent>
              </Card>
            ) : !normalizedAnalytics?.topPages?.length ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Info className="h-8 w-8 mx-auto text-muted-foreground mb-4" />
                  <h3 className="font-semibold text-muted-foreground">No Engagement Data Available</h3>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>Top Articles</CardTitle>
                  <CardDescription>Most-read articles by page views</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {normalizedAnalytics.topPages.map((page: any, index: number) => (
                      <div key={page.url} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted/50 transition-colors">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <span className="text-sm font-mono text-muted-foreground w-6 text-right shrink-0">
                            {index + 1}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium truncate">
                              {page.title || page.url}
                            </p>
                            {page.title && (
                              <p className="text-xs text-muted-foreground truncate">{page.url}</p>
                            )}
                          </div>
                        </div>
                        <Badge variant="secondary" className="shrink-0 ml-2">
                          {page.views.toLocaleString()} views
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AnalyticsPageLayout>
  );
};

export default SubstackAnalyticsClient;
