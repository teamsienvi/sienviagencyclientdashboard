import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { RefreshCw, Settings, CheckCircle, XCircle, Clock, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAnalyticsSource, useTriggerSync, useSyncLogs } from "@/hooks/useSocialAnalytics";
import { useToggleAnalyticsSource } from "@/hooks/useReportData";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface SocialAnalyticsAdminProps {
  clientId?: string;
}

export const SocialAnalyticsAdmin = ({ clientId }: SocialAnalyticsAdminProps) => {
  const [isSyncing, setIsSyncing] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState<string>("");
  
  const { data: analyticsSource, refetch: refetchSource } = useAnalyticsSource();
  const { toggle: toggleSource } = useToggleAnalyticsSource();
  const { triggerSync } = useTriggerSync();
  const { data: syncLogs, refetch: refetchLogs } = useSyncLogs(clientId);

  // Get clients for sync
  const { data: clients } = useQuery({
    queryKey: ["clients-for-sync"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, name")
        .eq("is_active", true);
      
      if (error) throw error;
      return data;
    },
  });

  const [selectedClientId, setSelectedClientId] = useState<string>(clientId || "");

  const handleToggleSource = async () => {
    try {
      const newSource = analyticsSource === "csv" ? "api" : "csv";
      await toggleSource(newSource as "csv" | "api");
      await refetchSource();
      toast.success(`Analytics source switched to ${newSource.toUpperCase()}`);
    } catch (error) {
      toast.error("Failed to toggle analytics source");
    }
  };

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const result = await triggerSync(
        selectedClientId || undefined,
        selectedPlatform || undefined
      );
      toast.success(result.message || "Sync completed successfully");
      await refetchLogs();
    } catch (error) {
      toast.error("Sync failed. Check logs for details.");
    } finally {
      setIsSyncing(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1" /> Completed</Badge>;
      case "failed":
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" /> Failed</Badge>;
      case "in_progress":
        return <Badge className="bg-yellow-500"><Clock className="h-3 w-3 mr-1" /> In Progress</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getPlatformBadge = (platform: string) => {
    const colors: Record<string, string> = {
      instagram: "bg-pink-500",
      facebook: "bg-blue-600",
      tiktok: "bg-black",
      x: "bg-gray-800",
      youtube: "bg-red-500",
      linkedin: "bg-blue-700",
    };
    return <Badge className={`${colors[platform] || "bg-primary"} text-white`}>{platform}</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* Analytics Source Toggle */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Analytics Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label>Data Source</Label>
              <p className="text-sm text-muted-foreground">
                {analyticsSource === "api" 
                  ? "Using automated API data (live)" 
                  : "Using CSV upload data (manual)"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className={analyticsSource === "csv" ? "font-medium" : "text-muted-foreground"}>CSV</span>
              <Switch 
                checked={analyticsSource === "api"} 
                onCheckedChange={handleToggleSource}
              />
              <span className={analyticsSource === "api" ? "font-medium" : "text-muted-foreground"}>API</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Manual Sync Trigger */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            Manual Sync
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Client</Label>
              <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                <SelectTrigger>
                  <SelectValue placeholder="All clients" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All clients</SelectItem>
                  {clients?.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Platform</Label>
              <Select value={selectedPlatform} onValueChange={setSelectedPlatform}>
                <SelectTrigger>
                  <SelectValue placeholder="All platforms" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All platforms</SelectItem>
                  <SelectItem value="instagram">Instagram</SelectItem>
                  <SelectItem value="facebook">Facebook</SelectItem>
                  <SelectItem value="tiktok">TikTok</SelectItem>
                  <SelectItem value="x">X (Twitter)</SelectItem>
                  <SelectItem value="linkedin">LinkedIn</SelectItem>
                  <SelectItem value="youtube">YouTube</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button onClick={handleSync} disabled={isSyncing} className="w-full">
                {isSyncing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Syncing...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Sync Now
                  </>
                )}
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Note: Syncing requires connected social accounts with valid API tokens.
          </p>
        </CardContent>
      </Card>

      {/* Sync Logs */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Sync Activity</CardTitle>
        </CardHeader>
        <CardContent>
          {syncLogs && syncLogs.length > 0 ? (
            <div className="space-y-3">
              {syncLogs.slice(0, 10).map((log: any) => (
                <div 
                  key={log.id} 
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                >
                  <div className="flex items-center gap-3">
                    {getPlatformBadge(log.platform)}
                    <div>
                      <p className="text-sm font-medium">
                        {new Date(log.started_at).toLocaleString()}
                      </p>
                      {log.error_message && (
                        <p className="text-xs text-destructive">{log.error_message}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {log.records_synced > 0 && (
                      <span className="text-sm text-muted-foreground">
                        {log.records_synced} records
                      </span>
                    )}
                    {getStatusBadge(log.status)}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">
              No sync activity yet. Connect social accounts and run a sync.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
