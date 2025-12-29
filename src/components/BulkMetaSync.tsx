import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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

  const handleSyncAll = async () => {
    setStatus("syncing");
    setResults([]);

    try {
      const { data, error } = await supabase.functions.invoke("sync-meta-agency");
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

      const successCount = nextResults.filter((r) => r.success).length;
      toast.success(`Bulk sync complete: ${successCount}/${nextResults.length} successful`);
    } catch (err: any) {
      console.error("Bulk sync failed:", err);
      toast.error(err?.message || "Bulk sync failed");
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
