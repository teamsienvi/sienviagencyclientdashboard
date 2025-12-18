import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Users,
  BarChart3,
  PlayCircle,
  Search,
  Youtube,
  Loader2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, parseISO, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay } from "date-fns";

interface YouTubeContent {
  id: string;
  content_type: string;
  post_date: string;
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  impressions: number | null;
  duration: string | null;
  played_to_watch_percent: number | null;
  watch_time_hours: number | null;
  subscribers: number | null;
}

interface YouTubeAnalyticsProps {
  clientId: string;
  clientName: string;
  content: YouTubeContent[];
  followers: number;
  weekStart: string;
  weekEnd: string;
  onDataRefresh?: () => void;
}

interface DailyStats {
  date: string;
  dayName: string;
  postCount: number;
  totalViews: number;
  totalLikes: number;
  totalComments: number;
  totalShares: number;
  totalImpressions: number;
  engagementRate: number;
}

interface WeeklyStats {
  totalPosts: number;
  totalViews: number;
  totalLikes: number;
  totalComments: number;
  totalShares: number;
  totalImpressions: number;
  avgEngagementRate: number;
  avgViewsPerPost: number;
}

export const YouTubeAnalytics = ({
  clientId,
  clientName,
  content,
  followers,
  weekStart,
  weekEnd,
  onDataRefresh,
}: YouTubeAnalyticsProps) => {
  const [isSyncing, setIsSyncing] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState<"daily" | "weekly">("daily");

  // Compute engagement rate formula:
  // Engagement Rate = ((likes + comments + shares) / views) * 100
  const computeEngagementRate = (
    likes: number,
    comments: number,
    shares: number,
    views: number
  ): number => {
    if (views === 0) return 0;
    return ((likes + comments + shares) / views) * 100;
  };

  // Group content by day
  const dailyStats = useMemo((): DailyStats[] => {
    try {
      const start = parseISO(weekStart);
      const end = parseISO(weekEnd);
      const days = eachDayOfInterval({ start, end });

      return days.map((day) => {
        const dayContent = content.filter((c) => {
          try {
            const postDate = parseISO(c.post_date);
            return isSameDay(postDate, day);
          } catch {
            return false;
          }
        });

        const totalViews = dayContent.reduce((sum, c) => sum + (c.views || 0), 0);
        const totalLikes = dayContent.reduce((sum, c) => sum + (c.likes || 0), 0);
        const totalComments = dayContent.reduce((sum, c) => sum + (c.comments || 0), 0);
        const totalShares = dayContent.reduce((sum, c) => sum + (c.shares || 0), 0);
        const totalImpressions = dayContent.reduce((sum, c) => sum + (c.impressions || 0), 0);

        return {
          date: format(day, "yyyy-MM-dd"),
          dayName: format(day, "EEEE, MMM d"),
          postCount: dayContent.length,
          totalViews,
          totalLikes,
          totalComments,
          totalShares,
          totalImpressions,
          engagementRate: computeEngagementRate(totalLikes, totalComments, totalShares, totalViews),
        };
      });
    } catch {
      return [];
    }
  }, [content, weekStart, weekEnd]);

  // Weekly aggregated stats
  const weeklyStats = useMemo((): WeeklyStats => {
    const totalPosts = content.length;
    const totalViews = content.reduce((sum, c) => sum + (c.views || 0), 0);
    const totalLikes = content.reduce((sum, c) => sum + (c.likes || 0), 0);
    const totalComments = content.reduce((sum, c) => sum + (c.comments || 0), 0);
    const totalShares = content.reduce((sum, c) => sum + (c.shares || 0), 0);
    const totalImpressions = content.reduce((sum, c) => sum + (c.impressions || 0), 0);

    return {
      totalPosts,
      totalViews,
      totalLikes,
      totalComments,
      totalShares,
      totalImpressions,
      avgEngagementRate: computeEngagementRate(totalLikes, totalComments, totalShares, totalViews),
      avgViewsPerPost: totalPosts > 0 ? totalViews / totalPosts : 0,
    };
  }, [content]);

  // Sync YouTube data
  const handleSyncYouTube = async () => {
    setIsSyncing(true);
    try {
      // First check if there's a connected YouTube account for this client
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
        // For Father Figure Formula, use the known handle
        if (clientName.toLowerCase().includes("father figure")) {
          channelHandle = "@FatherFigureFormula";
        } else {
          toast.error("No YouTube channel connected for this client");
          setIsSyncing(false);
          return;
        }
      }

      const { data, error } = await supabase.functions.invoke("sync-youtube", {
        body: {
          clientId,
          accountId,
          channelHandle,
          periodStart: weekStart,
          periodEnd: weekEnd,
        },
      });

      if (error) throw error;

      if (data?.success) {
        toast.success(`YouTube data synced! ${data.syncedRecords || 0} videos updated.`);
        onDataRefresh?.();
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

  const filteredContent = content.filter(
    (c) =>
      c.content_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.post_date.includes(searchTerm)
  );

  const formatDuration = (duration: string | null) => {
    if (!duration) return "-";
    return duration;
  };

  return (
    <div className="space-y-6">
      {/* Header with Sync Button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Youtube className="h-6 w-6 text-red-500" />
          <h3 className="text-xl font-semibold">YouTube Analytics</h3>
        </div>
        <Button onClick={handleSyncYouTube} disabled={isSyncing} variant="outline">
          {isSyncing ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Syncing...
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4 mr-2" />
              Sync YouTube Data
            </>
          )}
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-card border-border">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <Users className="h-4 w-4" />
              <span className="text-sm">Followers</span>
            </div>
            <span className="text-3xl font-bold text-foreground">{followers.toLocaleString()}</span>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <BarChart3 className="h-4 w-4" />
              <span className="text-sm">Engagement Rate %</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-3xl font-bold text-foreground">
                {weeklyStats.avgEngagementRate.toFixed(2)}%
              </span>
              {weeklyStats.avgEngagementRate > 3 ? (
                <TrendingUp className="h-4 w-4 text-green-500" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-500" />
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Formula: (Likes + Comments + Shares) / Views × 100
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <PlayCircle className="h-4 w-4" />
              <span className="text-sm">Total Content</span>
            </div>
            <span className="text-3xl font-bold text-foreground">{weeklyStats.totalPosts}</span>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <TrendingUp className="h-4 w-4" />
              <span className="text-sm">Total Views</span>
            </div>
            <span className="text-3xl font-bold text-foreground">
              {weeklyStats.totalViews.toLocaleString()}
            </span>
          </CardContent>
        </Card>
      </div>

      {/* View Mode Toggle */}
      <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as "daily" | "weekly")}>
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="daily">Daily View</TabsTrigger>
            <TabsTrigger value="weekly">Weekly Summary</TabsTrigger>
          </TabsList>
          <div className="relative max-w-xs">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search content..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Daily View */}
        <TabsContent value="daily" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Daily Performance Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Day</TableHead>
                    <TableHead className="text-center">Posts</TableHead>
                    <TableHead className="text-right">Views</TableHead>
                    <TableHead className="text-right">Likes</TableHead>
                    <TableHead className="text-right">Comments</TableHead>
                    <TableHead className="text-right">Shares</TableHead>
                    <TableHead className="text-right">Engagement Rate</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dailyStats.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                        No data available for this period
                      </TableCell>
                    </TableRow>
                  ) : (
                    dailyStats.map((day) => (
                      <TableRow key={day.date}>
                        <TableCell className="font-medium">{day.dayName}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant="secondary">{day.postCount}</Badge>
                        </TableCell>
                        <TableCell className="text-right">{day.totalViews.toLocaleString()}</TableCell>
                        <TableCell className="text-right">{day.totalLikes.toLocaleString()}</TableCell>
                        <TableCell className="text-right">{day.totalComments.toLocaleString()}</TableCell>
                        <TableCell className="text-right">{day.totalShares.toLocaleString()}</TableCell>
                        <TableCell className="text-right">
                          <span
                            className={
                              day.engagementRate >= 5
                                ? "text-green-500 font-semibold"
                                : day.engagementRate >= 2
                                ? "text-yellow-500"
                                : "text-muted-foreground"
                            }
                          >
                            {day.engagementRate.toFixed(2)}%
                          </span>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Weekly Summary */}
        <TabsContent value="weekly" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Weekly Totals</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center py-2 border-b border-border">
                  <span className="text-muted-foreground">Total Posts</span>
                  <span className="font-bold">{weeklyStats.totalPosts}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-border">
                  <span className="text-muted-foreground">Total Views</span>
                  <span className="font-bold">{weeklyStats.totalViews.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-border">
                  <span className="text-muted-foreground">Total Likes</span>
                  <span className="font-bold">{weeklyStats.totalLikes.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-border">
                  <span className="text-muted-foreground">Total Comments</span>
                  <span className="font-bold">{weeklyStats.totalComments.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-border">
                  <span className="text-muted-foreground">Total Shares</span>
                  <span className="font-bold">{weeklyStats.totalShares.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-muted-foreground">Total Impressions</span>
                  <span className="font-bold">{weeklyStats.totalImpressions.toLocaleString()}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Weekly Averages</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center py-2 border-b border-border">
                  <span className="text-muted-foreground">Avg Views per Post</span>
                  <span className="font-bold">{Math.round(weeklyStats.avgViewsPerPost).toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-border">
                  <span className="text-muted-foreground">Avg Engagement Rate</span>
                  <span className="font-bold text-primary">{weeklyStats.avgEngagementRate.toFixed(2)}%</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-border">
                  <span className="text-muted-foreground">Posts per Day</span>
                  <span className="font-bold">{(weeklyStats.totalPosts / 7).toFixed(1)}</span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-muted-foreground">Views per Day</span>
                  <span className="font-bold">{Math.round(weeklyStats.totalViews / 7).toLocaleString()}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Content Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">All YouTube Content</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead className="text-right">Likes</TableHead>
                <TableHead className="text-right">Comments</TableHead>
                <TableHead className="text-right">Shares</TableHead>
                <TableHead className="text-right">Views</TableHead>
                <TableHead className="text-right">Engagement %</TableHead>
                <TableHead className="text-right">Impressions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredContent.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                    No YouTube content available. Click "Sync YouTube Data" to fetch latest data.
                  </TableCell>
                </TableRow>
              ) : (
                filteredContent.map((item) => {
                  const engRate = computeEngagementRate(
                    item.likes || 0,
                    item.comments || 0,
                    item.shares || 0,
                    item.views || 0
                  );
                  return (
                    <TableRow key={item.id}>
                      <TableCell>
                        <Badge variant="secondary" className="bg-red-500/10 text-red-500">
                          {item.content_type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {format(parseISO(item.post_date), "EEEE, MMM d")}
                      </TableCell>
                      <TableCell>{formatDuration(item.duration)}</TableCell>
                      <TableCell className="text-right">{(item.likes || 0).toLocaleString()}</TableCell>
                      <TableCell className="text-right">{(item.comments || 0).toLocaleString()}</TableCell>
                      <TableCell className="text-right">{(item.shares || 0).toLocaleString()}</TableCell>
                      <TableCell className="text-right">{(item.views || 0).toLocaleString()}</TableCell>
                      <TableCell className="text-right">
                        <span
                          className={
                            engRate >= 5
                              ? "text-green-500 font-semibold"
                              : engRate >= 2
                              ? "text-yellow-500"
                              : "text-muted-foreground"
                          }
                        >
                          {engRate.toFixed(2)}%
                        </span>
                      </TableCell>
                      <TableCell className="text-right">{(item.impressions || 0).toLocaleString()}</TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};
