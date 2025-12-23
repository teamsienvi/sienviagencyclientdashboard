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
import { ANALYTICS_PERIOD } from "@/utils/analyticsPeriod";

interface YouTubeStats {
  followers: number;
  newFollowers: number;
  totalVideos: number;
  totalViews: number;
  totalLikes: number;
  totalComments: number;
  totalShares: number;
  avgRetentionRate: number;
  engagementRate: number;
  // Previous period stats for comparison
  prevTotalViews: number;
  prevTotalLikes: number;
  prevTotalComments: number;
  prevTotalShares: number;
  prevTotalVideos: number;
  prevEngagementRate: number;
  prevAvgRetentionRate: number;
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

type DateRange = "today" | "7d" | "30d" | "custom";

interface YouTubeAnalyticsSectionProps {
  clientId: string;
  clientName: string;
  channelHandle?: string; // Optional YouTube channel handle (e.g., "@FatherFigureFormula")
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

  const computeEngagementRate = (
    likes: number,
    comments: number,
    shares: number,
    views: number,
    newSubscribers: number = 0
  ): number => {
    if (views === 0) return 0;
    return ((likes + comments + shares + Math.abs(newSubscribers)) / views) * 100;
  };

  const getDateRangeFilter = (): { start: Date; end: Date } => {
    const now = new Date();
    switch (dateRange) {
      case "today":
        return { start: startOfDay(now), end: now };
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

  const fetchYouTubeData = async () => {
    if (!clientId) return;
    
    try {
      setIsLoading(true);
      const { start, end } = getDateRangeFilter();
      
      // Calculate previous period for comparison
      const periodDuration = end.getTime() - start.getTime();
      const prevStart = new Date(start.getTime() - periodDuration);
      const prevEnd = new Date(start.getTime() - 1); // Day before current period starts

      // Fetch account metrics
      const { data: accountMetrics } = await supabase
        .from("social_account_metrics")
        .select("*")
        .eq("client_id", clientId)
        .eq("platform", "youtube")
        .order("collected_at", { ascending: false })
        .limit(2);

      const currentFollowers = accountMetrics?.[0]?.followers || 0;
      const previousFollowers = accountMetrics?.[1]?.followers || currentFollowers;
      const newFollowers = currentFollowers - previousFollowers;

      // Fetch content with metrics for current period
      const { data: contentData } = await supabase
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
            watch_time_hours
          )
        `)
        .eq("client_id", clientId)
        .eq("platform", "youtube")
        .gte("published_at", start.toISOString())
        .lte("published_at", end.toISOString())
        .order("published_at", { ascending: false });

      // Fetch content with metrics for previous period
      const { data: prevContentData } = await supabase
        .from("social_content")
        .select(`
          id,
          content_type,
          social_content_metrics (
            views,
            likes,
            comments,
            shares
          )
        `)
        .eq("client_id", clientId)
        .eq("platform", "youtube")
        .gte("published_at", prevStart.toISOString())
        .lte("published_at", prevEnd.toISOString());

      let totalViews = 0;
      let totalLikes = 0;
      let totalComments = 0;
      let totalShares = 0;
      let shortCount = 0;
      let videoCount = 0;
      const videoList: VideoData[] = [];

      // Helper to get estimated retention rate based on content type
      const getEstimatedRetention = (contentType: string): number => {
        const type = contentType.toLowerCase();
        if (type === "short") return 75; // Shorts have ~75% retention
        return 40; // Regular videos average ~40%
      };

      contentData?.forEach((content: any) => {
        const metrics = content.social_content_metrics?.[0];
        const views = metrics?.views || 0;
        const likes = metrics?.likes || 0;
        const comments = metrics?.comments || 0;
        const shares = metrics?.shares || 0;
        const watchTimeHours = metrics?.watch_time_hours || 0;
        const contentType = content.content_type || "video";
        const avgViewDuration = getEstimatedRetention(contentType);

        totalViews += views;
        totalLikes += likes;
        totalComments += comments;
        totalShares += shares;
        
        if (contentType.toLowerCase() === "short") {
          shortCount++;
        } else {
          videoCount++;
        }

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
          avg_view_duration: avgViewDuration,
          watch_time_hours: watchTimeHours,
          engagement_rate: computeEngagementRate(likes, comments, shares, views),
        });
      });

      // Calculate previous period totals
      let prevTotalViews = 0;
      let prevTotalLikes = 0;
      let prevTotalComments = 0;
      let prevTotalShares = 0;
      let prevShortCount = 0;
      let prevVideoCount = 0;

      prevContentData?.forEach((content: any) => {
        const metrics = content.social_content_metrics?.[0];
        prevTotalViews += metrics?.views || 0;
        prevTotalLikes += metrics?.likes || 0;
        prevTotalComments += metrics?.comments || 0;
        prevTotalShares += metrics?.shares || 0;
        
        if (content.content_type?.toLowerCase() === "short") {
          prevShortCount++;
        } else {
          prevVideoCount++;
        }
      });

      const prevTotalVideos = (prevContentData?.length || 0);
      const prevTotalContent = prevShortCount + prevVideoCount;
      const prevAvgRetention = prevTotalContent > 0 
        ? ((prevShortCount * 75) + (prevVideoCount * 40)) / prevTotalContent 
        : 0;
      const prevEngagementRate = computeEngagementRate(prevTotalLikes, prevTotalComments, prevTotalShares, prevTotalViews);

      // Calculate weighted average retention rate
      const totalContent = shortCount + videoCount;
      const avgRetention = totalContent > 0 
        ? ((shortCount * 75) + (videoCount * 40)) / totalContent 
        : 0;

      setVideos(videoList);
      setStats({
        followers: currentFollowers,
        newFollowers,
        totalVideos: videoList.length,
        totalViews,
        totalLikes,
        totalComments,
        totalShares,
        avgRetentionRate: avgRetention,
        engagementRate: computeEngagementRate(totalLikes, totalComments, totalShares, totalViews, newFollowers),
        prevTotalViews,
        prevTotalLikes,
        prevTotalComments,
        prevTotalShares,
        prevTotalVideos,
        prevEngagementRate,
        prevAvgRetentionRate: prevAvgRetention,
      });
    } catch (err: any) {
      console.error("Error fetching YouTube data:", err);
      toast.error("Failed to load YouTube data");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchYouTubeData();
  }, [clientId, dateRange, customDateRange.from, customDateRange.to]);

  const handleSyncYouTube = async () => {
    setIsSyncing(true);
    try {
      const { data: accounts } = await supabase
        .from("social_accounts")
        .select("*")
        .eq("client_id", clientId)
        .eq("platform", "youtube")
        .eq("is_active", true)
        .limit(1);

      let channelHandle = "";
      let accountId = "";

      // Check for connected YouTube account first
      if (accounts && accounts.length > 0) {
        channelHandle = accounts[0].account_id;
        accountId = accounts[0].id;
      } else if (propChannelHandle) {
        channelHandle = propChannelHandle;
      } else {
        toast.error("No YouTube channel connected. Please add a YouTube account in the admin settings.");
        setIsSyncing(false);
        return;
      }

      // Sync both current and previous periods for comparison
      const periods = [
        { start: ANALYTICS_PERIOD.start, end: ANALYTICS_PERIOD.end },
        { start: ANALYTICS_PERIOD.prevStart, end: ANALYTICS_PERIOD.prevEnd },
      ];

      let totalSynced = 0;
      for (const period of periods) {
        const { data, error } = await supabase.functions.invoke("sync-youtube", {
          body: {
            clientId,
            accountId,
            channelHandle,
            periodStart: period.start,
            periodEnd: period.end,
          },
        });

        if (error) throw error;
        if (data?.success) {
          totalSynced += data.recordsSynced || 0;
        } else {
          throw new Error(data?.error || "Sync failed");
        }
      }

      toast.success(`Synced ${totalSynced} videos (current + previous week)`);
      await fetchYouTubeData();
    } catch (error: any) {
      console.error("YouTube sync error:", error);
      toast.error(error.message || "Failed to sync");
    } finally {
      setIsSyncing(false);
    }
  };

  const getTypeBadgeColor = (type: string) => {
    const lowerType = type.toLowerCase();
    if (lowerType === "short") return "bg-pink-500 text-white";
    if (lowerType === "video") return "bg-red-500 text-white";
    return "bg-secondary text-secondary-foreground";
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
          {(["today", "7d", "30d"] as const).map((range) => (
            <Button
              key={range}
              variant={dateRange === range ? "default" : "ghost"}
              size="sm"
              onClick={() => setDateRange(range)}
              className="text-xs"
            >
              {range === "today" ? "Today" : range === "7d" ? "7 Days" : "30 Days"}
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

        <Button onClick={handleSyncYouTube} disabled={isSyncing} size="sm">
          {isSyncing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <RefreshCw className="h-4 w-4 mr-1" />
              Sync YouTube
            </>
          )}
        </Button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="bg-card">
              <CardContent className="pt-5 pb-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Users className="h-4 w-4" />
                  <span className="text-xs">Subscribers</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <p className="text-2xl font-bold">{stats.followers.toLocaleString()}</p>
                  {stats.newFollowers !== 0 && (
                    <span className={cn(
                      "text-xs font-medium flex items-center",
                      stats.newFollowers > 0 ? "text-green-500" : "text-red-500"
                    )}>
                      {stats.newFollowers > 0 ? "+" : ""}{stats.newFollowers.toLocaleString()}
                      {stats.newFollowers > 0 ? (
                        <TrendingUp className="h-3 w-3 ml-0.5" />
                      ) : (
                        <TrendingDown className="h-3 w-3 ml-0.5" />
                      )}
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card">
              <CardContent className="pt-5 pb-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Eye className="h-4 w-4" />
                  <span className="text-xs">Total Views</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <p className="text-2xl font-bold">{stats.totalViews.toLocaleString()}</p>
                  {(() => {
                    const viewsChange = stats.totalViews - stats.prevTotalViews;
                    if (viewsChange !== 0) {
                      return (
                        <span className={cn(
                          "text-xs font-medium flex items-center",
                          viewsChange > 0 ? "text-green-500" : "text-red-500"
                        )}>
                          {viewsChange > 0 ? "+" : ""}{viewsChange.toLocaleString()}
                          {viewsChange > 0 ? (
                            <TrendingUp className="h-3 w-3 ml-0.5" />
                          ) : (
                            <TrendingDown className="h-3 w-3 ml-0.5" />
                          )}
                        </span>
                      );
                    }
                    return null;
                  })()}
                </div>
                {stats.prevTotalViews > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Last period: {stats.prevTotalViews.toLocaleString()}
                  </p>
                )}
              </CardContent>
            </Card>

            <Card className="bg-card">
              <CardContent className="pt-5 pb-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Clock className="h-4 w-4" />
                  <span className="text-xs">Avg. View Duration</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <p className="text-2xl font-bold">{stats.avgRetentionRate.toFixed(0)}%</p>
                  {(() => {
                    const retentionChange = stats.avgRetentionRate - stats.prevAvgRetentionRate;
                    if (stats.prevAvgRetentionRate > 0 && Math.abs(retentionChange) >= 1) {
                      return (
                        <span className={cn(
                          "text-xs font-medium flex items-center",
                          retentionChange > 0 ? "text-green-500" : "text-red-500"
                        )}>
                          {retentionChange > 0 ? "+" : ""}{retentionChange.toFixed(0)}%
                          {retentionChange > 0 ? (
                            <TrendingUp className="h-3 w-3 ml-0.5" />
                          ) : (
                            <TrendingDown className="h-3 w-3 ml-0.5" />
                          )}
                        </span>
                      );
                    }
                    return null;
                  })()}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card">
              <CardContent className="pt-5 pb-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <BarChart3 className="h-4 w-4" />
                  <span className="text-xs">Engagement</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <p className="text-2xl font-bold">{stats.engagementRate.toFixed(2)}%</p>
                  {(() => {
                    const engagementChange = stats.engagementRate - stats.prevEngagementRate;
                    if (stats.prevEngagementRate > 0) {
                      return (
                        <span className={cn(
                          "text-xs font-medium flex items-center",
                          engagementChange >= 0 ? "text-green-500" : "text-red-500"
                        )}>
                          {engagementChange >= 0 ? "+" : ""}{engagementChange.toFixed(2)}%
                          {engagementChange >= 0 ? (
                            <TrendingUp className="h-3 w-3 ml-0.5" />
                          ) : (
                            <TrendingDown className="h-3 w-3 ml-0.5" />
                          )}
                        </span>
                      );
                    }
                    return stats.engagementRate >= 3 ? (
                      <TrendingUp className="h-4 w-4 text-green-500" />
                    ) : (
                      <TrendingDown className="h-4 w-4 text-red-500" />
                    );
                  })()}
                </div>
                {stats.prevEngagementRate > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Last period: {stats.prevEngagementRate.toFixed(2)}%
                  </p>
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
                  const likesChange = stats.totalLikes - stats.prevTotalLikes;
                  if (likesChange !== 0) {
                    return (
                      <span className={cn(
                        "text-xs font-medium flex items-center justify-center",
                        likesChange > 0 ? "text-green-500" : "text-red-500"
                      )}>
                        {likesChange > 0 ? "+" : ""}{likesChange.toLocaleString()}
                        {likesChange > 0 ? (
                          <TrendingUp className="h-3 w-3 ml-0.5" />
                        ) : (
                          <TrendingDown className="h-3 w-3 ml-0.5" />
                        )}
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
                  const commentsChange = stats.totalComments - stats.prevTotalComments;
                  if (commentsChange !== 0) {
                    return (
                      <span className={cn(
                        "text-xs font-medium flex items-center justify-center",
                        commentsChange > 0 ? "text-green-500" : "text-red-500"
                      )}>
                        {commentsChange > 0 ? "+" : ""}{commentsChange.toLocaleString()}
                        {commentsChange > 0 ? (
                          <TrendingUp className="h-3 w-3 ml-0.5" />
                        ) : (
                          <TrendingDown className="h-3 w-3 ml-0.5" />
                        )}
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
                  const sharesChange = stats.totalShares - stats.prevTotalShares;
                  if (sharesChange !== 0) {
                    return (
                      <span className={cn(
                        "text-xs font-medium flex items-center justify-center",
                        sharesChange > 0 ? "text-green-500" : "text-red-500"
                      )}>
                        {sharesChange > 0 ? "+" : ""}{sharesChange.toLocaleString()}
                        {sharesChange > 0 ? (
                          <TrendingUp className="h-3 w-3 ml-0.5" />
                        ) : (
                          <TrendingDown className="h-3 w-3 ml-0.5" />
                        )}
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
                  const videosChange = stats.totalVideos - stats.prevTotalVideos;
                  if (videosChange !== 0) {
                    return (
                      <span className={cn(
                        "text-xs font-medium flex items-center justify-center",
                        videosChange > 0 ? "text-green-500" : "text-red-500"
                      )}>
                        {videosChange > 0 ? "+" : ""}{videosChange}
                        {videosChange > 0 ? (
                          <TrendingUp className="h-3 w-3 ml-0.5" />
                        ) : (
                          <TrendingDown className="h-3 w-3 ml-0.5" />
                        )}
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
              <p className="text-xs text-muted-foreground mt-1">Try syncing or selecting a different date range</p>
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
                  <TableHead className="text-right">Watch Time</TableHead>
                  <TableHead className="text-right">Stayed to Watch</TableHead>
                  <TableHead className="text-right">Engagement</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {videos.map((video) => (
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
                        <p className="text-xs text-muted-foreground">
                          {format(parseISO(video.published_at), "MMM d, yyyy")}
                        </p>
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
                      {video.watch_time_hours > 0 
                        ? `${video.watch_time_hours.toFixed(1)}h` 
                        : "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      {video.avg_view_duration}%
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
