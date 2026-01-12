import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
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
import { RefreshCw, Users, TrendingUp, TrendingDown, MessageSquare, ExternalLink, Twitter, Heart, Repeat2, Eye, ArrowUp, ArrowDown, Minus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { DateRangeSelector } from "@/components/DateRangeSelector";
import { subDays, format, startOfDay, endOfDay } from "date-fns";
import { ANALYTICS_PERIOD } from "@/utils/analyticsPeriod";

interface XAnalyticsSectionProps {
  clientId: string;
  clientName: string;
}

interface XAccountMetrics {
  id: string;
  followers: number | null;
  engagement_rate: number | null;
  total_content: number | null;
  period_start: string;
  period_end: string;
  collected_at: string;
}

interface XPrevMetrics {
  followers: number | null;
  engagement_rate: number | null;
  total_content: number | null;
}

interface XContent {
  id: string;
  content_id: string;
  title: string | null;
  url: string | null;
  published_at: string;
  content_type: string;
}

interface XContentMetrics {
  social_content_id: string;
  impressions: number | null;
  engagements: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
}

type DateRangePreset = "7d" | "30d" | "custom";

const XAnalyticsSection = ({ clientId, clientName }: XAnalyticsSectionProps) => {
  const [searchParams] = useSearchParams();
  const didInitFromQuery = useRef(false);

  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [accountMetrics, setAccountMetrics] = useState<XAccountMetrics | null>(null);
  const [prevMetrics, setPrevMetrics] = useState<XPrevMetrics | null>(null);
  const [content, setContent] = useState<(XContent & { metrics?: XContentMetrics })[]>([]);
  const [socialAccount, setSocialAccount] = useState<{ id: string; account_id: string } | null>(null);

  // Date range state
  const [dateRangePreset, setDateRangePreset] = useState<DateRangePreset>("7d");
  const [customDateRange, setCustomDateRange] = useState<{ start: Date; end: Date } | undefined>();

  useEffect(() => {
    if (didInitFromQuery.current) return;

    const start = searchParams.get("start");
    const end = searchParams.get("end");

    if (start && end) {
      const startDate = new Date(start);
      const endDate = new Date(end);
      if (!Number.isNaN(startDate.getTime()) && !Number.isNaN(endDate.getTime())) {
        setDateRangePreset("custom");
        setCustomDateRange({ start: startDate, end: endDate });
      }
    }

    didInitFromQuery.current = true;
  }, [searchParams]);

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

  // Helper to find metrics for a specific period range
  const findMetricsForPeriod = (metrics: any[], targetStart: string, targetEnd: string) => {
    if (!metrics || metrics.length === 0) return null;
    
    // Sort by collected_at descending to get most recent first
    const sorted = [...metrics].sort((a, b) => 
      new Date(b.collected_at || 0).getTime() - new Date(a.collected_at || 0).getTime()
    );
    
    // First try to find exact period match
    const exactMatch = sorted.find(m => 
      m.period_start === targetStart && m.period_end === targetEnd
    );
    if (exactMatch) return exactMatch;
    
    // Then try to find overlapping period
    const targetStartDate = new Date(targetStart);
    const targetEndDate = new Date(targetEnd);
    
    const overlapping = sorted.find(m => {
      if (!m.period_start || !m.period_end) return false;
      const periodStart = new Date(m.period_start);
      const periodEnd = new Date(m.period_end);
      // Check if periods overlap
      return periodStart <= targetEndDate && periodEnd >= targetStartDate;
    });
    if (overlapping) return overlapping;
    
    // Fallback to most recent metrics
    return sorted[0];
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const { start, end } = getDateRange();
      const startDate = format(startOfDay(start), "yyyy-MM-dd");
      const endDate = format(endOfDay(end), "yyyy-MM-dd");

      // Calculate previous period for comparison
      const periodDuration = end.getTime() - start.getTime();
      const prevStart = new Date(start.getTime() - periodDuration);
      const prevEnd = new Date(start.getTime() - 1); // Day before current period starts
      const prevStartDate = format(startOfDay(prevStart), "yyyy-MM-dd");
      const prevEndDate = format(endOfDay(prevEnd), "yyyy-MM-dd");

      // Fetch social account for X
      const { data: accountData } = await supabase
        .from("social_accounts")
        .select("id, account_id")
        .eq("client_id", clientId)
        .eq("platform", "x")
        .eq("is_active", true)
        .maybeSingle();

      setSocialAccount(accountData);

      // Fetch latest account metrics - get most recent that overlaps with selected range
      const { data: metricsData } = await supabase
        .from("social_account_metrics")
        .select("*")
        .eq("client_id", clientId)
        .eq("platform", "x")
        .lte("period_start", endDate)
        .gte("period_end", startDate)
        .order("collected_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      setAccountMetrics(metricsData);

      // Fetch previous period metrics for comparison
      const { data: prevMetricsData } = await supabase
        .from("social_account_metrics")
        .select("*")
        .eq("client_id", clientId)
        .eq("platform", "x")
        .lte("period_start", prevEndDate)
        .gte("period_end", prevStartDate)
        .order("collected_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      setPrevMetrics(prevMetricsData ? {
        followers: prevMetricsData.followers,
        engagement_rate: prevMetricsData.engagement_rate,
        total_content: prevMetricsData.total_content,
      } : null);

      // Fetch ALL content for this client/platform with their metrics
      // We filter by metrics period_start/period_end instead of published_at
      const { data: contentData } = await supabase
        .from("social_content")
        .select(`
          id, content_id, title, url, published_at, content_type,
          social_content_metrics(social_content_id, impressions, engagements, likes, comments, shares, period_start, period_end, collected_at)
        `)
        .eq("client_id", clientId)
        .eq("platform", "x")
        .order("published_at", { ascending: false });

      if (contentData) {
        // Filter and process content based on metrics period
        const contentWithMetrics = contentData
          .map((item: any) => {
            const metrics = findMetricsForPeriod(item.social_content_metrics, startDate, endDate);
            return {
              ...item,
              metrics: metrics || null,
            };
          })
          .filter((item: any) => item.metrics !== null) // Only show content with metrics in the period
          .slice(0, 50); // Limit to 50 items
        
        setContent(contentWithMetrics);
      }
    } catch (error) {
      console.error("Error fetching X analytics:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    if (!socialAccount) {
      toast.error("No X account connected for this client");
      return;
    }

    setSyncing(true);
    try {
      // Sync both current and previous periods for comparison
      const periods = [
        { start: ANALYTICS_PERIOD.start, end: ANALYTICS_PERIOD.end },
        { start: ANALYTICS_PERIOD.prevStart, end: ANALYTICS_PERIOD.prevEnd },
      ];

      let totalSynced = 0;
      for (const period of periods) {
        const { data, error } = await supabase.functions.invoke("sync-x", {
          body: {
            clientId,
            accountId: socialAccount.id,
            accountExternalId: socialAccount.account_id,
            periodStart: period.start,
            periodEnd: period.end,
          },
        });

        if (error) throw error;
        if (data?.success) {
          totalSynced += data.recordsSynced || 0;
        } else {
          toast.error(data?.error || "Failed to sync X data");
          return;
        }
      }

      toast.success(`Synced ${totalSynced} posts from X (current + previous week)`);
      fetchData();
    } catch (error: any) {
      console.error("Sync error:", error);
      toast.error(error.message || "Failed to sync X analytics");
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
  const renderTrendIndicator = (current: number | null | undefined, previous: number | null | undefined, isPercentage = false, isNumeric = false) => {
    if (current == null || previous == null) return null;
    
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

  return (
    <div className="space-y-6">
      {/* Header with date range and sync button */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Twitter className="h-5 w-5" />
            <span className="text-sm text-muted-foreground">
              {socialAccount ? "Account connected" : "No account connected"}
            </span>
          </div>
          <DateRangeSelector
            value={dateRangePreset}
            onChange={handleDateRangeChange}
            customRange={customDateRange}
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleSync}
          disabled={syncing || !socialAccount}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? "animate-spin" : ""}`} />
          {syncing ? "Syncing..." : "Sync from X"}
        </Button>
      </div>

      {/* Account Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Users className="h-4 w-4" />
              <span className="text-sm">Followers</span>
            </div>
            <p className="text-2xl font-bold">
              {accountMetrics?.followers?.toLocaleString() || "—"}
            </p>
            {prevMetrics?.followers != null && accountMetrics?.followers != null && (
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-muted-foreground">
                  vs {prevMetrics.followers.toLocaleString()} (prev week)
                </span>
                {renderTrendIndicator(accountMetrics.followers, prevMetrics.followers, false, true)}
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
              {accountMetrics?.engagement_rate?.toFixed(2) || "0"}%
            </p>
            {prevMetrics?.engagement_rate != null && accountMetrics?.engagement_rate != null && (
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-muted-foreground">
                  vs {prevMetrics.engagement_rate.toFixed(2)}% (prev week)
                </span>
                {renderTrendIndicator(accountMetrics.engagement_rate, prevMetrics.engagement_rate, true)}
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <MessageSquare className="h-4 w-4" />
              <span className="text-sm">Total Posts</span>
            </div>
            <p className="text-2xl font-bold">
              {accountMetrics?.total_content || content.length || "—"}
            </p>
            {prevMetrics?.total_content != null && (
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-muted-foreground">
                  vs {prevMetrics.total_content} (prev week)
                </span>
                {renderTrendIndicator(accountMetrics?.total_content || content.length, prevMetrics.total_content, false, true)}
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Eye className="h-4 w-4" />
              <span className="text-sm">Period</span>
            </div>
            <p className="text-sm font-medium">
              {accountMetrics?.period_start && accountMetrics?.period_end
                ? `${formatDate(accountMetrics.period_start)} - ${formatDate(accountMetrics.period_end)}`
                : "—"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">vs previous period</p>
          </CardContent>
        </Card>
      </div>

      {/* Content Table */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Posts</CardTitle>
        </CardHeader>
        <CardContent>
          {content.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Twitter className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No X posts synced yet</p>
              <p className="text-sm mt-2">
                {socialAccount
                  ? "Click 'Sync from X' to fetch your latest posts"
                  : "Connect an X account to see analytics"}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Post</TableHead>
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
                      <MessageSquare className="h-3 w-3" />
                      Replies
                    </div>
                  </TableHead>
                  <TableHead>
                    <div className="flex items-center gap-1">
                      <Repeat2 className="h-3 w-3" />
                      Reposts
                    </div>
                  </TableHead>
                  <TableHead>Engagements</TableHead>
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
                    <TableCell>{formatDate(post.published_at)}</TableCell>
                    <TableCell>{post.metrics?.impressions?.toLocaleString() || "—"}</TableCell>
                    <TableCell>{post.metrics?.likes?.toLocaleString() || "—"}</TableCell>
                    <TableCell>{post.metrics?.comments?.toLocaleString() || "—"}</TableCell>
                    <TableCell>{post.metrics?.shares?.toLocaleString() || "—"}</TableCell>
                    <TableCell>{post.metrics?.engagements?.toLocaleString() || "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default XAnalyticsSection;
