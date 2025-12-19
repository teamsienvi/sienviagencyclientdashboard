import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { RefreshCw, Users, TrendingUp, MessageSquare, ExternalLink, Heart, Eye, Share2, Image as ImageIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { DateRangeSelector } from "@/components/DateRangeSelector";
import { subDays, format, startOfDay, endOfDay } from "date-fns";

interface MetaAnalyticsSectionProps {
  clientId: string;
  clientName: string;
}

interface MetaAccountMetrics {
  id: string;
  followers: number | null;
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

type DateRangePreset = "7d" | "30d" | "custom";
type MetaPlatform = "instagram" | "facebook";

const MetaAnalyticsSection = ({ clientId, clientName }: MetaAnalyticsSectionProps) => {
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [activePlatform, setActivePlatform] = useState<MetaPlatform>("instagram");
  
  // Instagram data
  const [instagramMetrics, setInstagramMetrics] = useState<MetaAccountMetrics | null>(null);
  const [instagramContent, setInstagramContent] = useState<(MetaContent & { metrics?: MetaContentMetrics })[]>([]);
  const [instagramAccount, setInstagramAccount] = useState<{ id: string; account_id: string; access_token?: string } | null>(null);
  
  // Facebook data
  const [facebookMetrics, setFacebookMetrics] = useState<MetaAccountMetrics | null>(null);
  const [facebookContent, setFacebookContent] = useState<(MetaContent & { metrics?: MetaContentMetrics })[]>([]);
  const [facebookAccount, setFacebookAccount] = useState<{ id: string; account_id: string; access_token?: string } | null>(null);
  
  // Date range state
  const [dateRangePreset, setDateRangePreset] = useState<DateRangePreset>("7d");
  const [customDateRange, setCustomDateRange] = useState<{ start: Date; end: Date } | undefined>();

  const getDateRange = () => {
    const today = new Date();
    if (dateRangePreset === "custom" && customDateRange) {
      return { start: customDateRange.start, end: customDateRange.end };
    }
    const days = dateRangePreset === "30d" ? 30 : 7;
    return { start: subDays(today, days), end: today };
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

  const fetchPlatformData = async (platform: MetaPlatform, startDate: string, endDate: string) => {
    // Fetch social account
    const { data: accountData } = await supabase
      .from("social_accounts")
      .select("id, account_id")
      .eq("client_id", clientId)
      .eq("platform", platform)
      .eq("is_active", true)
      .maybeSingle();

    // Also check OAuth accounts for access token
    const { data: oauthData } = await supabase
      .from("social_oauth_accounts")
      .select("id, access_token, instagram_business_id, page_id")
      .eq("client_id", clientId)
      .eq("is_active", true)
      .maybeSingle();

    const account = accountData ? {
      ...accountData,
      access_token: oauthData?.access_token,
    } : null;

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

    // Fetch content with metrics filtered by date range
    const { data: contentData } = await supabase
      .from("social_content")
      .select(`
        id, content_id, title, url, published_at, content_type,
        social_content_metrics(social_content_id, reach, impressions, likes, comments, shares, interactions)
      `)
      .eq("client_id", clientId)
      .eq("platform", platform)
      .gte("published_at", startDate)
      .lte("published_at", endDate + "T23:59:59")
      .order("published_at", { ascending: false })
      .limit(50);

    const contentWithMetrics = contentData?.map((item: any) => ({
      ...item,
      metrics: item.social_content_metrics?.[0] || null,
    })) || [];

    return { account, metrics: metricsData, content: contentWithMetrics };
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const { start, end } = getDateRange();
      const startDate = format(startOfDay(start), "yyyy-MM-dd");
      const endDate = format(endOfDay(end), "yyyy-MM-dd");

      // Fetch both platforms in parallel
      const [instagramData, facebookData] = await Promise.all([
        fetchPlatformData("instagram", startDate, endDate),
        fetchPlatformData("facebook", startDate, endDate),
      ]);

      setInstagramAccount(instagramData.account);
      setInstagramMetrics(instagramData.metrics);
      setInstagramContent(instagramData.content);

      setFacebookAccount(facebookData.account);
      setFacebookMetrics(facebookData.metrics);
      setFacebookContent(facebookData.content);
    } catch (error) {
      console.error("Error fetching Meta analytics:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async (platform: MetaPlatform) => {
    const account = platform === "instagram" ? instagramAccount : facebookAccount;
    
    if (!account) {
      toast.error(`No ${platform === "instagram" ? "Instagram" : "Facebook"} account connected`);
      return;
    }

    // Check for OAuth token
    const { data: oauthData } = await supabase
      .from("social_oauth_accounts")
      .select("access_token, instagram_business_id, page_id")
      .eq("client_id", clientId)
      .eq("is_active", true)
      .maybeSingle();

    if (!oauthData?.access_token) {
      toast.error("No access token found. Please reconnect your Meta account.");
      return;
    }

    const externalId = platform === "instagram" 
      ? oauthData.instagram_business_id 
      : oauthData.page_id;

    if (!externalId) {
      toast.error(`No ${platform} account ID found. Please reconnect your Meta account.`);
      return;
    }

    setSyncing(true);
    try {
      const today = new Date();
      const lastWeek = new Date(today);
      lastWeek.setDate(lastWeek.getDate() - 7);

      const { data, error } = await supabase.functions.invoke("sync-meta", {
        body: {
          clientId,
          accountId: account.id,
          platform,
          accessToken: oauthData.access_token,
          accountExternalId: externalId,
          periodStart: lastWeek.toISOString().split("T")[0],
          periodEnd: today.toISOString().split("T")[0],
        },
      });

      if (error) throw error;

      if (data?.success) {
        toast.success(`Synced ${data.recordsSynced} posts from ${platform === "instagram" ? "Instagram" : "Facebook"}`);
        fetchData();
      } else {
        toast.error(data?.error || `Failed to sync ${platform} data`);
      }
    } catch (error: any) {
      console.error("Sync error:", error);
      toast.error(error.message || `Failed to sync ${platform} analytics`);
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

  const renderMetricsCards = (metrics: MetaAccountMetrics | null, platform: MetaPlatform) => (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Users className="h-4 w-4" />
            <span className="text-sm">Followers</span>
          </div>
          <p className="text-2xl font-bold">
            {metrics?.followers?.toLocaleString() || "—"}
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <TrendingUp className="h-4 w-4" />
            <span className="text-sm">Engagement Rate</span>
          </div>
          <p className="text-2xl font-bold">
            {metrics?.engagement_rate?.toFixed(2) || "0"}%
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <ImageIcon className="h-4 w-4" />
            <span className="text-sm">Total Posts</span>
          </div>
          <p className="text-2xl font-bold">
            {metrics?.total_content || (platform === "instagram" ? instagramContent.length : facebookContent.length) || "—"}
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Eye className="h-4 w-4" />
            <span className="text-sm">Period</span>
          </div>
          <p className="text-sm font-medium">
            {metrics?.period_start && metrics?.period_end
              ? `${formatDate(metrics.period_start)} - ${formatDate(metrics.period_end)}`
              : "—"}
          </p>
        </CardContent>
      </Card>
    </div>
  );

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
              {(platform === "instagram" ? instagramAccount : facebookAccount)
                ? `Click 'Sync from ${platform === "instagram" ? "Instagram" : "Facebook"}' to fetch your latest posts`
                : `Connect a ${platform === "instagram" ? "Instagram" : "Facebook"} account to see analytics`}
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

  return (
    <div className="space-y-6">
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
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="instagram" className="flex items-center gap-2">
              <span>📸</span> Instagram
            </TabsTrigger>
            <TabsTrigger value="facebook" className="flex items-center gap-2">
              <span>📘</span> Facebook
            </TabsTrigger>
          </TabsList>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleSync(activePlatform)}
            disabled={syncing}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Syncing..." : `Sync from ${activePlatform === "instagram" ? "Instagram" : "Facebook"}`}
          </Button>
        </div>

        <TabsContent value="instagram" className="space-y-6 mt-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>📸</span>
            <span>{instagramAccount ? "Account connected" : "No account connected"}</span>
          </div>
          {renderMetricsCards(instagramMetrics, "instagram")}
          {renderContentTable(instagramContent, "instagram")}
        </TabsContent>

        <TabsContent value="facebook" className="space-y-6 mt-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>📘</span>
            <span>{facebookAccount ? "Account connected" : "No account connected"}</span>
          </div>
          {renderMetricsCards(facebookMetrics, "facebook")}
          {renderContentTable(facebookContent, "facebook")}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default MetaAnalyticsSection;
