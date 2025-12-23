import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Music2, Check, X, RefreshCw } from "lucide-react";

interface TikTokOAuthConnectProps {
  clientId?: string;
}

export const TikTokOAuthConnect = ({ clientId: propClientId }: TikTokOAuthConnectProps) => {
  const [selectedClientId, setSelectedClientId] = useState<string>(propClientId || "");
  const queryClient = useQueryClient();

  const clientId = propClientId || selectedClientId;

  // Fetch clients for dropdown
  const { data: clients } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, name")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !propClientId,
  });

  // Fetch connected TikTok account for selected client
  const { data: connectedAccount, isLoading: isLoadingAccount } = useQuery({
    queryKey: ["tiktok-account", clientId],
    queryFn: async () => {
      if (!clientId) return null;
      const { data, error } = await supabase
        .from("social_accounts")
        .select("*")
        .eq("client_id", clientId)
        .eq("platform", "tiktok")
        .eq("is_active", true)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!clientId,
  });

  // Initialize OAuth flow
  const initOAuthMutation = useMutation({
    mutationFn: async () => {
      const redirectUri = `${window.location.origin}/oauth/tiktok/callback`;
      
      const { data, error } = await supabase.functions.invoke("tiktok-oauth-init", {
        body: { clientId, redirectUri },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);
      
      return data.authUrl;
    },
    onSuccess: (authUrl) => {
      window.location.href = authUrl;
    },
    onError: (error) => {
      console.error("TikTok OAuth init error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to start TikTok connection");
    },
  });

  // Disconnect account
  const disconnectMutation = useMutation({
    mutationFn: async () => {
      if (!connectedAccount) throw new Error("No account to disconnect");
      
      const { error } = await supabase
        .from("social_accounts")
        .update({ is_active: false })
        .eq("id", connectedAccount.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tiktok-account", clientId] });
      toast.success("TikTok account disconnected");
    },
    onError: (error) => {
      toast.error("Failed to disconnect account");
      console.error(error);
    },
  });

  const isConnected = !!connectedAccount;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Music2 className="h-5 w-5" />
          TikTok Connection
        </CardTitle>
        <CardDescription>
          Connect a TikTok Business account to sync analytics data
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!propClientId && (
          <div className="space-y-2">
            <label className="text-sm font-medium">Select Client</label>
            <Select value={selectedClientId} onValueChange={setSelectedClientId}>
              <SelectTrigger>
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
          </div>
        )}

        {clientId && (
          <div className="space-y-4">
            {isLoadingAccount ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Checking connection status...
              </div>
            ) : isConnected ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-green-600">
                  <Check className="h-4 w-4" />
                  <span className="font-medium">Connected</span>
                </div>
                <div className="text-sm text-muted-foreground">
                  Account: {connectedAccount.account_name || connectedAccount.account_id}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => initOAuthMutation.mutate()}
                    disabled={initOAuthMutation.isPending}
                  >
                    {initOAuthMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <RefreshCw className="h-4 w-4 mr-2" />
                    )}
                    Reconnect
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => disconnectMutation.mutate()}
                    disabled={disconnectMutation.isPending}
                  >
                    {disconnectMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <X className="h-4 w-4 mr-2" />
                    )}
                    Disconnect
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <X className="h-4 w-4" />
                  <span>Not connected</span>
                </div>
                <Button
                  onClick={() => initOAuthMutation.mutate()}
                  disabled={initOAuthMutation.isPending}
                  className="bg-black hover:bg-gray-800 text-white"
                >
                  {initOAuthMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Music2 className="h-4 w-4 mr-2" />
                  )}
                  Connect TikTok
                </Button>
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              Connecting will allow syncing of video analytics and engagement metrics.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
