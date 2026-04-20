import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Listens for new rows in social_content_metrics via Supabase Realtime.
 * When the background auto-sync (or any sync) writes new metric data,
 * this hook automatically invalidates the top-performing-posts and
 * summary-metrics React Query caches so the UI reflects the latest data
 * without requiring a page refresh or a manual "Refresh Insights" click.
 */
export function useSocialMetricsRealtime(clientId: string | undefined) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!clientId) return;

    // Subscribe to inserts on social_content_metrics, filtered to this client's content
    // We can't filter directly on client_id (it's on the parent table), so we listen
    // to ALL inserts and invalidate. The query itself filters by client_id.
    const channel = supabase
      .channel(`social-metrics-${clientId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "social_content_metrics",
        },
        (_payload) => {
          console.log("[Realtime] social_content_metrics insert detected — refreshing top posts");
          // Invalidate all top-posts and summary-metrics queries for this client
          queryClient.invalidateQueries({ queryKey: ["top-performing-posts", clientId] });
          queryClient.invalidateQueries({ queryKey: ["all-time-top-posts", clientId] });
          queryClient.invalidateQueries({ queryKey: ["summary-metrics", clientId] });
          queryClient.invalidateQueries({ queryKey: ["client-social-metrics", clientId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [clientId, queryClient]);
}
