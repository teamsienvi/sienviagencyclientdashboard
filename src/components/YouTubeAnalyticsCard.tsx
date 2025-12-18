import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  Youtube,
  Loader2,
  Eye,
  Clock,
  ChevronRight,
  ThumbsUp,
  MessageCircle,
  Share2,
  Calendar,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, subDays, subWeeks, subMonths, parseISO, isAfter, isBefore, startOfDay } from "date-fns";

interface YouTubeAnalyticsCardProps {
  clientId: string;
  clientName: string;
}

interface YouTubeStats {
  followers: number;
  totalVideos: number;
  totalViews: number;
  totalLikes: number;
  totalComments: number;
  totalShares: number;
  totalWatchTimeHours: number;
  engagementRate: number;
}

interface VideoData {
  id: string;
  title: string | null;
  published_at: string;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  watch_time_hours: number;
  engagement_rate: number;
}

type DateRange = "today" | "7d" | "30d";

export const YouTubeAnalyticsCard = ({ clientId, clientName }: YouTubeAnalyticsCardProps) => {
  const [isSyncing, setIsSyncing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState<YouTubeStats | null>(null);
  const [videos, setVideos] = useState<VideoData[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<DateRange>("7d");
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  // Compute engagement rate: (likes + comments + shares) / views * 100
  const computeEngagementRate = (
    likes: number,
    comments: number,
    shares: number,
    views: number
  ): number => {
    if (views === 0) return 0;
    return ((likes + comments + shares) / views) * 100;
  };

  const getDateRangeFilter = (range: DateRange): Date => {
    const now = new Date();
    switch (range) {
      case "today":
        return startOfDay(now);
      case "7d":
        return subDays(now, 7);
      case "30d":
        return subMonths(now, 1);
      default:
        return subDays(now, 7);
    }
  };

  const fetchYouTubeData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const startDate = getDateRangeFilter(dateRange);

      // Fetch account metrics
      const { data: accountMetrics } = await supabase
        .from("social_account_metrics")
        .select("*")
        .eq("client_id", clientId)
        .eq("platform", "youtube")
        .order("collected_at", { ascending: false })
        .limit(1);

      // Fetch content with metrics
      const { data: contentData } = await supabase
        .from("social_content")
        .select(`
          id,
          title,
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
        .gte("published_at", startDate.toISOString())
        .order("published_at", { ascending: false });

      let totalViews = 0;
      let totalLikes = 0;
      let totalComments = 0;
      let totalShares = 0;
      let totalWatchTimeHours = 0;
      const videoList: VideoData[] = [];

      contentData?.forEach((content: any) => {
        const metrics = content.social_content_metrics?.[0];
        const views = metrics?.views || 0;
        const likes = metrics?.likes || 0;
        const comments = metrics?.comments || 0;
        const shares = metrics?.shares || 0;
        const watchTime = metrics?.watch_time_hours || 0;

        totalViews += views;
        totalLikes += likes;
        totalComments += comments;
        totalShares += shares;
        totalWatchTimeHours += watchTime;

        videoList.push({
          id: content.id,
          title: content.title,
          published_at: content.published_at,
          views,
          likes,
          comments,
          shares,
          watch_time_hours: watchTime,
          engagement_rate: computeEngagementRate(likes, comments, shares, views),
        });
      });

      setVideos(videoList);
      setStats({
        followers: accountMetrics?.[0]?.followers || 0,
        totalVideos: videoList.length,
        totalViews,
        totalLikes,
        totalComments,
        totalShares,
        totalWatchTimeHours,
        engagementRate: computeEngagementRate(totalLikes, totalComments, totalShares, totalViews),
      });
    } catch (err: any) {
      console.error("Error fetching YouTube data:", err);
      setError("Failed to load YouTube data");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (clientId) {
      fetchYouTubeData();
    }
  }, [clientId, dateRange]);

  // Sync YouTube data
  const handleSyncYouTube = async (e: React.MouseEvent) => {
    e.stopPropagation();
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

      if (accounts && accounts.length > 0) {
        channelHandle = accounts[0].account_name || accounts[0].account_id;
        accountId = accounts[0].id;
      } else {
        if (clientName.toLowerCase().includes("father figure")) {
          channelHandle = "@FatherFigureFormula";
        } else {
          toast.error("No YouTube channel connected for this client");
          setIsSyncing(false);
          return;
        }
      }

      const periodEnd = format(new Date(), "yyyy-MM-dd");
      const periodStart = format(subWeeks(new Date(), 1), "yyyy-MM-dd");

      const { data, error } = await supabase.functions.invoke("sync-youtube", {
        body: {
          clientId,
          accountId,
          channelHandle,
          periodStart,
          periodEnd,
        },
      });

      if (error) throw error;

      if (data?.success) {
        toast.success(`YouTube synced! ${data.syncedRecords || 0} videos updated.`);
        await fetchYouTubeData();
      } else {
        throw new Error(data?.error || "Sync failed");
      }
    } catch (error: any) {
      console.error("YouTube sync error:", error);
      toast.error(error.message || "Failed to sync YouTube data");
    } finally {
      setIsSyncing(false);
    }
  };

  const formatWatchTime = (hours: number): string => {
    if (hours < 1) {
      return `${Math.round(hours * 60)}m`;
    }
    return `${hours.toFixed(1)}h`;
  };

  const getDateRangeLabel = (range: DateRange): string => {
    switch (range) {
      case "today":
        return "Today";
      case "7d":
        return "Last 7 days";
      case "30d":
        return "Last 30 days";
      default:
        return "Last 7 days";
    }
  };

  if (isLoading) {
    return (
      <div className="pt-4 border-t border-border space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Youtube className="h-4 w-4 text-red-500" />
            <h4 className="text-sm font-medium text-foreground">YouTube Analytics</h4>
          </div>
          <Skeleton className="h-8 w-20" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-accent/50 rounded-lg p-3 space-y-2">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-6 w-12" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="pt-4 border-t border-border space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Youtube className="h-4 w-4 text-red-500" />
            <h4 className="text-sm font-medium text-foreground">YouTube Analytics</h4>
          </div>
          <Button variant="outline" size="sm" onClick={handleSyncYouTube} disabled={isSyncing}>
            {isSyncing ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
          </Button>
        </div>
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
          <p className="text-xs text-destructive">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="pt-4 border-t border-border space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Youtube className="h-4 w-4 text-red-500" />
            <h4 className="text-sm font-medium text-foreground">YouTube Analytics</h4>
          </div>
          <div className="flex items-center gap-2">
            <Select value={dateRange} onValueChange={(v) => setDateRange(v as DateRange)}>
              <SelectTrigger className="h-8 w-[100px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="7d">Last 7d</SelectItem>
                <SelectItem value="30d">Last 30d</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={handleSyncYouTube} disabled={isSyncing}>
              {isSyncing ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <RefreshCw className="h-3 w-3" />
              )}
            </Button>
          </div>
        </div>

        {stats ? (
          <div 
            className="cursor-pointer hover:opacity-90 transition-opacity"
            onClick={() => setIsDetailOpen(true)}
          >
            <div className="grid grid-cols-3 gap-2 mb-2">
              <div className="bg-accent/50 rounded-lg p-3">
                <div className="flex items-center gap-1 text-muted-foreground mb-1">
                  <Users className="h-3 w-3" />
                  <span className="text-xs">Subscribers</span>
                </div>
                <p className="text-lg font-semibold">{stats.followers.toLocaleString()}</p>
              </div>
              <div className="bg-accent/50 rounded-lg p-3">
                <div className="flex items-center gap-1 text-muted-foreground mb-1">
                  <Eye className="h-3 w-3" />
                  <span className="text-xs">Views</span>
                </div>
                <p className="text-lg font-semibold">{stats.totalViews.toLocaleString()}</p>
              </div>
              <div className="bg-accent/50 rounded-lg p-3">
                <div className="flex items-center gap-1 text-muted-foreground mb-1">
                  <Clock className="h-3 w-3" />
                  <span className="text-xs">Watch Time</span>
                </div>
                <p className="text-lg font-semibold">{formatWatchTime(stats.totalWatchTimeHours)}</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-accent/50 rounded-lg p-3">
                <div className="flex items-center gap-1 text-muted-foreground mb-1">
                  <BarChart3 className="h-3 w-3" />
                  <span className="text-xs">Engagement</span>
                </div>
                <div className="flex items-center gap-1">
                  <p className="text-lg font-semibold">{stats.engagementRate.toFixed(2)}%</p>
                  {stats.engagementRate >= 3 ? (
                    <TrendingUp className="h-3 w-3 text-green-500" />
                  ) : (
                    <TrendingDown className="h-3 w-3 text-red-500" />
                  )}
                </div>
              </div>
              <div className="bg-accent/50 rounded-lg p-3">
                <div className="flex items-center gap-1 text-muted-foreground mb-1">
                  <PlayCircle className="h-3 w-3" />
                  <span className="text-xs">Videos</span>
                </div>
                <p className="text-lg font-semibold">{stats.totalVideos}</p>
              </div>
              <div className="bg-accent/50 rounded-lg p-3">
                <div className="flex items-center gap-1 text-muted-foreground mb-1">
                  <ThumbsUp className="h-3 w-3" />
                  <span className="text-xs">Likes</span>
                </div>
                <p className="text-lg font-semibold">{stats.totalLikes.toLocaleString()}</p>
              </div>
            </div>
            <div className="flex items-center justify-center gap-1 mt-3 text-xs text-muted-foreground hover:text-primary transition-colors">
              <span>Click to view details</span>
              <ChevronRight className="h-3 w-3" />
            </div>
          </div>
        ) : (
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <p className="text-xs text-muted-foreground">No YouTube data. Click Sync to fetch.</p>
          </div>
        )}
      </div>

      {/* Detail Dialog */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="flex items-center gap-2">
                <Youtube className="h-5 w-5 text-red-500" />
                YouTube Analytics - {clientName}
              </DialogTitle>
            </div>
          </DialogHeader>

          <div className="space-y-6">
            {/* Date Range Selector */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Showing data for:</span>
              </div>
              <div className="flex gap-2">
                {(["today", "7d", "30d"] as DateRange[]).map((range) => (
                  <Button
                    key={range}
                    variant={dateRange === range ? "default" : "outline"}
                    size="sm"
                    onClick={() => setDateRange(range)}
                  >
                    {getDateRangeLabel(range)}
                  </Button>
                ))}
              </div>
            </div>

            {/* Summary Stats */}
            {stats && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-accent/30 rounded-xl p-4 border border-border">
                  <div className="flex items-center gap-2 text-muted-foreground mb-2">
                    <Users className="h-4 w-4" />
                    <span className="text-sm">Subscribers</span>
                  </div>
                  <p className="text-2xl font-bold">{stats.followers.toLocaleString()}</p>
                </div>
                <div className="bg-accent/30 rounded-xl p-4 border border-border">
                  <div className="flex items-center gap-2 text-muted-foreground mb-2">
                    <Eye className="h-4 w-4" />
                    <span className="text-sm">Total Views</span>
                  </div>
                  <p className="text-2xl font-bold">{stats.totalViews.toLocaleString()}</p>
                </div>
                <div className="bg-accent/30 rounded-xl p-4 border border-border">
                  <div className="flex items-center gap-2 text-muted-foreground mb-2">
                    <Clock className="h-4 w-4" />
                    <span className="text-sm">Watch Time</span>
                  </div>
                  <p className="text-2xl font-bold">{formatWatchTime(stats.totalWatchTimeHours)}</p>
                </div>
                <div className="bg-accent/30 rounded-xl p-4 border border-border">
                  <div className="flex items-center gap-2 text-muted-foreground mb-2">
                    <BarChart3 className="h-4 w-4" />
                    <span className="text-sm">Engagement Rate</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="text-2xl font-bold">{stats.engagementRate.toFixed(2)}%</p>
                    {stats.engagementRate >= 3 ? (
                      <TrendingUp className="h-4 w-4 text-green-500" />
                    ) : (
                      <TrendingDown className="h-4 w-4 text-red-500" />
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Engagement Breakdown */}
            {stats && (
              <div className="grid grid-cols-4 gap-4">
                <div className="bg-muted/50 rounded-lg p-3 text-center">
                  <ThumbsUp className="h-4 w-4 mx-auto mb-1 text-blue-500" />
                  <p className="text-lg font-semibold">{stats.totalLikes.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">Likes</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-3 text-center">
                  <MessageCircle className="h-4 w-4 mx-auto mb-1 text-green-500" />
                  <p className="text-lg font-semibold">{stats.totalComments.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">Comments</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-3 text-center">
                  <Share2 className="h-4 w-4 mx-auto mb-1 text-purple-500" />
                  <p className="text-lg font-semibold">{stats.totalShares.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">Shares</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-3 text-center">
                  <PlayCircle className="h-4 w-4 mx-auto mb-1 text-red-500" />
                  <p className="text-lg font-semibold">{stats.totalVideos}</p>
                  <p className="text-xs text-muted-foreground">Videos</p>
                </div>
              </div>
            )}

            {/* Video List */}
            <div>
              <h3 className="text-lg font-semibold mb-3">Video Performance</h3>
              {videos.length === 0 ? (
                <div className="bg-muted/50 rounded-lg p-6 text-center">
                  <PlayCircle className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-muted-foreground">No videos found for this period</p>
                  <p className="text-xs text-muted-foreground mt-1">Try selecting a different date range or sync new data</p>
                </div>
              ) : (
                <div className="rounded-lg border border-border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="w-[250px]">Video</TableHead>
                        <TableHead className="text-right">Views</TableHead>
                        <TableHead className="text-right">Likes</TableHead>
                        <TableHead className="text-right">Comments</TableHead>
                        <TableHead className="text-right">Shares</TableHead>
                        <TableHead className="text-right">Watch Time</TableHead>
                        <TableHead className="text-right">Engagement</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {videos.map((video) => (
                        <TableRow key={video.id} className="hover:bg-muted/30">
                          <TableCell>
                            <div>
                              <p className="font-medium text-sm line-clamp-1">
                                {video.title || "Untitled Video"}
                              </p>
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
                            {formatWatchTime(video.watch_time_hours)}
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge 
                              variant="secondary"
                              className={
                                video.engagement_rate >= 5 
                                  ? "bg-green-500/20 text-green-600" 
                                  : video.engagement_rate >= 2 
                                  ? "bg-yellow-500/20 text-yellow-600" 
                                  : "bg-muted text-muted-foreground"
                              }
                            >
                              {video.engagement_rate.toFixed(2)}%
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
