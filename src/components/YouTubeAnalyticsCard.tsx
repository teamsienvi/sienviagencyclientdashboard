import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
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
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, subDays, subWeeks } from "date-fns";

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
  engagementRate: number;
}

export const YouTubeAnalyticsCard = ({ clientId, clientName }: YouTubeAnalyticsCardProps) => {
  const [isSyncing, setIsSyncing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState<YouTubeStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Compute engagement rate: (likes + comments) / views * 100
  const computeEngagementRate = (
    likes: number,
    comments: number,
    views: number
  ): number => {
    if (views === 0) return 0;
    return ((likes + comments) / views) * 100;
  };

  const fetchYouTubeData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Get the last 7 days date range
      const periodEnd = format(new Date(), "yyyy-MM-dd");
      const periodStart = format(subDays(new Date(), 7), "yyyy-MM-dd");

      // Fetch account metrics
      const { data: accountMetrics } = await supabase
        .from("social_account_metrics")
        .select("*")
        .eq("client_id", clientId)
        .eq("platform", "youtube")
        .order("collected_at", { ascending: false })
        .limit(1);

      // Fetch content metrics for the period
      const { data: contentData } = await supabase
        .from("social_content")
        .select(`
          id,
          social_content_metrics (
            views,
            likes,
            comments
          )
        `)
        .eq("client_id", clientId)
        .eq("platform", "youtube");

      let totalViews = 0;
      let totalLikes = 0;
      let totalComments = 0;
      let totalVideos = contentData?.length || 0;

      contentData?.forEach((content: any) => {
        const metrics = content.social_content_metrics?.[0];
        if (metrics) {
          totalViews += metrics.views || 0;
          totalLikes += metrics.likes || 0;
          totalComments += metrics.comments || 0;
        }
      });

      setStats({
        followers: accountMetrics?.[0]?.followers || 0,
        totalVideos,
        totalViews,
        totalLikes,
        totalComments,
        engagementRate: computeEngagementRate(totalLikes, totalComments, totalViews),
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
  }, [clientId]);

  // Sync YouTube data
  const handleSyncYouTube = async () => {
    setIsSyncing(true);
    try {
      // Check for connected YouTube account
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
          {[...Array(4)].map((_, i) => (
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
    <div className="pt-4 border-t border-border space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Youtube className="h-4 w-4 text-red-500" />
          <h4 className="text-sm font-medium text-foreground">YouTube Analytics</h4>
        </div>
        <Button variant="outline" size="sm" onClick={handleSyncYouTube} disabled={isSyncing}>
          {isSyncing ? (
            <>
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              <span className="text-xs">Syncing</span>
            </>
          ) : (
            <>
              <RefreshCw className="h-3 w-3 mr-1" />
              <span className="text-xs">Sync</span>
            </>
          )}
        </Button>
      </div>

      {stats ? (
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-accent/50 rounded-lg p-3">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Users className="h-3 w-3" />
              <span className="text-xs">Subscribers</span>
            </div>
            <p className="text-lg font-semibold">{stats.followers.toLocaleString()}</p>
          </div>
          <div className="bg-accent/50 rounded-lg p-3">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Eye className="h-3 w-3" />
              <span className="text-xs">Total Views</span>
            </div>
            <p className="text-lg font-semibold">{stats.totalViews.toLocaleString()}</p>
          </div>
          <div className="bg-accent/50 rounded-lg p-3">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
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
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <PlayCircle className="h-3 w-3" />
              <span className="text-xs">Videos</span>
            </div>
            <p className="text-lg font-semibold">{stats.totalVideos}</p>
          </div>
        </div>
      ) : (
        <div className="bg-muted/50 rounded-lg p-3 text-center">
          <p className="text-xs text-muted-foreground">No YouTube data. Click Sync to fetch.</p>
        </div>
      )}
    </div>
  );
};
