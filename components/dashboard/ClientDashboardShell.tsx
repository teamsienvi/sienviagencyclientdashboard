"use client";

import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { format, subDays, startOfWeek, endOfWeek } from "date-fns";
import { getCurrentReportingWeek } from "@/utils/weeklyDateRange";
import { getClientLogo } from "@/utils/clientLogos";
import {
  ArrowLeft, Calendar, TrendingUp, Users, Eye,
  Youtube, Music2, Linkedin, FileText, ExternalLink,
  BarChart3, Loader2, ChevronRight, Upload, Twitter, Building2, ChevronDown, LogOut, ShoppingBag, Headphones, Podcast, FlaskConical, Instagram, Facebook, Target
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
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import { clientsData } from "@/data/clients";
import { CSVUploadDialog } from "@/components/CSVUploadDialog";
// import { TopPerformingPosts } from "@/components/TopPerformingPosts";
import { AnalyticsSummaryCard } from "@/components/AnalyticsSummaryCard";
import { AdsShredderCard } from "@/components/AdsShredderCard";
import { AmazonAdsReportCard } from "@/components/AmazonAdsReportCard";
import { TikTokAdsReportCard } from "@/components/TikTokAdsReportCard";
import { WebsiteAnalyticsSection } from "@/components/analytics/WebsiteAnalyticsSection";
import { getClientAdPlatforms, AD_PLATFORM_LABELS } from "@/config/adPlatforms";
import { Globe, Share2, Star } from "lucide-react";
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
import { useSocialMetricsRealtime } from "@/hooks/useSocialMetricsRealtime";

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

type DateRangePreset = "7d" | "14d" | "30d" | "60d" | "90d" | "custom";
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
  const [activeTab, setActiveTab] = useState<string>("analytics");
  const [selectedShredderPlatforms, setSelectedShredderPlatforms] = useState<string[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Realtime subscription: auto-invalidate top posts cache when background sync writes new data
  useSocialMetricsRealtime(clientId);

  // Fetch client details from database
  const { data: client, isLoading: isLoadingClient } = useQuery({
    queryKey: ["client-dashboard", clientId, "with-ga4"],
    queryFn: async () => {
      if (!clientId) return null;
      const { data, error } = await supabase
        .from("clients")
        .select("id, name, logo_url, supabase_url, api_key, client_ga4_config(ga4_property_id)")
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
      if (!clientId) return { x: false, xHasData: false, meta: false, youtube: false, shopify: false, metaAds: false, substack: false };

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

      // Check Substack config
      const { data: substackData } = await supabase
        .from("client_substack_config" as any)
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
        substack: substackData && substackData.length > 0,
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
      const targetUrl = client?.supabase_url || "https://ouxnqgwdwccjipmplure.supabase.co";
      const res = await fetch(`${targetUrl}/functions/v1/beta-count`, {
        headers: { 
          "x-api-key": "Iydknyk1@#$%",
          ...(client?.api_key ? { "Authorization": `Bearer ${client.api_key}`, "apikey": client.api_key } : {})
        },
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

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
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

  // Helper: resolve ga4 property id regardless of whether supabase returns object or array
  const clientGa4PropertyId = useMemo(() => {
    const cfg = client?.client_ga4_config;
    if (!cfg) return null;
    if (Array.isArray(cfg)) return cfg[0]?.ga4_property_id || null;
    return (cfg as any)?.ga4_property_id || null;
  }, [client]);

  // Check if client only has ads (meta_ads) and no other platforms
  const isAdsOnlyClient = useMemo(() => {
    if (!metricoolPlatforms) return false;
    const name = client?.name?.trim();
    // If client has website analytics configured, it's not ads-only
    if (client?.supabase_url || clientGa4PropertyId || connectedAccounts?.substack || ["Snarky Pets", "Snarky Humans", "BlingyBag", "Father Figure Formula", "Sienvi Agency"].includes(name || "")) return false;
    const platforms = metricoolPlatforms.map(p => p.platform);
    const adsPlatforms = ['meta_ads', 'google_ads', 'tiktok_ads'];
    const hasAnyAdsPlatform = platforms.some(p => adsPlatforms.includes(p));
    return hasAnyAdsPlatform && !hasSocialMedia;
  }, [metricoolPlatforms, hasSocialMedia, client, clientGa4PropertyId]);

  // Check if client has any ads platforms connected
  const hasAdsPlatform = useMemo(() => {
    if (client?.name === "Father Figure Formula" || client?.name === "Sienvi Agency" || client?.name === "The Billionaire Brother") return false;
    if (metricoolPlatforms?.some(p => ['meta_ads', 'google_ads', 'tiktok_ads'].includes(p.platform))) return true;
    if (connectedAccounts?.metaAds) return true;
    if (client?.name && getClientAdPlatforms(client.name).includes('amazon')) return true;
    return false;
  }, [client?.name, metricoolPlatforms, connectedAccounts]);

  const latestReport = clientReports?.reports && clientReports.reports.length > 0 
    ? clientReports.reports[clientReports.reports.length - 1] 
    : null;

  if (!mounted || isLoadingClient) {
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
                <div className="mb-4">
                  <Link 
                    href="/" 
                    className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors group px-2 py-1 -ml-2 rounded-md hover:bg-muted/50"
                  >
                    <ChevronRight className="h-3 w-3 rotate-180 transition-transform group-hover:-translate-x-1" />
                    Back to Command Center
                  </Link>
                </div>
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
            </div>
          </div>

          {/* Main Content Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
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

            {/* Navigation Buckets Bar - Full width, fills row */}
            <div className="grid py-4 mb-4 border-y border-primary/5 bg-primary/[0.02] rounded-xl overflow-hidden"
              style={{ gridTemplateColumns: `repeat(${[hasSocialMedia, hasAdsPlatform, ((!isAdsOnlyClient && client.supabase_url) || ['Snarky Pets','Snarky Humans','BlingyBag','Father Figure Formula'].includes(client?.name?.trim() || '') || connectedAccounts?.substack), true].filter(Boolean).length}, 1fr)` }}
            >
              
              {hasSocialMedia && (
                <button
                  onClick={() => scrollToSection("social-media")}
                  className="flex items-center justify-center gap-2 py-3 px-4 text-sm font-bold transition-all hover:bg-violet-500/5 border-r border-primary/10 last:border-r-0 group"
                >
                  <Share2 className="h-4 w-4 text-violet-500 group-hover:scale-110 transition-transform" />
                  <span>SOCIAL MEDIA</span>
                </button>
              )}

              {hasAdsPlatform && (
                <button
                  onClick={() => scrollToSection("advertising")}
                  className="flex items-center justify-center gap-2 py-3 px-4 text-sm font-bold transition-all hover:bg-orange-500/5 border-r border-primary/10 last:border-r-0 group"
                >
                  <BarChart3 className="h-4 w-4 text-orange-500 group-hover:scale-110 transition-transform" />
                  <span>ADVERTISING</span>
                </button>
              )}

              {((!isAdsOnlyClient && client.supabase_url) || 
                ["Snarky Pets", "Snarky Humans", "BlingyBag", "Father Figure Formula"].includes(client?.name?.trim() || "") || 
                connectedAccounts?.substack) && (
                <button
                  onClick={() => scrollToSection("web-ecommerce")}
                  className="flex items-center justify-center gap-2 py-3 px-4 text-sm font-bold transition-all hover:bg-emerald-500/5 border-r border-primary/10 last:border-r-0 group"
                >
                  <Globe className="h-4 w-4 text-emerald-500 group-hover:scale-110 transition-transform" />
                  <span>WEB & E-COMM</span>
                </button>
              )}

              {client?.name !== "Snarky Humans" && client?.name !== "Snarky Pets" && client?.name !== "Snarky A$$ Humans" && (
                <button
                  onClick={() => scrollToSection("seo")}
                  className="flex items-center justify-center gap-2 py-3 px-4 text-sm font-bold transition-all hover:bg-slate-500/10 border-r border-primary/10 last:border-r-0 group"
                >
                  <span className="text-base grayscale group-hover:scale-110 transition-transform">🔍</span>
                  <span>SEO DASHBOARD</span>
                </button>
              )}
            </div>

            {/* Analytics Tab */}
            <TabsContent value="analytics" forceMount className={activeTab === "analytics" ? "space-y-12 pb-12" : "hidden"}>
              
              {/* Zone 2: Executive Insight Layer */}
              <div className="space-y-6 scroll-mt-24" id="executive-insights">

                
                <div className="relative px-4 sm:px-12">
                  <Carousel opts={{ align: "start" }} className="w-full">
                    <CarouselContent>
                      {hasSocialMedia && !isAdsOnlyClient && (
                        <CarouselItem>
                          <AnalyticsSummaryCard
                            clientId={clientId!}
                            type="social"
                            title="Social Media Overview"
                            icon={<Share2 className="h-5 w-5 text-violet-500" />}
                            dateRange={dateRange}
                            customDateRange={customDateRange}
                            isActive={activeTab === "analytics"}
                            liveFollowers={metricoolFollowers}
                            socialMetrics={socialMetrics}
                          />
                        </CarouselItem>
                      )}

                      {((!isAdsOnlyClient && client.supabase_url) || 
                        ["Snarky Pets", "Snarky Humans", "BlingyBag", "Father Figure Formula"].includes(client?.name?.trim() || "") || 
                        connectedAccounts?.substack) && (
                        <CarouselItem>
                          <AnalyticsSummaryCard
                            clientId={clientId!}
                            type="website"
                            title="Web & E-Commerce Overview"
                            icon={<Globe className="h-5 w-5 text-emerald-500" />}
                            dateRange={dateRange}
                            customDateRange={customDateRange}
                            isActive={activeTab === "analytics"}
                          />
                        </CarouselItem>
                      )}

                      {/*
                      {hasAdsPlatform && (
                        <CarouselItem>
                          <AnalyticsSummaryCard
                            clientId={clientId!}
                            type="ads"
                            title="Ads & Campaigns Overview"
                            icon={<Target className="h-5 w-5 text-amber-500" />}
                            dateRange={dateRange}
                            customDateRange={customDateRange}
                            isActive={activeTab === "analytics"}
                          />
                        </CarouselItem>
                      )}
                      */}
                    </CarouselContent>
                    <CarouselPrevious className="flex -left-2 sm:-left-12 h-8 w-8 bg-background/80 backdrop-blur-sm border-border hover:bg-accent" />
                    <CarouselNext className="flex -right-2 sm:-right-12 h-8 w-8 bg-background/80 backdrop-blur-sm border-border hover:bg-accent" />
                  </Carousel>
                </div>
              </div>

              {/* Zone 3: Channel Drill-down Layer */}
              <div className="space-y-8 pt-4">
                <div className="flex items-center gap-3 pb-3 border-b">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <BarChart3 className="h-5 w-5 text-primary" />
                  </div>
                  <h2 className="text-2xl font-heading font-semibold tracking-tight">Channel Drill-downs</h2>
                </div>

                {/* Social Channel */}
                {hasSocialMedia && (
                  <div className="mt-8 mb-8 scroll-mt-24 bg-violet-50 dark:bg-violet-500/5 border-2 border-violet-200 dark:border-violet-500/20 rounded-3xl p-4 md:p-8 shadow-sm" id="social-media">
                    <div className="flex items-center gap-3 mb-6 pb-4 border-b border-violet-200 dark:border-violet-500/20">
                      <div className="p-2 rounded-lg bg-violet-100 dark:bg-violet-500/20"><Share2 className="h-5 w-5 text-violet-600 dark:text-violet-400" /></div>
                      <div>
                        <h3 className="font-semibold text-xl text-violet-950 dark:text-violet-100 tracking-tight">Social Media</h3>
                        <p className="text-sm text-violet-600/80 dark:text-violet-300/70 mt-1">Platform-specific metrics and audience data</p>
                      </div>
                    </div>
                    
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {/* YouTube */}
                        {(metricoolPlatforms?.some(p => p.platform === 'youtube') || connectedAccounts?.youtube || client.name === "Snarky Humans") && (
                          <Card className="hover:border-primary/40 hover:shadow-md transition-all cursor-pointer group shadow-sm bg-card/80 backdrop-blur-sm" onClick={() => router.push(`/youtube-analytics/${clientId}`)}>
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
                        {(metricoolPlatforms?.some(p => ['facebook', 'instagram'].includes(p.platform)) || connectedAccounts?.meta || client.name === "Snarky A$$ Humans") && (
                          <Card className="hover:border-primary/40 hover:shadow-md transition-all cursor-pointer group shadow-sm bg-card/80 backdrop-blur-sm" onClick={() => router.push(`/meta-analytics/${clientId}`)}>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                              <div className="flex items-center gap-3">
                                <div className="flex -space-x-2">
                                  <div className="p-2 rounded-full bg-gradient-to-tr from-yellow-400 via-red-500 to-purple-500 z-10 border-2 border-background">
                                    <Instagram className="h-3.5 w-3.5 text-white" />
                                  </div>
                                  <div className="p-2 rounded-full bg-[#1877F2] border-2 border-background">
                                    <Facebook className="h-3.5 w-3.5 text-white" />
                                  </div>
                                </div>
                                <div><CardTitle className="text-base">Meta</CardTitle></div>
                              </div>
                              <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-foreground group-hover:translate-x-1 transition-all" />
                            </CardHeader>
                            <CardContent>
                              <div className="flex justify-between items-center">
                                {connectedAccounts?.meta ? (
                                  <Badge variant="secondary" className="bg-green-500/10 text-green-600">Connected</Badge>
                                ) : (
                                  <Badge variant="outline">Connect Account</Badge>
                                )}
                              </div>
                            </CardContent>
                          </Card>
                        )}
                        {/* TikTok */}
                        {(metricoolPlatforms?.some(p => p.platform === 'tiktok') || client.name === "Snarky A$$ Humans") && (
                          <Card className="hover:border-primary/40 hover:shadow-md transition-all cursor-pointer group shadow-sm bg-card/80 backdrop-blur-sm" onClick={() => router.push(`/tiktok-metricool/${clientId}`)}>
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
                        {(client.name === "Sienvi Agency" || client.name === "Father Figure Formula") && (
                          connectedAccounts?.xHasData ? (
                            <Card className="hover:border-primary/40 hover:shadow-md transition-all cursor-pointer group shadow-sm bg-card/80 backdrop-blur-sm" onClick={() => router.push(`/x-analytics/${clientId}`)}>
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
                            <Card className="hover:border-primary/40 hover:shadow-md transition-all group shadow-sm bg-card/80 backdrop-blur-sm">
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
                          <Card className="hover:border-primary/40 hover:shadow-md transition-all cursor-pointer group shadow-sm bg-card/80 backdrop-blur-sm" onClick={() => router.push(`/linkedin-metricool/${clientId}`)}>
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
                  </div>
                )}

                {client?.name !== "Father Figure Formula" && client?.name !== "Sienvi Agency" && client?.name !== "The Haven At Deer Park" && (metricoolPlatforms?.some(p => ['meta_ads', 'google_ads', 'tiktok_ads'].includes(p.platform)) || connectedAccounts?.metaAds || getClientAdPlatforms(client.name).includes('amazon') || getClientAdPlatforms(client.name).includes('tiktok')) && (
                  <div className="mt-8 mb-8 scroll-mt-24 bg-orange-50 dark:bg-orange-500/5 border-2 border-orange-200 dark:border-orange-500/20 rounded-3xl p-4 md:p-8 shadow-sm" id="advertising">
                    <div className="flex items-center gap-3 mb-6 pb-4 border-b border-orange-200 dark:border-orange-500/20">
                      <div className="p-2 rounded-lg bg-orange-100 dark:bg-orange-500/20"><BarChart3 className="h-5 w-5 text-orange-600 dark:text-orange-400" /></div>
                      <div>
                        <h3 className="font-semibold text-xl text-orange-950 dark:text-orange-100 tracking-tight">Advertising</h3>
                        <p className="text-sm text-orange-600/80 dark:text-orange-300/70 mt-1">Campaign performance, ad spend, and conversions</p>
                      </div>
                    </div>
                    <div className="space-y-4">
                      {(() => {
                        const availableAdPlatforms: string[] = [];
                        if (metricoolPlatforms?.some(p => p.platform === 'meta_ads')) availableAdPlatforms.push('meta');
                        if (metricoolPlatforms?.some(p => p.platform === 'google_ads')) availableAdPlatforms.push('google');
                        
                        if (availableAdPlatforms.length === 0) return null;

                        return (
                          <div className="space-y-4">
                            <div className="flex flex-col sm:flex-row sm:items-center gap-4 bg-card/50 p-4 rounded-xl border border-border/50">
                              <div className="flex-1">
                                <h4 className="font-semibold text-lg flex items-center gap-2">
                                  <Target className="h-5 w-5 text-amber-500" />
                                  Ads Shredder Analysis
                                </h4>
                                <p className="text-sm text-muted-foreground mt-1">Select an ad platform to upload data and generate an AI teardown</p>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {availableAdPlatforms.map(p => {
                                  const isSelected = selectedShredderPlatforms.includes(p);
                                  return (
                                    <Button
                                      key={p}
                                      variant={isSelected ? "default" : "outline"}
                                      size="sm"
                                      onClick={() => {
                                        setSelectedShredderPlatforms(prev => 
                                          isSelected ? prev.filter(x => x !== p) : [...prev, p]
                                        );
                                      }}
                                      className="gap-2"
                                    >
                                      {AD_PLATFORM_LABELS[p as keyof typeof AD_PLATFORM_LABELS] || p}
                                    </Button>
                                  );
                                })}
                              </div>
                            </div>

                            {availableAdPlatforms.map(p => 
                              selectedShredderPlatforms.includes(p) && (
                                <AdsShredderCard 
                                  key={p}
                                  clientId={clientId!} 
                                  adPlatform={p} 
                                  title={`Ads Shredder — ${AD_PLATFORM_LABELS[p as keyof typeof AD_PLATFORM_LABELS] || p}`} 
                                  isActive={activeTab === "analytics"}
                                />
                              )
                            )}
                          </div>
                        );
                      })()}
                        {getClientAdPlatforms(client.name).includes('amazon') && (
                          <AmazonAdsReportCard
                            clientId={clientId!}
                            clientName={client.name}
                          />
                        )}
                        {(metricoolPlatforms?.some(p => p.platform === 'tiktok_ads') || getClientAdPlatforms(client.name).includes('tiktok')) && (
                          <TikTokAdsReportCard
                            clientId={clientId!}
                            clientName={client.name}
                          />
                        )}
                      </div>

                      {/* Drill down cards */}
                      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 pt-6">
                        <Card className="hover:border-primary/30 transition-all cursor-pointer group shadow-sm hover:shadow-md" onClick={() => router.push(`/ads-analytics/${clientId}`)}>
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
                  </div>
                )}

                {/* Web & E-Comm Channel */}
                {(client.supabase_url || clientGa4PropertyId || 
                  ["Snarky Pets", "Snarky Humans", "BlingyBag", "Father Figure Formula"].includes(client?.name?.trim() || "") || 
                  connectedAccounts?.substack) ? (
                  <div className="mt-8 mb-8 scroll-mt-24 bg-emerald-50 dark:bg-emerald-500/5 border-2 border-emerald-200 dark:border-emerald-500/20 rounded-3xl p-4 md:p-8 shadow-sm" id="web-ecommerce">
                    <div className="flex items-center gap-3 mb-6 pb-4 border-b border-emerald-200 dark:border-emerald-500/20">
                      <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-500/20"><Globe className="h-5 w-5 text-emerald-600 dark:text-emerald-400" /></div>
                      <div>
                        <h3 className="font-semibold text-xl text-emerald-950 dark:text-emerald-100 tracking-tight">Web & E-Commerce</h3>
                        <p className="text-sm text-emerald-600/80 dark:text-emerald-300/70 mt-1">Site traffic, sales engines, and integrations</p>
                      </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {/* Website specific */}
                        {(client.supabase_url || clientGa4PropertyId) && (
                          <Card className="hover:border-primary/40 hover:shadow-md transition-all cursor-pointer group shadow-sm bg-card/80 backdrop-blur-sm" onClick={() => router.push(`/web-analytics/${clientId}`)}>
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
                          <Card className="hover:border-primary/40 hover:shadow-md transition-all cursor-pointer group shadow-sm bg-card/80 backdrop-blur-sm" onClick={() => router.push(`/shopify-analytics/${clientId}`)}>
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

                        {/* Substack */}
                        {connectedAccounts?.substack && (
                          <Card className="hover:border-primary/40 hover:shadow-md transition-all cursor-pointer group shadow-sm bg-card/80 backdrop-blur-sm" onClick={() => router.push(`/substack-analytics/${clientId}`)}>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                              <div className="flex items-center gap-3">
                                <div className="p-2.5 rounded-xl bg-orange-500/10 group-hover:bg-orange-500/20 transition-colors">
                                  <FileText className="h-5 w-5 text-orange-500" />
                                </div>
                                <div><CardTitle className="text-base">Substack</CardTitle></div>
                              </div>
                              <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-foreground group-hover:translate-x-1 transition-all" />
                            </CardHeader>
                            <CardContent>
                              <Badge variant="secondary" className="bg-orange-500/10 text-orange-600">Active</Badge>
                            </CardContent>
                          </Card>
                        )}

                        {/* Podcasts and LMS - Father Figure Formula */}
                        {client.name === "Father Figure Formula" && (
                          <>
                            <Card className="hover:border-primary/40 hover:shadow-md transition-all cursor-pointer group shadow-sm bg-card/80 backdrop-blur-sm" onClick={() => window.open('https://podcastsconnect.apple.com/analytics', '_blank')}>
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

                            <Card className="hover:border-primary/40 hover:shadow-md transition-all cursor-pointer group shadow-sm bg-card/80 backdrop-blur-sm" onClick={() => window.open('https://creators.spotify.com/pod/show/1hkGUz3tDpJFHzmapxtSGk/analytics', '_blank')}>
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
                      

                  </div>
                ) : null}

                {/* SEO Channel (Ubersuggest) */}
                {client?.name !== "Snarky Humans" && client?.name !== "Snarky Pets" && client?.name !== "Snarky A$$ Humans" && client?.name !== "The Haven At Deer Park" && (
                  <div className="mt-8 mb-8 scroll-mt-24 bg-blue-50 dark:bg-blue-500/5 border-2 border-blue-200 dark:border-blue-500/20 rounded-3xl p-4 md:p-8 shadow-sm" id="seo">
                    <div className="flex items-center gap-3 mb-6 pb-4 border-b border-blue-200 dark:border-blue-500/20">
                      <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-500/20 flex items-center justify-center">
                         <span className="text-xl leading-none">🔍</span>
                      </div>
                      <div>
                        <h3 className="font-semibold text-xl text-blue-950 dark:text-blue-100 tracking-tight">Search Engine Optimization</h3>
                        <p className="text-sm text-blue-600/80 dark:text-blue-300/70 mt-1">Site audit score, crawl issues, and rankings</p>
                      </div>
                    </div>
                    
                    <div className="space-y-6 bg-card/50 rounded-xl p-1 md:p-4">
                      <UbersuggestSection 
                        clientId={clientId!} 
                        dateRange={dateRange} 
                        customDateRange={customDateRange} 
                        isActive={activeTab === "analytics"}
                      />
                    </div>
                  </div>
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
  const { isAdmin, isAuthenticated, signOut } = useAuth();

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
  const currentClient = clients?.find(c => c.id === currentClientId);

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
  };

  return (
    <header className="border-b border-border/40 bg-card sticky top-0 z-50 transition-colors duration-300 shadow-sm">
      <div className="container mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-6 animate-fade-in">
          {/* Static Branding */}
          <div className="flex items-center gap-3">
            {clientLogo ? (
              <div className="h-8 w-8 rounded-lg overflow-hidden border border-border/60 shadow-sm flex-shrink-0 bg-white">
                <img 
                  src={clientLogo} 
                  alt={clientName || "Client"} 
                  className="h-full w-full object-cover"
                />
              </div>
            ) : (
              <div className="h-8 w-8 rounded-lg border border-border/60 shadow-sm bg-muted flex items-center justify-center">
                 <Building2 className="h-4 w-4 text-muted-foreground stroke-[1.5]" />
              </div>
            )}
            <div className="hidden sm:flex flex-col">
              <h1 className="text-sm font-semibold tracking-tight text-foreground leading-none">
                {clientName || "Client Dashboard"}
              </h1>
            </div>
          </div>

          <div className="h-6 w-px bg-border/60 hidden sm:block mx-1" />

          <div className="flex items-center gap-2">
            {/* Primary App Shell Nav */}
            {isAdmin && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleBackClick}
                className="gap-2 h-8 px-3 font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all"
              >
                <BarChart3 className="h-4 w-4" />
                <span className="hidden sm:inline">Command Center</span>
              </Button>
            )}

            {/* Client Context */}
            {showClientSwitcher && (
              <>
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40 hidden sm:block" />
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="gap-2.5 h-8 px-3 transition-all bg-primary/5 text-primary font-semibold">
                      {currentClient?.logo_url ? (
                        <img src={currentClient.logo_url} alt={currentClient.name} className="h-4 w-4 rounded-sm object-cover ring-1 ring-border shadow-sm" />
                      ) : (
                        <Building2 className="h-4 w-4" />
                      )}
                      <span className="max-w-[150px] truncate">
                        {currentClient?.name || "Switch Client"}
                      </span>
                      <ChevronDown className="h-3.5 w-3.5 opacity-50" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-[240px] max-h-[400px] overflow-y-auto mt-1 rounded-xl shadow-lg border-border/40 p-1">
                    <DropdownMenuLabel className="text-xs uppercase tracking-wider text-muted-foreground px-3 py-2 font-semibold">Active Clients</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {clients.map((client) => (
                      <DropdownMenuItem
                        key={client.id}
                        onClick={() => handleClientSelect(client.id)}
                        className={`cursor-pointer flex items-center gap-3 px-3 py-2.5 rounded-lg mb-0.5 transition-colors ${currentClientId === client.id ? 'bg-primary/5 text-primary font-medium' : 'hover:bg-muted focus:bg-muted'}`}
                      >
                        {client.logo_url ? (
                          <img 
                            src={client.logo_url} 
                            alt={client.name} 
                            className="h-6 w-6 rounded-md object-cover ring-1 ring-border shadow-sm"
                          />
                        ) : (
                          <div className="h-6 w-6 rounded-md bg-muted flex items-center justify-center ring-1 ring-border">
                            <Building2 className="h-3 w-3 text-muted-foreground" />
                          </div>
                        )}
                        <span className="truncate">{client.name}</span>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 sm:gap-2">
          <ThemeToggle />
          {isAuthenticated && (
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={handleSignOut}
              className="h-8 w-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors ml-1"
              title="Sign Out"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
