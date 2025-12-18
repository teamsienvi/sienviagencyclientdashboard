import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, subDays, subMonths, startOfDay } from "date-fns";

interface YouTubeAnalyticsCardProps {
  clientId: string;
  clientName: string;
}

interface YouTubeStats {
  followers: number;
  newFollowers: number;
  totalVideos: number;
  totalViews: number;
  totalWatchTimeHours: number;
  engagementRate: number;
}

type DateRange = "today" | "7d" | "30d";

export const YouTubeAnalyticsCard = ({ clientId, clientName }: YouTubeAnalyticsCardProps) => {
  const navigate = useNavigate();
  const [isSyncing, setIsSyncing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState<YouTubeStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<DateRange>("7d");

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
        .gte("published_at", startDate.toISOString());

      let totalViews = 0;
      let totalLikes = 0;
      let totalComments = 0;
      let totalShares = 0;
      let totalWatchTimeHours = 0;
      let totalVideos = contentData?.length || 0;

      contentData?.forEach((content: any) => {
        const metrics = content.social_content_metrics?.[0];
        if (metrics) {
          totalViews += metrics.views || 0;
          totalLikes += metrics.likes || 0;
          totalComments += metrics.comments || 0;
          totalShares += metrics.shares || 0;
          totalWatchTimeHours += metrics.watch_time_hours || 0;
        }
      });

      setStats({
        followers: currentFollowers,
        newFollowers,
        totalVideos,
        totalViews,
        totalWatchTimeHours,
        engagementRate: computeEngagementRate(totalLikes, totalComments, totalShares, totalViews),
      });
    } catch (err: any) {
      console.error("Error fetching YouTube data:", err);
      setError("Failed to load");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (clientId) {
      fetchYouTubeData();
    }
  }, [clientId, dateRange]);

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
          toast.error("No YouTube channel connected");
          setIsSyncing(false);
          return;
        }
      }

      const periodEnd = format(new Date(), "yyyy-MM-dd");
      const periodStart = format(getDateRangeFilter(dateRange), "yyyy-MM-dd");

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

  const handleNavigateToPage = () => {
    navigate(`/youtube-analytics/${clientId}?name=${encodeURIComponent(clientName)}`);
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
      <div className="pt-4 border-t border-border space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Youtube className="h-4 w-4 text-red-500" />
            <h4 className="text-sm font-medium text-foreground">YouTube Analytics</h4>
          </div>
          <Skeleton className="h-8 w-20" />
        </div>
        <div className="grid grid-cols-3 gap-2">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-accent/50 rounded-lg p-2.5 space-y-1.5">
              <Skeleton className="h-2.5 w-12" />
              <Skeleton className="h-5 w-10" />
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
    <div className="pt-4 border-t border-border space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Youtube className="h-4 w-4 text-red-500" />
          <h4 className="text-sm font-medium text-foreground">YouTube Analytics</h4>
        </div>
        <div className="flex items-center gap-2">
          <Select value={dateRange} onValueChange={(v) => setDateRange(v as DateRange)}>
            <SelectTrigger className="h-7 w-[80px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="7d">7 Days</SelectItem>
              <SelectItem value="30d">30 Days</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" className="h-7 w-7 p-0" onClick={handleSyncYouTube} disabled={isSyncing}>
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
          onClick={handleNavigateToPage}
        >
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-accent/50 rounded-lg p-2.5">
              <div className="flex items-center gap-1 text-muted-foreground mb-0.5">
                <Users className="h-3 w-3" />
                <span className="text-[10px]">Subscribers</span>
              </div>
              <div className="flex items-baseline gap-1">
                <p className="text-base font-semibold">{stats.followers.toLocaleString()}</p>
                {stats.newFollowers !== 0 && (
                  <span className={`text-[10px] font-medium ${stats.newFollowers > 0 ? "text-green-500" : "text-red-500"}`}>
                    {stats.newFollowers > 0 ? "+" : ""}{stats.newFollowers}
                  </span>
                )}
              </div>
            </div>
            <div className="bg-accent/50 rounded-lg p-2.5">
              <div className="flex items-center gap-1 text-muted-foreground mb-0.5">
                <Eye className="h-3 w-3" />
                <span className="text-[10px]">Views</span>
              </div>
              <p className="text-base font-semibold">{stats.totalViews.toLocaleString()}</p>
            </div>
            <div className="bg-accent/50 rounded-lg p-2.5">
              <div className="flex items-center gap-1 text-muted-foreground mb-0.5">
                <Clock className="h-3 w-3" />
                <span className="text-[10px]">Watch Time</span>
              </div>
              <p className="text-base font-semibold">{formatWatchTime(stats.totalWatchTimeHours)}</p>
            </div>
            <div className="bg-accent/50 rounded-lg p-2.5">
              <div className="flex items-center gap-1 text-muted-foreground mb-0.5">
                <BarChart3 className="h-3 w-3" />
                <span className="text-[10px]">Engagement</span>
              </div>
              <div className="flex items-center gap-1">
                <p className="text-base font-semibold">{stats.engagementRate.toFixed(2)}%</p>
                {stats.engagementRate >= 3 ? (
                  <TrendingUp className="h-3 w-3 text-green-500" />
                ) : (
                  <TrendingDown className="h-3 w-3 text-red-500" />
                )}
              </div>
            </div>
            <div className="bg-accent/50 rounded-lg p-2.5">
              <div className="flex items-center gap-1 text-muted-foreground mb-0.5">
                <PlayCircle className="h-3 w-3" />
                <span className="text-[10px]">Videos</span>
              </div>
              <p className="text-base font-semibold">{stats.totalVideos}</p>
            </div>
            <div className="bg-accent/50 rounded-lg p-2.5 flex items-center justify-center">
              <div className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors">
                <span>Details</span>
                <ChevronRight className="h-3 w-3" />
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-muted/50 rounded-lg p-3 text-center">
          <p className="text-xs text-muted-foreground">No data. Click Sync to fetch.</p>
        </div>
      )}
    </div>
  );
};
