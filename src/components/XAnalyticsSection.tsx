import { useState, useEffect, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  RefreshCw, Users, TrendingUp, MessageSquare, ExternalLink, 
  Twitter, Heart, Repeat2, Eye, ArrowUp, ArrowDown, Minus,
  Calendar, Link2, MousePointerClick, Play, Upload
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { getCurrentReportingWeek, getPreviousReportingWeek, formatDateRange } from "@/utils/weeklyDateRange";
import { useAnalyticsCache, getWeekKey } from "@/hooks/useAnalyticsCache";
import { XCSVUploadDialog } from "@/components/XCSVUploadDialog";

interface XAnalyticsSectionProps {
  clientId: string;
  clientName: string;
}

interface XKPIs {
  current: {
    followers: number | null;
    newFollowers: number | null;
    engagementRate: number | null;
    totalPosts: number | null;
  };
  previous: {
    followers: number | null;
    newFollowers: number | null;
    engagementRate: number | null;
    totalPosts: number | null;
  };
  debug?: Record<string, unknown>;
}

interface XPost {
  id: string | null;
  text: string | null;
  url: string | null;
  timestamp: string | null;
  impressions: number;
  likes: number;
  reposts: number;
  replies: number;
  quotes: number;
  engagements: number;
  linkClicks: number;
  profileClicks: number;
  videoViews: number;
}

interface CachedData {
  kpis: XKPIs | null;
  posts: XPost[];
  lastSyncAt: string | null;
}

const XAnalyticsSection = ({ clientId, clientName }: XAnalyticsSectionProps) => {
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [kpis, setKpis] = useState<XKPIs | null>(null);
  const [posts, setPosts] = useState<XPost[]>([]);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [hasMetricoolConfig, setHasMetricoolConfig] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const [hasUploadedData, setHasUploadedData] = useState(false);

  // Get standardized reporting periods
  const currentWeek = useMemo(() => getCurrentReportingWeek(), []);
  const previousWeek = useMemo(() => getPreviousReportingWeek(), []);
  
  const weekKey = useMemo(
    () => getWeekKey(currentWeek.start, currentWeek.end),
    [currentWeek]
  );

  // Cache for persisting data across navigation
  const { cachedData, updateCache, hasCachedData } = useAnalyticsCache<CachedData>(
    clientId,
    "x",
    weekKey
  );

  // Format dates for API calls (YYYY-MM-DD)
  const formatApiDate = (date: Date) => format(date, "yyyy-MM-dd");

  // Check if Metricool config exists
  useEffect(() => {
    const checkConfig = async () => {
      const { data } = await supabase
        .from("client_metricool_config")
        .select("id")
        .eq("client_id", clientId)
        .eq("platform", "x")
        .eq("is_active", true)
        .maybeSingle();
      
      setHasMetricoolConfig(!!data);
    };
    checkConfig();
  }, [clientId]);

  // Load cached data on mount
  useEffect(() => {
    if (hasCachedData && cachedData) {
      setKpis(cachedData.kpis);
      setPosts(cachedData.posts);
      setLastSyncAt(cachedData.lastSyncAt);
      setLoading(false);
    }
  }, [hasCachedData, cachedData]);

  // Fetch uploaded CSV data from database (for clients without Metricool config)
  const fetchUploadedData = useCallback(async () => {
    try {
      const currentStart = formatApiDate(currentWeek.start);
      const currentEnd = formatApiDate(currentWeek.end);
      const previousStart = formatApiDate(previousWeek.start);
      const previousEnd = formatApiDate(previousWeek.end);

      // Fetch current period account metrics
      const { data: currentMetrics } = await supabase
        .from("social_account_metrics")
        .select("*")
        .eq("client_id", clientId)
        .eq("platform", "x")
        .lte("period_start", currentEnd)
        .gte("period_end", currentStart)
        .order("collected_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      // Fetch previous period account metrics
      const { data: previousMetrics } = await supabase
        .from("social_account_metrics")
        .select("*")
        .eq("client_id", clientId)
        .eq("platform", "x")
        .lte("period_start", previousEnd)
        .gte("period_end", previousStart)
        .order("collected_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      // Fetch content for current period
      const { data: content } = await supabase
        .from("social_content")
        .select("*")
        .eq("client_id", clientId)
        .eq("platform", "x")
        .order("published_at", { ascending: false });

      // Fetch content metrics
      const postsData: XPost[] = [];
      if (content && content.length > 0) {
        setHasUploadedData(true);
        
        for (const c of content) {
          const { data: metrics } = await supabase
            .from("social_content_metrics")
            .select("*")
            .eq("social_content_id", c.id)
            .order("collected_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          postsData.push({
            id: c.content_id,
            text: c.title,
            url: c.url,
            timestamp: c.published_at,
            impressions: metrics?.impressions || 0,
            likes: metrics?.likes || 0,
            reposts: metrics?.shares || 0,
            replies: metrics?.comments || 0,
            quotes: 0,
            engagements: metrics?.engagements || 0,
            linkClicks: metrics?.link_clicks || 0,
            profileClicks: metrics?.profile_visits || 0,
            videoViews: metrics?.views || 0,
          });
        }
      }

      // Build KPIs from account metrics
      if (currentMetrics || postsData.length > 0) {
        setHasUploadedData(true);
        setKpis({
          current: {
            followers: currentMetrics?.followers ?? null,
            newFollowers: currentMetrics?.new_followers ?? null,
            engagementRate: currentMetrics?.engagement_rate ?? null,
            totalPosts: currentMetrics?.total_content ?? postsData.length,
          },
          previous: {
            followers: previousMetrics?.followers ?? null,
            newFollowers: previousMetrics?.new_followers ?? null,
            engagementRate: previousMetrics?.engagement_rate ?? null,
            totalPosts: previousMetrics?.total_content ?? null,
          },
        });
        setPosts(postsData);
        setLastSyncAt(currentMetrics?.collected_at || new Date().toISOString());

        // Update cache
        updateCache({
          kpis: {
            current: {
              followers: currentMetrics?.followers ?? null,
              newFollowers: currentMetrics?.new_followers ?? null,
              engagementRate: currentMetrics?.engagement_rate ?? null,
              totalPosts: currentMetrics?.total_content ?? postsData.length,
            },
            previous: {
              followers: previousMetrics?.followers ?? null,
              newFollowers: previousMetrics?.new_followers ?? null,
              engagementRate: previousMetrics?.engagement_rate ?? null,
              totalPosts: previousMetrics?.total_content ?? null,
            },
          },
          posts: postsData,
          lastSyncAt: currentMetrics?.collected_at || new Date().toISOString(),
        });
      }
    } catch (error) {
      console.error("Error fetching uploaded data:", error);
    } finally {
      setLoading(false);
    }
  }, [clientId, currentWeek, previousWeek, updateCache]);

  // Fetch fresh data
  const fetchData = useCallback(async (showToast = false) => {
    if (!hasMetricoolConfig) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const currentStart = formatApiDate(currentWeek.start);
      const currentEnd = formatApiDate(currentWeek.end);
      const previousStart = formatApiDate(previousWeek.start);
      const previousEnd = formatApiDate(previousWeek.end);

      // Fetch KPIs and posts in parallel
      const [kpisResponse, postsResponse] = await Promise.all([
        supabase.functions.invoke("metricool-x-kpis", {
          body: { clientId, currentStart, currentEnd, previousStart, previousEnd },
        }),
        supabase.functions.invoke("metricool-x-posts", {
          body: { clientId, periodStart: currentStart, periodEnd: currentEnd },
        }),
      ]);

      if (kpisResponse.error) {
        console.error("KPIs fetch error:", kpisResponse.error);
        toast.error("Failed to fetch X KPIs");
      } else if (kpisResponse.data?.success) {
        setKpis({
          current: kpisResponse.data.current,
          previous: kpisResponse.data.previous,
          debug: kpisResponse.data.debug,
        });
      }

      if (postsResponse.error) {
        console.error("Posts fetch error:", postsResponse.error);
        toast.error("Failed to fetch X posts");
      } else if (postsResponse.data?.success) {
        setPosts(postsResponse.data.posts || []);
      }

      const syncTime = new Date().toISOString();
      setLastSyncAt(syncTime);

      // Update cache
      updateCache({
        kpis: kpisResponse.data?.success ? {
          current: kpisResponse.data.current,
          previous: kpisResponse.data.previous,
        } : null,
        posts: postsResponse.data?.posts || [],
        lastSyncAt: syncTime,
      });

      if (showToast) {
        toast.success(`Synced ${postsResponse.data?.recordsSynced || 0} X posts`);
      }
    } catch (error) {
      console.error("Error fetching X analytics:", error);
      toast.error("Failed to fetch X analytics");
    } finally {
      setLoading(false);
      setSyncing(false);
    }
  }, [clientId, currentWeek, previousWeek, hasMetricoolConfig, updateCache]);

  // Initial fetch (only if no cache)
  useEffect(() => {
    if (!hasCachedData && hasMetricoolConfig) {
      fetchData();
    } else if (!hasMetricoolConfig && !hasCachedData) {
      // Fetch uploaded CSV data from database
      fetchUploadedData();
    } else if (!hasMetricoolConfig) {
      setLoading(false);
    }
  }, [hasCachedData, hasMetricoolConfig, fetchData, fetchUploadedData]);

  const handleSync = async () => {
    setSyncing(true);
    await fetchData(true);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "Unknown date";
    
    // Handle epoch ms
    const asNum = Number(dateString);
    if (!isNaN(asNum) && asNum > 1000000000000) {
      return new Date(asNum).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    }
    
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "Unknown date";
    
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const renderTrendIndicator = (
    current: number | null | undefined,
    previous: number | null | undefined,
    isPercentage = false,
    isNumeric = false
  ) => {
    if (current == null || previous == null) return null;

    const diff = current - previous;
    const percentChange = previous !== 0 ? ((diff / previous) * 100).toFixed(1) : "0";

    if (diff > 0) {
      return (
        <div className="flex items-center text-xs text-emerald-600 dark:text-emerald-400 gap-0.5">
          <ArrowUp className="h-3 w-3" />
          <span>
            {isPercentage ? `+${diff.toFixed(2)}%` : isNumeric ? `+${diff}` : `+${percentChange}%`}
          </span>
        </div>
      );
    } else if (diff < 0) {
      return (
        <div className="flex items-center text-xs text-destructive gap-0.5">
          <ArrowDown className="h-3 w-3" />
          <span>
            {isPercentage ? `${diff.toFixed(2)}%` : isNumeric ? `${diff}` : `${percentChange}%`}
          </span>
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

  if (loading && !hasCachedData) {
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

  // If no Metricool config but we have uploaded data, show the full dashboard
  if (!hasMetricoolConfig && !hasUploadedData && posts.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Twitter className="h-5 w-5" />
            <Badge variant="secondary">Manual Upload</Badge>
          </div>
          <XCSVUploadDialog
            clientId={clientId}
            clientName={clientName}
            trigger={
              <Button variant="outline" size="sm">
                <Upload className="h-4 w-4 mr-2" />
                Upload CSV
              </Button>
            }
            onUploadComplete={() => fetchUploadedData()}
          />
        </div>
        <div className="text-center py-12">
          <Twitter className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
          <h3 className="text-lg font-medium mb-2">X Analytics Not Configured</h3>
          <p className="text-muted-foreground mb-4">
            No Metricool configuration found for X. Upload CSV data manually or set up the integration.
          </p>
        </div>
      </div>
    );
  }

  // Determine if we're in manual upload mode (no Metricool config but have data)
  const isManualMode = !hasMetricoolConfig && (hasUploadedData || posts.length > 0);

  return (
    <div className="space-y-6">
      {/* Header with period and sync button */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Twitter className="h-5 w-5" />
            <Badge variant="secondary">{isManualMode ? "Manual Upload" : "Metricool"}</Badge>
          </div>
          <Badge variant="outline" className="text-sm">
            <Calendar className="h-3 w-3 mr-1" />
            {currentWeek.dateRange}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          {lastSyncAt && (
            <span className="text-xs text-muted-foreground">
              Last sync: {formatDate(lastSyncAt)}
            </span>
          )}
          <XCSVUploadDialog
            clientId={clientId}
            clientName={clientName}
            trigger={
              <Button variant="outline" size="sm">
                <Upload className="h-4 w-4 mr-2" />
                Upload CSV
              </Button>
            }
            onUploadComplete={() => isManualMode ? fetchUploadedData() : fetchData(true)}
          />
          {!isManualMode && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleSync}
              disabled={syncing}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "Syncing..." : "Sync Data"}
            </Button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Followers */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Users className="h-4 w-4" />
              <span className="text-sm">Followers</span>
            </div>
            <p className="text-2xl font-bold">
              {kpis?.current.followers?.toLocaleString() || "—"}
            </p>
            {kpis?.previous.followers != null && kpis?.current.followers != null && (
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-muted-foreground">
                  vs {kpis.previous.followers.toLocaleString()} (prev week)
                </span>
                {renderTrendIndicator(kpis.current.followers, kpis.previous.followers, false, true)}
              </div>
            )}
            {kpis?.current.newFollowers != null && (
              <div className="text-xs text-muted-foreground mt-1">
                {kpis.current.newFollowers >= 0 ? "+" : ""}{kpis.current.newFollowers} new this week
              </div>
            )}
          </CardContent>
        </Card>

        {/* Engagement Rate */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <TrendingUp className="h-4 w-4" />
              <span className="text-sm">Engagement Rate</span>
            </div>
            <p className="text-2xl font-bold">
              {kpis?.current.engagementRate?.toFixed(2) || "0"}%
            </p>
            {kpis?.previous.engagementRate != null && kpis?.current.engagementRate != null && (
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-muted-foreground">
                  vs {kpis.previous.engagementRate.toFixed(2)}% (prev week)
                </span>
                {renderTrendIndicator(kpis.current.engagementRate, kpis.previous.engagementRate, true)}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Total Posts */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <MessageSquare className="h-4 w-4" />
              <span className="text-sm">Total Posts</span>
            </div>
            <p className="text-2xl font-bold">
              {kpis?.current.totalPosts ?? posts.length ?? "—"}
            </p>
            {kpis?.previous.totalPosts != null && (
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-muted-foreground">
                  vs {kpis.previous.totalPosts} (prev week)
                </span>
                {renderTrendIndicator(
                  kpis?.current.totalPosts ?? posts.length,
                  kpis.previous.totalPosts,
                  false,
                  true
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Period Card */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Eye className="h-4 w-4" />
              <span className="text-sm">Period</span>
            </div>
            <p className="text-sm font-medium">
              {format(currentWeek.start, "MMM d")} – {format(currentWeek.end, "MMM d, yyyy")}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              vs {previousWeek.dateRange}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Debug Panel (admin only) */}
      {kpis?.debug && (
        <div className="text-xs">
          <button
            onClick={() => setShowDebug(!showDebug)}
            className="text-muted-foreground hover:text-foreground underline"
          >
            {showDebug ? "Hide" : "Show"} API Debug
          </button>
          {showDebug && (
            <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-auto max-h-48">
              {JSON.stringify(kpis.debug, null, 2)}
            </pre>
          )}
        </div>
      )}

      {/* Recent Posts Table */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Posts</CardTitle>
        </CardHeader>
        <CardContent>
          {posts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Twitter className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No X posts found for this period</p>
              <p className="text-sm mt-2">Click "Sync Data" to fetch your latest posts</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[200px]">Post</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>
                      <div className="flex items-center gap-1">
                        <Eye className="h-3 w-3" />
                        Impressions
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
                        <Repeat2 className="h-3 w-3" />
                        Reposts
                      </div>
                    </TableHead>
                    <TableHead>
                      <div className="flex items-center gap-1">
                        <MessageSquare className="h-3 w-3" />
                        Replies
                      </div>
                    </TableHead>
                    <TableHead>
                      <div className="flex items-center gap-1">
                        <Link2 className="h-3 w-3" />
                        Link Clicks
                      </div>
                    </TableHead>
                    <TableHead>
                      <div className="flex items-center gap-1">
                        <Play className="h-3 w-3" />
                        Video Views
                      </div>
                    </TableHead>
                    <TableHead>Engagements</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {posts.map((post, idx) => (
                    <TableRow key={post.id || idx}>
                      <TableCell className="max-w-[300px]">
                        {post.url ? (
                          <a
                            href={post.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline flex items-center gap-1"
                          >
                            <span className="truncate">
                              {post.text?.substring(0, 50) || "View Post"}
                              {post.text && post.text.length > 50 ? "..." : ""}
                            </span>
                            <ExternalLink className="h-3 w-3 flex-shrink-0" />
                          </a>
                        ) : (
                          <span className="text-muted-foreground truncate">
                            {post.text?.substring(0, 50) || "—"}
                            {post.text && post.text.length > 50 ? "..." : ""}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{formatDate(post.timestamp)}</TableCell>
                      <TableCell>{post.impressions?.toLocaleString() || 0}</TableCell>
                      <TableCell>{post.likes?.toLocaleString() || 0}</TableCell>
                      <TableCell>{post.reposts?.toLocaleString() || 0}</TableCell>
                      <TableCell>{post.replies?.toLocaleString() || 0}</TableCell>
                      <TableCell>{post.linkClicks?.toLocaleString() || 0}</TableCell>
                      <TableCell>{post.videoViews?.toLocaleString() || 0}</TableCell>
                      <TableCell>{post.engagements?.toLocaleString() || 0}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default XAnalyticsSection;
