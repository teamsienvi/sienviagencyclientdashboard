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
import { RefreshCw, Settings, Users, Eye, Heart, MessageCircle, Share2, TrendingUp, ExternalLink, Save, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { format, subDays } from "date-fns";

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
  
  // Store live aggregation data from Metricool API
  const [liveEngagement, setLiveEngagement] = useState<number | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);

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

  // Sync mutation - uses metricool-aggregation edge function
  const syncMutation = useMutation({
    mutationFn: async () => {
      if (!config) throw new Error("No configuration found");
      if (!config.user_id) throw new Error("User ID not configured");

      // Build ISO date strings with timezone offset (e.g., 2025-12-30T00:00:00+08:00)
      const now = new Date();
      const startDate = subDays(now, 7);
      
      // Format with timezone offset
      const formatWithTimezone = (date: Date, isEnd: boolean) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const time = isEnd ? "23:59:59" : "00:00:00";
        // Use a common timezone offset (e.g., +08:00 for Asia/Shanghai or UTC)
        const offset = "+00:00";
        return `${year}-${month}-${day}T${time}${offset}`;
      };

      const from = formatWithTimezone(startDate, false);
      const to = formatWithTimezone(now, true);

      console.log("Syncing with metricool-aggregation:", { 
        clientId, 
        platform, 
        userId: config.user_id, 
        blogId: config.blog_id,
        from,
        to 
      });

      // Call the new aggregation endpoint
      const { data, error } = await supabase.functions.invoke("metricool-aggregation", {
        body: {
          from,
          to,
          metric: "engagement",
          network: platform,
          timezone: "UTC",
          subject: "video",
          userId: config.user_id,
          blogId: config.blog_id || undefined,
        },
      });

      if (error) throw error;
      
      // Check for upstream errors
      if (data.error) {
        console.error("Metricool upstream error:", data);
        throw new Error(data.error);
      }
      
      if (!data.success) throw new Error("Sync failed - no data returned");
      
      console.log("Metricool aggregation response:", data);
      return data;
    },
    onSuccess: (data) => {
      toast.success("Synced analytics from Metricool");
      console.log("Sync success, data:", data);
      
      // Store the live engagement data
      if (data.data?.data !== undefined) {
        setLiveEngagement(data.data.data);
        setLastSyncTime(new Date());
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

      {/* Account Metrics Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Users className="h-4 w-4" />
              <span className="text-xs">Followers</span>
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
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <TrendingUp className="h-4 w-4" />
              <span className="text-xs">Engagement Rate</span>
              {liveEngagement !== null && (
                <Badge variant="secondary" className="text-[10px] px-1 py-0">Live</Badge>
              )}
            </div>
            {metricsLoading && liveEngagement === null ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <p className="text-2xl font-bold">
                {liveEngagement !== null 
                  ? `${liveEngagement.toFixed(2)}%`
                  : `${accountMetrics?.engagement_rate?.toFixed(2) || "0"}%`
                }
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Eye className="h-4 w-4" />
              <span className="text-xs">Period</span>
            </div>
            {lastSyncTime ? (
              <p className="text-sm font-medium">
                {format(subDays(new Date(), 7), "MMM d")} - {format(new Date(), "MMM d")}
              </p>
            ) : metricsLoading ? (
              <Skeleton className="h-8 w-32" />
            ) : accountMetrics ? (
              <p className="text-sm font-medium">
                {format(new Date(accountMetrics.period_start), "MMM d")} - {format(new Date(accountMetrics.period_end), "MMM d")}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">No data</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <RefreshCw className="h-4 w-4" />
              <span className="text-xs">Last Synced</span>
            </div>
            {lastSyncTime ? (
              <p className="text-sm font-medium">
                {format(lastSyncTime, "MMM d, h:mm a")}
              </p>
            ) : metricsLoading ? (
              <Skeleton className="h-8 w-24" />
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
          <CardTitle className="text-lg">Recent Content</CardTitle>
          <CardDescription>
            Latest {platform === "tiktok" ? "videos" : "posts"} with performance metrics
          </CardDescription>
        </CardHeader>
        <CardContent>
          {contentLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : contentData && contentData.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Content</TableHead>
                  <TableHead className="text-center">
                    <Eye className="h-4 w-4 mx-auto" />
                  </TableHead>
                  <TableHead className="text-center">
                    <Heart className="h-4 w-4 mx-auto" />
                  </TableHead>
                  <TableHead className="text-center">
                    <MessageCircle className="h-4 w-4 mx-auto" />
                  </TableHead>
                  <TableHead className="text-center">
                    <Share2 className="h-4 w-4 mx-auto" />
                  </TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contentData.map((content) => (
                  <TableRow key={content.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium line-clamp-1">
                          {content.title || "Untitled"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(content.published_at), "MMM d, yyyy")}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      {formatNumber(content.metrics?.views)}
                    </TableCell>
                    <TableCell className="text-center">
                      {formatNumber(content.metrics?.likes)}
                    </TableCell>
                    <TableCell className="text-center">
                      {formatNumber(content.metrics?.comments)}
                    </TableCell>
                    <TableCell className="text-center">
                      {formatNumber(content.metrics?.shares)}
                    </TableCell>
                    <TableCell>
                      {content.url && (
                        <Button
                          variant="ghost"
                          size="sm"
                          asChild
                        >
                          <a href={content.url} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        </Button>
                      )}
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
