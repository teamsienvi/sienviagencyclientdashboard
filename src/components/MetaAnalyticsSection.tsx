import { useState, useEffect } from "react";
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
import { RefreshCw, Users, TrendingUp, TrendingDown, MessageSquare, ExternalLink, Heart, Eye, Share2, Image as ImageIcon, Facebook, Instagram, CheckCircle2, Link2, Clock, AlertCircle, Unlink, ArrowUp, ArrowDown, Minus, RotateCcw } from "lucide-react";
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
import { subDays, format, startOfDay, endOfDay, formatDistanceToNow } from "date-fns";

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
  likes: number | null;
  comments: number | null;
  shares: number | null;
  interactions: number | null;
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

type DateRangePreset = "7d" | "30d" | "custom";
type MetaPlatform = "instagram" | "facebook";

const MetaAnalyticsSection = ({ clientId, clientName }: MetaAnalyticsSectionProps) => {
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
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

  const isConnected = oauthAccount !== null && oauthAccount.is_active;

  // Get the most recent Monday (start of reporting week)
  const getMostRecentMonday = (fromDate: Date = new Date()) => {
    const date = new Date(fromDate);
    const dayOfWeek = date.getDay(); // 0 = Sunday, 1 = Monday
    const daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    date.setDate(date.getDate() - daysToSubtract);
    date.setHours(0, 0, 0, 0);
    return date;
  };

  // Get current week (from most recent Monday to Sunday)
  const getDateRange = () => {
    if (dateRangePreset === "custom" && customDateRange) {
      return { start: customDateRange.start, end: customDateRange.end };
    }
    if (dateRangePreset === "30d") {
      const today = new Date();
      return { start: subDays(today, 30), end: today };
    }
    // Weekly: Monday to Sunday cycle
    const today = new Date();
    const currentMonday = getMostRecentMonday(today);
    const currentSunday = new Date(currentMonday);
    currentSunday.setDate(currentMonday.getDate() + 6);
    return { start: currentMonday, end: currentSunday };
  };

  // Get previous week (Monday to Sunday before current week)
  const getComparisonDateRange = () => {
    const { start: currentStart } = getDateRange();
    const prevMonday = subDays(currentStart, 7); // Previous Monday
    const prevSunday = subDays(currentStart, 1); // Sunday before current Monday
    return { start: prevMonday, end: prevSunday };
  };

  const handleDateRangeChange = (preset: DateRangePreset, customRange?: { start: Date; end: Date }) => {
    setDateRangePreset(preset);
    if (preset === "custom" && customRange) {
      setCustomDateRange(customRange);
    }
  };

  useEffect(() => {
    fetchData();
  }, [clientId, dateRangePreset, customDateRange]);

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

  const fetchInstagramProfile = async (accessToken: string, instagramBusinessId: string, pageId?: string | null) => {
    setLoadingProfile(true);
    try {
      const { data, error } = await supabase.functions.invoke("fetch-instagram-profile", {
        body: { accessToken, instagramBusinessId, pageId },
      });

      if (error) {
        console.error("Failed to fetch Instagram profile:", error);
        toast.error("Instagram connection needs re-authorization.");
        return null;
      }

      if (data?.needsReconnect) {
        toast.error("Meta permissions missing. Disconnect and reconnect to grant Facebook Pages access.");
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
        toast.error("Facebook connection needs re-authorization.");
        return null;
      }

      if (data?.needsReconnect) {
        toast.error("Meta permissions missing. Disconnect and reconnect to grant Facebook Pages access.");
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

    // Fetch content with metrics filtered by date range
    const { data: contentData } = await supabase
      .from("social_content")
      .select(`
        id, content_id, title, url, published_at, content_type,
        social_content_metrics(social_content_id, reach, impressions, likes, comments, shares, interactions, collected_at, period_start, period_end)
      `)
      .eq("client_id", clientId)
      .eq("platform", platform)
      .gte("published_at", startDate)
      .lte("published_at", endDate + "T23:59:59")
      .order("published_at", { ascending: false })
      .limit(50);

    const contentWithMetrics = (contentData || [])
      .filter((item: any) => item.title || item.url) // Hide posts without title or URL
      .map((item: any) => {
        const metricsList = item.social_content_metrics || [];
        const latest = metricsList
          .slice()
          .sort((a: any, b: any) => new Date(b.collected_at).getTime() - new Date(a.collected_at).getTime())[0];

        return {
          ...item,
          metrics: latest || null,
        };
      });

    return { account: accountData, metrics: metricsData, prevMetrics: prevMetricsData, content: contentWithMetrics };
  };

  // Fetch the latest report data from platform_data for comparison
  const fetchReportComparisonData = async () => {
    // Get the most recent report for this client
    const { data: latestReport } = await supabase
      .from("reports")
      .select("id, week_start, week_end")
      .eq("client_id", clientId)
      .order("week_start", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!latestReport) return;

    // Fetch platform_data for Instagram and Facebook from the latest report
    const { data: platformData } = await supabase
      .from("platform_data")
      .select("platform, engagement_rate, last_week_engagement_rate, total_content, last_week_total_content, followers, new_followers")
      .eq("report_id", latestReport.id)
      .in("platform", ["Instagram", "Facebook"]);

    if (platformData) {
      const igData = platformData.find(p => p.platform === "Instagram");
      const fbData = platformData.find(p => p.platform === "Facebook");
      
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
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const { start, end } = getDateRange();
      const { start: compStart, end: compEnd } = getComparisonDateRange();
      const startDate = format(startOfDay(start), "yyyy-MM-dd");
      const endDate = format(endOfDay(end), "yyyy-MM-dd");
      const compStartDate = format(startOfDay(compStart), "yyyy-MM-dd");
      const compEndDate = format(endOfDay(compEnd), "yyyy-MM-dd");

      // Fetch OAuth account, platform data, report comparison data, and sync logs in parallel
      const [oauth, instagramData, facebookData] = await Promise.all([
        fetchOAuthAccount(),
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

      // Fetch Instagram profile and Facebook page if we have the OAuth data
      if (oauth?.access_token) {
        if (oauth.instagram_business_id) {
          fetchInstagramProfile(oauth.access_token, oauth.instagram_business_id, oauth.page_id);
        }
        if (oauth.page_id) {
          fetchFacebookPage(oauth.access_token, oauth.page_id);
        }
      }
    } catch (error) {
      console.error("Error fetching Meta analytics:", error);
    } finally {
      setLoading(false);
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
    try {
      let periodEnd: Date;
      let periodStart: Date;

      if (syncLastWeek) {
        // Sync previous week (8-14 days ago)
        periodEnd = new Date();
        periodEnd.setDate(periodEnd.getDate() - 7);
        periodStart = new Date(periodEnd);
        periodStart.setDate(periodStart.getDate() - 7);
      } else {
        // Sync current week (0-7 days ago)
        periodEnd = new Date();
        periodStart = new Date(periodEnd);
        periodStart.setDate(periodStart.getDate() - 7);
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
        fetchData();
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

  const renderConnectionCard = () => (
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
        <CardTitle>Connect Your Meta Accounts</CardTitle>
        <CardDescription className="max-w-md mx-auto">
          Connect your Facebook Page and Instagram Business account to view analytics, 
          track engagement, and monitor your social media performance.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex justify-center pt-4">
        <Button 
          onClick={handleConnect} 
          disabled={connecting}
          size="lg"
          className="gap-2"
        >
          <Link2 className="h-4 w-4" />
          {connecting ? "Connecting..." : "Connect with Meta"}
        </Button>
      </CardContent>
    </Card>
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
    const currentLabel = `${format(currentStart, "MMM d")}-${format(currentEnd, "d")}`;
    const compLabel = `${format(compStart, "MMM d")}-${format(compEnd, "d")}`;

    // Use report data from CSV uploads for comparison (more accurate than API data)
    const reportData = platform === "instagram" ? instagramReportData : facebookReportData;
    
    // Determine which data source to use for current and comparison values
    const currentEngagement = reportData?.engagement_rate ?? metrics?.engagement_rate;
    const prevEngagement = reportData?.last_week_engagement_rate ?? prevMetrics?.engagement_rate;
    const currentTotalPosts = reportData?.total_content ?? metrics?.total_content ?? (platform === "instagram" ? instagramContent.length : facebookContent.length);
    const prevTotalPosts = reportData?.last_week_total_content ?? prevMetrics?.total_content;
    const currentFollowers = reportData?.followers ?? metrics?.followers;
    const prevFollowers = reportData?.new_followers != null && reportData?.followers != null 
      ? reportData.followers - reportData.new_followers 
      : prevMetrics?.followers;

    return (
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Users className="h-4 w-4" />
              <span className="text-sm">Followers</span>
            </div>
            <p className="text-2xl font-bold">
              {currentFollowers?.toLocaleString() || "—"}
            </p>
            {prevFollowers != null && (
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-muted-foreground">
                  vs {prevFollowers.toLocaleString()} (prev week)
                </span>
                {renderTrendIndicator(currentFollowers, prevFollowers)}
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <TrendingUp className="h-4 w-4" />
              <span className="text-sm">Engagement Rate</span>
            </div>
            <p className="text-2xl font-bold">
              {currentEngagement?.toFixed(2) || "0"}%
            </p>
            {prevEngagement != null && (
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-muted-foreground">
                  vs {prevEngagement.toFixed(2)}% (prev week)
                </span>
                {renderTrendIndicator(currentEngagement, prevEngagement, true)}
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <ImageIcon className="h-4 w-4" />
              <span className="text-sm">Total Posts</span>
            </div>
            <p className="text-2xl font-bold">
              {currentTotalPosts || "—"}
            </p>
            {prevTotalPosts != null && (
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-muted-foreground">
                  vs {prevTotalPosts} (prev week)
                </span>
                {renderTrendIndicator(currentTotalPosts, prevTotalPosts, false, true)}
              </div>
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
            <div className="group relative">
              <p className="text-xs text-muted-foreground mt-1 cursor-help underline decoration-dotted">
                vs previous week
              </p>
              <div className="absolute bottom-full left-0 mb-2 hidden group-hover:block z-10">
                <div className="bg-popover text-popover-foreground text-xs rounded-md px-3 py-2 shadow-lg border whitespace-nowrap">
                  <p>Compared to: {compLabel}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  const renderContentTable = (content: (MetaContent & { metrics?: MetaContentMetrics })[], platform: MetaPlatform) => (
    <Card>
      <CardHeader>
        <CardTitle>Recent Posts</CardTitle>
      </CardHeader>
      <CardContent>
        {content.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <ImageIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No {platform === "instagram" ? "Instagram" : "Facebook"} posts synced yet</p>
            <p className="text-sm mt-2">
              Click 'Sync' to fetch your latest posts
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Post</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>
                  <div className="flex items-center gap-1">
                    <Eye className="h-3 w-3" />
                    Reach
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
                <TableHead>
                  <div className="flex items-center gap-1">
                    <Share2 className="h-3 w-3" />
                    Shares
                  </div>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {content.map((post) => (
                <TableRow key={post.id}>
                  <TableCell className="max-w-[300px]">
                    {post.url ? (
                      <a
                        href={post.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline flex items-center gap-1"
                      >
                        <span className="truncate">
                          {post.title?.substring(0, 50) || "View Post"}
                          {post.title && post.title.length > 50 ? "..." : ""}
                        </span>
                        <ExternalLink className="h-3 w-3 flex-shrink-0" />
                      </a>
                    ) : (
                      <span className="text-muted-foreground truncate">
                        {post.title?.substring(0, 50) || "—"}
                        {post.title && post.title.length > 50 ? "..." : ""}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span title={post.content_type}>
                      {getContentTypeIcon(post.content_type)}
                    </span>
                  </TableCell>
                  <TableCell>{formatDate(post.published_at)}</TableCell>
                  <TableCell>{post.metrics?.reach?.toLocaleString() || "—"}</TableCell>
                  <TableCell>{post.metrics?.likes?.toLocaleString() || "—"}</TableCell>
                  <TableCell>{post.metrics?.comments?.toLocaleString() || "—"}</TableCell>
                  <TableCell>{post.metrics?.shares?.toLocaleString() || "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );

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
      {!instagramProfile && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-green-600 border-green-600">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Meta Connected
            </Badge>
            {loadingProfile && (
              <Badge variant="secondary" className="gap-1">
                <RefreshCw className="h-3 w-3 animate-spin" />
                Loading profile...
              </Badge>
            )}
            {oauthAccount?.instagram_business_id && !loadingProfile && (
              <Badge variant="secondary" className="gap-1">
                <Instagram className="h-3 w-3" />
                Instagram
              </Badge>
            )}
            {oauthAccount?.page_id && (
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
            <TabsTrigger value="instagram" className="flex items-center gap-2" disabled={!oauthAccount?.instagram_business_id}>
              <Instagram className="h-4 w-4" /> Instagram
            </TabsTrigger>
            <TabsTrigger value="facebook" className="flex items-center gap-2" disabled={!oauthAccount?.page_id}>
              <Facebook className="h-4 w-4" /> Facebook
            </TabsTrigger>
          </TabsList>
          
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleSync(activePlatform, true)}
                disabled={syncing}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? "animate-spin" : ""}`} />
                Sync Last Week
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleSync(activePlatform, false)}
                disabled={syncing}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? "animate-spin" : ""}`} />
                {syncing ? "Syncing..." : "Sync Now"}
              </Button>
            </div>
          </div>
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
