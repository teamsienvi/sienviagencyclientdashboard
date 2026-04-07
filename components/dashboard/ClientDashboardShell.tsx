"use client";

import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState, useMemo } from "react";
import Link from "next/link";
import { format, subDays, startOfWeek, endOfWeek } from "date-fns";
import { getCurrentReportingWeek } from "@/utils/weeklyDateRange";
import { getClientLogo } from "@/utils/clientLogos";
import {
  ArrowLeft, Calendar, TrendingUp, Users, Eye,
  Youtube, Music2, Linkedin, FileText, ExternalLink,
  BarChart3, Loader2, ChevronRight, Upload, Twitter, Building2, ChevronDown, LogOut, ShoppingBag, Headphones, Podcast, FlaskConical
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { clientsData } from "@/data/clients";
import { CSVUploadDialog } from "@/components/CSVUploadDialog";
import { TopPerformingPosts } from "@/components/TopPerformingPosts";
import { AnalyticsSummaryCard } from "@/components/AnalyticsSummaryCard";
import { AdsShredderCard } from "@/components/AdsShredderCard";
import { getClientAdPlatforms, AD_PLATFORM_LABELS } from "@/config/adPlatforms";
import { Globe, Share2 } from "lucide-react";
import { XCSVUploadDialog } from "@/components/XCSVUploadDialog";
import { useAuth } from "@/hooks/useAuth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AllTimeTopPostsModal } from "@/components/AllTimeTopPostsModal";
import { UbersuggestSection } from "@/components/analytics/UbersuggestSection";

const PLATFORM_SHORT_NAMES: Record<string, string> = {
  instagram: "IG",
  facebook: "FB",
  tiktok: "TikTok",
  youtube: "YT",
  linkedin: "LI",
  x: "X",
  twitter: "X"
};

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

import { DateRangeSelector } from "@/components/DateRangeSelector";

type DateRangePreset = "7d" | "30d" | "60d" | "custom";
type RankingChoice = "all" | "engagement" | "reach" | "clicks";

interface ClientDashboardShellProps {
  clientId: string;
}

export default function ClientDashboardShell({ clientId }: ClientDashboardShellProps) {
  const router = useRouter();
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [metricRankingChoice, setMetricRankingChoice] = useState<RankingChoice>("all");
  
  // Dashboard Date Range State (for AI Summaries)
  const [dateRange, setDateRange] = useState<DateRangePreset>("7d");
  const [customDateRange, setCustomDateRange] = useState<{ start: Date; end: Date } | undefined>();

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
        .select("platform, followers")
        .eq("client_id", clientId)
        .eq("is_active", true);
      if (error) throw error;
      return data || [];
    },
    enabled: !!clientId,
  });

  // Fetch connected accounts and data existence
  const { data: connectedAccounts } = useQuery({
    queryKey: ["client-connected-accounts", clientId],
    queryFn: async () => {
      if (!clientId) return { x: false, xHasData: false, meta: false, youtube: false, shopify: false, metaAds: false };

      // Check X account connection
      const { data: xData } = await supabase
        .from("social_accounts")
        .select("id")
        .eq("client_id", clientId)
        .eq("platform", "x")
        .eq("is_active", true)
        .limit(1);

      // Check if X has any content data (from CSV upload)
      const { data: xContentData } = await supabase
        .from("social_content")
        .select("id")
        .eq("client_id", clientId)
        .eq("platform", "x")
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

      const { data: shopifyData } = await supabase
        .from("shopify_oauth_connections")
        .select("id")
        .eq("client_id", clientId)
        .eq("is_active", true)
        .limit(1);

      // Check Meta Ads config (direct API integration)
      const { data: metaAdsData } = await supabase
        .from("client_meta_ads_config")
        .select("id")
        .eq("client_id", clientId)
        .eq("is_active", true)
        .limit(1);

      return {
        x: xData && xData.length > 0,
        xHasData: (xContentData && xContentData.length > 0) || (xData && xData.length > 0),
        meta: metaData && metaData.length > 0,
        youtube: youtubeData && youtubeData.length > 0,
        shopify: shopifyData && shopifyData.length > 0,
        metaAds: metaAdsData && metaAdsData.length > 0,
      };
    },
    enabled: !!clientId,
  });

  // Fetch latest social metrics (for all API-connected platforms)
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

  // Fetch live follower counts from Metricool for platforms that support it
  const { data: metricoolFollowers } = useQuery({
    queryKey: ["client-metricool-followers", clientId, metricoolPlatforms],
    queryFn: async () => {
      if (!clientId || !metricoolPlatforms || metricoolPlatforms.length === 0) return null;

      const followers: Record<string, number> = {};
      // Include social platforms that support the followers metric via metricool-social-weekly
      // YouTube has different metrics and is fetched via social_account_metrics instead
      const socialPlatforms = metricoolPlatforms
        .filter(p => ["instagram", "facebook", "tiktok", "linkedin"].includes(p.platform))
        .map(p => p.platform);

      if (socialPlatforms.length === 0) return null;

      // Get date ranges for current period
      const today = new Date();
      const dayOfWeek = today.getDay();
      const daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      const thisMonday = new Date(today);
      thisMonday.setDate(today.getDate() - daysToSubtract);
      thisMonday.setHours(0, 0, 0, 0);

      const currentStart = new Date(thisMonday);
      currentStart.setDate(thisMonday.getDate() - 7);
      const currentEnd = new Date(thisMonday);
      currentEnd.setDate(thisMonday.getDate() - 1);
      const prevStart = new Date(currentStart);
      prevStart.setDate(currentStart.getDate() - 7);
      const prevEnd = new Date(currentStart);
      prevEnd.setDate(currentStart.getDate() - 1);

      const formatDate = (d: Date) => d.toISOString().split("T")[0];

      // Fetch each platform in parallel
      const results = await Promise.allSettled(
        socialPlatforms.map(async (platform) => {
          const { data, error } = await supabase.functions.invoke("metricool-social-weekly", {
            body: {
              clientId,
              platform,
              from: formatDate(currentStart),
              to: formatDate(currentEnd),
              prevFrom: formatDate(prevStart),
              prevTo: formatDate(prevEnd),
            },
          });

          if (error || !data?.success) return { platform, followers: null };

          // Get followers from the last point in the current timeline
          const timeline = data.data?.current?.followersTimeline || [];
          const lastPoint = timeline.length > 0 ? timeline[timeline.length - 1] : null;

          return { platform, followers: lastPoint?.value || null };
        })
      );

      results.forEach((result) => {
        if (result.status === "fulfilled" && result.value.followers) {
          followers[result.value.platform] = result.value.followers;
        }
      });

      return Object.keys(followers).length > 0 ? followers : null;
    },
    enabled: !!clientId && !!metricoolPlatforms && metricoolPlatforms.length > 0,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  // Fetch database reports for this client (for Jan 3+ dynamic reports)
  const { data: dbReports } = useQuery({
    queryKey: ["client-db-reports", clientId],
    queryFn: async () => {
      if (!clientId) return [];
      const { data, error } = await supabase
        .from("reports")
        .select("id, date_range, week_start, week_end")
        .eq("client_id", clientId)
        .gte("week_start", "2026-01-03")
        .order("week_start", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!clientId,
  });

  // Fetch beta testers count for Father Figure Formula
  const { data: betaCount, isLoading: isLoadingBeta } = useQuery({
    queryKey: ["fff-beta-count"],
    queryFn: async () => {
      const res = await fetch("https://qnquitqllwpeivinvhzk.supabase.co/functions/v1/beta-count", {
        headers: { "x-api-key": "Iydknyk1@#$%" },
      });
      if (!res.ok) throw new Error("Failed to fetch beta count");
      const data = await res.json();
      return data as { summary: { beta_testers_count: number }; timestamp: string };
    },
    enabled: client?.name === "Father Figure Formula",
    staleTime: 5 * 60 * 1000,
  });

  // Match client name with clientsData for reports
  const clientReports = useMemo(() => {
    if (!client?.name) return null;
    const staticClient = clientsData.find(c => c.name === client.name);
    if (!staticClient) return null;

    // Merge static reports with dynamic DB reports (Jan 3+)
    const staticReports = [...staticClient.reports];

    // Add DB reports that aren't already in static list
    if (dbReports && dbReports.length > 0) {
      const existingDateRanges = new Set(staticReports.map(r => r.dateRange.toLowerCase().replace(/\s+/g, '')));

      for (const dbReport of dbReports) {
        // Format date range for display (e.g., "Jan 5-11")
        const start = new Date(dbReport.week_start);
        const end = new Date(dbReport.week_end);
        const startMonth = start.toLocaleDateString('en-US', { month: 'short' });
        const endMonth = end.toLocaleDateString('en-US', { month: 'short' });
        const startDay = start.getDate();
        const endDay = end.getDate();

        let dateRange: string;
        if (startMonth === endMonth) {
          dateRange = `${startMonth} ${startDay}-${endDay}`;
        } else {
          dateRange = `${startMonth} ${startDay} - ${endMonth} ${endDay}`;
        }

        const normalizedRange = dateRange.toLowerCase().replace(/\s+/g, '');
        if (!existingDateRanges.has(normalizedRange)) {
          staticReports.push({
            dateRange,
            link: `/report/${dbReport.id}`,
            isInternal: true,
          });
          existingDateRanges.add(normalizedRange);
        }
      }
    }

    return { ...staticClient, reports: staticReports };
  }, [client?.name, dbReports]);

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
      router.push(report.link);
    } else {
      window.open(report.link, '_blank');
    }
  };

  // Aggregate total followers from ALL sources:
  // 1. Live Metricool API data (most accurate, real-time)
  // 2. social_account_metrics (for platforms not in Metricool)
  const { totalFollowers, followerBreakdown } = useMemo(() => {
    let total = 0;
    const breakdown: { platform: string; count: number }[] = [];
    const countedPlatforms = new Set<string>();

    // First priority: Live Metricool followers (most accurate)
    if (metricoolFollowers) {
      Object.entries(metricoolFollowers).forEach(([platform, followers]) => {
        if (followers && followers > 0) {
          total += followers;
          countedPlatforms.add(platform);
          breakdown.push({ platform, count: followers });
        }
      });
    }

    // Second: Add from social_account_metrics for platforms not already counted
    if (socialMetrics) {
      Object.entries(socialMetrics).forEach(([platform, m]) => {
        if (m?.followers && !countedPlatforms.has(platform)) {
          total += m.followers;
          countedPlatforms.add(platform);
          breakdown.push({ platform, count: m.followers });
        }
      });
    }

    breakdown.sort((a, b) => b.count - a.count);

    return { totalFollowers: total, followerBreakdown: breakdown };
  }, [socialMetrics, metricoolFollowers]);

  // Count connected platforms accurately
  const connectedPlatformsCount = useMemo(() => {
    let count = 0;

    // Metricool platforms (excluding meta_ads which is not a social platform)
    const socialMetricoolPlatforms = metricoolPlatforms?.filter(p => p.platform !== 'meta_ads') || [];
    count += socialMetricoolPlatforms.length;

    // Add YouTube if connected and not in Metricool
    if (connectedAccounts?.youtube && !metricoolPlatforms?.some(p => p.platform === 'youtube')) {
      count++;
    }

    // Add Meta (OAuth) if connected and not in Metricool
    if (connectedAccounts?.meta && !metricoolPlatforms?.some(p => p.platform === 'instagram' || p.platform === 'facebook')) {
      count++;
    }

    // Add X if has data and not in Metricool
    if (connectedAccounts?.xHasData && !metricoolPlatforms?.some(p => p.platform === 'x')) {
      count++;
    }

    // Add Shopify if connected
    if (connectedAccounts?.shopify) {
      count++;
    }

    return count;
  }, [metricoolPlatforms, connectedAccounts]);

  // Check if client has any active social media platforms
  const hasSocialMedia = useMemo(() => {
    if (client?.name === "Snarky A$$ Humans") return false;

    if (!metricoolPlatforms || !connectedAccounts) return false;
    
    if (client?.name === "Snarky Humans") return true;

    const platforms = metricoolPlatforms.map(p => p.platform);
    const adsPlatforms = ['meta_ads', 'google_ads', 'tiktok_ads'];
    const nonAdsPlatforms = platforms.filter(p => !adsPlatforms.includes(p));
    
    const hasMetricsData = socialMetrics ? Object.keys(socialMetrics).some(p => !adsPlatforms.includes(p)) : false;

    return nonAdsPlatforms.length > 0 || 
           connectedAccounts.meta || 
           connectedAccounts.youtube || 
           connectedAccounts.xHasData || 
           hasMetricsData;
  }, [metricoolPlatforms, connectedAccounts, socialMetrics, client]);

  // Check if client only has ads (meta_ads) and no other platforms
  const isAdsOnlyClient = useMemo(() => {
    if (!metricoolPlatforms) return false;
    // If client has website analytics configured, it's not ads-only
    if (client?.supabase_url) return false;
    const platforms = metricoolPlatforms.map(p => p.platform);
    const adsPlatforms = ['meta_ads', 'google_ads', 'tiktok_ads'];
    const hasAnyAdsPlatform = platforms.some(p => adsPlatforms.includes(p));
    return hasAnyAdsPlatform && !hasSocialMedia;
  }, [metricoolPlatforms, hasSocialMedia, client]);

  const latestReport = clientReports?.reports && clientReports.reports.length > 0 
    ? clientReports.reports[clientReports.reports.length - 1] 
    : null;

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
              <Button onClick={() => router.push("/")}>Back to Dashboard</Button>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <ClientHeader clientName={client.name} clientLogo={getClientLogo(client.name, client.logo_url)} currentClientId={clientId} />

      <main className="container mx-auto px-4 py-8">
        <div className="space-y-6">
          {/* Branded Hero Section */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/5 via-primary/3 to-transparent border border-primary/10 p-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <Breadcrumb className="mb-1">
                  <BreadcrumbList>
                    <BreadcrumbItem>
                      <BreadcrumbLink asChild>
                        <Link href="/" className="hover:text-primary transition-colors flex items-center gap-1 text-xs">
                          <BarChart3 className="h-3 w-3" />
                          Home
                        </Link>
                      </BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator>
                      <ChevronRight className="h-3 w-3" />
                    </BreadcrumbSeparator>
                    <BreadcrumbItem>
                      <BreadcrumbPage className="text-xs">Dashboard</BreadcrumbPage>
                    </BreadcrumbItem>
                  </BreadcrumbList>
                </Breadcrumb>
                <h1 className="text-2xl font-bold text-foreground tracking-tight">
                  {client.name} <span className="text-muted-foreground font-normal text-lg">— Analytics</span>
                </h1>
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  {connectedPlatformsCount > 0 && (
                    <span className="flex items-center gap-1">
                      <TrendingUp className="h-3.5 w-3.5" />
                      {connectedPlatformsCount} platforms
                    </span>
                  )}
                  {totalFollowers > 0 && (
                    <div className="flex items-center gap-2">
                      <span className="flex items-center gap-1">
                        <Users className="h-3.5 w-3.5" />
                        {totalFollowers.toLocaleString()} followers
                      </span>
                      {followerBreakdown.length > 0 && (
                        <span className="text-muted-foreground/75 text-xs font-medium ml-1">
                          ({followerBreakdown.map(b => `${PLATFORM_SHORT_NAMES[b.platform] || b.platform} ${Intl.NumberFormat('en-US', { notation: "compact", maximumFractionDigits: 1 }).format(b.count)}`).join(', ')})
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <DateRangeSelector 
                  value={dateRange} 
                  onChange={(preset, custom) => {
                    setDateRange(preset);
                    if (preset === "custom" && custom) setCustomDateRange(custom);
                  }} 
                  customRange={customDateRange}
                />
              </div>
            </div>
          </div>

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
              <Accordion type="multiple" defaultValue={["social", "ads", "web", "seo"]} className="w-full space-y-4">
                
                {/* Social Bucket */}
                {hasSocialMedia && (
                  <AccordionItem value="social" className="border rounded-lg bg-card overflow-hidden">
                    <AccordionTrigger className="px-6 py-4 hover:bg-muted/50 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-violet-500/10">
                          <Share2 className="h-5 w-5 text-violet-500" />
                        </div>
                        <div className="flex flex-col items-start bg-transparent">
                          <span className="text-base font-semibold">Social Media</span>
                          <span className="text-sm font-normal text-muted-foreground">Performance, engagement, and top posts</span>
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-6 pb-6 pt-2 border-t space-y-6">
                      {!isAdsOnlyClient && (
                        <AnalyticsSummaryCard
                          clientId={clientId!}
                          type="social"
                          title="Social Media Summary"
                          icon={<Share2 className="h-5 w-5 text-violet-400" />}
                          dateRange={dateRange}
                        />
                      )}
                      
                      <div className="flex justify-end">
                        <AllTimeTopPostsModal clientId={clientId!} buttonLabel="🏆 View Hall of Fame" buttonSize="default" buttonVariant="outline" />
                      </div>

                      <TopPerformingPosts clientId={clientId!} dateRange={dateRange} customDateRange={customDateRange} />
                      
                      {/* Drill down cards */}
                      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 pt-4 border-t">
                        {/* YouTube */}
                        {(metricoolPlatforms?.some(p => p.platform === 'youtube') || connectedAccounts?.youtube || client.name === "Snarky Humans") && (
                          <Card className="hover:border-primary/30 transition-all cursor-pointer group" onClick={() => router.push(`/youtube-analytics/${clientId}`)}>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                              <div className="flex items-center gap-3">
                                <div className="p-2.5 rounded-xl bg-red-500/10 group-hover:bg-red-500/20 transition-colors">
                                  <Youtube className="h-5 w-5 text-red-500" />
                                </div>
                                <div><CardTitle className="text-base">YouTube</CardTitle></div>
                              </div>
                              <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-foreground group-hover:translate-x-1 transition-all" />
                            </CardHeader>
                            <CardContent>
                              {connectedAccounts?.youtube ? (
                                <Badge variant="secondary" className="bg-green-500/10 text-green-600">Connected</Badge>
                              ) : (
                                <Badge variant="outline">View Channel</Badge>
                              )}
                            </CardContent>
                          </Card>
                        )}
                        {/* Meta */}
                        {(metricoolPlatforms?.some(p => ['facebook', 'instagram'].includes(p.platform)) || connectedAccounts?.meta || client.name === "Snarky Humans") && (
                          <Card className="hover:border-primary/30 transition-all cursor-pointer group" onClick={() => router.push(`/meta-analytics/${clientId}`)}>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                              <div className="flex items-center gap-3">
                                <div className="p-2.5 rounded-xl bg-blue-500/10 group-hover:bg-blue-500/20 transition-colors">
                                  <TrendingUp className="h-5 w-5 text-blue-500" />
                                </div>
                                <div><CardTitle className="text-base">Meta</CardTitle></div>
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
                        )}
                        {/* TikTok */}
                        {(metricoolPlatforms?.some(p => p.platform === 'tiktok') || client.name === "Snarky Humans") && (
                          <Card className="hover:border-primary/30 transition-all cursor-pointer group" onClick={() => router.push(`/tiktok-metricool/${clientId}`)}>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                              <div className="flex items-center gap-3">
                                <div className="p-2.5 rounded-xl bg-pink-500/10 group-hover:bg-pink-500/20 transition-colors">
                                  <Music2 className="h-5 w-5 text-pink-500" />
                                </div>
                                <div><CardTitle className="text-base">TikTok</CardTitle></div>
                              </div>
                              <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-foreground group-hover:translate-x-1 transition-all" />
                            </CardHeader>
                            <CardContent>
                              <div className="flex justify-between items-center">
                                <Badge variant="secondary" className="bg-green-500/10 text-green-600">Connected</Badge>
                                {socialMetrics?.tiktok?.followers && (
                                  <span className="text-sm text-muted-foreground">{socialMetrics.tiktok.followers.toLocaleString()} followers</span>
                                )}
                              </div>
                            </CardContent>
                          </Card>
                        )}
                        {/* X */}
                        {(client.name === "Sienvi Agency" || client.name === "Father Figure Formula" || client.name === "Snarky Humans") && (
                          connectedAccounts?.xHasData ? (
                            <Card className="hover:border-primary/30 transition-all cursor-pointer group" onClick={() => router.push(`/x-analytics/${clientId}`)}>
                              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <div className="flex items-center gap-3">
                                  <div className="p-2.5 rounded-xl bg-[#1DA1F2]/10 group-hover:bg-[#1DA1F2]/20 transition-colors">
                                    <Twitter className="h-5 w-5 text-[#1DA1F2]" />
                                  </div>
                                  <div><CardTitle className="text-base">X</CardTitle></div>
                                </div>
                                <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-foreground group-hover:translate-x-1 transition-all" />
                              </CardHeader>
                              <CardContent>
                                <Badge variant="secondary" className="bg-green-500/10 text-green-600">{connectedAccounts?.x ? "Connected" : "Data Available"}</Badge>
                              </CardContent>
                            </Card>
                          ) : (
                            <Card className="hover:border-primary/30 transition-all group">
                              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <div className="flex items-center gap-3">
                                  <div className="p-2.5 rounded-xl bg-[#1DA1F2]/10 group-hover:bg-[#1DA1F2]/20 transition-colors">
                                    <Twitter className="h-5 w-5 text-[#1DA1F2]" />
                                  </div>
                                  <div><CardTitle className="text-base">X</CardTitle></div>
                                </div>
                              </CardHeader>
                              <CardContent>
                                <XCSVUploadDialog clientId={clientId!} clientName={client.name} trigger={<Button variant="outline" size="sm" className="gap-2 w-full"><Upload className="h-4 w-4" />Upload CSV</Button>} />
                              </CardContent>
                            </Card>
                          )
                        )}
                        {/* LinkedIn */}
                        {metricoolPlatforms?.some(p => p.platform === 'linkedin') && (
                          <Card className="hover:border-primary/30 transition-all cursor-pointer group" onClick={() => router.push(`/linkedin-metricool/${clientId}`)}>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                              <div className="flex items-center gap-3">
                                <div className="p-2.5 rounded-xl bg-[#0A66C2]/10 group-hover:bg-[#0A66C2]/20 transition-colors">
                                  <Linkedin className="h-5 w-5 text-[#0A66C2]" />
                                </div>
                                <div><CardTitle className="text-base">LinkedIn</CardTitle></div>
                              </div>
                              <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-foreground group-hover:translate-x-1 transition-all" />
                            </CardHeader>
                            <CardContent>
                              <Badge variant="secondary" className="bg-green-500/10 text-green-600">Connected</Badge>
                            </CardContent>
                          </Card>
                        )}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                )}

                {/* Ads Bucket */}
                {client?.name !== "Father Figure Formula" && (metricoolPlatforms?.some(p => ['meta_ads', 'google_ads', 'tiktok_ads'].includes(p.platform)) || connectedAccounts?.metaAds || getClientAdPlatforms(client.name).includes('amazon')) && (
                  <AccordionItem value="ads" className="border rounded-lg bg-card overflow-hidden">
                    <AccordionTrigger className="px-6 py-4 hover:bg-muted/50 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-orange-500/10">
                          <BarChart3 className="h-5 w-5 text-orange-500" />
                        </div>
                        <div className="flex flex-col items-start bg-transparent">
                          <span className="text-base font-semibold">Advertising</span>
                          <span className="text-sm font-normal text-muted-foreground">Ad spend, impressions, and conversions</span>
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-6 pb-6 pt-2 border-t space-y-6">
                      <div className="space-y-4">
                        {metricoolPlatforms?.some(p => p.platform === 'meta_ads') && (
                          <AdsShredderCard clientId={clientId!} adPlatform="meta" title={`Ads Shredder — ${AD_PLATFORM_LABELS.meta}`} />
                        )}
                        {metricoolPlatforms?.some(p => p.platform === 'google_ads') && (
                          <AdsShredderCard clientId={clientId!} adPlatform="google" title={`Ads Shredder — ${AD_PLATFORM_LABELS.google}`} />
                        )}
                        {metricoolPlatforms?.some(p => p.platform === 'tiktok_ads') && (
                          <AdsShredderCard clientId={clientId!} adPlatform="tiktok" title={`Ads Shredder — ${AD_PLATFORM_LABELS.tiktok}`} />
                        )}
                        {getClientAdPlatforms(client.name).includes('amazon') && (
                          <AdsShredderCard clientId={clientId!} adPlatform="amazon" title={`Ads Shredder — ${AD_PLATFORM_LABELS.amazon}`} />
                        )}
                      </div>

                      {/* Drill down cards */}
                      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 pt-4 border-t">
                        <Card className="hover:border-primary/30 transition-all cursor-pointer group" onClick={() => router.push(`/ads-analytics/${clientId}`)}>
                          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <div className="flex items-center gap-3">
                              <div className="p-2.5 rounded-xl bg-orange-500/10 group-hover:bg-orange-500/20 transition-colors">
                                <BarChart3 className="h-5 w-5 text-orange-500" />
                              </div>
                              <div><CardTitle className="text-base">Ads Platform</CardTitle></div>
                            </div>
                            <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-foreground group-hover:translate-x-1 transition-all" />
                          </CardHeader>
                          <CardContent>
                            <Badge variant="secondary" className="bg-green-500/10 text-green-600">Connected</Badge>
                          </CardContent>
                        </Card>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                )}

                {/* Web Bucket */}
                {(!isAdsOnlyClient && client.supabase_url) || (client.name === "Snarky Pets" || client.name === "Snarky Humans" || client.name === "BlingyBag") || (client.name === "Father Figure Formula") ? (
                  <AccordionItem value="web" className="border rounded-lg bg-card overflow-hidden">
                    <AccordionTrigger className="px-6 py-4 hover:bg-muted/50 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-emerald-500/10">
                          <Globe className="h-5 w-5 text-emerald-500" />
                        </div>
                        <div className="flex flex-col items-start bg-transparent">
                          <span className="text-base font-semibold">Web & E-Commerce</span>
                          <span className="text-sm font-normal text-muted-foreground">Traffic, sales, and platform analytics</span>
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-6 pb-6 pt-2 border-t space-y-6">
                      
                      {!isAdsOnlyClient && client.supabase_url && (
                        <AnalyticsSummaryCard
                          clientId={clientId!}
                          type="website"
                          title="Website Analytics Summary"
                          icon={<Globe className="h-5 w-5 text-fuchsia-400" />}
                          dateRange={dateRange}
                        />
                      )}

                      {/* Drill down cards */}
                      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 pt-4 border-t">
                        {/* Website specific */}
                        {!isAdsOnlyClient && client.supabase_url && (
                          <Card className="hover:border-primary/30 transition-all cursor-pointer group" onClick={() => router.push(`/web-analytics/${clientId}`)}>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                              <div className="flex items-center gap-3">
                                <div className="p-2.5 rounded-xl bg-emerald-500/10 group-hover:bg-emerald-500/20 transition-colors">
                                  <Eye className="h-5 w-5 text-emerald-500" />
                                </div>
                                <div><CardTitle className="text-base">Website</CardTitle></div>
                              </div>
                              <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-foreground group-hover:translate-x-1 transition-all" />
                            </CardHeader>
                            <CardContent>
                              <Badge variant="secondary" className="bg-green-500/10 text-green-600">Active</Badge>
                            </CardContent>
                          </Card>
                        )}
                        
                        {/* Shopify */}
                        {(client.name === "Snarky Pets" || client.name === "Snarky Humans" || client.name === "BlingyBag") && (
                          <Card className="hover:border-primary/30 transition-all cursor-pointer group" onClick={() => router.push(`/shopify-analytics/${clientId}`)}>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                              <div className="flex items-center gap-3">
                                <div className="p-2.5 rounded-xl bg-green-500/10 group-hover:bg-green-500/20 transition-colors">
                                  <ShoppingBag className="h-5 w-5 text-green-500" />
                                </div>
                                <div><CardTitle className="text-base">Shopify</CardTitle></div>
                              </div>
                              <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-foreground group-hover:translate-x-1 transition-all" />
                            </CardHeader>
                            <CardContent>
                              <Badge variant="secondary" className="bg-green-500/10 text-green-600">Connected</Badge>
                            </CardContent>
                          </Card>
                        )}

                        {/* Podcasts and LMS - Father Figure Formula */}
                        {client.name === "Father Figure Formula" && (
                          <>
                            <Card className="hover:border-primary/30 transition-all cursor-pointer group" onClick={() => window.open('https://podcastsconnect.apple.com/analytics', '_blank')}>
                              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <div className="flex items-center gap-3">
                                  <div className="p-2.5 rounded-xl bg-purple-500/10 group-hover:bg-purple-500/20 transition-colors">
                                    <Podcast className="h-5 w-5 text-purple-500" />
                                  </div>
                                  <div><CardTitle className="text-base">Apple Podcasts</CardTitle></div>
                                </div>
                                <ExternalLink className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-all" />
                              </CardHeader>
                              <CardContent>
                                <Badge variant="secondary" className="bg-purple-500/10 text-purple-600">External</Badge>
                              </CardContent>
                            </Card>

                            <Card className="hover:border-primary/30 transition-all cursor-pointer group" onClick={() => window.open('https://creators.spotify.com/pod/show/1hkGUz3tDpJFHzmapxtSGk/analytics', '_blank')}>
                              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <div className="flex items-center gap-3">
                                  <div className="p-2.5 rounded-xl bg-green-500/10 group-hover:bg-green-500/20 transition-colors">
                                    <Headphones className="h-5 w-5 text-green-500" />
                                  </div>
                                  <div><CardTitle className="text-base">Spotify</CardTitle></div>
                                </div>
                                <ExternalLink className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-all" />
                              </CardHeader>
                              <CardContent>
                                <Badge variant="secondary" className="bg-green-500/10 text-green-600">External</Badge>
                              </CardContent>
                            </Card>

                            <Card className="hover:border-primary/30 transition-all cursor-pointer group bg-gradient-to-br from-amber-500/5 to-orange-500/5 border-amber-200/50 dark:border-amber-800/50" onClick={() => router.push(`/lms-analytics/${clientId}`)}>
                              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <div className="flex items-center gap-3">
                                  <div className="p-2.5 rounded-xl bg-amber-500/10 group-hover:bg-amber-500/20 transition-colors">
                                    <FlaskConical className="h-5 w-5 text-amber-500" />
                                  </div>
                                  <div><CardTitle className="text-base">LMS Course</CardTitle></div>
                                </div>
                                <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-foreground group-hover:translate-x-1 transition-all" />
                              </CardHeader>
                              <CardContent>
                                <div className="flex items-center justify-between">
                                  <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                                    {isLoadingBeta ? <Loader2 className="h-5 w-5 animate-spin" /> : <>{betaCount?.summary?.beta_testers_count ?? "—"} <span className="text-sm font-normal text-muted-foreground">testers</span></>}
                                  </div>
                                  <Badge variant="secondary" className="bg-amber-500/10 text-amber-600">Live</Badge>
                                </div>
                              </CardContent>
                            </Card>
                          </>
                        )}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ) : null}

                {/* SEO Bucket (Ubersuggest) */}
                <AccordionItem value="seo" className="border rounded-lg bg-card overflow-hidden">
                  <AccordionTrigger className="px-6 py-4 hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-slate-800">
                        <span className="text-xl">🔍</span>
                      </div>
                      <div className="flex flex-col items-start bg-transparent">
                        <span className="text-base font-semibold">Search Engine Optimization</span>
                        <span className="text-sm font-normal text-muted-foreground">Site audit score, issues, and keyword positions</span>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-6 pb-6 pt-2 border-t space-y-6 bg-slate-900/5">
                    <UbersuggestSection clientId={clientId!} />
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
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
                            router.push(latestReport.link);
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
                                router.push(report.link);
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
const ClientHeader = ({ clientName, clientLogo, currentClientId }: { clientName?: string; clientLogo?: string | null; currentClientId?: string }) => {
  const router = useRouter();
  const { isAdmin, isAuthenticated, signOut, user } = useAuth();

  // Fetch all clients unconditionally for the Switch Client dropdown
  const { data: clients } = useQuery({
    queryKey: ["all-clients-dropdown"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, name, logo_url")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    }
  });

  const showClientSwitcher = clients && clients.length > 0;

  const handleClientSelect = (clientId: string) => {
    router.push(`/client/${clientId}`);
  };

  const handleSignOut = async () => {
    await signOut();
    router.push("/login");
  };

  const handleBackClick = () => {
    if (isAdmin) {
      router.push("/");
    }
    // Non-admin users with single client - no back navigation
    // Non-admin users with multiple clients can use the switcher
  };

  return (
    <header className="border-b border-border bg-card/80 backdrop-blur-md sticky top-0 z-50">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* Only show back button for admins */}
            {isAdmin && (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleBackClick}
                className="shrink-0"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
            )}

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

          <div className="flex items-center gap-3">
            {/* Client Selector - for admins OR users with multiple assigned clients */}
            {showClientSwitcher && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2 hover:bg-primary/5 hover:border-primary/30 transition-all duration-300">
                    {clientLogo ? (
                      <img src={clientLogo} alt={clientName || "Client"} className="h-4 w-4 rounded-sm object-cover" />
                    ) : (
                      <Building2 className="h-4 w-4" />
                    )}
                    <span className="hidden sm:inline max-w-[150px] truncate">
                      {clientName || "Switch Client"}
                    </span>
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-[220px] max-h-[400px] overflow-y-auto">
                  <DropdownMenuLabel>Switch Client</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {clients.map((client) => (
                    <DropdownMenuItem
                      key={client.id}
                      onClick={() => handleClientSelect(client.id)}
                      className={`cursor-pointer flex items-center gap-2 ${currentClientId === client.id ? 'bg-accent' : ''}`}
                    >
                      {getClientLogo(client.name, client.logo_url) ? (
                        <img
                          src={getClientLogo(client.name, client.logo_url)!}
                          alt={client.name}
                          className="h-6 w-6 rounded object-cover"
                        />
                      ) : (
                        <div className="h-6 w-6 rounded bg-muted flex items-center justify-center">
                          <Building2 className="h-3 w-3 text-muted-foreground" />
                        </div>
                      )}
                      <span className="truncate">{client.name}</span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            <ThemeToggle />
            {/* Logout button for all authenticated users */}
            {isAuthenticated && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleSignOut}
                className="gap-2 hover:bg-destructive/10 hover:border-destructive/30 hover:text-destructive transition-all duration-300"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Sign Out</span>
              </Button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
