import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { LinkedInOAuthConnect } from "@/components/LinkedInOAuthConnect";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Loader2, Linkedin, Eye, Heart, MessageCircle, Share2, Users, ArrowLeft } from "lucide-react";
import { format } from "date-fns";

const LinkedInAnalytics = () => {
  const { clientId } = useParams<{ clientId: string }>();
  const navigate = useNavigate();

  // Fetch client details
  const { data: client, isLoading: isLoadingClient } = useQuery({
    queryKey: ["client", clientId],
    queryFn: async () => {
      if (!clientId) return null;
      const { data, error } = await supabase
        .from("clients")
        .select("id, name, logo_url")
        .eq("id", clientId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!clientId,
  });

  // Fetch LinkedIn account for client
  const { data: linkedinAccount, isLoading: isLoadingAccount } = useQuery({
    queryKey: ["linkedin-account", clientId],
    queryFn: async () => {
      if (!clientId) return null;
      const { data, error } = await supabase
        .from("social_accounts")
        .select("*")
        .eq("client_id", clientId)
        .eq("platform", "linkedin")
        .eq("is_active", true)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!clientId,
  });

  // Fetch account metrics
  const { data: accountMetrics } = useQuery({
    queryKey: ["linkedin-account-metrics", clientId],
    queryFn: async () => {
      if (!clientId) return null;
      const { data, error } = await supabase
        .from("social_account_metrics")
        .select("*")
        .eq("client_id", clientId)
        .eq("platform", "linkedin")
        .order("period_end", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!clientId && !!linkedinAccount,
  });

  // Fetch content and metrics
  const { data: contentData, isLoading: isLoadingContent } = useQuery({
    queryKey: ["linkedin-content", clientId],
    queryFn: async () => {
      if (!clientId) return [];
      
      const { data: content, error: contentError } = await supabase
        .from("social_content")
        .select(`
          *,
          social_content_metrics (*)
        `)
        .eq("client_id", clientId)
        .eq("platform", "linkedin")
        .order("published_at", { ascending: false })
        .limit(50);

      if (contentError) throw contentError;
      return content || [];
    },
    enabled: !!clientId && !!linkedinAccount,
  });

  const isConnected = !!linkedinAccount;

  if (!clientId) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              No client specified. Please select a client from the dashboard.
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-8">
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-2">
                <Linkedin className="h-8 w-8 text-[#0A66C2]" />
                {isLoadingClient ? "Loading..." : client?.name || "LinkedIn Analytics"}
              </h1>
              <p className="text-muted-foreground mt-1">
                LinkedIn performance metrics and content analytics
              </p>
            </div>
          </div>

          {clientId && (
            <>
              {/* Connection Status */}
              <LinkedInOAuthConnect clientId={clientId} />

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
                          <CardTitle className="text-sm font-medium">Total Posts</CardTitle>
                          <Linkedin className="h-4 w-4 text-muted-foreground" />
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
                      <CardTitle>Recent Posts</CardTitle>
                      <CardDescription>
                        Performance metrics for recent LinkedIn content
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
                              <TableHead className="text-right">Impressions</TableHead>
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
                                      {metrics?.impressions?.toLocaleString() || 0}
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
                          No content data available. Run a sync to fetch LinkedIn analytics.
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </>
              )}

              {!isConnected && !isLoadingAccount && (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground">
                    Connect a LinkedIn account above to view analytics
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

export default LinkedInAnalytics;
