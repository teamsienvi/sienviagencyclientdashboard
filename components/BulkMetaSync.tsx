import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { RefreshCw, CheckCircle2, XCircle, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type SyncStatus = "idle" | "syncing" | "done";

type SyncResult = {
  clientId: string;
  clientName: string;
  platform: string;
  success: boolean;
  recordsSynced?: number;
  error?: string;
  periodStart?: string;
  periodEnd?: string;
};

export const BulkMetaSync = () => {
  const [status, setStatus] = useState<SyncStatus>("idle");
  const [results, setResults] = useState<SyncResult[]>([]);
  const [progress, setProgress] = useState({ current: 0, total: 0, currentClient: "" });
  const pollInterval = useRef<NodeJS.Timeout | null>(null);
  const syncStartTime = useRef<string | null>(null);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollInterval.current) {
        clearInterval(pollInterval.current);
      }
    };
  }, []);

  const startProgressPolling = async (expectedTotal: number) => {
    syncStartTime.current = new Date().toISOString();
    setProgress({ current: 0, total: expectedTotal, currentClient: "Starting..." });

    pollInterval.current = setInterval(async () => {
      if (!syncStartTime.current) return;

      // Query sync logs created since we started
      const { data: logs } = await supabase
        .from("social_sync_logs")
        .select(`
          id,
          platform,
          status,
          client_id,
          clients (name)
        `)
        .gte("started_at", syncStartTime.current)
        .order("started_at", { ascending: false });

      if (logs && logs.length > 0) {
        const completedCount = logs.filter(l => l.status === "completed").length;
        const runningLog = logs.find(l => l.status === "running");
        const currentClient = runningLog 
          ? `${(runningLog as any).clients?.name || "Unknown"} (${runningLog.platform})`
          : logs[0] 
            ? `${(logs[0] as any).clients?.name || "Unknown"} (${logs[0].platform})`
            : "";

        setProgress({
          current: completedCount,
          total: expectedTotal,
          currentClient,
        });
      }
    }, 1500);
  };

  const stopProgressPolling = () => {
    if (pollInterval.current) {
      clearInterval(pollInterval.current);
      pollInterval.current = null;
    }
    syncStartTime.current = null;
  };

  const handleSyncAll = async () => {
    setStatus("syncing");
    setResults([]);

    try {
      // First, count how many mappings we have to estimate total syncs
      const { data: mappings } = await supabase
        .from("client_meta_map")
        .select("id, page_id, ig_business_id")
        .eq("active", true);

      // Each mapping syncs 2 periods (current + previous week)
      // Count FB and IG separately since they're separate syncs
      let totalSyncs = 0;
      for (const m of mappings || []) {
        if (m.page_id) totalSyncs += 2; // FB: 2 periods
        if (m.ig_business_id) totalSyncs += 2; // IG: 2 periods
      }

      // Start progress polling
      startProgressPolling(totalSyncs);

      const { data, error } = await supabase.functions.invoke("sync-meta-agency");
      
      stopProgressPolling();

      if (error) throw error;

      const nextResults: SyncResult[] = (data?.results || []).map((r: any) => ({
        clientId: r.clientId,
        clientName: r.clientName,
        platform: r.platform,
        success: !!r.success,
        recordsSynced: r.recordsSynced,
        error: r.error,
        periodStart: r.periodStart,
        periodEnd: r.periodEnd,
      }));

      setResults(nextResults);
      setProgress(prev => ({ ...prev, current: prev.total }));

      const successCount = nextResults.filter((r) => r.success).length;
      toast.success(`Bulk sync complete: ${successCount}/${nextResults.length} successful`);

      // Dispatch custom event so individual client pages can auto-refresh
      window.dispatchEvent(new CustomEvent("bulk-meta-sync-complete", { detail: nextResults }));
    } catch (err: any) {
      console.error("Bulk sync failed:", err);
      toast.error(err?.message || "Bulk sync failed");
      stopProgressPolling();
    } finally {
      setStatus("done");
    }
  };

  const getStatusIcon = (success: boolean) => {
    if (status === "syncing") return <RefreshCw className="h-4 w-4 text-primary animate-spin" />;
    return success ? (
      <CheckCircle2 className="h-4 w-4 text-green-500" />
    ) : (
      <XCircle className="h-4 w-4 text-destructive" />
    );
  };

  const getStatusBadge = (success: boolean) => {
    if (status === "syncing") return <Badge variant="default">Syncing...</Badge>;
    return success ? (
      <Badge variant="outline" className="border-green-500 text-green-600">
        Success
      </Badge>
    ) : (
      <Badge variant="destructive">Failed</Badge>
    );
  };

  const progressPercent = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <RefreshCw className="h-5 w-5" />
          Bulk Meta Sync
        </CardTitle>
        <CardDescription>
          Sync all Meta (Instagram & Facebook) accounts in one run (agency + per-client connections)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Button onClick={handleSyncAll} disabled={status === "syncing"}>
            {status === "syncing" ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Syncing...
              </>
            ) : (
              <>
                <Clock className="mr-2 h-4 w-4" />
                Sync All Clients
              </>
            )}
          </Button>
        </div>

        {status === "syncing" && progress.total > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                Syncing {progress.current} of {progress.total}...
              </span>
              <span className="font-medium">{progressPercent}%</span>
            </div>
            <Progress value={progressPercent} className="h-2" />
            {progress.currentClient && (
              <p className="text-xs text-muted-foreground">
                Current: {progress.currentClient}
              </p>
            )}
          </div>
        )}

        {results.length > 0 && (
          <div className="border rounded-lg divide-y">
            {results.map((r, idx) => (
              <div key={`${r.clientId}-${r.platform}-${idx}`} className="flex items-center justify-between p-3">
                <div className="flex items-center gap-3">
                  {getStatusIcon(r.success)}
                  <div>
                    <p className="font-medium text-sm">{r.clientName}</p>
                    <p className="text-xs text-muted-foreground capitalize">
                      {r.platform}
                      {r.periodStart && r.periodEnd ? ` • ${r.periodStart} to ${r.periodEnd}` : ""}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {typeof r.recordsSynced === "number" && (
                    <span className="text-xs text-muted-foreground">{r.recordsSynced} records</span>
                  )}
                  {r.error && !r.success && (
                    <span className="text-xs text-destructive max-w-[260px] truncate">{r.error}</span>
                  )}
                  {getStatusBadge(r.success)}
                </div>
              </div>
            ))}
          </div>
        )}

        {status === "done" && results.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">No results returned.</p>
        )}
      </CardContent>
    </Card>
  );
};
