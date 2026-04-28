import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Users,
  BarChart3,
  PlayCircle,
  Loader2,
  Eye,
  Clock,
  ThumbsUp,
  MessageCircle,
  Share2,
  CalendarIcon,
  ExternalLink,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, subDays, subMonths, parseISO, startOfDay } from "date-fns";
import { cn } from "@/lib/utils";
import { getCurrentReportingWeek, getPreviousReportingWeek } from "@/utils/weeklyDateRange";
import { format as formatDate } from "date-fns";
import { AllTimeTopPostsModal } from "@/components/AllTimeTopPostsModal";
import { useSyncState } from "@/hooks/useSyncState";

interface YouTubeStats {
  followers: number;
  newFollowers: number;
  prevFollowers: number;
  followerChangePercent: number;
  totalVideos: number;
  totalViews: number;
  totalLikes: number;
  totalComments: number;
  totalShares: number;
  avgViewDuration: number;
  engagementRate: number;
  // Previous period stats for WoW comparison
  prevTotalViews: number;
  prevTotalLikes: number;
  prevTotalComments: number;
  prevTotalShares: number;
  prevTotalVideos: number;
  prevEngagementRate: number;
  prevAvgViewDuration: number;
}

interface VideoData {
  id: string;
  title: string | null;
  url: string | null;
  content_type: string;
  published_at: string;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  avg_view_duration: number;
  watch_time_hours: number;
  engagement_rate: number;
}

type DateRange = "7d" | "30d" | "custom";

interface YouTubeAnalyticsSectionProps {
  clientId: string;
  clientName: string;
  channelHandle?: string;
}

const YouTubeAnalyticsSection = ({ clientId, clientName, channelHandle: propChannelHandle }: YouTubeAnalyticsSectionProps) => {
  const [isSyncing, setIsSyncing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState<YouTubeStats | null>(null);
  const [videos, setVideos] = useState<VideoData[]>([]);
  const [dateRange, setDateRange] = useState<DateRange>("7d");
  const [customDateRange, setCustomDateRange] = useState<{
    from: Date | undefined;
    to: Date | undefined;
  }>({ from: undefined, to: undefined });
  
  const syncState = useSyncState(clientId, "youtube", "youtube");
  const [reportingPeriodLabel, setReportingPeriodLabel] = useState<string>("");

  const computeEngagementRate = (
    likes: number,
    comments: number,
    shares: number,
    views: number
  ): number => {
    if (views === 0) return 0;
    return ((likes + comments + shares) / views) * 100;
  };

  const getDateRangeFilter = (): { start: Date; end: Date } => {
    const now = new Date();
    switch (dateRange) {
      case "7d":
        return { start: subDays(now, 7), end: now };
      case "30d":
        return { start: subMonths(now, 1), end: now };
      case "custom":
        return {
          start: customDateRange.from || subDays(now, 7),
          end: customDateRange.to || now,
        };
      default:
        return { start: subDays(now, 7), end: now };
    }
  };

  const getPrevPeriodLabel = () => {
    if (dateRange === "30d") return "prev 30 days";
    if (dateRange === "custom") return "prev period";
    return "prev week";
  };

  // Custom metricool fetch logic removed. useSyncState orchestrates this on backend.

  // Fetch from database (fallback)
  const fetchDatabaseData = async () => {
    const currentWeek = getCurrentReportingWeek();
    const previousWeek = getPreviousReportingWeek();

    let startStr: string;
    let endStr: string;
    let prevStartStr: string;
    let prevEndStr: string;

    if (dateRange === "7d") {
      startStr = formatDate(currentWeek.start, 'yyyy-MM-dd');
      endStr = formatDate(currentWeek.end, 'yyyy-MM-dd');
      prevStartStr = formatDate(previousWeek.start, 'yyyy-MM-dd');
      prevEndStr = formatDate(previousWeek.end, 'yyyy-MM-dd');
      setReportingPeriodLabel(currentWeek.dateRange);
    } else {
      const { start, end } = getDateRangeFilter();
      startStr = format(start, 'yyyy-MM-dd');
      endStr = format(end, 'yyyy-MM-dd');
      setReportingPeriodLabel(`${format(start, 'MMM d')} - ${format(end, 'MMM d')}`);

      const periodDuration = end.getTime() - start.getTime();
      const prevStart = new Date(start.getTime() - periodDuration);
      const prevEnd = new Date(start.getTime() - 1);
      prevStartStr = format(prevStart, 'yyyy-MM-dd');
      prevEndStr = format(prevEnd, 'yyyy-MM-dd');
    }

    // Fetch the MOST RECENT account metrics (regardless of period)
    // This ensures we always get the latest subscriber count
    const { data: latestMetrics } = await supabase
      .from("social_account_metrics")
      .select("*")
      .eq("client_id", clientId)
      .eq("platform", "youtube")
      .order("collected_at", { ascending: false })
      .limit(2);

    // Latest record is current, second-latest is previous (for comparison)
    const currentFollowers = latestMetrics?.[0]?.followers || 0;
    const previousFollowers = latestMetrics?.[1]?.followers || latestMetrics?.[0]?.followers || 0;
    const newFollowers = currentFollowers - previousFollowers;
    const followerChangePercent = previousFollowers > 0
      ? ((newFollowers / previousFollowers) * 100)
      : 0;

    // Fetch content with metrics
    const { data: allContentData } = await supabase
      .from("social_content")
      .select(`
        id,
        title,
        url,
        content_type,
        published_at,
        social_content_metrics (
          views,
          likes,
          comments,
          shares,
          watch_time_hours,
          period_start,
          period_end,
          collected_at
        )
      `)
      .eq("client_id", clientId)
      .eq("platform", "youtube")
      .order("published_at", { ascending: false });

    const findMetricsForPeriod = (metrics: any[], targetStart: string, targetEnd: string) => {
      if (!metrics || metrics.length === 0) return null;
      const sorted = [...metrics].sort((a, b) =>
        new Date(b.collected_at || 0).getTime() - new Date(a.collected_at || 0).getTime()
      );
      const exactMatch = sorted.find(m =>
        m.period_start === targetStart && m.period_end === targetEnd
      );
      if (exactMatch) return exactMatch;
      const targetStartDate = new Date(targetStart);
      const targetEndDate = new Date(targetEnd);
      const overlapping = sorted.find(m => {
        if (!m.period_start || !m.period_end) return false;
        const periodStart = new Date(m.period_start);
        const periodEnd = new Date(m.period_end);
        return periodStart <= targetEndDate && periodEnd >= targetStartDate;
      });
      if (overlapping) return overlapping;
      // Do NOT fall back to sorted[0] — that returns all-time data
      return null;
    };

    let totalViews = 0;
    let totalLikes = 0;
    let totalComments = 0;
    let totalShares = 0;
    let prevTotalViews = 0;
    let prevTotalLikes = 0;
    let prevTotalComments = 0;
    let prevTotalShares = 0;
    let prevVideoCount = 0;
    const videoList: VideoData[] = [];

    allContentData?.forEach((content: any) => {
      const metrics = findMetricsForPeriod(content.social_content_metrics, startStr, endStr);

      // Only include videos that have metrics for this period (with any activity)
      const views = metrics?.views || 0;
      const likes = metrics?.likes || 0;
      const comments = metrics?.comments || 0;
      const shares = metrics?.shares || 0;
      const watchTimeHours = metrics?.watch_time_hours || 0;
      const contentType = content.content_type || "video";

      // Include all videos for the period (even zero-engagement ones)
      totalViews += views;
      totalLikes += likes;
      totalComments += comments;
      totalShares += shares;

      // Only include videos published within the reporting period
      if (content.published_at && content.published_at < startStr) return;

      videoList.push({
        id: content.id,
        title: content.title,
        url: content.url,
        content_type: contentType,
        published_at: content.published_at,
        views,
        likes,
        comments,
        shares,
        avg_view_duration: 0,
        watch_time_hours: watchTimeHours,
        engagement_rate: computeEngagementRate(likes, comments, shares, views),
      });
    });

    allContentData?.forEach((content: any) => {
      const metrics = findMetricsForPeriod(content.social_content_metrics, prevStartStr, prevEndStr);
      if (metrics) {
        prevTotalViews += metrics.views || 0;
        prevTotalLikes += metrics.likes || 0;
        prevTotalComments += metrics.comments || 0;
        prevTotalShares += metrics.shares || 0;
        prevVideoCount++;
      }
    });

    const prevEngagementRate = computeEngagementRate(prevTotalLikes, prevTotalComments, prevTotalShares, prevTotalViews);

    setVideos(videoList);
    setStats({
      followers: currentFollowers,
      newFollowers,
      prevFollowers: previousFollowers,
      followerChangePercent,
      totalVideos: videoList.length,
      totalViews,
      totalLikes,
      totalComments,
      totalShares,
      avgViewDuration: 0,
      engagementRate: computeEngagementRate(totalLikes, totalComments, totalShares, totalViews),
      prevTotalViews,
      prevTotalLikes,
      prevTotalComments,
      prevTotalShares,
      prevTotalVideos: prevVideoCount,
      prevEngagementRate,
      prevAvgViewDuration: 0,
    });
  };

  const fetchYouTubeData = async () => {
    if (!clientId) return;

    try {
      setIsLoading(true);
      await fetchDatabaseData();
    } catch (err: any) {
      console.error("Error fetching YouTube data:", err);
      toast.error("Failed to load YouTube data");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!syncState.isSyncing || syncState.isDegraded) {
      fetchYouTubeData();
    }
  }, [clientId, dateRange, customDateRange.from, customDateRange.to, syncState.isSyncing, syncState.isDegraded]);

  const handleSyncYouTube = async () => {
    syncState.retry();
  };

  const getTypeBadgeColor = (type: string) => {
    const lowerType = type.toLowerCase();
    if (lowerType === "short") return "bg-pink-500 text-white";
    if (lowerType === "video") return "bg-red-500 text-white";
    return "bg-secondary text-secondary-foreground";
  };

  // Helper to calculate change and percent
  const calcWoW = (current: number, prev: number) => {
    const delta = current - prev;
    const percent = prev > 0 ? (delta / prev) * 100 : 0;
    return { delta, percent };
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1 bg-muted p-1 rounded-lg">
          {(["7d", "30d"] as const).map((range) => (
            <Button
              key={range}
              variant={dateRange === range ? "default" : "ghost"}
              size="sm"
              onClick={() => setDateRange(range)}
              className="text-xs"
            >
              {range === "7d" ? "7 Days" : "30 Days"}
            </Button>
          ))}
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant={dateRange === "custom" ? "default" : "ghost"}
                size="sm"
                className="text-xs"
              >
                <CalendarIcon className="h-3 w-3 mr-1" />
                Custom
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="range"
                selected={{
                  from: customDateRange.from,
                  to: customDateRange.to,
                }}
                onSelect={(range) => {
                  setCustomDateRange({ from: range?.from, to: range?.to });
                  if (range?.from && range?.to) {
                    setDateRange("custom");
                  }
                }}
                numberOfMonths={2}
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>
        </div>

        <div className="flex items-center gap-2">
          <AllTimeTopPostsModal clientId={clientId} platformFilter="youtube" buttonLabel="All-Time Top 3" />
          <Button onClick={handleSyncYouTube} disabled={syncState.isSyncing} size="sm">
            {syncState.isSyncing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-1" />
                Refresh
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {/* Subscribers Card */}
            <Card className="bg-card">
              <CardContent className="pt-5 pb-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Users className="h-4 w-4" />
                  <span className="text-xs">Subscribers</span>
                </div>
                <p className="text-2xl font-bold">{stats.followers.toLocaleString()}</p>
                {stats.newFollowers > 0 && (
                  <div className={cn(
                    "text-xs font-medium flex items-center gap-1 mt-1",
                    "text-green-500"
                  )}>
                    <TrendingUp className="h-3 w-3" />
                    <span>
                      +{stats.newFollowers.toLocaleString()}
                      {stats.followerChangePercent > 0 && (
                        <> ({stats.followerChangePercent.toFixed(2)}%)</>
                      )}
                    </span>
                  </div>
                )}
                {stats.prevFollowers > 0 && stats.newFollowers >= 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    vs {stats.prevFollowers.toLocaleString()} {getPrevPeriodLabel()}
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Views Card */}
            <Card className="bg-card">
              <CardContent className="pt-5 pb-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Eye className="h-4 w-4" />
                  <span className="text-xs">{dateRange === "7d" ? "Weekly Views" : "Views"}</span>
                </div>
                <p className="text-2xl font-bold">{stats.totalViews.toLocaleString()}</p>
                {(() => {
                  const { delta, percent } = calcWoW(stats.totalViews, stats.prevTotalViews);
                  if (delta !== 0) {
                    return (
                      <div className={cn(
                        "text-xs font-medium flex items-center gap-1 mt-1",
                        delta > 0 ? "text-green-500" : "text-red-500"
                      )}>
                        {delta > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                        <span>
                          {delta > 0 ? "+" : ""}{delta.toLocaleString()}
                          {stats.prevTotalViews > 0 && <> ({percent.toFixed(2)}%)</>}
                        </span>
                      </div>
                    );
                  }
                  return null;
                })()}
                {stats.prevTotalViews > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    vs {stats.prevTotalViews.toLocaleString()} {getPrevPeriodLabel()}
                  </p>
                )}
                {reportingPeriodLabel && (
                  <p className="text-xs text-muted-foreground mt-1">{reportingPeriodLabel}</p>
                )}
              </CardContent>
            </Card>

            {/* Engagement Card */}
            <Card className="bg-card">
              <CardContent className="pt-5 pb-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <BarChart3 className="h-4 w-4" />
                  <span className="text-xs">{dateRange === "7d" ? "Weekly Engagement" : "Engagement"}</span>
                </div>
                <p className="text-2xl font-bold">{stats.engagementRate.toFixed(2)}%</p>
                {(() => {
                  const { delta } = calcWoW(stats.engagementRate, stats.prevEngagementRate);
                  if (stats.prevEngagementRate > 0) {
                    return (
                      <div className={cn(
                        "text-xs font-medium flex items-center gap-1 mt-1",
                        delta >= 0 ? "text-green-500" : "text-red-500"
                      )}>
                        {delta >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                        <span>
                          {delta >= 0 ? "+" : ""}{delta.toFixed(2)}%
                        </span>
                      </div>
                    );
                  }
                  return null;
                })()}
                {stats.prevEngagementRate > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    vs {stats.prevEngagementRate.toFixed(2)}% {getPrevPeriodLabel()}
                  </p>
                )}
                {reportingPeriodLabel && (
                  <p className="text-xs text-muted-foreground mt-1">{reportingPeriodLabel}</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Engagement Breakdown */}
          <div className="grid grid-cols-4 gap-4">
            <Card className="bg-muted/30">
              <CardContent className="py-4 text-center">
                <ThumbsUp className="h-4 w-4 mx-auto mb-1 text-blue-500" />
                <p className="text-lg font-semibold">{stats.totalLikes.toLocaleString()}</p>
                {(() => {
                  const { delta } = calcWoW(stats.totalLikes, stats.prevTotalLikes);
                  if (delta !== 0) {
                    return (
                      <span className={cn(
                        "text-xs font-medium flex items-center justify-center",
                        delta > 0 ? "text-green-500" : "text-red-500"
                      )}>
                        {delta > 0 ? "+" : ""}{delta.toLocaleString()}
                      </span>
                    );
                  }
                  return null;
                })()}
                <p className="text-xs text-muted-foreground">Likes</p>
              </CardContent>
            </Card>
            <Card className="bg-muted/30">
              <CardContent className="py-4 text-center">
                <MessageCircle className="h-4 w-4 mx-auto mb-1 text-green-500" />
                <p className="text-lg font-semibold">{stats.totalComments.toLocaleString()}</p>
                {(() => {
                  const { delta } = calcWoW(stats.totalComments, stats.prevTotalComments);
                  if (delta !== 0) {
                    return (
                      <span className={cn(
                        "text-xs font-medium flex items-center justify-center",
                        delta > 0 ? "text-green-500" : "text-red-500"
                      )}>
                        {delta > 0 ? "+" : ""}{delta.toLocaleString()}
                      </span>
                    );
                  }
                  return null;
                })()}
                <p className="text-xs text-muted-foreground">Comments</p>
              </CardContent>
            </Card>
            <Card className="bg-muted/30">
              <CardContent className="py-4 text-center">
                <Share2 className="h-4 w-4 mx-auto mb-1 text-purple-500" />
                <p className="text-lg font-semibold">{stats.totalShares.toLocaleString()}</p>
                {(() => {
                  const { delta } = calcWoW(stats.totalShares, stats.prevTotalShares);
                  if (delta !== 0) {
                    return (
                      <span className={cn(
                        "text-xs font-medium flex items-center justify-center",
                        delta > 0 ? "text-green-500" : "text-red-500"
                      )}>
                        {delta > 0 ? "+" : ""}{delta.toLocaleString()}
                      </span>
                    );
                  }
                  return null;
                })()}
                <p className="text-xs text-muted-foreground">Shares</p>
              </CardContent>
            </Card>
            <Card className="bg-muted/30">
              <CardContent className="py-4 text-center">
                <PlayCircle className="h-4 w-4 mx-auto mb-1 text-red-500" />
                <p className="text-lg font-semibold">{stats.totalVideos}</p>
                {(() => {
                  const delta = stats.totalVideos - stats.prevTotalVideos;
                  if (delta !== 0) {
                    return (
                      <span className={cn(
                        "text-xs font-medium flex items-center justify-center",
                        delta > 0 ? "text-green-500" : "text-red-500"
                      )}>
                        {delta > 0 ? "+" : ""}{delta}
                      </span>
                    );
                  }
                  return null;
                })()}
                <p className="text-xs text-muted-foreground">Videos</p>
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {/* Video Table */}
      <Card>
        <CardContent className="p-0">
          <div className="p-4 border-b border-border">
            <h3 className="font-semibold">Video Performance</h3>
          </div>
          {videos.length === 0 ? (
            <div className="p-8 text-center">
              <PlayCircle className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-muted-foreground">No videos found</p>
              <p className="text-xs text-muted-foreground mt-1">Try refreshing or selecting a different date range</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead>Type</TableHead>
                  <TableHead className="w-[280px]">Video</TableHead>
                  <TableHead className="text-right">Views</TableHead>
                  <TableHead className="text-right">Likes</TableHead>
                  <TableHead className="text-right">Comments</TableHead>
                  <TableHead className="text-right">Shares</TableHead>
                  <TableHead className="text-right">Avg Duration</TableHead>
                  <TableHead className="text-right">Engagement</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {videos.slice(0, 25).map((video) => (
                  <TableRow key={video.id}>
                    <TableCell>
                      <Badge className={getTypeBadgeColor(video.content_type)}>
                        {video.content_type.charAt(0).toUpperCase() + video.content_type.slice(1).toLowerCase()}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div>
                        {video.url ? (
                          <a
                            href={video.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-medium text-sm line-clamp-1 text-primary hover:underline flex items-center gap-1"
                          >
                            {video.title || "Untitled"}
                            <ExternalLink className="h-3 w-3 flex-shrink-0" />
                          </a>
                        ) : (
                          <p className="font-medium text-sm line-clamp-1">
                            {video.title || "Untitled"}
                          </p>
                        )}
                        {video.published_at && (
                          <p className="text-xs text-muted-foreground">
                            {format(parseISO(video.published_at), "MMM d, yyyy")}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {video.views.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                      {video.likes.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                      {video.comments.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                      {video.shares.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                      {video.avg_view_duration > 0
                        ? `${Math.floor(video.avg_view_duration / 60)}:${String(Math.floor(video.avg_view_duration % 60)).padStart(2, '0')}`
                        : "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge
                        variant="secondary"
                        className={cn(
                          video.engagement_rate >= 5
                            ? "bg-green-500/20 text-green-600"
                            : video.engagement_rate >= 2
                              ? "bg-yellow-500/20 text-yellow-600"
                              : "bg-muted text-muted-foreground"
                        )}
                      >
                        {video.engagement_rate.toFixed(2)}%
                      </Badge>
                    </TableCell>
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

export default YouTubeAnalyticsSection;
