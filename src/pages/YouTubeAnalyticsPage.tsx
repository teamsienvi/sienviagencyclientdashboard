import { useState, useEffect } from "react";
import { useParams, Link, useSearchParams } from "react-router-dom";
import { Header } from "@/components/Header";
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
  Youtube,
  Loader2,
  Eye,
  Clock,
  ThumbsUp,
  MessageCircle,
  Share2,
  ArrowLeft,
  CalendarIcon,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, subDays, subMonths, parseISO, startOfDay } from "date-fns";
import { cn } from "@/lib/utils";

interface YouTubeStats {
  followers: number;
  newFollowers: number;
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

type DateRange = "today" | "7d" | "30d" | "custom";

const YouTubeAnalyticsPage = () => {
  const { clientId } = useParams<{ clientId: string }>();
  const [searchParams] = useSearchParams();
  const clientName = searchParams.get("name") || "Client";

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

      // Fetch account metrics (current and previous for comparison)
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
        .gte("published_at", start.toISOString())
        .lte("published_at", end.toISOString())
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
        followers: currentFollowers,
        newFollowers,
        totalVideos: videoList.length,
        totalViews,
        totalLikes,
        totalComments,
        totalShares,
        totalWatchTimeHours,
        engagementRate: computeEngagementRate(totalLikes, totalComments, totalShares, totalViews, newFollowers),
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

      if (accounts && accounts.length > 0) {
        channelHandle = accounts[0].account_name || accounts[0].account_id;
        accountId = accounts[0].id;
      } else {
        if (clientName.toLowerCase().includes("father figure")) {
          channelHandle = "@FatherFigureFormula";
        } else {
          toast.error("No YouTube channel connected");
          setIsSyncing(false);
          return;
        }
      }

      const { start, end } = getDateRangeFilter();

      const { data, error } = await supabase.functions.invoke("sync-youtube", {
        body: {
          clientId,
          accountId,
          channelHandle,
          periodStart: format(start, "yyyy-MM-dd"),
          periodEnd: format(end, "yyyy-MM-dd"),
        },
      });

      if (error) throw error;

      if (data?.success) {
        toast.success(`Synced ${data.syncedRecords || 0} videos`);
        await fetchYouTubeData();
      } else {
        throw new Error(data?.error || "Sync failed");
      }
    } catch (error: any) {
      console.error("YouTube sync error:", error);
      toast.error(error.message || "Failed to sync");
    } finally {
      setIsSyncing(false);
    }
  };

  const formatWatchTime = (hours: number): string => {
    if (hours < 1) {
      const minutes = Math.round(hours * 60);
      return `${minutes}m`;
    }
    return `${hours.toFixed(1)}h`;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <Skeleton className="h-8 w-64 mb-8" />
          <div className="grid grid-cols-4 gap-4 mb-8">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
          <Skeleton className="h-96" />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <Link
              to="/"
              className="inline-flex items-center text-muted-foreground hover:text-foreground mb-2 transition-colors text-sm"
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back
            </Link>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Youtube className="h-6 w-6 text-red-500" />
              {clientName}
            </h1>
          </div>

          <div className="flex items-center gap-3">
            {/* Date Range Buttons */}
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
                  Sync
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        {stats && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
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
                        {stats.newFollowers > 0 ? "+" : ""}{stats.newFollowers}
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
                  <p className="text-2xl font-bold">{stats.totalViews.toLocaleString()}</p>
                </CardContent>
              </Card>

              <Card className="bg-card">
                <CardContent className="pt-5 pb-4">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <Clock className="h-4 w-4" />
                    <span className="text-xs">Watch Time</span>
                  </div>
                  <p className="text-2xl font-bold">{formatWatchTime(stats.totalWatchTimeHours)}</p>
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
                    {stats.engagementRate >= 3 ? (
                      <TrendingUp className="h-4 w-4 text-green-500" />
                    ) : (
                      <TrendingDown className="h-4 w-4 text-red-500" />
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Engagement Breakdown */}
            <div className="grid grid-cols-4 gap-4 mb-8">
              <Card className="bg-muted/30">
                <CardContent className="py-4 text-center">
                  <ThumbsUp className="h-4 w-4 mx-auto mb-1 text-blue-500" />
                  <p className="text-lg font-semibold">{stats.totalLikes.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">Likes</p>
                </CardContent>
              </Card>
              <Card className="bg-muted/30">
                <CardContent className="py-4 text-center">
                  <MessageCircle className="h-4 w-4 mx-auto mb-1 text-green-500" />
                  <p className="text-lg font-semibold">{stats.totalComments.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">Comments</p>
                </CardContent>
              </Card>
              <Card className="bg-muted/30">
                <CardContent className="py-4 text-center">
                  <Share2 className="h-4 w-4 mx-auto mb-1 text-purple-500" />
                  <p className="text-lg font-semibold">{stats.totalShares.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">Shares</p>
                </CardContent>
              </Card>
              <Card className="bg-muted/30">
                <CardContent className="py-4 text-center">
                  <PlayCircle className="h-4 w-4 mx-auto mb-1 text-red-500" />
                  <p className="text-lg font-semibold">{stats.totalVideos}</p>
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
                    <TableHead className="w-[280px]">Video</TableHead>
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
                    <TableRow key={video.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium text-sm line-clamp-1">
                            {video.title || "Untitled"}
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
      </main>
    </div>
  );
};

export default YouTubeAnalyticsPage;
