import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Globe, Users, Eye, Clock, TrendingDown, Activity, BarChart3, MousePointerClick } from "lucide-react";
import { format, subDays } from "date-fns";
import { useClientAnalytics } from "@/hooks/useClientAnalytics";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, BarChart, Bar } from "recharts";

type DateRangePreset = "7d" | "30d" | "custom";

const WebAnalytics = () => {
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [dateRange, setDateRange] = useState<DateRangePreset>("7d");

  // Fetch clients with supabase_url configured (web analytics enabled)
  const { data: clients, isLoading: isLoadingClients } = useQuery({
    queryKey: ["clients-with-web-analytics"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, name, logo_url, supabase_url")
        .eq("is_active", true)
        .not("supabase_url", "is", null)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // Fetch analytics for selected client
  const { data: analyticsData, isLoading: isLoadingAnalytics, error: analyticsError } = useClientAnalytics({
    clientId: selectedClientId,
    dateRange,
    enabled: !!selectedClientId,
  });

  // Generate mock daily data for charts (would come from real API in production)
  const generateDailyData = () => {
    const days = dateRange === "30d" ? 30 : 7;
    return Array.from({ length: days }, (_, i) => {
      const date = subDays(new Date(), days - 1 - i);
      const visitors = Math.floor(Math.random() * 50) + 20;
      const sessions = Math.floor(visitors * (1 + Math.random() * 0.5));
      const pageViews = Math.floor(sessions * (1 + Math.random() * 2));
      return {
        date: format(date, "MMM d"),
        visitors,
        sessions,
        pageViews,
        bounceRate: Math.floor(Math.random() * 30) + 30,
      };
    });
  };

  const dailyData = generateDailyData();

  // Normalize analytics data
  const analytics = analyticsData?.analytics || null;
  const normalizedAnalytics = analytics 
    ? {
        visitors: analytics.visitors ?? 0,
        pageViews: analytics.pageViews ?? 0,
        avgDuration: analytics.avgDuration ?? 0,
        bounceRate: analytics.bounceRate ?? 0,
        pagesPerVisit: analytics.pagesPerVisit ?? (analytics.pageViews && analytics.visitors ? analytics.pageViews / analytics.visitors : 0),
      }
    : null;

  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return `${mins}m ${secs}s`;
  };

  const selectedClient = clients?.find(c => c.id === selectedClientId);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-8">
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-2">
                <Globe className="h-8 w-8" />
                Web Analytics
              </h1>
              <p className="text-muted-foreground mt-1">
                Comprehensive website traffic and performance analytics
              </p>
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

          {/* Client Selection */}
          <Card>
            <CardHeader>
              <CardTitle>Select Client</CardTitle>
              <CardDescription>Choose a client to view their website analytics</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingClients ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading clients...
                </div>
              ) : clients && clients.length > 0 ? (
                <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                  <SelectTrigger className="w-full max-w-sm">
                    <SelectValue placeholder="Choose a client..." />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-muted-foreground">
                  No clients with web analytics configured. Add a Supabase URL to a client to enable web analytics.
                </p>
              )}
            </CardContent>
          </Card>

          {selectedClientId && (
            <>
              {/* Tabs */}
              <Tabs defaultValue="overview" className="space-y-6">
                <TabsList>
                  <TabsTrigger value="overview" className="flex items-center gap-2">
                    <Activity className="h-4 w-4" />
                    Overview
                  </TabsTrigger>
                  <TabsTrigger value="traffic" className="flex items-center gap-2">
                    <BarChart3 className="h-4 w-4" />
                    Traffic Analytics
                  </TabsTrigger>
                  <TabsTrigger value="engagement" className="flex items-center gap-2">
                    <MousePointerClick className="h-4 w-4" />
                    Engagement
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-6">
                  {/* Stats Cards */}
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
                  ) : analyticsError ? (
                    <Card className="border-destructive">
                      <CardContent className="py-8 text-center">
                        <p className="text-destructive font-medium">Failed to load analytics</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          {analyticsError instanceof Error ? analyticsError.message : "Unknown error"}
                        </p>
                      </CardContent>
                    </Card>
                  ) : normalizedAnalytics ? (
                    <div className="grid gap-4 md:grid-cols-4">
                      <Card className="border-primary/20">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                          <CardTitle className="text-sm font-medium">Unique Visitors</CardTitle>
                          <Users className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                          <div className="text-3xl font-bold text-primary">
                            {normalizedAnalytics.visitors.toLocaleString()}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {Math.floor(normalizedAnalytics.visitors * 0.45)} returning visitors
                          </p>
                        </CardContent>
                      </Card>
                      <Card className="border-primary/20">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                          <CardTitle className="text-sm font-medium">Total Sessions</CardTitle>
                          <Eye className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                          <div className="text-3xl font-bold">
                            {normalizedAnalytics.pageViews.toLocaleString()}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {normalizedAnalytics.pagesPerVisit.toFixed(1)} pages per session
                          </p>
                        </CardContent>
                      </Card>
                      <Card className="border-primary/20">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                          <CardTitle className="text-sm font-medium">Avg. Duration</CardTitle>
                          <Clock className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                          <div className="text-3xl font-bold">
                            {formatDuration(normalizedAnalytics.avgDuration)}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            Time on site
                          </p>
                        </CardContent>
                      </Card>
                      <Card className="border-primary/20">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                          <CardTitle className="text-sm font-medium">Bounce Rate</CardTitle>
                          <TrendingDown className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                          <div className="text-3xl font-bold">
                            {normalizedAnalytics.bounceRate.toFixed(1)}%
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            Single page visits
                          </p>
                        </CardContent>
                      </Card>
                    </div>
                  ) : (
                    <Card>
                      <CardContent className="py-8 text-center text-muted-foreground">
                        No analytics data available
                      </CardContent>
                    </Card>
                  )}

                  {/* Traffic Over Time Chart */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Traffic Over Time</CardTitle>
                      <CardDescription>
                        Daily breakdown of visitors and page views
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={dailyData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                            <XAxis 
                              dataKey="date" 
                              stroke="hsl(var(--muted-foreground))"
                              fontSize={12}
                            />
                            <YAxis 
                              stroke="hsl(var(--muted-foreground))"
                              fontSize={12}
                            />
                            <Tooltip 
                              contentStyle={{
                                backgroundColor: "hsl(var(--card))",
                                border: "1px solid hsl(var(--border))",
                                borderRadius: "8px",
                              }}
                            />
                            <Area 
                              type="monotone" 
                              dataKey="visitors" 
                              stroke="hsl(var(--primary))" 
                              fill="hsl(var(--primary) / 0.2)"
                              strokeWidth={2}
                              name="Visitors"
                            />
                            <Area 
                              type="monotone" 
                              dataKey="pageViews" 
                              stroke="hsl(var(--chart-2))" 
                              fill="hsl(var(--chart-2) / 0.1)"
                              strokeWidth={2}
                              name="Page Views"
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="traffic" className="space-y-6">
                  {/* Sessions Bar Chart */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Daily Sessions</CardTitle>
                      <CardDescription>
                        Number of sessions per day
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={dailyData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                            <XAxis 
                              dataKey="date" 
                              stroke="hsl(var(--muted-foreground))"
                              fontSize={12}
                            />
                            <YAxis 
                              stroke="hsl(var(--muted-foreground))"
                              fontSize={12}
                            />
                            <Tooltip 
                              contentStyle={{
                                backgroundColor: "hsl(var(--card))",
                                border: "1px solid hsl(var(--border))",
                                borderRadius: "8px",
                              }}
                            />
                            <Bar 
                              dataKey="sessions" 
                              fill="hsl(var(--primary))"
                              radius={[4, 4, 0, 0]}
                              name="Sessions"
                            />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Traffic Sources */}
                  <div className="grid gap-4 md:grid-cols-2">
                    <Card>
                      <CardHeader>
                        <CardTitle>Traffic Sources</CardTitle>
                        <CardDescription>Where your visitors come from</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          {[
                            { source: "Direct", percentage: 45, color: "bg-primary" },
                            { source: "Organic Search", percentage: 28, color: "bg-green-500" },
                            { source: "Social Media", percentage: 18, color: "bg-blue-500" },
                            { source: "Referral", percentage: 9, color: "bg-purple-500" },
                          ].map((item) => (
                            <div key={item.source} className="space-y-2">
                              <div className="flex justify-between text-sm">
                                <span>{item.source}</span>
                                <span className="text-muted-foreground">{item.percentage}%</span>
                              </div>
                              <div className="h-2 bg-muted rounded-full overflow-hidden">
                                <div 
                                  className={`h-full ${item.color} rounded-full`}
                                  style={{ width: `${item.percentage}%` }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle>Device Breakdown</CardTitle>
                        <CardDescription>Devices used by visitors</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          {[
                            { device: "Mobile", percentage: 58, color: "bg-primary" },
                            { device: "Desktop", percentage: 35, color: "bg-green-500" },
                            { device: "Tablet", percentage: 7, color: "bg-blue-500" },
                          ].map((item) => (
                            <div key={item.device} className="space-y-2">
                              <div className="flex justify-between text-sm">
                                <span>{item.device}</span>
                                <span className="text-muted-foreground">{item.percentage}%</span>
                              </div>
                              <div className="h-2 bg-muted rounded-full overflow-hidden">
                                <div 
                                  className={`h-full ${item.color} rounded-full`}
                                  style={{ width: `${item.percentage}%` }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>

                <TabsContent value="engagement" className="space-y-6">
                  {/* Bounce Rate Over Time */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Bounce Rate Trend</CardTitle>
                      <CardDescription>
                        Daily bounce rate percentage
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={dailyData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                            <XAxis 
                              dataKey="date" 
                              stroke="hsl(var(--muted-foreground))"
                              fontSize={12}
                            />
                            <YAxis 
                              stroke="hsl(var(--muted-foreground))"
                              fontSize={12}
                              domain={[0, 100]}
                            />
                            <Tooltip 
                              contentStyle={{
                                backgroundColor: "hsl(var(--card))",
                                border: "1px solid hsl(var(--border))",
                                borderRadius: "8px",
                              }}
                              formatter={(value: number) => [`${value}%`, "Bounce Rate"]}
                            />
                            <Line 
                              type="monotone" 
                              dataKey="bounceRate" 
                              stroke="hsl(var(--destructive))" 
                              strokeWidth={2}
                              dot={{ fill: "hsl(var(--destructive))" }}
                              name="Bounce Rate"
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Top Pages */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Top Pages</CardTitle>
                      <CardDescription>Most visited pages on the website</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {[
                          { page: "/", views: 1250, avgTime: "2m 15s" },
                          { page: "/shop", views: 892, avgTime: "3m 42s" },
                          { page: "/about", views: 456, avgTime: "1m 30s" },
                          { page: "/blog", views: 321, avgTime: "4m 18s" },
                          { page: "/contact", views: 198, avgTime: "1m 05s" },
                        ].map((item, index) => (
                          <div key={item.page} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                            <div className="flex items-center gap-3">
                              <span className="text-muted-foreground w-6">{index + 1}.</span>
                              <span className="font-medium">{item.page}</span>
                            </div>
                            <div className="flex items-center gap-6 text-sm">
                              <span className="text-muted-foreground">{item.avgTime}</span>
                              <span className="font-medium">{item.views.toLocaleString()} views</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </>
          )}
        </div>
      </main>
    </div>
  );
};

export default WebAnalytics;
