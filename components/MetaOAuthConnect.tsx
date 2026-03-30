import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Facebook, Instagram, Link2, Loader2, CheckCircle2 } from "lucide-react";

interface MetaOAuthConnectProps {
  clientId?: string;
}

export function MetaOAuthConnect({ clientId }: MetaOAuthConnectProps) {
  const [selectedClient, setSelectedClient] = useState<string>(clientId || "");
  const [selectedPlatform, setSelectedPlatform] = useState<"facebook" | "instagram">("instagram");
  const queryClient = useQueryClient();

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
  });

  const { data: connectedAccounts, isLoading: loadingAccounts } = useQuery({
    queryKey: ["oauth-accounts", selectedClient],
    queryFn: async () => {
      if (!selectedClient) return [];
      const { data, error } = await supabase
        .from("social_oauth_accounts")
        .select("*")
        .eq("client_id", selectedClient)
        .eq("is_active", true);
      if (error) throw error;
      return data;
    },
    enabled: !!selectedClient,
  });

  const initOAuthMutation = useMutation({
    mutationFn: async () => {
      const redirectUri = `${window.location.origin}/oauth/meta/callback`;
      
      const { data, error } = await supabase.functions.invoke("meta-oauth-init", {
        body: {
          clientId: selectedClient,
          redirectUri,
          platform: selectedPlatform,
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      if (data.authUrl) {
        window.location.href = data.authUrl;
      }
    },
    onError: (error) => {
      console.error("OAuth init error:", error);
      toast.error("Failed to start OAuth flow");
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: async (accountId: string) => {
      const { error } = await supabase
        .from("social_oauth_accounts")
        .update({ is_active: false })
        .eq("id", accountId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["oauth-accounts"] });
      toast.success("Account disconnected");
    },
    onError: () => {
      toast.error("Failed to disconnect account");
    },
  });

  const getConnectedAccount = (platform: string) => {
    return connectedAccounts?.find((acc) => acc.platform === platform);
  };

  const facebookAccount = getConnectedAccount("facebook");
  const instagramAccount = getConnectedAccount("instagram");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Link2 className="h-5 w-5" />
          Connect Meta Accounts
        </CardTitle>
        <CardDescription>
          Connect Facebook and Instagram accounts via OAuth for automatic analytics syncing
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {!clientId && (
          <div className="space-y-2">
            <label className="text-sm font-medium">Select Client</label>
            <Select value={selectedClient} onValueChange={setSelectedClient}>
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

        {selectedClient && (
          <>
            <div className="grid gap-4 md:grid-cols-2">
              {/* Facebook Connection */}
              <Card className="border-2">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="rounded-lg bg-blue-500/10 p-2">
                        <Facebook className="h-6 w-6 text-blue-500" />
                      </div>
                      <div>
                        <h4 className="font-medium">Facebook</h4>
                        {facebookAccount ? (
                          <Badge variant="outline" className="mt-1 text-green-600 border-green-600">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Connected
                          </Badge>
                        ) : (
                          <p className="text-sm text-muted-foreground">Not connected</p>
                        )}
                      </div>
                    </div>
                    {facebookAccount ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => disconnectMutation.mutate(facebookAccount.id)}
                        disabled={disconnectMutation.isPending}
                      >
                        Disconnect
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => {
                          setSelectedPlatform("facebook");
                          initOAuthMutation.mutate();
                        }}
                        disabled={initOAuthMutation.isPending}
                      >
                        {initOAuthMutation.isPending && selectedPlatform === "facebook" ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : null}
                        Connect
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Instagram Connection */}
              <Card className="border-2">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="rounded-lg bg-gradient-to-br from-purple-500/10 to-pink-500/10 p-2">
                        <Instagram className="h-6 w-6 text-pink-500" />
                      </div>
                      <div>
                        <h4 className="font-medium">Instagram</h4>
                        {instagramAccount ? (
                          <Badge variant="outline" className="mt-1 text-green-600 border-green-600">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Connected
                          </Badge>
                        ) : (
                          <p className="text-sm text-muted-foreground">Not connected</p>
                        )}
                      </div>
                    </div>
                    {instagramAccount ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => disconnectMutation.mutate(instagramAccount.id)}
                        disabled={disconnectMutation.isPending}
                      >
                        Disconnect
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => {
                          setSelectedPlatform("instagram");
                          initOAuthMutation.mutate();
                        }}
                        disabled={initOAuthMutation.isPending}
                      >
                        {initOAuthMutation.isPending && selectedPlatform === "instagram" ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : null}
                        Connect
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {loadingAccounts && (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              Connecting accounts allows automatic syncing of analytics data. You'll need a Facebook Page 
              connected to your Instagram Business Account for Instagram analytics.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
