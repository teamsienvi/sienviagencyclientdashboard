import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Instagram, Facebook, RefreshCw, Check, Link2, Unlink, Play, CheckCircle2, XCircle, Clock } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface MetaPage {
  pageId: string;
  pageName: string;
  pagePicture: string | null;
  pageAccessToken: string;
  instagramBusinessId: string | null;
  instagramUsername: string | null;
  instagramPicture: string | null;
}

interface Client {
  id: string;
  name: string;
  logo_url: string | null;
  assignedPageId: string | null;
  assignedPageName: string | null;
  instagramUsername: string | null;
  instagramBusinessId: string | null;
  pageAccessToken: string | null;
  lastSyncAt: string | null;
  lastSyncPlatform: string | null;
}

interface SyncStatus {
  clientId: string;
  platform: "instagram" | "facebook";
  status: "pending" | "syncing" | "success" | "error";
  message?: string;
}

export const BulkMetaPageAssignment = () => {
  const [pages, setPages] = useState<MetaPage[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [metaUserId, setMetaUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncStatuses, setSyncStatuses] = useState<SyncStatus[]>([]);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch all clients
      const { data: clientsData, error: clientsError } = await supabase
        .from("clients")
        .select("id, name, logo_url")
        .eq("is_active", true)
        .order("name");

      if (clientsError) throw clientsError;

      // Fetch current assignments
      const { data: assignments, error: assignmentsError } = await supabase
        .from("social_oauth_accounts")
        .select("client_id, page_id, instagram_business_id")
        .eq("is_active", true);

      if (assignmentsError) throw assignmentsError;

      // Fetch last sync timestamps for each client
      const { data: syncLogs, error: syncLogsError } = await supabase
        .from("social_sync_logs")
        .select("client_id, platform, completed_at, status")
        .in("platform", ["instagram", "facebook"])
        .eq("status", "success")
        .order("completed_at", { ascending: false });

      if (syncLogsError) throw syncLogsError;

      // Get latest sync per client
      const latestSyncByClient: Record<string, { timestamp: string; platform: string }> = {};
      syncLogs?.forEach(log => {
        if (!latestSyncByClient[log.client_id] && log.completed_at) {
          latestSyncByClient[log.client_id] = { 
            timestamp: log.completed_at, 
            platform: log.platform 
          };
        }
      });

      // Fetch Meta pages
      const { data: pagesData, error: pagesError } = await supabase.functions.invoke("fetch-meta-pages");

      if (pagesError) throw pagesError;

      if (pagesData.error) {
        setError(pagesData.error);
        setPages([]);
      } else {
        setPages(pagesData.pages || []);
        setMetaUserId(pagesData.metaUserId);
      }

      // Map clients with their current assignments
      const clientsWithAssignments = (clientsData || []).map(client => {
        const assignment = (assignments || []).find(a => a.client_id === client.id);
        const page = (pagesData.pages || []).find((p: MetaPage) => p.pageId === assignment?.page_id);
        const lastSync = latestSyncByClient[client.id];
        return {
          ...client,
          assignedPageId: assignment?.page_id || null,
          assignedPageName: page?.pageName || null,
          instagramUsername: page?.instagramUsername || null,
          instagramBusinessId: page?.instagramBusinessId || null,
          pageAccessToken: page?.pageAccessToken || null,
          lastSyncAt: lastSync?.timestamp || null,
          lastSyncPlatform: lastSync?.platform || null,
        };
      });

      setClients(clientsWithAssignments);
    } catch (err: any) {
      console.error("Error fetching data:", err);
      setError(err.message || "Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAssign = async (clientId: string, pageId: string) => {
    if (!metaUserId) {
      toast.error("Meta user ID not found");
      return;
    }

    const page = pages.find(p => p.pageId === pageId);
    if (!page) {
      toast.error("Page not found");
      return;
    }

    setAssigning(clientId);
    try {
      const { error } = await supabase.functions.invoke("assign-meta-page", {
        body: {
          clientId,
          pageId: page.pageId,
          pageAccessToken: page.pageAccessToken,
          instagramBusinessId: page.instagramBusinessId,
          metaUserId,
        },
      });

      if (error) throw error;

      // Update local state
      setClients(prev => prev.map(c => 
        c.id === clientId 
          ? { 
              ...c, 
              assignedPageId: page.pageId, 
              assignedPageName: page.pageName,
              instagramUsername: page.instagramUsername,
              instagramBusinessId: page.instagramBusinessId,
              pageAccessToken: page.pageAccessToken,
            } 
          : c
      ));

      toast.success(`Assigned ${page.pageName} to client`);
    } catch (err: any) {
      console.error("Failed to assign page:", err);
      toast.error(err.message || "Failed to assign page");
    } finally {
      setAssigning(null);
    }
  };

  const handleUnassign = async (clientId: string) => {
    setAssigning(clientId);
    try {
      const { error } = await supabase
        .from("social_oauth_accounts")
        .update({ is_active: false })
        .eq("client_id", clientId);

      if (error) throw error;

      // Update local state
      setClients(prev => prev.map(c => 
        c.id === clientId 
          ? { ...c, assignedPageId: null, assignedPageName: null, instagramUsername: null, instagramBusinessId: null, pageAccessToken: null } 
          : c
      ));

      toast.success("Page unassigned from client");
    } catch (err: any) {
      console.error("Failed to unassign page:", err);
      toast.error(err.message || "Failed to unassign page");
    } finally {
      setAssigning(null);
    }
  };

  const handleSyncAll = async () => {
    const assignedClients = clients.filter(c => c.assignedPageId);
    if (assignedClients.length === 0) {
      toast.error("No clients have pages assigned");
      return;
    }

    setSyncing(true);

    // Initialize sync statuses
    const initialStatuses: SyncStatus[] = [];
    assignedClients.forEach(client => {
      if (client.instagramBusinessId) {
        initialStatuses.push({ clientId: client.id, platform: "instagram", status: "pending" });
      }
      if (client.assignedPageId) {
        initialStatuses.push({ clientId: client.id, platform: "facebook", status: "pending" });
      }
    });
    setSyncStatuses(initialStatuses);

    let successCount = 0;
    let errorCount = 0;

    // Fetch OAuth accounts to get access tokens
    const { data: oauthAccounts } = await supabase
      .from("social_oauth_accounts")
      .select("client_id, access_token, instagram_business_id, page_id")
      .eq("is_active", true);

    // Fetch social accounts for account IDs
    const { data: socialAccounts } = await supabase
      .from("social_accounts")
      .select("id, client_id, platform")
      .in("client_id", assignedClients.map(c => c.id))
      .in("platform", ["instagram", "facebook"])
      .eq("is_active", true);

    for (let i = 0; i < initialStatuses.length; i++) {
      const status = initialStatuses[i];
      const client = assignedClients.find(c => c.id === status.clientId);
      const oauth = oauthAccounts?.find(a => a.client_id === status.clientId);
      
      if (!client || !oauth) {
        setSyncStatuses(prev => prev.map((s, idx) => 
          idx === i ? { ...s, status: "error", message: "No OAuth token" } : s
        ));
        errorCount++;
        continue;
      }

      // Update status to syncing
      setSyncStatuses(prev => prev.map((s, idx) => 
        idx === i ? { ...s, status: "syncing" } : s
      ));

      const externalId = status.platform === "instagram" ? oauth.instagram_business_id : oauth.page_id;
      const socialAccount = socialAccounts?.find(
        sa => sa.client_id === status.clientId && sa.platform === status.platform
      );

      const periodEnd = new Date();
      const periodStart = new Date(periodEnd);
      periodStart.setDate(periodStart.getDate() - 7);

      try {
        const { data, error } = await supabase.functions.invoke("sync-meta", {
          body: {
            clientId: client.id,
            accountId: socialAccount?.id,
            platform: status.platform,
            accessToken: oauth.access_token,
            accountExternalId: externalId,
            periodStart: periodStart.toISOString().split("T")[0],
            periodEnd: periodEnd.toISOString().split("T")[0],
          },
        });

        if (error) throw error;

        setSyncStatuses(prev => prev.map((s, idx) => 
          idx === i ? { ...s, status: "success", message: `${data?.recordsSynced || 0} records` } : s
        ));
        successCount++;
      } catch (err: any) {
        setSyncStatuses(prev => prev.map((s, idx) => 
          idx === i ? { ...s, status: "error", message: err.message || "Sync failed" } : s
        ));
        errorCount++;
      }

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    setSyncing(false);
    toast.success(`Sync completed: ${successCount} successful, ${errorCount} failed`);
  };

  const getStatusIcon = (status: SyncStatus["status"]) => {
    switch (status) {
      case "pending": return <Clock className="h-3 w-3 text-muted-foreground" />;
      case "syncing": return <RefreshCw className="h-3 w-3 text-primary animate-spin" />;
      case "success": return <CheckCircle2 className="h-3 w-3 text-green-500" />;
      case "error": return <XCircle className="h-3 w-3 text-destructive" />;
    }
  };

  const assignedCount = clients.filter(c => c.assignedPageId).length;

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Link2 className="h-5 w-5" />
              Meta Page Assignments
            </CardTitle>
            <CardDescription>
              Assign Facebook Pages / Instagram accounts to clients without re-authenticating
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={fetchData} disabled={loading || syncing}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button size="sm" onClick={handleSyncAll} disabled={syncing || assignedCount === 0}>
              {syncing ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Syncing...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Sync All ({assignedCount})
                </>
              )}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {error ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground mb-4">{error}</p>
            <p className="text-sm text-muted-foreground">
              Connect a Meta account on any client first to enable bulk assignments.
            </p>
          </div>
        ) : pages.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground">
              No Meta pages available. Connect a Meta account on any client first.
            </p>
          </div>
        ) : (
          <>
            {syncStatuses.length > 0 && (
              <div className="mb-4 p-3 border rounded-lg bg-muted/30">
                <p className="text-sm font-medium mb-2">Sync Progress</p>
                <div className="flex flex-wrap gap-2">
                  {syncStatuses.map((status, idx) => {
                    const client = clients.find(c => c.id === status.clientId);
                    return (
                      <Badge key={idx} variant="outline" className="gap-1">
                        {getStatusIcon(status.status)}
                        <span className="text-xs">{client?.name} ({status.platform})</span>
                      </Badge>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="mb-4 flex flex-wrap gap-2">
              <span className="text-sm text-muted-foreground">Available pages:</span>
              {pages.map(page => (
                <Badge key={page.pageId} variant="secondary" className="gap-1">
                  <Facebook className="h-3 w-3" />
                  {page.pageName}
                  {page.instagramUsername && (
                    <span className="text-muted-foreground">
                      (@{page.instagramUsername})
                    </span>
                  )}
                </Badge>
              ))}
            </div>

            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Client</TableHead>
                    <TableHead>Current Assignment</TableHead>
                    <TableHead>Last Sync</TableHead>
                    <TableHead>Assign Page</TableHead>
                    <TableHead className="w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clients.map(client => (
                    <TableRow key={client.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={client.logo_url || ""} />
                            <AvatarFallback>{client.name.charAt(0)}</AvatarFallback>
                          </Avatar>
                          <span className="font-medium">{client.name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {client.assignedPageId ? (
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="gap-1">
                              <Check className="h-3 w-3 text-green-500" />
                              {client.assignedPageName}
                            </Badge>
                            {client.instagramUsername && (
                              <Badge variant="secondary" className="gap-1">
                                <Instagram className="h-3 w-3" />
                                @{client.instagramUsername}
                              </Badge>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">Not assigned</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {client.lastSyncAt ? (
                          <div className="flex flex-col">
                            <span className="text-sm">
                              {new Date(client.lastSyncAt).toLocaleDateString()}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {new Date(client.lastSyncAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">Never</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Select
                          value={client.assignedPageId || ""}
                          onValueChange={(value) => handleAssign(client.id, value)}
                          disabled={assigning === client.id}
                        >
                          <SelectTrigger className="w-[200px]">
                            <SelectValue placeholder="Select a page..." />
                          </SelectTrigger>
                          <SelectContent>
                            {pages.map(page => (
                              <SelectItem key={page.pageId} value={page.pageId}>
                                <div className="flex items-center gap-2">
                                  <Facebook className="h-4 w-4" />
                                  {page.pageName}
                                  {page.instagramUsername && (
                                    <span className="text-muted-foreground text-xs">
                                      (@{page.instagramUsername})
                                    </span>
                                  )}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        {client.assignedPageId && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleUnassign(client.id)}
                            disabled={assigning === client.id}
                          >
                            {assigning === client.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Unlink className="h-4 w-4" />
                            )}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};