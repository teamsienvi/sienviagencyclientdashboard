import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Settings, Users, Eye, Heart, MessageCircle, Share2, TrendingUp, ExternalLink, Save, AlertCircle, Play, Clock } from "lucide-react";
import { toast } from "sonner";
import { format, subDays } from "date-fns";
import { cn } from "@/lib/utils";

interface MetricoolAnalyticsSectionProps {
  clientId: string;
  clientName: string;
  platform: "tiktok" | "linkedin";
  platformIcon: React.ReactNode;
  platformColor: string;
}

interface MetricoolConfig {
  id: string;
  user_id: string;
  blog_id: string | null;
  is_active: boolean;
}

interface AccountMetric {
  id: string;
  followers: number | null;
  engagement_rate: number | null;
  period_start: string;
  period_end: string;
  collected_at: string;
}

interface TikTokPost {
  title: string | null;
  date: string | null;
  type: string | null;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  reach: number;
  duration: string | null;
  engagement: number;
  url: string | null;
  link: string | null;
  image: string | null;
}

interface ContentWithMetrics {
  id: string;
  content_id: string;
  title: string | null;
  url: string | null;
  published_at: string;
  content_type: string;
  metrics: {
    views: number;
    likes: number;
    comments: number;
    shares: number;
    reach: number;
    impressions: number;
  } | null;
}

export const MetricoolAnalyticsSection = ({
  clientId,
  clientName,
  platform,
  platformIcon,
  platformColor,
}: MetricoolAnalyticsSectionProps) => {
  const queryClient = useQueryClient();
  const [showConfig, setShowConfig] = useState(false);
  const [userId, setUserId] = useState("");
  const [blogId, setBlogId] = useState("");
  
  // Store live data from Metricool API
  const [liveEngagement, setLiveEngagement] = useState<number | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [livePosts, setLivePosts] = useState<TikTokPost[]>([]);

  // Fetch Metricool config for this client/platform
  const { data: config, isLoading: configLoading } = useQuery({
    queryKey: ["metricool-config", clientId, platform],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_metricool_config")
        .select("*")
        .eq("client_id", clientId)
        .eq("platform", platform)
        .eq("is_active", true)
        .maybeSingle();

      if (error) throw error;
      return data as MetricoolConfig | null;
    },
  });

  // Fetch latest account metrics
  const { data: accountMetrics, isLoading: metricsLoading } = useQuery({
    queryKey: ["metricool-account-metrics", clientId, platform],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("social_account_metrics")
        .select("*")
        .eq("client_id", clientId)
        .eq("platform", platform)
        .order("collected_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data as AccountMetric | null;
    },
    enabled: !!config,
  });

  // Fetch content with metrics
  const { data: contentData, isLoading: contentLoading } = useQuery({
    queryKey: ["metricool-content", clientId, platform],
    queryFn: async () => {
      // First get content
      const { data: content, error: contentError } = await supabase
        .from("social_content")
        .select("*")
        .eq("client_id", clientId)
        .eq("platform", platform)
        .order("published_at", { ascending: false })
        .limit(10);

      if (contentError) throw contentError;
      if (!content || content.length === 0) return [];

      // Get metrics for each content
      const contentWithMetrics: ContentWithMetrics[] = await Promise.all(
        content.map(async (c) => {
          const { data: metrics } = await supabase
            .from("social_content_metrics")
            .select("*")
            .eq("social_content_id", c.id)
            .order("collected_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          return {
            id: c.id,
            content_id: c.content_id,
            title: c.title,
            url: c.url,
            published_at: c.published_at,
            content_type: c.content_type,
            metrics: metrics ? {
              views: metrics.views || 0,
              likes: metrics.likes || 0,
              comments: metrics.comments || 0,
              shares: metrics.shares || 0,
              reach: metrics.reach || 0,
              impressions: metrics.impressions || 0,
            } : null,
          };
        })
      );

      return contentWithMetrics;
    },
    enabled: !!config,
  });

  // Save config mutation
  const saveConfigMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("client_metricool_config")
        .upsert({
          client_id: clientId,
          platform: platform,
          user_id: userId,
          blog_id: blogId || null,
          is_active: true,
        }, { onConflict: "client_id,platform" });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Configuration saved!");
      queryClient.invalidateQueries({ queryKey: ["metricool-config", clientId, platform] });
      setShowConfig(false);
    },
    onError: (error) => {
      toast.error(`Failed to save: ${error.message}`);
    },
  });

  // Sync mutation - uses metricool-tiktok-posts edge function to fetch CSV data
  const syncMutation = useMutation({
    mutationFn: async () => {
      if (!config) throw new Error("No configuration found");
      if (!config.user_id) throw new Error("User ID not configured");

      // Build ISO date strings with timezone offset
      const now = new Date();
      const startDate = subDays(now, 7);
      
      const formatWithTimezone = (date: Date, isEnd: boolean) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const time = isEnd ? "23:59:59" : "00:00:00";
        const offset = "+00:00";
        return `${year}-${month}-${day}T${time}${offset}`;
      };

      const from = formatWithTimezone(startDate, false);
      const to = formatWithTimezone(now, true);

      console.log("Syncing TikTok posts:", { 
        clientId, 
        platform, 
        userId: config.user_id, 
        blogId: config.blog_id,
        from,
        to 
      });

      // Call the TikTok posts endpoint with clientId to persist data
      const { data, error } = await supabase.functions.invoke("metricool-tiktok-posts", {
        body: {
          from,
          to,
          timezone: "UTC",
          userId: config.user_id,
          blogId: config.blog_id || undefined,
          clientId, // Pass clientId to persist data to database
        },
      });

      if (error) throw error;
      
      // Check for upstream errors
      if (data.error) {
        console.error("Metricool upstream error:", data);
        throw new Error(`${data.error} (status: ${data.upstreamStatus})`);
      }
      
      if (!data.success) throw new Error("Sync failed - no data returned");
      
      console.log("Metricool TikTok posts response:", data);
      return data;
    },
    onSuccess: (data) => {
      toast.success(`Synced ${data.rows?.length || 0} TikTok posts from Metricool`);
      console.log("Sync success, posts:", data.rows);
      
      // Store the live posts data
      if (data.rows && Array.isArray(data.rows)) {
        setLivePosts(data.rows);
        setLastSyncTime(new Date());
        
        // Calculate average engagement from posts
        if (data.rows.length > 0) {
          const avgEngagement = data.rows.reduce((sum: number, p: TikTokPost) => sum + (p.engagement || 0), 0) / data.rows.length;
          setLiveEngagement(avgEngagement);
        }
      }
      
      queryClient.invalidateQueries({ queryKey: ["metricool-account-metrics", clientId, platform] });
      queryClient.invalidateQueries({ queryKey: ["metricool-content", clientId, platform] });
    },
    onError: (error) => {
      toast.error(`Sync failed: ${error.message}`);
    },
  });

  const formatNumber = (num: number | null | undefined): string => {
    if (num === null || num === undefined) return "0";
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  if (configLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  // No config - show setup
  if (!config) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {platformIcon}
            <span className={platformColor}>
              {platform === "tiktok" ? "TikTok" : "LinkedIn"} Analytics
            </span>
          </CardTitle>
          <CardDescription>
            Connect your Metricool account to sync {platform === "tiktok" ? "TikTok" : "LinkedIn"} analytics
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-muted/50 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div className="text-sm text-muted-foreground">
              <p className="font-medium text-foreground mb-1">Setup Required</p>
              <p>Enter your Metricool User ID to start syncing analytics data for {clientName}.</p>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <Label htmlFor="userId">Metricool User ID</Label>
              <Input
                id="userId"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                placeholder="Enter your Metricool user ID"
              />
            </div>
            <div>
              <Label htmlFor="blogId">Blog ID (Optional)</Label>
              <Input
                id="blogId"
                value={blogId}
                onChange={(e) => setBlogId(e.target.value)}
                placeholder="Leave empty to auto-detect"
              />
            </div>
            <Button
              onClick={() => saveConfigMutation.mutate()}
              disabled={!userId || saveConfigMutation.isPending}
            >
              <Save className="h-4 w-4 mr-2" />
              Save Configuration
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with sync button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">
            Metricool Connected
          </Badge>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowConfig(!showConfig)}
          >
            <Settings className="h-4 w-4" />
          </Button>
        </div>
        <Button
          onClick={() => syncMutation.mutate()}
          disabled={syncMutation.isPending}
          size="sm"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${syncMutation.isPending ? "animate-spin" : ""}`} />
          Sync Now
        </Button>
      </div>

      {/* Config editor */}
      {showConfig && (
        <Card>
          <CardContent className="pt-4 space-y-3">
            <div>
              <Label htmlFor="editUserId">Metricool User ID</Label>
              <Input
                id="editUserId"
                value={userId || config.user_id}
                onChange={(e) => setUserId(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="editBlogId">Blog ID</Label>
              <Input
                id="editBlogId"
                value={blogId || config.blog_id || ""}
                onChange={(e) => setBlogId(e.target.value)}
                placeholder="Auto-detect"
              />
            </div>
            <Button
              size="sm"
              onClick={() => saveConfigMutation.mutate()}
              disabled={saveConfigMutation.isPending}
            >
              Update Configuration
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Account Metrics Overview - 6 cards like other platforms */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Users className="h-4 w-4" />
              <span className="text-sm">Followers</span>
            </div>
            {metricsLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <p className="text-2xl font-bold">
                {formatNumber(accountMetrics?.followers)}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Eye className="h-4 w-4" />
              <span className="text-sm">Total Views</span>
              {livePosts.length > 0 && (
                <Badge variant="secondary" className="text-[10px] px-1 py-0">Live</Badge>
              )}
            </div>
            <p className="text-2xl font-bold">
              {livePosts.length > 0
                ? formatNumber(livePosts.reduce((sum, p) => sum + (p.views || 0), 0))
                : "—"
              }
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Heart className="h-4 w-4" />
              <span className="text-sm">Total Likes</span>
            </div>
            <p className="text-2xl font-bold">
              {livePosts.length > 0
                ? formatNumber(livePosts.reduce((sum, p) => sum + (p.likes || 0), 0))
                : "—"
              }
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <TrendingUp className="h-4 w-4" />
              <span className="text-sm">Engagement</span>
              {liveEngagement !== null && (
                <Badge variant="secondary" className="text-[10px] px-1 py-0">Live</Badge>
              )}
            </div>
            <p className="text-2xl font-bold">
              {liveEngagement !== null 
                ? `${liveEngagement.toFixed(2)}%`
                : `${accountMetrics?.engagement_rate?.toFixed(2) || "0"}%`
              }
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Play className="h-4 w-4" />
              <span className="text-sm">Total Posts</span>
            </div>
            <p className="text-2xl font-bold">
              {livePosts.length > 0 ? livePosts.length : "—"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Clock className="h-4 w-4" />
              <span className="text-sm">Last Synced</span>
            </div>
            {lastSyncTime ? (
              <p className="text-sm font-medium">
                {format(lastSyncTime, "MMM d, h:mm a")}
              </p>
            ) : metricsLoading ? (
              <Skeleton className="h-6 w-24" />
            ) : accountMetrics ? (
              <p className="text-sm font-medium">
                {format(new Date(accountMetrics.collected_at), "MMM d, h:mm a")}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">Never</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Content Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            Recent {platform === "tiktok" ? "Videos" : "Posts"}
            {livePosts.length > 0 && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5">Live</Badge>
            )}
          </CardTitle>
          <CardDescription>
            Latest {platform === "tiktok" ? "videos" : "posts"} with performance metrics from the past 7 days
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Show live posts if available */}
          {livePosts.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[200px]">Video</TableHead>
                  <TableHead className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Eye className="h-3 w-3" />
                      Views
                    </div>
                  </TableHead>
                  <TableHead className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Heart className="h-3 w-3" />
                      Likes
                    </div>
                  </TableHead>
                  <TableHead className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <MessageCircle className="h-3 w-3" />
                      Comments
                    </div>
                  </TableHead>
                  <TableHead className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Share2 className="h-3 w-3" />
                      Shares
                    </div>
                  </TableHead>
                  <TableHead className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <TrendingUp className="h-3 w-3" />
                      Engagement
                    </div>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {livePosts.map((post, idx) => (
                  <TableRow key={idx}>
                    <TableCell>
                      <div className="max-w-[300px]">
                        {(post.url || post.link) ? (
                          <a
                            href={post.url || post.link || "#"}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-medium text-sm line-clamp-1 text-primary hover:underline flex items-center gap-1"
                          >
                            {post.title || "Untitled"}
                            <ExternalLink className="h-3 w-3 flex-shrink-0" />
                          </a>
                        ) : (
                          <p className="font-medium text-sm line-clamp-1">
                            {post.title || "Untitled"}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground">
                          {post.date || "Unknown date"}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {post.views.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                      {post.likes.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                      {post.comments.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                      {post.shares.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge
                        variant="secondary"
                        className={cn(
                          post.engagement >= 5
                            ? "bg-green-500/20 text-green-600"
                            : post.engagement >= 2
                            ? "bg-yellow-500/20 text-yellow-600"
                            : "bg-muted text-muted-foreground"
                        )}
                      >
                        {post.engagement?.toFixed(2)}%
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : contentLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : contentData && contentData.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[200px]">Video</TableHead>
                  <TableHead className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Eye className="h-3 w-3" />
                      Views
                    </div>
                  </TableHead>
                  <TableHead className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Heart className="h-3 w-3" />
                      Likes
                    </div>
                  </TableHead>
                  <TableHead className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <MessageCircle className="h-3 w-3" />
                      Comments
                    </div>
                  </TableHead>
                  <TableHead className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Share2 className="h-3 w-3" />
                      Shares
                    </div>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contentData.map((content) => (
                  <TableRow key={content.id}>
                    <TableCell>
                      <div className="max-w-[300px]">
                        {content.url ? (
                          <a
                            href={content.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-medium text-sm line-clamp-1 text-primary hover:underline flex items-center gap-1"
                          >
                            {content.title || "Untitled"}
                            <ExternalLink className="h-3 w-3 flex-shrink-0" />
                          </a>
                        ) : (
                          <p className="font-medium text-sm line-clamp-1">
                            {content.title || "Untitled"}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(content.published_at), "MMM d, yyyy")}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {(content.metrics?.views || 0).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                      {(content.metrics?.likes || 0).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                      {(content.metrics?.comments || 0).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                      {(content.metrics?.shares || 0).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <p>No content data yet.</p>
              <p className="text-sm">Click "Sync Now" to fetch data from Metricool.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default MetricoolAnalyticsSection;
