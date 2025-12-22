import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, CheckCircle2, XCircle, Clock, Play } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface SyncStatus {
  clientId: string;
  clientName: string;
  platform: "instagram" | "facebook";
  status: "pending" | "syncing" | "success" | "error";
  message?: string;
}

interface ConnectedClient {
  clientId: string;
  clientName: string;
  oauthAccountId: string;
  accessToken: string;
  instagramBusinessId: string | null;
  pageId: string | null;
  instagramAccountId: string | null;
  facebookAccountId: string | null;
}

export const BulkMetaSync = () => {
  const [syncing, setSyncing] = useState(false);
  const [syncStatuses, setSyncStatuses] = useState<SyncStatus[]>([]);
  const [connectedClients, setConnectedClients] = useState<ConnectedClient[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchConnectedClients = async () => {
    setLoading(true);
    try {
      // Fetch all active OAuth accounts with their client info
      const { data: oauthAccounts, error: oauthError } = await supabase
        .from("social_oauth_accounts")
        .select(`
          id,
          access_token,
          instagram_business_id,
          page_id,
          client_id,
          clients!inner(id, name)
        `)
        .eq("is_active", true);

      if (oauthError) throw oauthError;

      // Fetch social accounts to get their IDs
      const clientIds = oauthAccounts?.map(a => a.client_id) || [];
      const { data: socialAccounts } = await supabase
        .from("social_accounts")
        .select("id, client_id, platform, account_id")
        .in("client_id", clientIds)
        .in("platform", ["instagram", "facebook"])
        .eq("is_active", true);

      const clients: ConnectedClient[] = (oauthAccounts || []).map((account: any) => {
        const igAccount = socialAccounts?.find(
          sa => sa.client_id === account.client_id && sa.platform === "instagram"
        );
        const fbAccount = socialAccounts?.find(
          sa => sa.client_id === account.client_id && sa.platform === "facebook"
        );

        return {
          clientId: account.client_id,
          clientName: account.clients.name,
          oauthAccountId: account.id,
          accessToken: account.access_token,
          instagramBusinessId: account.instagram_business_id,
          pageId: account.page_id,
          instagramAccountId: igAccount?.id || null,
          facebookAccountId: fbAccount?.id || null,
        };
      });

      setConnectedClients(clients);
      
      // Initialize sync statuses
      const statuses: SyncStatus[] = [];
      clients.forEach(client => {
        if (client.instagramBusinessId) {
          statuses.push({
            clientId: client.clientId,
            clientName: client.clientName,
            platform: "instagram",
            status: "pending",
          });
        }
        if (client.pageId) {
          statuses.push({
            clientId: client.clientId,
            clientName: client.clientName,
            platform: "facebook",
            status: "pending",
          });
        }
      });
      setSyncStatuses(statuses);

      toast.success(`Found ${clients.length} connected Meta clients`);
    } catch (error: any) {
      console.error("Error fetching connected clients:", error);
      toast.error("Failed to fetch connected clients");
    } finally {
      setLoading(false);
    }
  };

  const syncClient = async (client: ConnectedClient, platform: "instagram" | "facebook") => {
    const externalId = platform === "instagram" ? client.instagramBusinessId : client.pageId;
    const accountId = platform === "instagram" ? client.instagramAccountId : client.facebookAccountId;

    if (!externalId) return { success: false, message: "No account ID found" };

    const periodEnd = new Date();
    const periodStart = new Date(periodEnd);
    periodStart.setDate(periodStart.getDate() - 7);

    try {
      const { data, error } = await supabase.functions.invoke("sync-meta", {
        body: {
          clientId: client.clientId,
          accountId,
          platform,
          accessToken: client.accessToken,
          accountExternalId: externalId,
          periodStart: periodStart.toISOString().split("T")[0],
          periodEnd: periodEnd.toISOString().split("T")[0],
        },
      });

      if (error) throw error;

      return { 
        success: true, 
        message: `Synced ${data?.recordsSynced || 0} records` 
      };
    } catch (error: any) {
      console.error(`Sync error for ${client.clientName} ${platform}:`, error);
      return { success: false, message: error.message || "Sync failed" };
    }
  };

  const handleBulkSync = async () => {
    if (connectedClients.length === 0) {
      toast.error("No connected clients found. Click 'Load Clients' first.");
      return;
    }

    setSyncing(true);
    let successCount = 0;
    let errorCount = 0;

    // Process each sync status sequentially to avoid rate limiting
    for (let i = 0; i < syncStatuses.length; i++) {
      const status = syncStatuses[i];
      const client = connectedClients.find(c => c.clientId === status.clientId);
      
      if (!client) continue;

      // Update status to syncing
      setSyncStatuses(prev => 
        prev.map((s, idx) => 
          idx === i ? { ...s, status: "syncing" } : s
        )
      );

      const result = await syncClient(client, status.platform);

      // Update status with result
      setSyncStatuses(prev => 
        prev.map((s, idx) => 
          idx === i 
            ? { ...s, status: result.success ? "success" : "error", message: result.message } 
            : s
        )
      );

      if (result.success) {
        successCount++;
      } else {
        errorCount++;
      }

      // Small delay between syncs to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    setSyncing(false);
    toast.success(`Bulk sync completed: ${successCount} successful, ${errorCount} failed`);
  };

  const getStatusIcon = (status: SyncStatus["status"]) => {
    switch (status) {
      case "pending":
        return <Clock className="h-4 w-4 text-muted-foreground" />;
      case "syncing":
        return <RefreshCw className="h-4 w-4 text-primary animate-spin" />;
      case "success":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "error":
        return <XCircle className="h-4 w-4 text-destructive" />;
    }
  };

  const getStatusBadge = (status: SyncStatus["status"]) => {
    switch (status) {
      case "pending":
        return <Badge variant="secondary">Pending</Badge>;
      case "syncing":
        return <Badge variant="default">Syncing...</Badge>;
      case "success":
        return <Badge variant="outline" className="border-green-500 text-green-500">Success</Badge>;
      case "error":
        return <Badge variant="destructive">Failed</Badge>;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <RefreshCw className="h-5 w-5" />
          Bulk Meta Sync
        </CardTitle>
        <CardDescription>
          Sync all connected Meta (Instagram & Facebook) accounts at once
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={fetchConnectedClients}
            disabled={loading || syncing}
          >
            {loading ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Loading...
              </>
            ) : (
              "Load Clients"
            )}
          </Button>
          <Button 
            onClick={handleBulkSync}
            disabled={syncing || connectedClients.length === 0}
          >
            {syncing ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Syncing All...
              </>
            ) : (
              <>
                <Play className="mr-2 h-4 w-4" />
                Sync All ({syncStatuses.length})
              </>
            )}
          </Button>
        </div>

        {syncStatuses.length > 0 && (
          <div className="border rounded-lg divide-y">
            {syncStatuses.map((status, idx) => (
              <div 
                key={`${status.clientId}-${status.platform}-${idx}`}
                className="flex items-center justify-between p-3"
              >
                <div className="flex items-center gap-3">
                  {getStatusIcon(status.status)}
                  <div>
                    <p className="font-medium text-sm">{status.clientName}</p>
                    <p className="text-xs text-muted-foreground capitalize">{status.platform}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {status.message && (
                    <span className="text-xs text-muted-foreground max-w-[200px] truncate">
                      {status.message}
                    </span>
                  )}
                  {getStatusBadge(status.status)}
                </div>
              </div>
            ))}
          </div>
        )}

        {connectedClients.length === 0 && !loading && (
          <p className="text-sm text-muted-foreground text-center py-4">
            Click "Load Clients" to see connected Meta accounts
          </p>
        )}
      </CardContent>
    </Card>
  );
};
