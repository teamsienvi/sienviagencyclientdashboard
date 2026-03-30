import { useState, useEffect } from "react";
import { Header } from "@/components/Header";
import { AuthForm } from "@/components/AuthForm";
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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { 
  LogOut, 
  Shield, 
  RefreshCw, 
  Search, 
  Youtube,
  Loader2,
  Unlink,
  Plus
} from "lucide-react";

interface YouTubeAsset {
  id: string;
  channel_id: string;
  channel_name: string;
  channel_url: string | null;
  thumbnail_url: string | null;
  subscriber_count: number;
  video_count: number;
  last_seen_at: string;
}

interface ClientYouTubeMap {
  id: string;
  client_id: string;
  channel_id: string;
  active: boolean;
}

interface Client {
  id: string;
  name: string;
}

const AdminYouTubeAssets = () => {
  const { user, isAdmin, isLoading: authLoading, signOut, isAuthenticated } = useAuth();
  const [assets, setAssets] = useState<YouTubeAsset[]>([]);
  const [mappings, setMappings] = useState<ClientYouTubeMap[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterTab, setFilterTab] = useState<"all" | "assigned" | "unassigned">("all");
  const [selectedAssets, setSelectedAssets] = useState<Set<string>>(new Set());
  const [bulkAssignClient, setBulkAssignClient] = useState<string>("");
  
  // Add channel dialog
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newChannelId, setNewChannelId] = useState("");
  const [assignToClient, setAssignToClient] = useState<string>("");

  useEffect(() => {
    if (isAuthenticated && isAdmin) {
      fetchData();
    }
  }, [isAuthenticated, isAdmin]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // Fetch assets
      const { data: assetsData } = await supabase
        .from("youtube_assets")
        .select("*")
        .order("channel_name");
      
      setAssets(assetsData || []);

      // Fetch mappings
      const { data: mappingsData } = await supabase
        .from("client_youtube_map")
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
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Failed to load data");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddChannel = async () => {
    if (!newChannelId.trim()) {
      toast.error("Please enter a channel ID");
      return;
    }

    setIsAdding(true);
    try {
      const { data, error } = await supabase.functions.invoke("youtube-add-channel", {
        body: { channelId: newChannelId.trim() },
      });

      if (error) throw error;
      
      // If a client is selected, also create the mapping
      if (assignToClient && data.channelId) {
        await supabase
          .from("client_youtube_map")
          .upsert({
            client_id: assignToClient,
            channel_id: data.channelId,
            active: true,
            mapped_at: new Date().toISOString(),
          }, {
            onConflict: "client_id,channel_id",
          });
      }
      
      toast.success(`Added channel: ${data.channelName}${assignToClient ? ' and assigned to client' : ''}`);
      setNewChannelId("");
      setAssignToClient("");
      setAddDialogOpen(false);
      await fetchData();
    } catch (error) {
      console.error("Error adding channel:", error);
      toast.error(error instanceof Error ? error.message : "Failed to add channel");
    } finally {
      setIsAdding(false);
    }
  };

  const handleSyncAll = async () => {
    setIsSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("sync-youtube-agency");
      
      if (error) throw error;
      
      const successCount = data.results?.filter((r: any) => r.success).length || 0;
      toast.success(`Synced ${successCount} of ${data.results?.length || 0} mappings`);
      await fetchData();
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
        .from("client_youtube_map")
        .upsert({
          client_id: clientId,
          channel_id: asset.channel_id,
          active: true,
          mapped_at: new Date().toISOString(),
        }, {
          onConflict: "client_id,channel_id",
        });

      if (error) throw error;

      toast.success(`Assigned ${asset.channel_name} to client`);
      await fetchData();
    } catch (error) {
      console.error("Error assigning asset:", error);
      toast.error("Failed to assign asset");
    }
  };

  const handleUnassign = async (mappingId: string) => {
    try {
      const { error } = await supabase
        .from("client_youtube_map")
        .update({ active: false })
        .eq("id", mappingId);

      if (error) throw error;

      toast.success("Channel unassigned");
      await fetchData();
    } catch (error) {
      console.error("Error unassigning:", error);
      toast.error("Failed to unassign channel");
    }
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

  const getAssetMapping = (asset: YouTubeAsset): ClientYouTubeMap | undefined => {
    return mappings.find(m => m.channel_id === asset.channel_id);
  };

  const getClientName = (clientId: string): string => {
    return clients.find(c => c.id === clientId)?.name || "Unknown";
  };

  const filteredAssets = assets.filter(asset => {
    if (searchQuery && !asset.channel_name.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
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
            <h1 className="text-3xl font-heading font-bold">YouTube Assets Management</h1>
            <p className="text-sm text-muted-foreground">
              Manage YouTube channels and client assignments
            </p>
          </div>
          <Button variant="outline" onClick={signOut}>
            <LogOut className="mr-2 h-4 w-4" />
            Sign Out
          </Button>
        </div>

        {/* Actions Card */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Youtube className="h-5 w-5 text-red-600" />
              YouTube Channels
            </CardTitle>
            <CardDescription>
              Add YouTube channels by their Channel ID and sync analytics for all clients
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline">
                    <Plus className="mr-2 h-4 w-4" />
                    Add Channel
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add YouTube Channel</DialogTitle>
                    <DialogDescription>
                      Enter the YouTube Channel ID. You can find this in the channel's URL 
                      (e.g., youtube.com/channel/UC...) or in YouTube Studio settings.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="channelId">Channel ID</Label>
                      <Input
                        id="channelId"
                        placeholder="UC..."
                        value={newChannelId}
                        onChange={(e) => setNewChannelId(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="assignClient">Assign to Client (Optional)</Label>
                      <Select value={assignToClient} onValueChange={setAssignToClient}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a client..." />
                        </SelectTrigger>
                        <SelectContent>
                          {clients.map((client) => (
                            <SelectItem key={client.id} value={client.id}>
                              {client.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleAddChannel} disabled={isAdding}>
                      {isAdding ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                      Add Channel
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              
              <Button onClick={handleSyncAll} disabled={isSyncing || mappings.length === 0}>
                {isSyncing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                Sync All Clients
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Assets Table */}
        <Card>
          <CardHeader>
            <CardTitle>YouTube Channels</CardTitle>
            <CardDescription>
              {assets.length} channels • {mappings.length} assigned
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
                  ? "No channels added yet. Click 'Add Channel' to get started."
                  : "No channels match your filters."}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10"></TableHead>
                    <TableHead>Channel</TableHead>
                    <TableHead>Channel ID</TableHead>
                    <TableHead>Subscribers</TableHead>
                    <TableHead>Videos</TableHead>
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
                            {asset.thumbnail_url ? (
                              <img 
                                src={asset.thumbnail_url} 
                                alt="" 
                                className="h-8 w-8 rounded-full"
                              />
                            ) : (
                              <Youtube className="h-8 w-8 text-red-600" />
                            )}
                            <div>
                              <span className="font-medium">{asset.channel_name}</span>
                              {asset.channel_url && (
                                <a 
                                  href={asset.channel_url} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="block text-xs text-muted-foreground hover:text-primary"
                                >
                                  View Channel →
                                </a>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {asset.channel_id}
                        </TableCell>
                        <TableCell>
                          {asset.subscriber_count?.toLocaleString() || '-'}
                        </TableCell>
                        <TableCell>
                          {asset.video_count?.toLocaleString() || '-'}
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
                            <Select 
                              value={mapping!.client_id} 
                              onValueChange={(clientId) => handleAssign(asset.id, clientId)}
                            >
                              <SelectTrigger className="w-40 h-8">
                                <SelectValue>
                                  {getClientName(mapping!.client_id)}
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent>
                                {clients.map((client) => (
                                  <SelectItem key={client.id} value={client.id}>
                                    {client.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
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

export default AdminYouTubeAssets;
