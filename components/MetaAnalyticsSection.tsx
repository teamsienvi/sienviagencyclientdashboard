import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Users, TrendingUp, TrendingDown, MessageSquare, ExternalLink, Heart, Eye, Share2, Image as ImageIcon, Facebook, Instagram, CheckCircle2, Link2, Clock, AlertCircle, Unlink, ArrowUp, ArrowDown, Minus, RotateCcw, Settings2, Info, Loader2, XCircle, ChevronDown, ChevronUp } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { supabase } from "@/integrations/supabase/client";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { DateRangeSelector } from "@/components/DateRangeSelector";
import { subDays, format, startOfDay, endOfDay, formatDistanceToNow, differenceInDays } from "date-fns";
import { getDashboardDateRange, getComparisonDateRange as getComparisonRange, formatPeriodLabel, type DateRange as DashboardDateRange } from "@/utils/dashboardDateRange";
import { MetaPageSelector } from "@/components/MetaPageSelector";
import MetaGrowthChart from "@/components/MetaGrowthChart";

interface MetaAnalyticsSectionProps {
  clientId: string;
  clientName: string;
}

interface MetaAccountMetrics {
  id: string;
  followers: number | null;
  new_followers: number | null;
  engagement_rate: number | null;
  total_content: number | null;
  period_start: string;
  period_end: string;
  collected_at: string;
}

interface MetaContent {
  id: string;
  content_id: string;
  title: string | null;
  url: string | null;
  published_at: string;
  content_type: string;
}

interface MetaContentMetrics {
  social_content_id: string;
  reach: number | null;
  impressions: number | null;
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  interactions: number | null;
  engagements: number | null;
}

interface OAuthAccount {
  id: string;
  access_token: string;
  instagram_business_id: string | null;
  page_id: string | null;
  is_active: boolean;
  platform: string;
  connected_at: string;
  token_expires_at: string;
}

interface InstagramProfile {
  username: string | null;
  name: string | null;
  profile_picture_url: string | null;
  followers_count: number | null;
  media_count: number | null;
  biography: string | null;
}

interface SyncLog {
  id: string;
  platform: string;
  status: string;
  started_at: string;
  completed_at: string | null;
  records_synced: number | null;
  error_message: string | null;
}

interface FacebookPage {
  name: string | null;
  id: string | null;
  followers_count: number | null;
  fan_count: number | null;
  picture_url: string | null;
}

type DateRangePreset = "7d" | "30d" | "60d" | "custom";
type MetaPlatform = "instagram" | "facebook";

const MetaAnalyticsSection = ({ clientId, clientName }: MetaAnalyticsSectionProps) => {
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncingContent, setSyncingContent] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [showingPageSelector, setShowingPageSelector] = useState(false);
  const [activePlatform, setActivePlatform] = useState<MetaPlatform>("instagram");

  // OAuth account data
  const [oauthAccount, setOauthAccount] = useState<OAuthAccount | null>(null);
  const [instagramProfile, setInstagramProfile] = useState<InstagramProfile | null>(null);
  const [facebookPage, setFacebookPage] = useState<FacebookPage | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);

  // Sync logs
  const [instagramSyncLog, setInstagramSyncLog] = useState<SyncLog | null>(null);
  const [facebookSyncLog, setFacebookSyncLog] = useState<SyncLog | null>(null);

  // Instagram data
  const [instagramMetrics, setInstagramMetrics] = useState<MetaAccountMetrics | null>(null);
  const [instagramPrevMetrics, setInstagramPrevMetrics] = useState<MetaAccountMetrics | null>(null);
  const [instagramContent, setInstagramContent] = useState<(MetaContent & { metrics?: MetaContentMetrics })[]>([]);
  const [instagramAccount, setInstagramAccount] = useState<{ id: string; account_id: string } | null>(null);

  // Facebook data
  const [facebookMetrics, setFacebookMetrics] = useState<MetaAccountMetrics | null>(null);
  const [facebookPrevMetrics, setFacebookPrevMetrics] = useState<MetaAccountMetrics | null>(null);
  const [facebookContent, setFacebookContent] = useState<(MetaContent & { metrics?: MetaContentMetrics })[]>([]);
  const [facebookAccount, setFacebookAccount] = useState<{ id: string; account_id: string } | null>(null);

  // Content type tab state for Posts/Reels
  const [instagramContentTab, setInstagramContentTab] = useState<"posts" | "reels">("posts");
  const [facebookContentTab, setFacebookContentTab] = useState<"posts" | "reels">("posts");

  // Date range state - weekly reports reset every Tuesday
  const [dateRangePreset, setDateRangePreset] = useState<DateRangePreset>("7d");
  const [customDateRange, setCustomDateRange] = useState<{ start: Date; end: Date } | undefined>();

  // Report-based comparison data (from CSV uploads)
  const [instagramReportData, setInstagramReportData] = useState<{
    engagement_rate: number | null;
    last_week_engagement_rate: number | null;
    total_content: number | null;
    last_week_total_content: number | null;
    followers: number | null;
    new_followers: number | null;
  } | null>(null);
  const [facebookReportData, setFacebookReportData] = useState<{
    engagement_rate: number | null;
    last_week_engagement_rate: number | null;
    total_content: number | null;
    last_week_total_content: number | null;
    followers: number | null;
    new_followers: number | null;
  } | null>(null);

  // Agency mapping state
  const [agencyMapping, setAgencyMapping] = useState<{
    page_id: string | null;
    ig_business_id: string | null;
  } | null>(null);

  // Bulk sync "in progress" banner state
  const [bulkSyncRunning, setBulkSyncRunning] = useState(false);

  // Sync details panel state
  const [syncDetailsOpen, setSyncDetailsOpen] = useState(false);

  // Metricool config state for both platforms
  const [metricoolConfig, setMetricoolConfig] = useState<{ user_id: string; blog_id: string | null } | null>(null);
  const [facebookMetricoolConfig, setFacebookMetricoolConfig] = useState<{ user_id: string; blog_id: string | null } | null>(null);
  const [syncingMetricool, setSyncingMetricool] = useState(false);
  const [syncingFacebookMetricool, setSyncingFacebookMetricool] = useState(false);

  // Metricool Overview KPIs (fetched directly from JSON API, not CSV)
  interface MetricoolOverviewKPIs {
    engagement: number | null;
    interactions: number | null;
    avgReachPerPost: number | null;
    impressions: number | null;
    postsCount: number | null;
    followers: number | null;
    engagementRate: number | null;
  }

  // Weekly data with WoW comparison
  interface TimelineDataPoint {
    dateTime: string;
    value: number;
  }

  interface FollowersDebugInfo {
    metricUsed: string;
    networkUsed: string;
    userIdUsed: string;
    blogIdUsed: string | null;
    firstPoint: { dateTime: string; value: number } | null;
    lastPoint: { dateTime: string; value: number } | null;
    pointsCount: number;
  }

  interface WeeklyData {
    followersTimeline: TimelineDataPoint[];
    engagementTimeline: TimelineDataPoint[];
    engagementAgg: number | null;
    postsCount: number | null;
    reelsCount: number | null;
    postsEngagement: number | null;
    reelsEngagement: number | null;
    followersDebug?: FollowersDebugInfo;
  }

  interface WeeklyComparison {
    current: WeeklyData;
    previous: WeeklyData;
  }

  const [instagramOverviewKPIs, setInstagramOverviewKPIs] = useState<MetricoolOverviewKPIs | null>(null);
  const [facebookOverviewKPIs, setFacebookOverviewKPIs] = useState<MetricoolOverviewKPIs | null>(null);
  const [loadingOverviewKPIs, setLoadingOverviewKPIs] = useState(false);
  const [overviewKPIsError, setOverviewKPIsError] = useState<string | null>(null);

  // Weekly comparison data for WoW display
  const [instagramWeekly, setInstagramWeekly] = useState<WeeklyComparison | null>(null);
  const [facebookWeekly, setFacebookWeekly] = useState<WeeklyComparison | null>(null);

  // Auto-hydration state
  const [isSyncing, setIsSyncing] = useState<Record<string, boolean>>({ instagram: false, facebook: false });
  const [lastSyncedAt, setLastSyncedAt] = useState<Record<string, string | null>>({ instagram: null, facebook: null });
  const syncLockRef = React.useRef<Record<string, boolean>>({ instagram: false, facebook: false });
  const [coverageFresh, setCoverageFresh] = useState<Record<string, boolean>>({ instagram: false, facebook: false });

  // isConnected is true if OAuth, agency mapping, OR Metricool config exists
  const isConnected = (oauthAccount !== null && oauthAccount.is_active) ||
    (agencyMapping !== null) ||
    (metricoolConfig !== null) ||
    (facebookMetricoolConfig !== null);
  const hasAgencyConnection = agencyMapping !== null;

  // Metricool is the primary data source when config exists
  const hasInstagramMetricool = metricoolConfig !== null;
  const hasFacebookMetricool = facebookMetricoolConfig !== null;

  // Dashboard date ranges: rolling 7d/30d (not Mon-Sun)
  const getDateRange = () => {
    return getDashboardDateRange(dateRangePreset, customDateRange ? { start: customDateRange.start, end: customDateRange.end } : undefined);
  };

  // Equal-length comparison period immediately preceding the selected period
  const getComparisonDateRange = () => {
    return getComparisonRange(getDateRange());
  };

  const handleDateRangeChange = (preset: DateRangePreset, customRange?: { start: Date; end: Date }) => {
    setDateRangePreset(preset);
    if (preset === "custom" && customRange) {
      setCustomDateRange(customRange);
    }
  };

  // Check if the selected date range is fully covered and fresh in sync_coverage
  const checkCoverageAndHydrate = async (platform: string, startDate: string, endDate: string) => {
    if (syncLockRef.current[platform]) return; // prevent duplicate
    try {
      const { data: rawCoverage } = await supabase
        .from("sync_coverage" as any)
        .select("day, feed_synced, reels_synced, feed_synced_at, reels_synced_at")
        .eq("client_id", clientId)
        .eq("platform", platform)
        .gte("day", startDate)
        .lte("day", endDate);

      const coverage = rawCoverage as any[] | null;

      const start = new Date(startDate);
      const end = new Date(endDate);
      const expectedDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      const coveredDays = coverage?.length || 0;
      const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();

      // Check if all days are covered and fresh (< 6h)
      const allFresh = coveredDays >= expectedDays && coverage!.every(c =>
        c.feed_synced && c.reels_synced &&
        c.feed_synced_at && c.feed_synced_at > sixHoursAgo &&
        c.reels_synced_at && c.reels_synced_at > sixHoursAgo
      );

      // Update last synced timestamp
      const latestSync = coverage?.reduce((latest: string | null, c: any) => {
        const ts = c.feed_synced_at || c.reels_synced_at;
        return ts && (!latest || ts > latest) ? ts : latest;
      }, null) || null;
      setLastSyncedAt(prev => ({ ...prev, [platform]: latestSync }));

      if (allFresh) {
        setCoverageFresh(prev => ({ ...prev, [platform]: true }));
        return; // data is fresh, no sync needed
      }

      setCoverageFresh(prev => ({ ...prev, [platform]: false }));

      // Queue background sync for missing/stale data
      syncLockRef.current[platform] = true;
      setIsSyncing(prev => ({ ...prev, [platform]: true }));

      const syncFn = platform === "instagram" ? "sync-metricool-instagram" : "sync-metricool-facebook";
      supabase.functions.invoke(syncFn, {
        body: { clientId, periodStart: startDate, periodEnd: endDate },
      }).then(() => {
        // Re-fetch data after sync completes
        return fetchData();
      }).catch(err => {
        console.error(`Auto-sync ${platform} error:`, err);
      }).finally(() => {
        syncLockRef.current[platform] = false;
        setIsSyncing(prev => ({ ...prev, [platform]: false }));
        setCoverageFresh(prev => ({ ...prev, [platform]: true }));
      });

    } catch (err) {
      console.error(`Coverage check error for ${platform}:`, err);
    }
  };

  useEffect(() => {
    fetchData();
  }, [clientId, dateRangePreset, customDateRange]);

  // Listen for bulk sync to show/hide banner and auto-refresh (works across tabs)
  useEffect(() => {
    const maybeRefreshFromResults = (results: any[]) => {
      const affectedClient = (results || []).find((r: any) => r.clientId === clientId && r.success);
      if (affectedClient) {
        setSyncingContent(true);
        fetchData().finally(() => {
          setSyncingContent(false);
          fetchSyncLogs();
        });
      }
    };

    const handleBulkSyncComplete = (event: CustomEvent) => {
      setBulkSyncRunning(false);
      maybeRefreshFromResults(event.detail || []);
    };

    const handleStorage = (e: StorageEvent) => {
      if (e.key !== "meta_bulk_sync" || !e.newValue) return;
      try {
        const payload = JSON.parse(e.newValue);
        if (payload?.status === "running") {
          setBulkSyncRunning(true);
        } else if (payload?.status === "completed" || payload?.status === "failed") {
          setBulkSyncRunning(false);
          if (payload?.status === "completed") {
            maybeRefreshFromResults(payload.results || []);
          }
        }
      } catch {
        // ignore
      }
    };

    // Check current sync state on mount
    try {
      const raw = localStorage.getItem("meta_bulk_sync");
      if (raw) {
        const payload = JSON.parse(raw);
        if (payload?.status === "running") {
          setBulkSyncRunning(true);
        } else if (payload?.status === "completed") {
          maybeRefreshFromResults(payload.results || []);
        }
      }
    } catch {
      // ignore
    }

    window.addEventListener("bulk-meta-sync-complete", handleBulkSyncComplete as EventListener);
    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener("bulk-meta-sync-complete", handleBulkSyncComplete as EventListener);
      window.removeEventListener("storage", handleStorage);
    };
  }, [clientId]);

  const fetchOAuthAccount = async () => {
    const { data } = await supabase
      .from("social_oauth_accounts")
      .select("id, access_token, instagram_business_id, page_id, is_active, platform, connected_at, token_expires_at")
      .eq("client_id", clientId)
      .eq("is_active", true)
      .maybeSingle();

    setOauthAccount(data);
    return data;
  };

  // Fetch agency mapping (from client_meta_map) for this client
  const fetchAgencyMapping = async () => {
    const { data } = await supabase
      .from("client_meta_map")
      .select("page_id, ig_business_id")
      .eq("client_id", clientId)
      .eq("active", true);

    if (data && data.length > 0) {
      // Combine all mappings - there might be separate FB page and IG mappings
      const combined = {
        page_id: data.find(m => m.page_id)?.page_id || null,
        ig_business_id: data.find(m => m.ig_business_id)?.ig_business_id || null,
      };
      setAgencyMapping(combined);
      return combined;
    }
    setAgencyMapping(null);
    return null;
  };

  // Fetch Metricool config for Instagram
  const fetchMetricoolConfig = async () => {
    const { data } = await supabase
      .from("client_metricool_config")
      .select("user_id, blog_id")
      .eq("client_id", clientId)
      .eq("platform", "instagram")
      .eq("is_active", true)
      .maybeSingle();

    setMetricoolConfig(data);
    return data;
  };

  // Fetch Metricool config for Facebook
  const fetchFacebookMetricoolConfig = async () => {
    const { data } = await supabase
      .from("client_metricool_config")
      .select("user_id, blog_id")
      .eq("client_id", clientId)
      .eq("platform", "facebook")
      .eq("is_active", true)
      .maybeSingle();

    setFacebookMetricoolConfig(data);
    return data;
  };

  const fetchInstagramProfile = async (accessToken: string, instagramBusinessId: string, pageId?: string | null) => {
    setLoadingProfile(true);
    try {
      const { data, error } = await supabase.functions.invoke("fetch-instagram-profile", {
        body: { accessToken, instagramBusinessId, pageId },
      });

      if (error) {
        console.error("Failed to fetch Instagram profile:", error);
        // toast.error("Instagram connection needs re-authorization.");
        return null;
      }

      if (data?.needsReconnect) {
        // toast.error("Meta permissions missing. Disconnect and reconnect to grant Facebook Pages access.");
        return null;
      }

      if (data?.profile) {
        setInstagramProfile(data.profile);
        return data.profile;
      }
      return null;
    } catch (error) {
      console.error("Error fetching Instagram profile:", error);
      toast.error("Failed to load Instagram profile.");
      return null;
    } finally {
      setLoadingProfile(false);
    }
  };

  const fetchFacebookPage = async (accessToken: string, pageId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke("fetch-facebook-page", {
        body: { accessToken, pageId },
      });

      if (error) {
        console.error("Failed to fetch Facebook page:", error);
        // toast.error("Facebook connection needs re-authorization.");
        return null;
      }

      if (data?.needsReconnect) {
        // toast.error("Meta permissions missing. Disconnect and reconnect to grant Facebook Pages access.");
        return null;
      }

      if (data?.page) {
        setFacebookPage(data.page);
        return data.page;
      }
      return null;
    } catch (error) {
      console.error("Error fetching Facebook page:", error);
      toast.error("Failed to load Facebook page profile.");
      return null;
    }
  };

  const fetchSyncLogs = async () => {
    // Fetch latest sync logs for both platforms
    const { data: instagramLog } = await supabase
      .from("social_sync_logs")
      .select("*")
      .eq("client_id", clientId)
      .eq("platform", "instagram")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: facebookLog } = await supabase
      .from("social_sync_logs")
      .select("*")
      .eq("client_id", clientId)
      .eq("platform", "facebook")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    setInstagramSyncLog(instagramLog);
    setFacebookSyncLog(facebookLog);
  };

  // Helper to find metrics for a specific period range, preferring rows with valid reach
  const findMetricsForPeriod = (metrics: any[], targetStart: string, targetEnd: string) => {
    if (!metrics || metrics.length === 0) return null;

    // Sort by collected_at descending to get most recent first
    const sorted = [...metrics].sort((a, b) =>
      new Date(b.collected_at || 0).getTime() - new Date(a.collected_at || 0).getTime()
    );

    const targetStartDate = new Date(targetStart);
    const targetEndDate = new Date(targetEnd);

    // Helper to check if metrics have valid reach (not null/0 when there's engagement)
    const hasValidReach = (m: any) => {
      const reach = m.reach;
      const hasEngagement = (m.likes || 0) + (m.comments || 0) + (m.shares || 0) > 0;
      // Valid if reach > 0, or if no engagement (0 reach is expected)
      return reach > 0 || !hasEngagement;
    };

    // 1) Exact period match with valid reach (best)
    const exactWithReach = sorted.find(m =>
      m.period_start === targetStart && m.period_end === targetEnd && hasValidReach(m)
    );
    if (exactWithReach) return exactWithReach;

    // 2) Exact period match (any)
    const exactMatch = sorted.find(m =>
      m.period_start === targetStart && m.period_end === targetEnd
    );
    if (exactMatch) return exactMatch;

    // 3) Overlapping period with valid reach
    const overlappingWithReach = sorted.find(m => {
      if (!m.period_start || !m.period_end) return false;
      const periodStart = new Date(m.period_start);
      const periodEnd = new Date(m.period_end);
      const overlaps = periodStart <= targetEndDate && periodEnd >= targetStartDate;
      return overlaps && hasValidReach(m);
    });
    if (overlappingWithReach) return overlappingWithReach;

    // 4) Overlapping period (any)
    const overlapping = sorted.find(m => {
      if (!m.period_start || !m.period_end) return false;
      const periodStart = new Date(m.period_start);
      const periodEnd = new Date(m.period_end);
      return periodStart <= targetEndDate && periodEnd >= targetStartDate;
    });
    if (overlapping) return overlapping;

    // 5) Fallback to most recent metrics
    return sorted[0];
  };

  const fetchPlatformData = async (platform: MetaPlatform, startDate: string, endDate: string, compStartDate: string, compEndDate: string) => {
    // Fetch social account
    const { data: accountData } = await supabase
      .from("social_accounts")
      .select("id, account_id")
      .eq("client_id", clientId)
      .eq("platform", platform)
      .eq("is_active", true)
      .maybeSingle();

    // Fetch latest account metrics that overlap with selected range
    const { data: metricsData } = await supabase
      .from("social_account_metrics")
      .select("*")
      .eq("client_id", clientId)
      .eq("platform", platform)
      .lte("period_start", endDate)
      .gte("period_end", startDate)
      .order("collected_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // Fetch comparison period metrics
    const { data: prevMetricsData } = await supabase
      .from("social_account_metrics")
      .select("*")
      .eq("client_id", clientId)
      .eq("platform", platform)
      .lte("period_start", compEndDate)
      .gte("period_end", compStartDate)
      .order("collected_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // Fetch ALL content for this client/platform with their metrics
    // We filter by metrics period_start/period_end instead of published_at
    const { data: contentData } = await supabase
      .from("social_content")
      .select(`
        id, content_id, title, url, published_at, content_type,
        social_content_metrics(social_content_id, reach, impressions, views, likes, comments, shares, interactions, engagements, collected_at, period_start, period_end)
      `)
      .eq("client_id", clientId)
      .eq("platform", platform)
      .order("published_at", { ascending: false });

    // Filter, deduplicate, and process content based on metrics period
    // Use a composite key for deduplication: content_id + title_hash + date
    const seenKeys = new Set<string>();
    const contentWithMetrics = (contentData || [])
      .filter((item: any) => item.title || item.url) // Hide posts without title or URL
      .filter((item: any) => {
        // Create a composite dedup key: content_id + truncated title + date
        // This catches duplicates that may have different content_ids but same content
        const titleHash = (item.title || "").substring(0, 40).trim().toLowerCase();
        const dateKey = item.published_at ? item.published_at.split("T")[0] : "";
        const compositeKey = `${item.content_id}::${titleHash}::${dateKey}`;

        if (seenKeys.has(compositeKey)) {
          return false;
        }
        seenKeys.add(compositeKey);

        // Also check for duplicate titles on the same day (different content_ids)
        const titleDateKey = `title::${titleHash}::${dateKey}`;
        if (titleHash && seenKeys.has(titleDateKey)) {
          return false;
        }
        if (titleHash) {
          seenKeys.add(titleDateKey);
        }

        return true;
      })
      .map((item: any) => {
        const metrics = findMetricsForPeriod(item.social_content_metrics, startDate, endDate);
        return {
          ...item,
          metrics: metrics || null,
        };
      })
      .filter((item: any) => {
        // Only show content published within the reporting period
        if (!item.published_at) return false;
        const publishedDate = new Date(item.published_at);
        const periodStart = new Date(startDate);
        const periodEnd = new Date(endDate);
        periodEnd.setHours(23, 59, 59, 999);
        return publishedDate >= periodStart && publishedDate <= periodEnd;
      })
      // Sort by date DESC (most recent first) as per requirement
      .sort((a: any, b: any) => {
        return new Date(b.published_at).getTime() - new Date(a.published_at).getTime();
      })
      .slice(0, 50); // Limit to 50 items

    return { account: accountData, metrics: metricsData, prevMetrics: prevMetricsData, content: contentWithMetrics };
  };

  // Fetch report data from platform_data - get the most recent weekly report
  // This ensures we always have comparison data even if there's no report for the current period
  const fetchReportComparisonData = async () => {
    // Fetch the most recent reports for this client (ordered by week_end descending)
    const { data: reports } = await supabase
      .from("reports")
      .select("id, week_start, week_end")
      .eq("client_id", clientId)
      .order("week_end", { ascending: false })
      .limit(5);

    if (!reports || reports.length === 0) return;

    // Filter to only weekly reports (7-day periods)
    const weeklyReports = reports.filter(r => {
      const start = new Date(r.week_start);
      const end = new Date(r.week_end);
      const days = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      return days >= 6 && days <= 8; // Allow for small variations
    });

    if (weeklyReports.length === 0) return;

    // Use the most recent weekly report
    const mostRecentReport = weeklyReports[0];

    const { data: platformData } = await supabase
      .from("platform_data")
      .select("report_id, platform, engagement_rate, last_week_engagement_rate, total_content, last_week_total_content, followers, new_followers")
      .eq("report_id", mostRecentReport.id)
      .in("platform", ["Instagram", "Facebook"]);

    if (!platformData) return;

    // Process Instagram data
    const igData = platformData.find(p => p.platform === "Instagram");
    if (igData) {
      setInstagramReportData({
        engagement_rate: igData.engagement_rate,
        last_week_engagement_rate: igData.last_week_engagement_rate,
        total_content: igData.total_content,
        last_week_total_content: igData.last_week_total_content,
        followers: igData.followers,
        new_followers: igData.new_followers,
      });
    }

    // Process Facebook data
    const fbData = platformData.find(p => p.platform === "Facebook");
    if (fbData) {
      setFacebookReportData({
        engagement_rate: fbData.engagement_rate,
        last_week_engagement_rate: fbData.last_week_engagement_rate,
        total_content: fbData.total_content,
        last_week_total_content: fbData.last_week_total_content,
        followers: fbData.followers,
        new_followers: fbData.new_followers,
      });
    }
  };

  // Fetch Metricool Overview KPIs directly from JSON API (not CSV)
  const fetchMetricoolOverviewKPIs = async (platform: MetaPlatform, startDate: string, endDate: string) => {
    try {
      const { data, error } = await supabase.functions.invoke("metricool-meta-overview", {
        body: {
          clientId,
          platform,
          from: startDate,
          to: endDate,
          // timezone removed — server reads from per-client config
        },
      });

      if (error) {
        console.error(`Error fetching Metricool overview for ${platform}:`, error);
        return null;
      }

      if (!data?.success) {
        console.warn(`Metricool overview failed for ${platform}:`, data?.error, data?.upstreamStatus, data?.upstreamBody);
        return null;
      }

      return data.data;
    } catch (err) {
      console.error(`Exception fetching Metricool overview for ${platform}:`, err);
      return null;
    }
  };

  const fetchData = async () => {
    setLoading(true);
    setLoadingOverviewKPIs(true);
    setOverviewKPIsError(null);
    try {
      const { start, end } = getDateRange();
      const { start: compStart, end: compEnd } = getComparisonDateRange();
      const startDate = format(startOfDay(start), "yyyy-MM-dd");
      const endDate = format(endOfDay(end), "yyyy-MM-dd");
      const compStartDate = format(startOfDay(compStart), "yyyy-MM-dd");
      const compEndDate = format(endOfDay(compEnd), "yyyy-MM-dd");

      // Fetch OAuth account, agency mapping, metricool configs and platform data in parallel
      const [oauth, agency, metricool, fbMetricool, instagramData, facebookData] = await Promise.all([
        fetchOAuthAccount(),
        fetchAgencyMapping(),
        fetchMetricoolConfig(),
        fetchFacebookMetricoolConfig(),
        fetchPlatformData("instagram", startDate, endDate, compStartDate, compEndDate),
        fetchPlatformData("facebook", startDate, endDate, compStartDate, compEndDate),
      ]);

      // Fetch sync logs and report comparison data separately (non-blocking)
      fetchSyncLogs();
      fetchReportComparisonData();

      setInstagramAccount(instagramData.account);
      setInstagramMetrics(instagramData.metrics);
      setInstagramPrevMetrics(instagramData.prevMetrics);
      setInstagramContent(instagramData.content);

      setFacebookAccount(facebookData.account);
      setFacebookMetrics(facebookData.metrics);
      setFacebookPrevMetrics(facebookData.prevMetrics);
      setFacebookContent(facebookData.content);

      // Auto-hydration: check coverage and trigger background sync if stale
      if (hasInstagramMetricool) {
        checkCoverageAndHydrate("instagram", startDate, endDate);
      }
      if (hasFacebookMetricool) {
        checkCoverageAndHydrate("facebook", startDate, endDate);
      }

      // Fetch Instagram profile and Facebook page if we have the OAuth data
      if (oauth?.access_token) {
        if (oauth.instagram_business_id) {
          fetchInstagramProfile(oauth.access_token, oauth.instagram_business_id, oauth.page_id);
        }
        if (oauth.page_id) {
          fetchFacebookPage(oauth.access_token, oauth.page_id);
        }
      }

      // Fetch Metricool Weekly comparison data (for WoW display) and Overview KPIs
      const fetchWeeklyData = async (platform: "instagram" | "facebook") => {
        try {
          const { data, error } = await supabase.functions.invoke("metricool-social-weekly", {
            body: {
              clientId,
              platform,
              from: startDate,
              to: endDate,
              prevFrom: compStartDate,
              prevTo: compEndDate,
              // timezone removed — server reads from per-client config
            },
          });

          if (error || !data?.success) {
            console.warn(`Weekly data fetch failed for ${platform}:`, error || data?.error);
            return null;
          }
          return data.data as WeeklyComparison;
        } catch (err) {
          console.error(`Exception fetching weekly data for ${platform}:`, err);
          return null;
        }
      };

      // Fetch Metricool Overview KPIs if Metricool configs exist
      if (metricool) {
        const [igKPIs, igWeekly] = await Promise.all([
          fetchMetricoolOverviewKPIs("instagram", startDate, endDate),
          fetchWeeklyData("instagram"),
        ]);
        setInstagramOverviewKPIs(igKPIs);
        setInstagramWeekly(igWeekly);
      } else {
        setInstagramOverviewKPIs(null);
        setInstagramWeekly(null);
      }

      if (fbMetricool) {
        // Fetch Facebook overview and weekly data in parallel
        const [fbOverviewResult, fbWeekly] = await Promise.all([
          supabase.functions.invoke("metricool-facebook-overview", {
            body: {
              clientId,
              from: startDate,
              to: endDate,
              // timezone removed — server reads from per-client config
            },
          }),
          fetchWeeklyData("facebook"),
        ]);

        if (fbOverviewResult.error) {
          console.error("Error fetching Facebook overview:", fbOverviewResult.error);
          setFacebookOverviewKPIs(null);
        } else if (fbOverviewResult.data?.success) {
          setFacebookOverviewKPIs(fbOverviewResult.data.data);
        } else {
          console.warn("Facebook overview failed:", fbOverviewResult.data?.error, fbOverviewResult.data?.notConfigured);
          setFacebookOverviewKPIs(null);
        }
        setFacebookWeekly(fbWeekly);
      } else {
        setFacebookOverviewKPIs(null);
        setFacebookWeekly(null);
      }
    } catch (error) {
      console.error("Error fetching Meta analytics:", error);
      setOverviewKPIsError("Failed to load analytics data");
    } finally {
      setLoading(false);
      setLoadingOverviewKPIs(false);
    }
  };

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const redirectUri = `${window.location.origin}/oauth/meta/callback`;

      const { data, error } = await supabase.functions.invoke("meta-oauth-init", {
        body: { clientId, platform: "instagram", redirectUri },
      });

      if (error) throw error;

      if (data?.authUrl) {
        window.location.href = data.authUrl;
      } else {
        toast.error("Failed to get authorization URL");
      }
    } catch (error: any) {
      console.error("Connect error:", error);
      toast.error(error.message || "Failed to connect to Meta");
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!oauthAccount?.id) return;

    setDisconnecting(true);
    try {
      const { error } = await supabase
        .from("social_oauth_accounts")
        .update({ is_active: false })
        .eq("id", oauthAccount.id);

      if (error) throw error;

      toast.success("Meta account disconnected successfully");
      setOauthAccount(null);
      setInstagramProfile(null);
      setFacebookPage(null);
      setInstagramMetrics(null);
      setFacebookMetrics(null);
      setInstagramContent([]);
      setFacebookContent([]);
    } catch (error: any) {
      console.error("Disconnect error:", error);
      toast.error(error.message || "Failed to disconnect Meta account");
    } finally {
      setDisconnecting(false);
    }
  };

  const handleReconnect = async () => {
    if (!oauthAccount?.id) return;

    setReconnecting(true);
    try {
      // Step 1: Disconnect current account
      const { error } = await supabase
        .from("social_oauth_accounts")
        .update({ is_active: false })
        .eq("id", oauthAccount.id);

      if (error) throw error;

      // Clear local state
      setOauthAccount(null);
      setInstagramProfile(null);
      setFacebookPage(null);
      setInstagramMetrics(null);
      setFacebookMetrics(null);
      setInstagramContent([]);
      setFacebookContent([]);

      // Step 2: Start new connect flow
      const redirectUri = `${window.location.origin}/oauth/meta/callback`;

      const { data, error: initError } = await supabase.functions.invoke("meta-oauth-init", {
        body: { clientId, platform: "instagram", redirectUri },
      });

      if (initError) throw initError;

      if (data?.authUrl) {
        window.location.href = data.authUrl;
      } else {
        toast.error("Failed to get authorization URL");
        setReconnecting(false);
      }
    } catch (err: any) {
      console.error("Reconnect error:", err);
      toast.error(err.message || "Failed to reconnect Meta account");
      setReconnecting(false);
    }
  };

  const handleSync = async (platform: MetaPlatform, syncLastWeek = false) => {
    if (!oauthAccount?.access_token) {
      toast.error("No access token found. Please connect your Meta account first.");
      return;
    }

    const externalId = platform === "instagram"
      ? oauthAccount.instagram_business_id
      : oauthAccount.page_id;

    if (!externalId) {
      toast.error(`No ${platform} account ID found. Please reconnect your Meta account.`);
      return;
    }

    const account = platform === "instagram" ? instagramAccount : facebookAccount;

    setSyncing(true);
    setSyncingContent(true);
    try {
      // Use the same Mon-Sun periods as the UI displays
      let periodStart: Date;
      let periodEnd: Date;

      if (syncLastWeek) {
        // Sync comparison period (the week before the reporting period)
        const compRange = getComparisonDateRange();
        periodStart = compRange.start;
        periodEnd = compRange.end;
      } else {
        // Sync current reporting period (last completed Mon-Sun)
        const currentRange = getDateRange();
        periodStart = currentRange.start;
        periodEnd = currentRange.end;
      }

      const { data, error } = await supabase.functions.invoke("sync-meta", {
        body: {
          clientId,
          accountId: account?.id,
          platform,
          accessToken: oauthAccount.access_token,
          accountExternalId: externalId,
          periodStart: periodStart.toISOString().split("T")[0],
          periodEnd: periodEnd.toISOString().split("T")[0],
        },
      });

      if (error) throw error;

      if (data?.success) {
        const weekLabel = syncLastWeek ? "last week" : "this week";
        toast.success(`Synced ${data.recordsSynced} posts from ${platform === "instagram" ? "Instagram" : "Facebook"} (${weekLabel})`);
        await fetchData();
        fetchSyncLogs();
      } else {
        toast.error(data?.error || `Failed to sync ${platform} data`);
        fetchSyncLogs();
      }
    } catch (error: any) {
      console.error("Sync error:", error);
      toast.error(error.message || `Failed to sync ${platform} analytics`);
      fetchSyncLogs();
    } finally {
      setSyncing(false);
      setSyncingContent(false);
    }
  };

  // Sync Instagram via Metricool
  const handleMetricoolSync = async () => {
    if (!metricoolConfig) {
      toast.error("No Metricool configuration found for Instagram");
      return;
    }

    setSyncingMetricool(true);
    setSyncingContent(true);
    try {
      const { start, end } = getDateRange();
      const periodStart = format(startOfDay(start), "yyyy-MM-dd");
      const periodEnd = format(endOfDay(end), "yyyy-MM-dd");

      const { data, error } = await supabase.functions.invoke("sync-metricool-instagram", {
        body: {
          clientId,
          periodStart,
          periodEnd,
        },
      });

      if (error) throw error;

      if (data?.success) {
        toast.success(`Synced ${data.recordsSynced} posts from Instagram via Metricool`);
        await fetchData();
        fetchSyncLogs();
      } else {
        toast.error(data?.error || "Failed to sync Instagram data from Metricool");
      }
    } catch (error: any) {
      console.error("Metricool sync error:", error);
      toast.error(error.message || "Failed to sync Instagram via Metricool");
    } finally {
      setSyncingMetricool(false);
      setSyncingContent(false);
    }
  };

  // Sync Facebook via Metricool
  const handleFacebookMetricoolSync = async () => {
    if (!facebookMetricoolConfig) {
      toast.error("No Metricool configuration found for Facebook");
      return;
    }

    setSyncingFacebookMetricool(true);
    setSyncingContent(true);
    try {
      const { start, end } = getDateRange();
      const periodStart = format(startOfDay(start), "yyyy-MM-dd");
      const periodEnd = format(endOfDay(end), "yyyy-MM-dd");

      const { data, error } = await supabase.functions.invoke("sync-metricool-facebook", {
        body: {
          clientId,
          periodStart,
          periodEnd,
        },
      });

      if (error) throw error;

      if (data?.success) {
        toast.success(`Synced ${data.recordsSynced} posts from Facebook via Metricool`);
        await fetchData();
        fetchSyncLogs();
      } else {
        toast.error(data?.error || "Failed to sync Facebook data from Metricool");
      }
    } catch (error: any) {
      console.error("Facebook Metricool sync error:", error);
      toast.error(error.message || "Failed to sync Facebook via Metricool");
    } finally {
      setSyncingFacebookMetricool(false);
      setSyncingContent(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const getContentTypeIcon = (type: string) => {
    switch (type) {
      case "reel":
        return "🎬";
      case "carousel":
        return "📸";
      case "story":
        return "⏱️";
      default:
        return "📷";
    }
  };

  const [showPageSelector, setShowPageSelector] = useState(true);

  const renderConnectionCard = () => (
    <div className="space-y-4">
      {/* Page Selector - try to use existing connection first */}
      {showPageSelector && (
        <MetaPageSelector
          clientId={clientId}
          clientName={clientName}
          onPageAssigned={() => {
            fetchData();
          }}
        />
      )}

      {/* Fallback: Manual OAuth connection */}
      <Card className="border-dashed">
        <CardHeader className="text-center pb-2">
          <div className="flex justify-center gap-4 mb-4">
            <div className="rounded-full bg-blue-500/10 p-4">
              <Facebook className="h-8 w-8 text-blue-500" />
            </div>
            <div className="rounded-full bg-gradient-to-br from-purple-500/10 to-pink-500/10 p-4">
              <Instagram className="h-8 w-8 text-pink-500" />
            </div>
          </div>
          <CardTitle>Or Connect a New Meta Account</CardTitle>
          <CardDescription className="max-w-md mx-auto">
            If the page you need isn't listed above, connect a new Meta account.
            This will refresh all available pages.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center pt-4">
          <Button
            onClick={handleConnect}
            disabled={connecting}
            size="lg"
            variant="outline"
            className="gap-2"
          >
            <Link2 className="h-4 w-4" />
            {connecting ? "Connecting..." : "Connect with Meta"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );

  const renderTrendIndicator = (current: number | null | undefined, previous: number | null | undefined, isPercentage = false, isNumeric = false) => {
    if (current == null || previous == null) {
      return null;
    }

    const diff = current - previous;
    const percentChange = previous !== 0 ? ((diff / previous) * 100).toFixed(1) : "0";

    if (diff > 0) {
      return (
        <div className="flex items-center text-xs text-green-500 gap-0.5">
          <ArrowUp className="h-3 w-3" />
          <span>{isPercentage ? `+${diff.toFixed(2)}%` : isNumeric ? `+${diff}` : `+${percentChange}%`}</span>
        </div>
      );
    } else if (diff < 0) {
      return (
        <div className="flex items-center text-xs text-red-500 gap-0.5">
          <ArrowDown className="h-3 w-3" />
          <span>{isPercentage ? `${diff.toFixed(2)}%` : isNumeric ? `${diff}` : `${percentChange}%`}</span>
        </div>
      );
    }

    return (
      <div className="flex items-center text-xs text-muted-foreground gap-0.5">
        <Minus className="h-3 w-3" />
        <span>{isNumeric ? "0" : "0%"}</span>
      </div>
    );
  };

  const formatComparisonValue = (current: number | null | undefined, previous: number | null | undefined, isPercentage = false) => {
    if (previous == null) return null;
    return isPercentage ? `${previous.toFixed(2)}%` : previous.toLocaleString();
  };

  const renderMetricsCards = (metrics: MetaAccountMetrics | null, prevMetrics: MetaAccountMetrics | null, platform: MetaPlatform) => {
    const { start: currentStart, end: currentEnd } = getDateRange();
    const { start: compStart, end: compEnd } = getComparisonDateRange();
    const sameMonth = currentStart.getMonth() === currentEnd.getMonth();
    const currentLabel = sameMonth
      ? `${format(currentStart, "MMM d")}-${format(currentEnd, "d")}`
      : `${format(currentStart, "MMM d")} - ${format(currentEnd, "MMM d")}`;
    const compSameMonth = compStart.getMonth() === compEnd.getMonth();
    const compLabel = compSameMonth
      ? `${format(compStart, "MMM d")}-${format(compEnd, "d")}`
      : `${format(compStart, "MMM d")} - ${format(compEnd, "MMM d")}`;

    // Get Metricool Overview KPIs and Weekly comparison data for this platform
    const overviewKPIs = platform === "instagram" ? instagramOverviewKPIs : facebookOverviewKPIs;
    const weeklyData = platform === "instagram" ? instagramWeekly : facebookWeekly;

    // Use report data from CSV uploads for comparison (more accurate than API data)
    const reportData = platform === "instagram" ? instagramReportData : facebookReportData;

    // ALWAYS use the debug.lastPoint from the edge function response for accurate followers
    // This ensures we get the exact last datapoint, matching Metricool UI
    const currentDebug = weeklyData?.current?.followersDebug;
    const prevDebug = weeklyData?.previous?.followersDebug;

    // Log debug info for verification (dev mode)
    if (currentDebug) {
      console.log(`[${platform.toUpperCase()}] Followers Debug - Current:`, {
        metric: currentDebug.metricUsed,
        network: currentDebug.networkUsed,
        userId: currentDebug.userIdUsed,
        blogId: currentDebug.blogIdUsed,
        firstPoint: currentDebug.firstPoint,
        lastPoint: currentDebug.lastPoint,
        pointsCount: currentDebug.pointsCount,
      });
    }
    if (prevDebug) {
      console.log(`[${platform.toUpperCase()}] Followers Debug - Previous:`, {
        lastPoint: prevDebug.lastPoint,
        pointsCount: prevDebug.pointsCount,
      });
    }

    // Priority: Use debug.lastPoint (most accurate) > fallback to timeline parsing > other sources
    const currentFollowersFromDebug = currentDebug?.lastPoint?.value ?? null;
    const prevFollowersFromDebug = prevDebug?.lastPoint?.value ?? null;
    // Fallback: use current period's firstPoint as "start of period" follower count
    // This ensures we show follower growth even when comparison period has no data (e.g. 30d)
    const periodStartFollowers = currentDebug?.firstPoint?.value ?? null;

    const currentFollowers = currentFollowersFromDebug ?? overviewKPIs?.followers ?? reportData?.followers ?? metrics?.followers;
    const prevFollowers = prevFollowersFromDebug ?? periodStartFollowers ?? (reportData?.new_followers != null && reportData?.followers != null
      ? reportData.followers - reportData.new_followers
      : prevMetrics?.followers);

    // Engagement from weekly aggregation (matches Metricool "Organic Summary" card)
    const currentEngagement = weeklyData?.current?.engagementAgg ?? overviewKPIs?.engagementRate ?? reportData?.engagement_rate ?? metrics?.engagement_rate;
    const prevEngagement = weeklyData?.previous?.engagementAgg ?? reportData?.last_week_engagement_rate ?? prevMetrics?.engagement_rate;

    // Posts count from weekly data
    // KPI source-of-truth: prefer local content count > API weekly > overview > report > DB metrics.
    // Use ?? (not ||) so real 0 stays 0, only true null/undefined falls through.
    const contentLen = platform === "instagram" ? instagramContent.length : facebookContent.length;
    const currentTotalPosts = contentLen > 0 ? contentLen
      : (weeklyData?.current?.postsCount ?? overviewKPIs?.postsCount ?? reportData?.total_content ?? metrics?.total_content ?? null);
    const prevTotalPosts = weeklyData?.previous?.postsCount ?? reportData?.last_week_total_content ?? prevMetrics?.total_content;

    // Helper to display value or N/A
    const displayValue = (value: number | null | undefined, formatter: (v: number) => string = (v) => v.toLocaleString()) => {
      if (value === null || value === undefined) {
        return <span className="text-muted-foreground">N/A</span>;
      }
      if (value === 0) {
        return <span className="text-muted-foreground">0</span>;
      }
      return formatter(value);
    };

    // WoW tooltip display like Metricool: "+Δ (X%)" 
    // isPercentage: for engagement rate, show % suffix on delta
    // hidePercentChange: for total posts, only show the numeric delta, no percentage
    const renderWoWTooltip = (
      current: number | null | undefined,
      previous: number | null | undefined,
      isPercentage = false,
      hidePercentChange = false
    ) => {
      if (current == null || previous == null) return null;

      const delta = current - previous;
      const pctChange = previous !== 0 ? ((delta / previous) * 100) : null;

      // Format delta
      const formatDelta = (d: number, isPct: boolean) => {
        if (isPct) {
          // For engagement rate: show +X.XX% (not pp)
          return d >= 0 ? `+${d.toFixed(2)}%` : `${d.toFixed(2)}%`;
        }
        return d >= 0 ? `+${d.toLocaleString()}` : d.toLocaleString();
      };

      // Format percentage change (for non-percentage metrics like followers)
      const formatPct = (p: number | null) => {
        if (p === null) return "";
        return ` (${p >= 0 ? "" : ""}${p.toFixed(1)}%)`;
      };

      const isPositive = delta > 0;
      const isNegative = delta < 0;
      const isNeutral = delta === 0;

      return (
        <div className="flex items-center gap-1.5 mt-1">
          <div className={`flex items-center text-xs gap-0.5 ${isPositive ? "text-green-500" : isNegative ? "text-red-500" : "text-muted-foreground"
            }`}>
            {isPositive && <ArrowUp className="h-3 w-3" />}
            {isNegative && <ArrowDown className="h-3 w-3" />}
            {isNeutral && <Minus className="h-3 w-3" />}
            <span className="font-medium">
              {formatDelta(delta, isPercentage)}
              {!isPercentage && !hidePercentChange && pctChange !== null ? formatPct(pctChange) : ""}
            </span>
          </div>
        </div>
      );
    };

    // Get content for this platform to count posts/reels as fallback
    const contentForPlatform = platform === "instagram" ? instagramContent : facebookContent;
    const postsContent = contentForPlatform.filter(c => c.content_type === "post" || c.content_type === "carousel");
    const reelsContent = contentForPlatform.filter(c => c.content_type === "reel" || c.content_type === "video");

    // Get posts/reels engagement from Metricool API (accurate data)
    const currentPostsEngagement = weeklyData?.current?.postsEngagement ?? null;
    const prevPostsEngagement = weeklyData?.previous?.postsEngagement ?? null;
    const currentReelsEngagement = weeklyData?.current?.reelsEngagement ?? null;
    const prevReelsEngagement = weeklyData?.previous?.reelsEngagement ?? null;

    // Get posts/reels counts from API, fallback to local content count
    const apiPostsCount = weeklyData?.current?.postsCount ?? postsContent.length;
    const apiReelsCount = weeklyData?.current?.reelsCount ?? reelsContent.length;
    const prevApiPostsCount = weeklyData?.previous?.postsCount ?? null;
    const prevApiReelsCount = weeklyData?.previous?.reelsCount ?? null;

    return (
      <div className="space-y-4">
        {/* KPI Cards: Followers, Engagement (Posts/Reels separated for IG), Total Posts, Reporting Period */}
        <div className={`grid grid-cols-2 gap-4 ${platform === "instagram" ? "md:grid-cols-5" : "md:grid-cols-4"}`}>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Users className="h-4 w-4" />
                <span className="text-sm">Followers</span>
              </div>
              <p className="text-2xl font-bold">
                {displayValue(currentFollowers)}
              </p>
              {prevFollowers != null && currentFollowers != null && currentFollowers >= prevFollowers && (
                <>
                  <span className="text-xs text-muted-foreground">
                    vs {prevFollowers.toLocaleString()}
                  </span>
                  {renderWoWTooltip(currentFollowers, prevFollowers)}
                </>
              )}
            </CardContent>
          </Card>

          {/* Engagement (Posts) - Raw value for Instagram */}
          {platform === "instagram" ? (
            <>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <TrendingUp className="h-4 w-4" />
                    <span className="text-sm">Engagement (Posts)</span>
                  </div>
                  <p className="text-2xl font-bold">
                    {currentPostsEngagement != null ? currentPostsEngagement.toFixed(2) : <span className="text-muted-foreground">N/A</span>}
                  </p>
                  {prevPostsEngagement != null && currentPostsEngagement != null && (
                    <>
                      <span className="text-xs text-muted-foreground">
                        vs {prevPostsEngagement.toFixed(2)}
                      </span>
                      {renderWoWTooltip(currentPostsEngagement, prevPostsEngagement, false, true)}
                    </>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <TrendingUp className="h-4 w-4" />
                    <span className="text-sm">Engagement (Reels)</span>
                  </div>
                  <p className="text-2xl font-bold">
                    {currentReelsEngagement != null ? currentReelsEngagement.toFixed(2) : <span className="text-muted-foreground">N/A</span>}
                  </p>
                  {prevReelsEngagement != null && currentReelsEngagement != null && (
                    <>
                      <span className="text-xs text-muted-foreground">
                        vs {prevReelsEngagement.toFixed(2)}
                      </span>
                      {renderWoWTooltip(currentReelsEngagement, prevReelsEngagement, false, true)}
                    </>
                  )}
                </CardContent>
              </Card>
            </>
          ) : (
            /* Facebook keeps grouped Engagement Rate card */
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 text-muted-foreground mb-2">
                  <TrendingUp className="h-4 w-4" />
                  <span className="text-sm">Engagement Rate</span>
                </div>
                <div className="space-y-3">
                  {/* Posts Engagement */}
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Posts:</span>
                    <div className="text-right">
                      <span className="text-lg font-bold">
                        {currentPostsEngagement != null ? currentPostsEngagement.toFixed(2) : <span className="text-muted-foreground text-sm">N/A</span>}
                      </span>
                      {prevPostsEngagement != null && currentPostsEngagement != null && (
                        <div className="flex items-center justify-end gap-1">
                          {renderWoWTooltip(currentPostsEngagement, prevPostsEngagement, false, true)}
                        </div>
                      )}
                    </div>
                  </div>
                  {/* Reels Engagement */}
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Reels:</span>
                    <div className="text-right">
                      <span className="text-lg font-bold">
                        {currentReelsEngagement != null ? currentReelsEngagement.toFixed(2) : <span className="text-muted-foreground text-sm">N/A</span>}
                      </span>
                      {prevReelsEngagement != null && currentReelsEngagement != null && (
                        <div className="flex items-center justify-end gap-1">
                          {renderWoWTooltip(currentReelsEngagement, prevReelsEngagement, false, true)}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <ImageIcon className="h-4 w-4" />
                <span className="text-sm">Total Content</span>
              </div>
              <p className="text-2xl font-bold">
                {displayValue(currentTotalPosts)}
              </p>
              {prevTotalPosts != null && currentTotalPosts != null && (
                <>
                  <span className="text-xs text-muted-foreground">
                    vs {prevTotalPosts}
                  </span>
                  {renderWoWTooltip(currentTotalPosts, prevTotalPosts, false, true)}
                </>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Clock className="h-4 w-4" />
                <span className="text-sm">Reporting Period</span>
              </div>
              <p className="text-lg font-semibold text-foreground">
                {currentLabel}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                vs {compLabel}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Debug: Show error if overview KPIs failed */}
        {overviewKPIsError && (
          <Alert variant="destructive" className="mt-2">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{overviewKPIsError}</AlertDescription>
          </Alert>
        )}
      </div>
    );
  };

  // Render growth chart for a platform
  const renderGrowthChart = (platform: MetaPlatform) => {
    const weeklyData = platform === "instagram" ? instagramWeekly : facebookWeekly;
    const overviewKPIs = platform === "instagram" ? instagramOverviewKPIs : facebookOverviewKPIs;
    const reportData = platform === "instagram" ? instagramReportData : facebookReportData;
    const content = platform === "instagram" ? instagramContent : facebookContent;
    const metrics = platform === "instagram" ? instagramMetrics : facebookMetrics;

    // Get followers timeline from weekly data
    const followersTimeline = weeklyData?.current?.followersTimeline ?? [];

    // Get current followers from debug lastPoint (most accurate)
    const currentDebug = weeklyData?.current?.followersDebug;
    const prevDebug = weeklyData?.previous?.followersDebug;
    const currentFollowers = currentDebug?.lastPoint?.value ?? overviewKPIs?.followers ?? reportData?.followers ?? metrics?.followers ?? null;
    const prevFollowers = prevDebug?.lastPoint?.value ?? null;
    const newFollowers = currentFollowers != null && prevFollowers != null
      ? currentFollowers - prevFollowers
      : (reportData?.new_followers ?? null);

    // Total content count
    const totalContent = content.length > 0 ? content.length
      : (weeklyData?.current?.postsCount ?? overviewKPIs?.postsCount ?? reportData?.total_content ?? null);

    // Only render if we have timeline data
    if (followersTimeline.length === 0) {
      return null;
    }

    return (
      <MetaGrowthChart
        followersTimeline={followersTimeline}
        currentFollowers={currentFollowers}
        newFollowers={newFollowers}
        totalContent={totalContent}
        platform={platform}
      />
    );
  };

  // Build a valid URL for a post
  const buildPostUrl = (post: MetaContent, platform: MetaPlatform): string | null => {
    // If we have a direct URL, use it
    if (post.url && (post.url.startsWith("http://") || post.url.startsWith("https://"))) {
      return post.url;
    }

    // Try to build URL from content_id
    if (post.content_id) {
      // Instagram URLs
      if (platform === "instagram") {
        // Instagram post IDs are typically numeric
        const cleanId = post.content_id.replace(/^ig_/, "").replace(/[^a-zA-Z0-9_-]/g, "");
        if (cleanId) {
          // Try shortcode-based URL (most common)
          return `https://www.instagram.com/p/${cleanId}/`;
        }
      }
      // Facebook URLs
      if (platform === "facebook") {
        const cleanId = post.content_id.replace(/^fb_/, "").replace(/[^a-zA-Z0-9_-]/g, "");
        if (cleanId) {
          return `https://www.facebook.com/${cleanId}`;
        }
      }
    }

    return null;
  };

  const renderContentTable = (content: (MetaContent & { metrics?: MetaContentMetrics })[], platform: MetaPlatform) => {
    // Filter content by type
    const contentTab = platform === "instagram" ? instagramContentTab : facebookContentTab;
    const setContentTab = platform === "instagram" ? setInstagramContentTab : setFacebookContentTab;

    // Determine what constitutes "posts" vs "reels" based on platform
    // IG: reel = reel, post = post/carousel
    // FB: reel = video, post = post
    const isReel = (type: string) => type === "reel" || type === "video";
    const isPost = (type: string) => type === "post" || type === "carousel";

    const filteredContent = content.filter(item => {
      if (contentTab === "reels") {
        return isReel(item.content_type);
      }
      return isPost(item.content_type);
    });

    const postsCount = content.filter(item => isPost(item.content_type)).length;
    const reelsCount = content.filter(item => isReel(item.content_type)).length;

    // Platform-specific column headers
    // IG Posts: Impressions, Organic Reach
    // IG Reels: Organic Views, Reach
    // FB Posts: Views, Reach
    // FB Reels: Video Views, Reach
    const getViewsHeader = () => {
      if (platform === "instagram") {
        return contentTab === "reels" ? "Organic Views" : "Impressions";
      }
      return contentTab === "reels" ? "Video Views" : "Views";
    };

    const getReachHeader = () => {
      if (platform === "instagram") {
        return "Organic Reach";
      }
      return "Reach";
    };

    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              Recent Content
              {syncingContent && (
                <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
              )}
            </CardTitle>
            <Tabs value={contentTab} onValueChange={(v) => setContentTab(v as "posts" | "reels")}>
              <TabsList className="h-8">
                <TabsTrigger value="posts" className="text-xs px-3 py-1">
                  📷 Posts ({postsCount})
                </TabsTrigger>
                <TabsTrigger value="reels" className="text-xs px-3 py-1">
                  🎬 Reels ({reelsCount})
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardHeader>
        <CardContent>
          {syncingContent ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-4 w-[200px]" />
                  <Skeleton className="h-4 w-[60px]" />
                  <Skeleton className="h-4 w-[80px]" />
                  <Skeleton className="h-4 w-[60px]" />
                  <Skeleton className="h-4 w-[60px]" />
                  <Skeleton className="h-4 w-[60px]" />
                </div>
              ))}
            </div>
          ) : filteredContent.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <ImageIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No {platform === "instagram" ? "Instagram" : "Facebook"} {contentTab} synced yet</p>
              <p className="text-sm mt-2">
                Click 'Sync' to fetch your latest content
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Content</TableHead>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>
                    <div className="flex items-center gap-1">
                      <Eye className="h-3 w-3" />
                      {getViewsHeader()}
                    </div>
                  </TableHead>
                  <TableHead>
                    <div className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {getReachHeader()}
                    </div>
                  </TableHead>
                  <TableHead>
                    <div className="flex items-center gap-1">
                      <Heart className="h-3 w-3" />
                      Likes
                    </div>
                  </TableHead>
                  <TableHead>
                    <div className="flex items-center gap-1">
                      <MessageSquare className="h-3 w-3" />
                      Comments
                    </div>
                  </TableHead>
                  {platform === "instagram" ? (
                    <TableHead>Saved</TableHead>
                  ) : (
                    <TableHead>
                      <div className="flex items-center gap-1">
                        <Share2 className="h-3 w-3" />
                        Shares
                      </div>
                    </TableHead>
                  )}
                  <TableHead>
                    <div className="flex items-center gap-1">
                      <TrendingUp className="h-3 w-3" />
                      Interactions
                    </div>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredContent.map((post) => {
                  // Build a valid URL for the post
                  const postUrl = buildPostUrl(post, platform);
                  const displayTitle = post.title?.substring(0, 50) || "View Post";
                  const truncatedTitle = post.title && post.title.length > 50 ? displayTitle + "..." : displayTitle;

                  return (
                    <TableRow key={post.id}>
                      <TableCell className="max-w-[250px]">
                        {postUrl ? (
                          <a
                            href={postUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline flex items-center gap-1"
                          >
                            <span className="truncate">{truncatedTitle}</span>
                            <ExternalLink className="h-3 w-3 flex-shrink-0" />
                          </a>
                        ) : (
                          <span className="text-foreground truncate" title={post.title || undefined}>
                            {truncatedTitle !== "View Post" ? truncatedTitle : "—"}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs">{formatDate(post.published_at)}</TableCell>
                      <TableCell>
                        {(() => {
                          // Views/Impressions based on platform and content type
                          const views = post.metrics?.views || post.metrics?.impressions;
                          return views ? views.toLocaleString() : "—";
                        })()}
                      </TableCell>
                      <TableCell>
                        {(() => {
                          const reach = post.metrics?.reach;
                          const impressions = post.metrics?.impressions;
                          const likes = post.metrics?.likes || 0;
                          const comments = post.metrics?.comments || 0;
                          const shares = post.metrics?.shares || 0;
                          const hasEngagement = likes > 0 || comments > 0 || shares > 0;

                          // For Facebook, fallback to impressions if reach is 0/null
                          if (platform === "facebook" && (reach === 0 || reach == null) && impressions && impressions > 0) {
                            return impressions.toLocaleString();
                          }

                          if ((reach === 0 || reach == null) && hasEngagement) {
                            return (
                              <span className="text-muted-foreground cursor-help" title="Reach unavailable">
                                N/A
                              </span>
                            );
                          }
                          return reach?.toLocaleString() || "—";
                        })()}
                      </TableCell>
                      <TableCell>{post.metrics?.likes?.toLocaleString() || "—"}</TableCell>
                      <TableCell>{post.metrics?.comments?.toLocaleString() || "—"}</TableCell>
                      {platform === "instagram" ? (
                        <TableCell>
                          {/* Saved - calculate from engagements minus likes/comments/shares */}
                          {(() => {
                            const engagements = post.metrics?.engagements || 0;
                            const likes = post.metrics?.likes || 0;
                            const comments = post.metrics?.comments || 0;
                            const shares = post.metrics?.shares || 0;
                            // Saved = engagements - likes - comments - shares (approximate)
                            const saved = Math.max(0, engagements - likes - comments - shares);
                            return saved > 0 ? saved.toLocaleString() : "—";
                          })()}
                        </TableCell>
                      ) : (
                        <TableCell>{post.metrics?.shares?.toLocaleString() || "—"}</TableCell>
                      )}
                      <TableCell>
                        {(() => {
                          const interactions = post.metrics?.engagements || 0;
                          return interactions > 0 ? interactions.toLocaleString() : "—";
                        })()}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    );
  };

  // Render sync details panel
  const renderSyncDetailsPanel = () => {
    const currentLog = activePlatform === "instagram" ? instagramSyncLog : facebookSyncLog;

    if (!currentLog) return null;

    const isRunning = currentLog.status === "running" || currentLog.status === "in_progress";
    const isFailed = currentLog.status === "failed";
    const isCompleted = currentLog.status === "completed";

    return (
      <Collapsible open={syncDetailsOpen} onOpenChange={setSyncDetailsOpen}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-foreground">
            <Info className="h-4 w-4" />
            Last sync details
            {syncDetailsOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-2">
          <div className="rounded-lg border bg-muted/30 p-4 text-sm space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Status</span>
              <div className="flex items-center gap-1.5">
                {isRunning && <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-500" />}
                {isCompleted && <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />}
                {isFailed && <XCircle className="h-3.5 w-3.5 text-destructive" />}
                <span className={
                  isRunning ? "text-blue-500" :
                    isCompleted ? "text-green-500" :
                      isFailed ? "text-destructive" : ""
                }>
                  {currentLog.status}
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Started</span>
              <span>{formatDistanceToNow(new Date(currentLog.started_at), { addSuffix: true })}</span>
            </div>
            {currentLog.completed_at && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Completed</span>
                <span>{formatDistanceToNow(new Date(currentLog.completed_at), { addSuffix: true })}</span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Records synced</span>
              <span>{currentLog.records_synced ?? 0}</span>
            </div>
            {currentLog.error_message && (
              <div className="mt-2 p-2 rounded bg-destructive/10 text-destructive text-xs">
                {currentLog.error_message}
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    );
  };

  // Render bulk sync banner
  const renderBulkSyncBanner = () => {
    if (!bulkSyncRunning) return null;

    return (
      <Alert className="border-blue-500/50 bg-blue-500/5">
        <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
        <AlertDescription className="text-blue-600 dark:text-blue-400">
          Sync in progress… Data will refresh automatically when complete.
        </AlertDescription>
      </Alert>
    );
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <Skeleton className="h-4 w-20 mb-2" />
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card>
          <CardContent className="pt-6">
            <Skeleton className="h-64 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show connection card if not connected
  if (!isConnected) {
    return renderConnectionCard();
  }

  return (
    <div className="space-y-6">
      {/* Bulk sync in-progress banner */}
      {renderBulkSyncBanner()}
      {/* Connected Account Card */}
      {instagramProfile && (
        <Card className="bg-gradient-to-r from-purple-500/5 to-pink-500/5 border-purple-200/50 dark:border-purple-800/50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              {instagramProfile.profile_picture_url ? (
                <img
                  src={instagramProfile.profile_picture_url}
                  alt={instagramProfile.username || "Profile"}
                  className="h-16 w-16 rounded-full object-cover ring-2 ring-pink-500/30"
                />
              ) : (
                <div className="h-16 w-16 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                  <Instagram className="h-8 w-8 text-white" />
                </div>
              )}
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-lg">{instagramProfile.name || instagramProfile.username}</h3>
                  <Badge variant="outline" className="text-green-600 border-green-600">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Connected
                  </Badge>
                </div>
                {instagramProfile.username && (
                  <a
                    href={`https://instagram.com/${instagramProfile.username}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-pink-500 transition-colors flex items-center gap-1"
                  >
                    @{instagramProfile.username}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
                {instagramProfile.biography && (
                  <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{instagramProfile.biography}</p>
                )}
              </div>
              <div className="hidden sm:flex gap-6 text-center">
                <div>
                  <p className="text-2xl font-bold">{instagramProfile.followers_count?.toLocaleString() || "—"}</p>
                  <p className="text-xs text-muted-foreground">Followers</p>
                </div>
                <div>
                  <p className="text-2xl font-bold">{instagramProfile.media_count?.toLocaleString() || "—"}</p>
                  <p className="text-xs text-muted-foreground">Posts</p>
                </div>
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive">
                    <Unlink className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Disconnect Meta Account?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will disconnect <strong>{instagramProfile.name || instagramProfile.username}</strong> from {clientName}.
                      You can reconnect a different account afterwards.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDisconnect}
                      disabled={disconnecting}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      {disconnecting ? "Disconnecting..." : "Disconnect"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Connected Facebook Page Card */}
      {facebookPage && (
        <Card className="bg-gradient-to-r from-blue-500/5 to-blue-600/5 border-blue-200/50 dark:border-blue-800/50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              {facebookPage.picture_url ? (
                <img
                  src={facebookPage.picture_url}
                  alt={facebookPage.name || "Page"}
                  className="h-16 w-16 rounded-full object-cover ring-2 ring-blue-500/30"
                />
              ) : (
                <div className="h-16 w-16 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                  <Facebook className="h-8 w-8 text-white" />
                </div>
              )}
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-lg">{facebookPage.name}</h3>
                  <Badge variant="outline" className="text-green-600 border-green-600">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Connected
                  </Badge>
                </div>
                <a
                  href={`https://facebook.com/${facebookPage.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-blue-500 transition-colors flex items-center gap-1"
                >
                  View Page
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
              <div className="hidden sm:flex gap-6 text-center">
                <div>
                  <p className="text-2xl font-bold">{(facebookPage.followers_count || facebookPage.fan_count)?.toLocaleString() || "—"}</p>
                  <p className="text-xs text-muted-foreground">Followers</p>
                </div>
                <div>
                  <p className="text-2xl font-bold">{facebookContent.length || "—"}</p>
                  <p className="text-xs text-muted-foreground">Posts</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Connection Status Badges */}
      {!instagramProfile && isConnected && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-green-600 border-green-600">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              {hasAgencyConnection ? "Agency Connected" : "Meta Connected"}
            </Badge>
            {loadingProfile && (
              <Badge variant="secondary" className="gap-1">
                <RefreshCw className="h-3 w-3 animate-spin" />
                Loading profile...
              </Badge>
            )}
            {(oauthAccount?.instagram_business_id || agencyMapping?.ig_business_id) && !loadingProfile && (
              <Badge variant="secondary" className="gap-1">
                <Instagram className="h-3 w-3" />
                Instagram
              </Badge>
            )}
            {(oauthAccount?.page_id || agencyMapping?.page_id) && (
              <Badge variant="secondary" className="gap-1">
                <Facebook className="h-3 w-3" />
                Facebook
              </Badge>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => setShowingPageSelector(!showingPageSelector)}
            >
              <Settings2 className="h-4 w-4" />
              {showingPageSelector ? "Hide Pages" : "Change Page"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={handleReconnect}
              disabled={reconnecting}
            >
              <RotateCcw className={`h-4 w-4 ${reconnecting ? "animate-spin" : ""}`} />
              {reconnecting ? "Reconnecting..." : "Reconnect Meta"}
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" className="text-muted-foreground hover:text-destructive gap-2">
                  <Unlink className="h-4 w-4" />
                  Disconnect
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Disconnect Meta Account?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will disconnect the Meta account from {clientName}.
                    You can reconnect a different account afterwards.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDisconnect}
                    disabled={disconnecting}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {disconnecting ? "Disconnecting..." : "Disconnect"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      )}

      {/* Page Selector - shown when "Change Page" is clicked */}
      {showingPageSelector && isConnected && (
        <MetaPageSelector
          clientId={clientId}
          clientName={clientName}
          onPageAssigned={() => {
            setShowingPageSelector(false);
            fetchData();
          }}
        />
      )}

      {/* Header with date range */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <DateRangeSelector
          value={dateRangePreset}
          onChange={handleDateRangeChange}
          customRange={customDateRange}
        />
      </div>

      {/* Platform Tabs */}
      <Tabs value={activePlatform} onValueChange={(v) => setActivePlatform(v as MetaPlatform)}>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <TabsList>
            <TabsTrigger
              value="instagram"
              className="flex items-center gap-2"
              disabled={!oauthAccount?.instagram_business_id && !agencyMapping?.ig_business_id && !metricoolConfig}
            >
              <Instagram className="h-4 w-4" /> Instagram
            </TabsTrigger>
            <TabsTrigger
              value="facebook"
              className="flex items-center gap-2"
              disabled={!oauthAccount?.page_id && !agencyMapping?.page_id && !facebookMetricoolConfig}
            >
              <Facebook className="h-4 w-4" /> Facebook
            </TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-3">
            {/* Metricool sync button for Instagram */}
            {activePlatform === "instagram" && metricoolConfig && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleMetricoolSync}
                disabled={syncingMetricool}
                className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 border-purple-200/50 hover:from-purple-500/20 hover:to-pink-500/20"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${syncingMetricool ? "animate-spin" : ""}`} />
                {syncingMetricool ? "Syncing..." : "Sync via Metricool"}
              </Button>
            )}

            {/* Metricool sync button for Facebook */}
            {activePlatform === "facebook" && facebookMetricoolConfig && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleFacebookMetricoolSync}
                disabled={syncingFacebookMetricool}
                className="bg-gradient-to-r from-blue-500/10 to-blue-600/10 border-blue-200/50 hover:from-blue-500/20 hover:to-blue-600/20"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${syncingFacebookMetricool ? "animate-spin" : ""}`} />
                {syncingFacebookMetricool ? "Syncing..." : "Sync via Metricool"}
              </Button>
            )}
          </div>
          {/* Sync Details Panel */}
          {renderSyncDetailsPanel()}
        </div>

        <TabsContent value="instagram" className="space-y-6 mt-4">
          {renderMetricsCards(instagramMetrics, instagramPrevMetrics, "instagram")}
          {renderContentTable(instagramContent, "instagram")}
        </TabsContent>

        <TabsContent value="facebook" className="space-y-6 mt-4">
          {renderMetricsCards(facebookMetrics, facebookPrevMetrics, "facebook")}
          {renderContentTable(facebookContent, "facebook")}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default MetaAnalyticsSection;
