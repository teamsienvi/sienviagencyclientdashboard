import { useState, useEffect } from "react";
import { Header } from "@/components/Header";
import { AuthForm } from "@/components/AuthForm";
import { BulkMetaSync } from "@/components/BulkMetaSync";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { 
  LogOut, 
  Shield, 
  RefreshCw, 
  Link2, 
  Search, 
  Facebook, 
  Instagram,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Unlink,
  UserPlus
} from "lucide-react";

interface MetaAsset {
  id: string;
  platform: string;
  page_id: string | null;
  ig_business_id: string | null;
  name: string;
  picture_url: string | null;
  permalink: string | null;
  last_seen_at: string;
}

interface ClientMetaMap {
  id: string;
  client_id: string;
  page_id: string | null;
  ig_business_id: string | null;
  active: boolean;
}

interface Client {
  id: string;
  name: string;
}

interface AgencyConnection {
  id: string;
  meta_user_id: string;
  token_expires_at: string;
  connected_at: string;
}

interface ClientOAuthAccount {
  id: string;
  client_id: string;
  platform: string;
  page_id: string | null;
  instagram_business_id: string | null;
  token_expires_at: string;
  is_active: boolean;
}

const AdminMetaAssets = () => {
  const { user, isAdmin, isLoading: authLoading, signOut, isAuthenticated } = useAuth();
  const [agencyConnection, setAgencyConnection] = useState<AgencyConnection | null>(null);
  const [assets, setAssets] = useState<MetaAsset[]>([]);
  const [mappings, setMappings] = useState<ClientMetaMap[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [clientOAuthAccounts, setClientOAuthAccounts] = useState<ClientOAuthAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterTab, setFilterTab] = useState<"all" | "assigned" | "unassigned">("all");
  const [selectedAssets, setSelectedAssets] = useState<Set<string>>(new Set());
  const [bulkAssignClient, setBulkAssignClient] = useState<string>("");
  const [clientConnectDialogOpen, setClientConnectDialogOpen] = useState(false);
  const [clientConnectTarget, setClientConnectTarget] = useState<string>("");
  const [isClientConnecting, setIsClientConnecting] = useState(false);

  useEffect(() => {
    if (isAuthenticated && isAdmin) {
      fetchData();
    }
  }, [isAuthenticated, isAdmin]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // Fetch agency connection
      const { data: connData } = await supabase
        .from("meta_agency_connection")
        .select("*")
        .limit(1)
        .maybeSingle();
      
      setAgencyConnection(connData);

      // Fetch assets
      const { data: assetsData } = await supabase
        .from("meta_assets")
        .select("*")
        .order("name");
      
      setAssets(assetsData || []);

      // Fetch mappings
      const { data: mappingsData } = await supabase
        .from("client_meta_map")
        .select("*")
        .eq("active", true);
      
      setMappings(mappingsData || []);

      // Fetch clients
      const { data: clientsData } = await supabase
        .from("clients")
        .select("id, name")
        .eq("is_active", true)
        .order("name");
      
      setClients(clientsData || []);

      // Fetch per-client OAuth accounts (for clients with separate IG connections)
      const { data: oauthData } = await supabase
        .from("social_oauth_accounts")
        .select("id, client_id, platform, page_id, instagram_business_id, token_expires_at, is_active")
        .eq("is_active", true);
      
      setClientOAuthAccounts(oauthData || []);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Failed to load data");
    } finally {
      setIsLoading(false);
    }
  };

  const handleConnectAgency = async () => {
    setIsConnecting(true);
    try {
      const redirectUri = `${window.location.origin}/oauth/meta/agency/callback`;
      
      const { data, error } = await supabase.functions.invoke("meta-agency-oauth-init", {
        body: { redirectUri },
      });

      if (error) throw error;
      if (data?.authUrl) {
        window.location.href = data.authUrl;
      }
    } catch (error) {
      console.error("Error initiating OAuth:", error);
      toast.error("Failed to start Meta connection");
      setIsConnecting(false);
    }
  };

  const handleDiscover = async () => {
    setIsDiscovering(true);
    try {
      const { data, error } = await supabase.functions.invoke("meta-discover");
      
      if (error) throw error;
      
      toast.success(`Discovered ${data.assetsCount} assets from ${data.pagesCount} pages`);
      await fetchData();
    } catch (error) {
      console.error("Error discovering assets:", error);
      toast.error(error instanceof Error ? error.message : "Failed to discover assets");
    } finally {
      setIsDiscovering(false);
    }
  };

  const handleSyncAll = async () => {
    setIsSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("sync-meta-agency");
      
      if (error) throw error;
      
      const successCount = data.results?.filter((r: any) => r.success).length || 0;
      toast.success(`Synced ${successCount} of ${data.results?.length || 0} mappings`);
    } catch (error) {
      console.error("Error syncing:", error);
      toast.error(error instanceof Error ? error.message : "Failed to sync");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleAssign = async (assetId: string, clientId: string) => {
    const asset = assets.find(a => a.id === assetId);
    if (!asset) return;

    try {
      const { error } = await supabase
        .from("client_meta_map")
        .upsert({
          client_id: clientId,
          page_id: asset.platform === "facebook" ? asset.page_id : null,
          ig_business_id: asset.platform === "instagram" ? asset.ig_business_id : null,
          active: true,
          mapped_at: new Date().toISOString(),
        }, {
          onConflict: asset.platform === "facebook" ? "client_id,page_id" : "client_id,ig_business_id",
        });

      if (error) throw error;

      toast.success(`Assigned ${asset.name} to client`);
      await fetchData();
    } catch (error) {
      console.error("Error assigning asset:", error);
      toast.error("Failed to assign asset");
    }
  };

  const handleUnassign = async (mappingId: string) => {
    try {
      const { error } = await supabase
        .from("client_meta_map")
        .update({ active: false })
        .eq("id", mappingId);

      if (error) throw error;

      toast.success("Asset unassigned");
      await fetchData();
    } catch (error) {
      console.error("Error unassigning:", error);
      toast.error("Failed to unassign asset");
    }
  };

  // Handle connecting a client's separate Instagram account (not via agency)
  const handleClientInstagramConnect = async (clientId: string) => {
    setIsClientConnecting(true);
    try {
      const redirectUri = `${window.location.origin}/oauth/meta/callback`;
      
      const { data, error } = await supabase.functions.invoke("meta-oauth-init", {
        body: {
          clientId,
          redirectUri,
          platform: "instagram",
        },
      });

      if (error) throw error;
      if (data?.authUrl) {
        window.location.href = data.authUrl;
      }
    } catch (error) {
      console.error("Error initiating client OAuth:", error);
      toast.error("Failed to start Instagram connection");
      setIsClientConnecting(false);
    }
  };

  const handleDisconnectClientOAuth = async (accountId: string) => {
    try {
      const { error } = await supabase
        .from("social_oauth_accounts")
        .update({ is_active: false })
        .eq("id", accountId);

      if (error) throw error;

      toast.success("Disconnected client Instagram account");
      await fetchData();
    } catch (error) {
      console.error("Error disconnecting:", error);
      toast.error("Failed to disconnect");
    }
  };

  // Get the client's individual OAuth connection (if any)
  const getClientOAuthAccount = (clientId: string): ClientOAuthAccount | undefined => {
    return clientOAuthAccounts.find(a => a.client_id === clientId && a.platform === "instagram");
  };

  const handleBulkAssign = async () => {
    if (!bulkAssignClient || selectedAssets.size === 0) return;

    try {
      for (const assetId of selectedAssets) {
        await handleAssign(assetId, bulkAssignClient);
      }
      setSelectedAssets(new Set());
      setBulkAssignClient("");
    } catch (error) {
      console.error("Error in bulk assign:", error);
    }
  };

  const getAssetMapping = (asset: MetaAsset): ClientMetaMap | undefined => {
    return mappings.find(m => 
      (asset.platform === "facebook" && m.page_id === asset.page_id) ||
      (asset.platform === "instagram" && m.ig_business_id === asset.ig_business_id)
    );
  };

  const getClientName = (clientId: string): string => {
    return clients.find(c => c.id === clientId)?.name || "Unknown";
  };

  const isTokenExpired = agencyConnection 
    ? new Date(agencyConnection.token_expires_at) < new Date()
    : false;

  const filteredAssets = assets.filter(asset => {
    // Search filter
    if (searchQuery && !asset.name.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }

    // Tab filter
    const mapping = getAssetMapping(asset);
    if (filterTab === "assigned" && !mapping) return false;
    if (filterTab === "unassigned" && mapping) return false;

    return true;
  });

  const toggleAssetSelection = (assetId: string) => {
    const newSelected = new Set(selectedAssets);
    if (newSelected.has(assetId)) {
      newSelected.delete(assetId);
    } else {
      newSelected.add(assetId);
    }
    setSelectedAssets(newSelected);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center min-h-[400px]">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </main>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <div className="max-w-md mx-auto">
            <AuthForm onSuccess={() => window.location.reload()} />
          </div>
        </main>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <div className="max-w-md mx-auto space-y-4">
            <Alert>
              <Shield className="h-4 w-4" />
              <AlertDescription>
                You don't have admin access. Contact an administrator.
              </AlertDescription>
            </Alert>
            <Button variant="outline" className="w-full" onClick={signOut}>
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </Button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-heading font-bold">Meta Assets Management</h1>
            <p className="text-sm text-muted-foreground">
              Manage agency-level Meta connection and asset assignments
            </p>
          </div>
          <Button variant="outline" onClick={signOut}>
            <LogOut className="mr-2 h-4 w-4" />
            Sign Out
          </Button>
        </div>

        {/* Agency Connection Card */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Link2 className="h-5 w-5" />
              Agency Meta Connection
            </CardTitle>
            <CardDescription>
              Connect once to access all managed Facebook Pages and Instagram accounts
            </CardDescription>
          </CardHeader>
          <CardContent>
            {agencyConnection ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {isTokenExpired ? (
                      <>
                        <AlertTriangle className="h-5 w-5 text-destructive" />
                        <span className="text-destructive font-medium">Token Expired</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                        <span className="text-green-600 font-medium">Connected</span>
                      </>
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Expires: {new Date(agencyConnection.token_expires_at).toLocaleDateString()}
                  </div>
                </div>

                {isTokenExpired && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      The agency token has expired. Please reconnect to continue syncing.
                    </AlertDescription>
                  </Alert>
                )}

                <div className="flex gap-2">
                  <Button onClick={handleConnectAgency} disabled={isConnecting} variant="outline">
                    {isConnecting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                    Reconnect
                  </Button>
                  <Button onClick={handleDiscover} disabled={isDiscovering || isTokenExpired}>
                    {isDiscovering ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
                    Discover Assets
                  </Button>
                  <Button onClick={handleSyncAll} disabled={isSyncing || isTokenExpired}>
                    {isSyncing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                    Sync All Clients
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-center py-6">
                <p className="text-muted-foreground mb-4">
                  No agency connection found. Connect your Meta account to get started.
                </p>
                <Button onClick={handleConnectAgency} disabled={isConnecting}>
                  {isConnecting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Link2 className="mr-2 h-4 w-4" />}
                  Connect Meta Account
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Bulk Meta Sync */}
        <div className="mb-6">
          <BulkMetaSync />
        </div>

        {/* Per-Client Instagram Connections */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              Per-Client Instagram Connections
            </CardTitle>
            <CardDescription>
              For clients with Instagram accounts not managed by the agency (e.g., BSUE, Sienvi)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {clients.map((client) => {
                const oauthAccount = getClientOAuthAccount(client.id);
                const hasAgencyMapping = mappings.some(m => m.client_id === client.id && m.ig_business_id);
                
                // Skip clients that already have agency IG mapping
                if (hasAgencyMapping) return null;

                return (
                  <div key={client.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <Instagram className="h-5 w-5 text-pink-600" />
                      <span className="font-medium">{client.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {oauthAccount ? (
                        <>
                          <Badge variant="default" className="flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3" />
                            Connected
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            IG: {oauthAccount.instagram_business_id?.slice(-6) || 'N/A'}
                          </span>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDisconnectClientOAuth(oauthAccount.id)}
                          >
                            <Unlink className="h-4 w-4" />
                          </Button>
                        </>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleClientInstagramConnect(client.id)}
                          disabled={isClientConnecting}
                        >
                          {isClientConnecting ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <Instagram className="mr-2 h-4 w-4" />
                          )}
                          Connect Instagram
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
              {clients.filter(c => !mappings.some(m => m.client_id === c.id && m.ig_business_id)).length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  All clients have Instagram connected via agency mapping
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Assets Table */}
        <Card>
          <CardHeader>
            <CardTitle>Meta Assets</CardTitle>
            <CardDescription>
              {assets.length} assets discovered • {mappings.length} assigned
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-4 mb-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Tabs value={filterTab} onValueChange={(v) => setFilterTab(v as any)}>
                <TabsList>
                  <TabsTrigger value="all">All</TabsTrigger>
                  <TabsTrigger value="unassigned">Unassigned</TabsTrigger>
                  <TabsTrigger value="assigned">Assigned</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            {/* Bulk Actions */}
            {selectedAssets.size > 0 && (
              <div className="flex items-center gap-2 mb-4 p-3 bg-muted rounded-lg">
                <span className="text-sm font-medium">{selectedAssets.size} selected</span>
                <Select value={bulkAssignClient} onValueChange={setBulkAssignClient}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Select client..." />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button size="sm" onClick={handleBulkAssign} disabled={!bulkAssignClient}>
                  Assign Selected
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setSelectedAssets(new Set())}>
                  Clear
                </Button>
              </div>
            )}

            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredAssets.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                {assets.length === 0 
                  ? "No assets discovered yet. Connect and run discovery."
                  : "No assets match your filters."}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10"></TableHead>
                    <TableHead>Platform</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>ID</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Assigned To</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAssets.map((asset) => {
                    const mapping = getAssetMapping(asset);
                    const isAssigned = !!mapping;

                    return (
                      <TableRow key={asset.id}>
                        <TableCell>
                          <Checkbox
                            checked={selectedAssets.has(asset.id)}
                            onCheckedChange={() => toggleAssetSelection(asset.id)}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {asset.platform === "facebook" ? (
                              <Facebook className="h-4 w-4 text-blue-600" />
                            ) : (
                              <Instagram className="h-4 w-4 text-pink-600" />
                            )}
                            <span className="capitalize">{asset.platform}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {asset.picture_url && (
                              <img 
                                src={asset.picture_url} 
                                alt="" 
                                className="h-6 w-6 rounded-full"
                              />
                            )}
                            <span className="font-medium">{asset.name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {asset.platform === "facebook" ? asset.page_id : asset.ig_business_id}
                        </TableCell>
                        <TableCell>
                          {isAssigned ? (
                            <Badge variant="default">Assigned</Badge>
                          ) : (
                            <Badge variant="secondary">Unassigned</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {isAssigned ? (
                            <span className="text-sm">{getClientName(mapping!.client_id)}</span>
                          ) : (
                            <Select onValueChange={(clientId) => handleAssign(asset.id, clientId)}>
                              <SelectTrigger className="w-40 h-8">
                                <SelectValue placeholder="Assign to..." />
                              </SelectTrigger>
                              <SelectContent>
                                {clients.map((client) => (
                                  <SelectItem key={client.id} value={client.id}>
                                    {client.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {isAssigned && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleUnassign(mapping!.id)}
                            >
                              <Unlink className="h-4 w-4" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default AdminMetaAssets;
