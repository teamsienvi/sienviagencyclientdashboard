import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState, useMemo } from "react";
import { format, subDays } from "date-fns";
import { 
  ArrowLeft, Calendar, TrendingUp, Users, Eye, 
  Youtube, Music2, Linkedin, FileText, ExternalLink,
  BarChart3, Loader2, ChevronRight, Upload, Twitter
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { clientsData } from "@/data/clients";
import { CSVUploadDialog } from "@/components/CSVUploadDialog";
import { TopPerformingPosts } from "@/components/TopPerformingPosts";
import { XCSVUploadDialog } from "@/components/XCSVUploadDialog";

// Helper to extract month from date range
const getMonthFromDateRange = (dateRange: string): string => {
  const monthMap: Record<string, string> = {
    'Jan': 'January', 'Feb': 'February', 'Mar': 'March', 'Apr': 'April',
    'May': 'May', 'Jun': 'June', 'Jul': 'July', 'Aug': 'August',
    'Sep': 'September', 'Oct': 'October', 'Nov': 'November', 'Dec': 'December'
  };
  const match = dateRange.match(/^([A-Za-z]+)/);
  return match ? (monthMap[match[1]] || match[1]) : dateRange;
};

const ClientDashboard = () => {
  const { clientId } = useParams<{ clientId: string }>();
  const navigate = useNavigate();
  const [selectedMonth, setSelectedMonth] = useState<string>("");

  // Fetch client details from database
  const { data: client, isLoading: isLoadingClient } = useQuery({
    queryKey: ["client-dashboard", clientId],
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

  // Fetch Metricool platforms for this client
  const { data: metricoolPlatforms } = useQuery({
    queryKey: ["client-metricool-platforms", clientId],
    queryFn: async () => {
      if (!clientId) return [];
      const { data, error } = await supabase
        .from("client_metricool_config")
        .select("platform")
        .eq("client_id", clientId)
        .eq("is_active", true);
      if (error) throw error;
      return data?.map(c => c.platform) || [];
    },
    enabled: !!clientId,
  });

  // Fetch connected accounts
  const { data: connectedAccounts } = useQuery({
    queryKey: ["client-connected-accounts", clientId],
    queryFn: async () => {
      if (!clientId) return { x: false, meta: false, youtube: false };
      
      const { data: xData } = await supabase
        .from("social_accounts")
        .select("id")
        .eq("client_id", clientId)
        .eq("platform", "x")
        .eq("is_active", true)
        .limit(1);

      const { data: metaData } = await supabase
        .from("social_oauth_accounts")
        .select("id")
        .eq("client_id", clientId)
        .eq("is_active", true)
        .limit(1);

      const { data: youtubeData } = await supabase
        .from("client_youtube_map")
        .select("id")
        .eq("client_id", clientId)
        .eq("active", true)
        .limit(1);

      return {
        x: xData && xData.length > 0,
        meta: metaData && metaData.length > 0,
        youtube: youtubeData && youtubeData.length > 0,
      };
    },
    enabled: !!clientId,
  });

  // Fetch latest social metrics
  const { data: socialMetrics, isLoading: isLoadingMetrics } = useQuery({
    queryKey: ["client-social-metrics", clientId],
    queryFn: async () => {
      if (!clientId) return null;
      const startDate = format(subDays(new Date(), 30), "yyyy-MM-dd");
      
      const { data, error } = await supabase
        .from("social_account_metrics")
        .select("*")
        .eq("client_id", clientId)
        .gte("period_start", startDate)
        .order("collected_at", { ascending: false });
      
      if (error) throw error;
      
      // Get latest per platform
      const latestByPlatform: Record<string, typeof data[0]> = {};
      for (const metric of data || []) {
        if (!latestByPlatform[metric.platform]) {
          latestByPlatform[metric.platform] = metric;
        }
      }
      return latestByPlatform;
    },
    enabled: !!clientId,
  });

  // Match client name with clientsData for reports
  const clientReports = useMemo(() => {
    if (!client?.name) return null;
    return clientsData.find(c => c.name === client.name);
  }, [client?.name]);

  // Group reports by month
  const reportsByMonth = useMemo(() => {
    if (!clientReports?.reports) return {};
    const grouped: Record<string, { index: number; report: typeof clientReports.reports[0] }[]> = {};
    clientReports.reports.forEach((report, index) => {
      const month = getMonthFromDateRange(report.dateRange);
      if (!grouped[month]) grouped[month] = [];
      grouped[month].push({ index, report });
    });
    return grouped;
  }, [clientReports?.reports]);

  const months = useMemo(() => Object.keys(reportsByMonth).reverse(), [reportsByMonth]);
  const weeksInSelectedMonth = useMemo(() => {
    if (!selectedMonth) return [];
    return reportsByMonth[selectedMonth] || [];
  }, [selectedMonth, reportsByMonth]);

  const handleWeekSelect = (value: string) => {
    if (!clientReports) return;
    const reportIndex = parseInt(value);
    const report = clientReports.reports[reportIndex];
    if (report.isInternal) {
      navigate(report.link);
    } else {
      window.open(report.link, '_blank');
    }
  };

  const totalFollowers = useMemo(() => {
    if (!socialMetrics) return 0;
    return Object.values(socialMetrics).reduce((sum, m) => sum + (m?.followers || 0), 0);
  }, [socialMetrics]);

  const latestReport = clientReports?.reports[clientReports.reports.length - 1];

  if (isLoadingClient) {
    return (
      <div className="min-h-screen bg-background">
        <ClientHeader />
        <main className="container mx-auto px-4 py-8">
          <Skeleton className="h-12 w-64 mb-4" />
          <Skeleton className="h-6 w-48 mb-8" />
          <div className="grid gap-6 md:grid-cols-3">
            <Skeleton className="h-40" />
            <Skeleton className="h-40" />
            <Skeleton className="h-40" />
          </div>
        </main>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="min-h-screen bg-background">
        <ClientHeader />
        <main className="container mx-auto px-4 py-8">
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground mb-4">Client not found</p>
              <Button onClick={() => navigate("/")}>Back to Dashboard</Button>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <ClientHeader clientName={client.name} clientLogo={client.logo_url} />
      
      <main className="container mx-auto px-4 py-8">
        <div className="space-y-8">
          {/* Welcome Section */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <BarChart3 className="h-4 w-4" />
              <span>Analytics Dashboard</span>
            </div>
            <h1 className="text-4xl font-bold text-foreground">
              Welcome to your Dashboard
            </h1>
            <p className="text-muted-foreground text-lg">
              View your performance metrics and past reports all in one place.
            </p>
          </div>

          {/* Quick Stats */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Followers</CardTitle>
                <Users className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {isLoadingMetrics ? (
                    <Loader2 className="h-6 w-6 animate-spin" />
                  ) : (
                    totalFollowers.toLocaleString()
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Across all connected platforms
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Past Reports</CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {clientReports?.reports.length || 0}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Available reports
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Platforms</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {(metricoolPlatforms?.length || 0) + 
                   (connectedAccounts?.youtube ? 1 : 0) + 
                   (connectedAccounts?.meta ? 1 : 0) + 
                   (connectedAccounts?.x ? 1 : 0)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Connected accounts
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Latest Report</CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-lg font-bold">
                  {latestReport?.dateRange || "No reports"}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Most recent period
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Top Performing Posts */}
          <TopPerformingPosts clientId={clientId!} />

          {/* Main Content Tabs */}
          <Tabs defaultValue="analytics" className="space-y-6">
            <TabsList className="grid w-full max-w-md grid-cols-2">
              <TabsTrigger value="analytics" className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Live Analytics
              </TabsTrigger>
              <TabsTrigger value="reports" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Past Reports
              </TabsTrigger>
            </TabsList>

            {/* Analytics Tab */}
            <TabsContent value="analytics" className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {/* YouTube */}
                <Card 
                  className="hover:border-primary/30 transition-all cursor-pointer group"
                  onClick={() => navigate(`/youtube-analytics/${clientId}`)}
                >
                  <CardHeader className="flex flex-row items-center justify-between space-y-0">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-xl bg-red-500/10 group-hover:bg-red-500/20 transition-colors">
                        <Youtube className="h-5 w-5 text-red-500" />
                      </div>
                      <div>
                        <CardTitle className="text-base">YouTube</CardTitle>
                        <CardDescription>Video Analytics</CardDescription>
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-foreground group-hover:translate-x-1 transition-all" />
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2">
                      {connectedAccounts?.youtube ? (
                        <Badge variant="secondary" className="bg-green-500/10 text-green-600">Connected</Badge>
                      ) : (
                        <Badge variant="outline">View Channel</Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Meta */}
                <Card 
                  className="hover:border-primary/30 transition-all cursor-pointer group"
                  onClick={() => navigate(`/meta-analytics/${clientId}`)}
                >
                  <CardHeader className="flex flex-row items-center justify-between space-y-0">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-xl bg-blue-500/10 group-hover:bg-blue-500/20 transition-colors">
                        <TrendingUp className="h-5 w-5 text-blue-500" />
                      </div>
                      <div>
                        <CardTitle className="text-base">Meta</CardTitle>
                        <CardDescription>Instagram & Facebook</CardDescription>
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-foreground group-hover:translate-x-1 transition-all" />
                  </CardHeader>
                  <CardContent>
                    {connectedAccounts?.meta ? (
                      <Badge variant="secondary" className="bg-green-500/10 text-green-600">Connected</Badge>
                    ) : (
                      <Badge variant="outline">Connect Account</Badge>
                    )}
                  </CardContent>
                </Card>

                {/* X (Twitter) */}
                {connectedAccounts?.x ? (
                  <Card 
                    className="hover:border-primary/30 transition-all cursor-pointer group"
                    onClick={() => navigate(`/x-analytics/${clientId}`)}
                  >
                    <CardHeader className="flex flex-row items-center justify-between space-y-0">
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-[#1DA1F2]/10 group-hover:bg-[#1DA1F2]/20 transition-colors">
                          <Twitter className="h-5 w-5 text-[#1DA1F2]" />
                        </div>
                        <div>
                          <CardTitle className="text-base">X</CardTitle>
                          <CardDescription>Twitter Analytics</CardDescription>
                        </div>
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-foreground group-hover:translate-x-1 transition-all" />
                    </CardHeader>
                    <CardContent>
                      <Badge variant="secondary" className="bg-green-500/10 text-green-600">Connected</Badge>
                    </CardContent>
                  </Card>
                ) : (
                  <Card className="hover:border-primary/30 transition-all group">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0">
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-[#1DA1F2]/10 group-hover:bg-[#1DA1F2]/20 transition-colors">
                          <Twitter className="h-5 w-5 text-[#1DA1F2]" />
                        </div>
                        <div>
                          <CardTitle className="text-base">X</CardTitle>
                          <CardDescription>Twitter Analytics</CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <XCSVUploadDialog
                        clientId={clientId!}
                        clientName={client.name}
                        trigger={
                          <Button variant="outline" size="sm" className="gap-2 w-full">
                            <Upload className="h-4 w-4" />
                            Upload CSV
                          </Button>
                        }
                      />
                    </CardContent>
                  </Card>
                )}

                {/* TikTok */}
                {metricoolPlatforms?.includes('tiktok') && (
                  <Card 
                    className="hover:border-primary/30 transition-all cursor-pointer group"
                    onClick={() => navigate(`/tiktok-metricool/${clientId}`)}
                  >
                    <CardHeader className="flex flex-row items-center justify-between space-y-0">
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-pink-500/10 group-hover:bg-pink-500/20 transition-colors">
                          <Music2 className="h-5 w-5 text-pink-500" />
                        </div>
                        <div>
                          <CardTitle className="text-base">TikTok</CardTitle>
                          <CardDescription>Short-form Video</CardDescription>
                        </div>
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-foreground group-hover:translate-x-1 transition-all" />
                    </CardHeader>
                    <CardContent>
                      <div className="flex justify-between items-center">
                        <Badge variant="secondary" className="bg-green-500/10 text-green-600">Connected</Badge>
                        {socialMetrics?.tiktok?.followers && (
                          <span className="text-sm text-muted-foreground">
                            {socialMetrics.tiktok.followers.toLocaleString()} followers
                          </span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* LinkedIn */}
                {metricoolPlatforms?.includes('linkedin') && (
                  <Card 
                    className="hover:border-primary/30 transition-all cursor-pointer group"
                    onClick={() => navigate(`/linkedin-metricool/${clientId}`)}
                  >
                    <CardHeader className="flex flex-row items-center justify-between space-y-0">
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-[#0A66C2]/10 group-hover:bg-[#0A66C2]/20 transition-colors">
                          <Linkedin className="h-5 w-5 text-[#0A66C2]" />
                        </div>
                        <div>
                          <CardTitle className="text-base">LinkedIn</CardTitle>
                          <CardDescription>Professional Network</CardDescription>
                        </div>
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-foreground group-hover:translate-x-1 transition-all" />
                    </CardHeader>
                    <CardContent>
                      <Badge variant="secondary" className="bg-green-500/10 text-green-600">Connected</Badge>
                    </CardContent>
                  </Card>
                )}

                {/* Web Analytics - Only for clients with supabase_url */}
                {client.supabase_url && client.name === "Snarky Humans" && (
                  <Card 
                    className="hover:border-primary/30 transition-all cursor-pointer group"
                    onClick={() => navigate(`/web-analytics/${clientId}`)}
                  >
                    <CardHeader className="flex flex-row items-center justify-between space-y-0">
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-emerald-500/10 group-hover:bg-emerald-500/20 transition-colors">
                          <Eye className="h-5 w-5 text-emerald-500" />
                        </div>
                        <div>
                          <CardTitle className="text-base">Website</CardTitle>
                          <CardDescription>Traffic Analytics</CardDescription>
                        </div>
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-foreground group-hover:translate-x-1 transition-all" />
                    </CardHeader>
                    <CardContent>
                      <Badge variant="secondary" className="bg-green-500/10 text-green-600">Active</Badge>
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>

            {/* Reports Tab */}
            <TabsContent value="reports" className="space-y-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Past Performance Reports</CardTitle>
                      <CardDescription>
                        Access detailed weekly analytics breakdowns
                      </CardDescription>
                    </div>
                    {clientReports && (
                      <CSVUploadDialog
                        clientName={clientReports.name}
                        trigger={
                          <Button variant="outline" size="sm" className="gap-2">
                            <Upload className="h-4 w-4" />
                            Upload CSV
                          </Button>
                        }
                      />
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Quick Access to Latest */}
                  {latestReport && (
                    <div className="p-4 rounded-lg border bg-accent/50 flex items-center justify-between">
                      <div>
                        <p className="font-medium">Latest Report</p>
                        <p className="text-sm text-muted-foreground">{latestReport.dateRange}</p>
                      </div>
                      <Button 
                        onClick={() => {
                          if (latestReport.isInternal) {
                            navigate(latestReport.link);
                          } else {
                            window.open(latestReport.link, '_blank');
                          }
                        }}
                        className="gap-2"
                      >
                        View Report
                        {!latestReport.isInternal && <ExternalLink className="h-4 w-4" />}
                      </Button>
                    </div>
                  )}

                  {/* Browse by Month */}
                  <div className="space-y-3">
                    <p className="text-sm font-medium text-muted-foreground">Browse by Month</p>
                    <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                      <SelectTrigger className="w-full md:w-[300px]">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-primary" />
                          <SelectValue placeholder="Select a month" />
                        </div>
                      </SelectTrigger>
                      <SelectContent>
                        {months.map((month) => (
                          <SelectItem key={month} value={month}>
                            <div className="flex items-center justify-between gap-4">
                              <span>{month}</span>
                              <span className="text-xs text-muted-foreground">
                                {reportsByMonth[month].length} {reportsByMonth[month].length === 1 ? 'week' : 'weeks'}
                              </span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {selectedMonth && (
                      <Select onValueChange={handleWeekSelect}>
                        <SelectTrigger className="w-full md:w-[300px]">
                          <div className="flex items-center gap-2">
                            <ChevronRight className="h-4 w-4 text-primary" />
                            <SelectValue placeholder="Select week" />
                          </div>
                        </SelectTrigger>
                        <SelectContent>
                          {weeksInSelectedMonth.map(({ index, report }) => (
                            <SelectItem key={index} value={index.toString()}>
                              <div className="flex items-center gap-2">
                                <span>{report.dateRange}</span>
                                {!report.isInternal && <ExternalLink className="h-3 w-3 text-muted-foreground" />}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>

                  {/* Report List */}
                  {clientReports?.reports && clientReports.reports.length > 0 && (
                    <div className="space-y-2 pt-4 border-t">
                      <p className="text-sm font-medium text-muted-foreground mb-3">All Reports</p>
                      <div className="grid gap-2">
                        {[...clientReports.reports].reverse().slice(0, 5).map((report, idx) => (
                          <div 
                            key={idx}
                            className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent/50 transition-colors cursor-pointer"
                            onClick={() => {
                              if (report.isInternal) {
                                navigate(report.link);
                              } else {
                                window.open(report.link, '_blank');
                              }
                            }}
                          >
                            <div className="flex items-center gap-3">
                              <FileText className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium">{report.dateRange}</span>
                            </div>
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
};

// Client-specific header component
const ClientHeader = ({ clientName, clientLogo }: { clientName?: string; clientLogo?: string | null }) => {
  const navigate = useNavigate();
  
  return (
    <header className="border-b border-border bg-card/80 backdrop-blur-md sticky top-0 z-50">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => navigate("/")}
              className="shrink-0"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            
            {clientLogo && (
              <div className="h-10 w-10 rounded-lg overflow-hidden border">
                <img 
                  src={clientLogo} 
                  alt={clientName || "Client"} 
                  className="h-full w-full object-cover"
                />
              </div>
            )}
            
            <div>
              <h1 className="text-xl font-bold text-foreground">
                {clientName || "Client Dashboard"}
              </h1>
              <p className="text-sm text-muted-foreground">Analytics & Reports</p>
            </div>
          </div>
          
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
};

export default ClientDashboard;
