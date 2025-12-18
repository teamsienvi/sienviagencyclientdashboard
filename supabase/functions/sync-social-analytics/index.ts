import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.87.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SyncResult {
  platform: string;
  success: boolean;
  recordsSynced: number;
  error?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { clientId, platform, manual = false } = await req.json().catch(() => ({}));

    console.log(`Starting social analytics sync. ClientId: ${clientId || 'all'}, Platform: ${platform || 'all'}, Manual: ${manual}`);

    // Get all active clients with connected social accounts
    let clientsQuery = supabase
      .from("clients")
      .select("id, name")
      .eq("is_active", true);

    if (clientId) {
      clientsQuery = clientsQuery.eq("id", clientId);
    }

    const { data: clients, error: clientsError } = await clientsQuery;

    if (clientsError) {
      throw new Error(`Failed to fetch clients: ${clientsError.message}`);
    }

    if (!clients || clients.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No active clients found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results: SyncResult[] = [];
    const platforms = platform ? [platform] : ['instagram', 'facebook', 'youtube', 'tiktok', 'x', 'linkedin'];

    // Calculate period (last 7 days)
    const periodEnd = new Date();
    const periodStart = new Date();
    periodStart.setDate(periodStart.getDate() - 7);

    for (const client of clients) {
      // Get connected social accounts for this client
      let accountsQuery = supabase
        .from("social_accounts")
        .select("*")
        .eq("client_id", client.id)
        .eq("is_active", true);

      if (platform) {
        accountsQuery = accountsQuery.eq("platform", platform);
      }

      const { data: accounts, error: accountsError } = await accountsQuery;

      if (accountsError) {
        console.error(`Error fetching accounts for client ${client.id}:`, accountsError);
        continue;
      }

      if (!accounts || accounts.length === 0) {
        console.log(`No connected accounts for client ${client.name}`);
        continue;
      }

      for (const account of accounts) {
        // Create sync log entry
        const { data: syncLog, error: syncLogError } = await supabase
          .from("social_sync_logs")
          .insert({
            client_id: client.id,
            platform: account.platform,
            status: "in_progress",
          })
          .select()
          .single();

        if (syncLogError) {
          console.error("Error creating sync log:", syncLogError);
        }

        try {
          // Call platform-specific sync function
          const syncFunctionName = `sync-${account.platform === 'instagram' || account.platform === 'facebook' ? 'meta' : account.platform}`;
          
          const { data: syncResult, error: syncError } = await supabase.functions.invoke(syncFunctionName, {
            body: {
              clientId: client.id,
              accountId: account.id,
              platform: account.platform,
              accessToken: account.access_token_encrypted,
              accountExternalId: account.account_id,
              periodStart: periodStart.toISOString().split('T')[0],
              periodEnd: periodEnd.toISOString().split('T')[0],
            },
          });

          if (syncError) {
            throw new Error(syncError.message);
          }

          results.push({
            platform: account.platform,
            success: true,
            recordsSynced: syncResult?.recordsSynced || 0,
          });

          // Update sync log
          if (syncLog) {
            await supabase
              .from("social_sync_logs")
              .update({
                status: "completed",
                records_synced: syncResult?.recordsSynced || 0,
                completed_at: new Date().toISOString(),
              })
              .eq("id", syncLog.id);
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : "Unknown error";
          console.error(`Error syncing ${account.platform} for client ${client.name}:`, errorMessage);

          results.push({
            platform: account.platform,
            success: false,
            recordsSynced: 0,
            error: errorMessage,
          });

          // Update sync log with error
          if (syncLog) {
            await supabase
              .from("social_sync_logs")
              .update({
                status: "failed",
                error_message: errorMessage,
                completed_at: new Date().toISOString(),
              })
              .eq("id", syncLog.id);
          }
        }
      }
    }

    const totalRecords = results.reduce((sum, r) => sum + r.recordsSynced, 0);
    const successCount = results.filter((r) => r.success).length;

    return new Response(
      JSON.stringify({
        success: true,
        message: `Sync completed. ${successCount}/${results.length} platforms synced successfully.`,
        totalRecordsSynced: totalRecords,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in sync-social-analytics:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
