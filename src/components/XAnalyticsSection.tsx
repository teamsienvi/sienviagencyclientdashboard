import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { RefreshCw, Users, TrendingUp, MessageSquare, ExternalLink, Twitter, Heart, Repeat2, Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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

const XAnalyticsSection = ({ clientId, clientName }: XAnalyticsSectionProps) => {
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [accountMetrics, setAccountMetrics] = useState<XAccountMetrics | null>(null);
  const [content, setContent] = useState<(XContent & { metrics?: XContentMetrics })[]>([]);
  const [socialAccount, setSocialAccount] = useState<{ id: string; account_id: string } | null>(null);

  useEffect(() => {
    fetchData();
  }, [clientId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch social account for X
      const { data: accountData } = await supabase
        .from("social_accounts")
        .select("id, account_id")
        .eq("client_id", clientId)
        .eq("platform", "x")
        .eq("is_active", true)
        .maybeSingle();

      setSocialAccount(accountData);

      // Fetch latest account metrics
      const { data: metricsData } = await supabase
        .from("social_account_metrics")
        .select("*")
        .eq("client_id", clientId)
        .eq("platform", "x")
        .order("collected_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      setAccountMetrics(metricsData);

      // Fetch content with metrics
      const { data: contentData } = await supabase
        .from("social_content")
        .select(`
          id, content_id, title, url, published_at, content_type,
          social_content_metrics(social_content_id, impressions, engagements, likes, comments, shares)
        `)
        .eq("client_id", clientId)
        .eq("platform", "x")
        .order("published_at", { ascending: false })
        .limit(50);

      if (contentData) {
        const contentWithMetrics = contentData.map((item: any) => ({
          ...item,
          metrics: item.social_content_metrics?.[0] || null,
        }));
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
      const today = new Date();
      const lastWeek = new Date(today);
      lastWeek.setDate(lastWeek.getDate() - 7);

      const { data, error } = await supabase.functions.invoke("sync-x", {
        body: {
          clientId,
          accountId: socialAccount.id,
          accountExternalId: socialAccount.account_id,
          periodStart: lastWeek.toISOString().split("T")[0],
          periodEnd: today.toISOString().split("T")[0],
        },
      });

      if (error) throw error;

      if (data?.success) {
        toast.success(`Synced ${data.recordsSynced} posts from X`);
        fetchData();
      } else {
        toast.error(data?.error || "Failed to sync X data");
      }
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

  return (
    <div className="space-y-6">
      {/* Header with sync button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Twitter className="h-5 w-5" />
          <span className="text-sm text-muted-foreground">
            {socialAccount ? "Account connected" : "No account connected"}
          </span>
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
