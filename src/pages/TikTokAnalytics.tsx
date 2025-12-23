import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { TikTokOAuthConnect } from "@/components/TikTokOAuthConnect";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, Music2, Eye, Heart, MessageCircle, Share2, Users } from "lucide-react";
import { format } from "date-fns";

const TikTokAnalytics = () => {
  const [selectedClientId, setSelectedClientId] = useState<string>("");

  // Fetch clients
  const { data: clients } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, name, logo_url")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // Fetch TikTok account for selected client
  const { data: tiktokAccount, isLoading: isLoadingAccount } = useQuery({
    queryKey: ["tiktok-account", selectedClientId],
    queryFn: async () => {
      if (!selectedClientId) return null;
      const { data, error } = await supabase
        .from("social_accounts")
        .select("*")
        .eq("client_id", selectedClientId)
        .eq("platform", "tiktok")
        .eq("is_active", true)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!selectedClientId,
  });

  // Fetch account metrics
  const { data: accountMetrics } = useQuery({
    queryKey: ["tiktok-account-metrics", selectedClientId],
    queryFn: async () => {
      if (!selectedClientId) return null;
      const { data, error } = await supabase
        .from("social_account_metrics")
        .select("*")
        .eq("client_id", selectedClientId)
        .eq("platform", "tiktok")
        .order("period_end", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!selectedClientId && !!tiktokAccount,
  });

  // Fetch content and metrics
  const { data: contentData, isLoading: isLoadingContent } = useQuery({
    queryKey: ["tiktok-content", selectedClientId],
    queryFn: async () => {
      if (!selectedClientId) return [];
      
      const { data: content, error: contentError } = await supabase
        .from("social_content")
        .select(`
          *,
          social_content_metrics (*)
        `)
        .eq("client_id", selectedClientId)
        .eq("platform", "tiktok")
        .order("published_at", { ascending: false })
        .limit(50);

      if (contentError) throw contentError;
      return content || [];
    },
    enabled: !!selectedClientId && !!tiktokAccount,
  });

  const isConnected = !!tiktokAccount;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-8">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-2">
                <Music2 className="h-8 w-8" />
                TikTok Analytics
              </h1>
              <p className="text-muted-foreground mt-1">
                View TikTok performance metrics and content analytics
              </p>
            </div>
          </div>

          {/* Client Selection */}
          <Card>
            <CardHeader>
              <CardTitle>Select Client</CardTitle>
              <CardDescription>Choose a client to view their TikTok analytics</CardDescription>
            </CardHeader>
            <CardContent>
              <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                <SelectTrigger className="w-full max-w-sm">
                  <SelectValue placeholder="Choose a client..." />
                </SelectTrigger>
                <SelectContent>
                  {clients?.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {selectedClientId && (
            <>
              {/* Connection Status */}
              <TikTokOAuthConnect clientId={selectedClientId} />

              {isConnected && (
                <>
                  {/* Account Overview */}
                  {accountMetrics && (
                    <div className="grid gap-4 md:grid-cols-4">
                      <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                          <CardTitle className="text-sm font-medium">Followers</CardTitle>
                          <Users className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-bold">
                            {accountMetrics.followers?.toLocaleString() || 0}
                          </div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                          <CardTitle className="text-sm font-medium">Engagement Rate</CardTitle>
                          <Heart className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-bold">
                            {accountMetrics.engagement_rate?.toFixed(2) || 0}%
                          </div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                          <CardTitle className="text-sm font-medium">Total Videos</CardTitle>
                          <Music2 className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-bold">
                            {accountMetrics.total_content || 0}
                          </div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                          <CardTitle className="text-sm font-medium">Period</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-sm text-muted-foreground">
                            {accountMetrics.period_start && accountMetrics.period_end && (
                              <>
                                {format(new Date(accountMetrics.period_start), "MMM d")} -{" "}
                                {format(new Date(accountMetrics.period_end), "MMM d, yyyy")}
                              </>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  )}

                  {/* Content Table */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Recent Videos</CardTitle>
                      <CardDescription>
                        Performance metrics for recent TikTok content
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {isLoadingContent ? (
                        <div className="flex items-center justify-center py-8">
                          <Loader2 className="h-6 w-6 animate-spin" />
                        </div>
                      ) : contentData && contentData.length > 0 ? (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Title</TableHead>
                              <TableHead>Published</TableHead>
                              <TableHead className="text-right">Views</TableHead>
                              <TableHead className="text-right">Likes</TableHead>
                              <TableHead className="text-right">Comments</TableHead>
                              <TableHead className="text-right">Shares</TableHead>
                              <TableHead>Link</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {contentData.map((content) => {
                              const metrics = content.social_content_metrics?.[0];
                              return (
                                <TableRow key={content.id}>
                                  <TableCell className="font-medium max-w-[200px] truncate">
                                    {content.title || "Untitled"}
                                  </TableCell>
                                  <TableCell>
                                    {format(new Date(content.published_at), "MMM d, yyyy")}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <div className="flex items-center justify-end gap-1">
                                      <Eye className="h-3 w-3 text-muted-foreground" />
                                      {metrics?.views?.toLocaleString() || 0}
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <div className="flex items-center justify-end gap-1">
                                      <Heart className="h-3 w-3 text-muted-foreground" />
                                      {metrics?.likes?.toLocaleString() || 0}
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <div className="flex items-center justify-end gap-1">
                                      <MessageCircle className="h-3 w-3 text-muted-foreground" />
                                      {metrics?.comments?.toLocaleString() || 0}
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <div className="flex items-center justify-end gap-1">
                                      <Share2 className="h-3 w-3 text-muted-foreground" />
                                      {metrics?.shares?.toLocaleString() || 0}
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    {content.url && (
                                      <a
                                        href={content.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-primary hover:underline text-sm"
                                      >
                                        View
                                      </a>
                                    )}
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      ) : (
                        <div className="text-center py-8 text-muted-foreground">
                          No content data available. Run a sync to fetch TikTok analytics.
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </>
              )}

              {!isConnected && !isLoadingAccount && (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground">
                    Connect a TikTok account above to view analytics
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
};

export default TikTokAnalytics;
