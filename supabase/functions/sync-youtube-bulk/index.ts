import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.87.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const youtubeApiKey = Deno.env.get("YOUTUBE_API_KEY");

    if (!youtubeApiKey) {
      return new Response(
        JSON.stringify({ success: false, error: "YouTube API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { periodStart, periodEnd } = await req.json();

    // 1. Get YouTube accounts from social_accounts
    const { data: youtubeAccounts } = await supabase
      .from("social_accounts")
      .select(`
        id,
        client_id,
        account_id,
        account_name,
        clients!inner(id, name, is_active)
      `)
      .eq("platform", "youtube")
      .eq("is_active", true);

    // 2. Get YouTube configs from client_metricool_config
    const { data: metricoolYtConfigs } = await supabase
      .from("client_metricool_config")
      .select(`
        id,
        client_id,
        channel_handle,
        channel_id,
        clients!inner(id, name, is_active)
      `)
      .eq("platform", "youtube")
      .eq("is_active", true);

    // 3. Get YouTube mappings from client_youtube_map
    const { data: ytMaps } = await supabase
      .from("client_youtube_map")
      .select(`
        id,
        client_id,
        channel_id,
        clients!inner(id, name, is_active)
      `)
      .eq("active", true);

    // Build unified target list of clients to sync
    const targetClients = new Map<string, { clientId: string; clientName: string; accountId?: string; channelHandle?: string; channelId?: string }>();

    (youtubeAccounts || []).forEach((a: any) => {
      if (a.clients?.is_active) {
        targetClients.set(a.client_id, {
          clientId: a.client_id,
          clientName: a.clients?.name || "Unknown",
          accountId: a.id,
          channelHandle: a.account_id,
        });
      }
    });

    (metricoolYtConfigs || []).forEach((c: any) => {
      if (c.clients?.is_active) {
        const existing = targetClients.get(c.client_id) || {
          clientId: c.client_id,
          clientName: c.clients?.name || "Unknown",
        };
        existing.channelHandle = existing.channelHandle || c.channel_handle || c.channel_id;
        existing.channelId = existing.channelId || c.channel_id;
        targetClients.set(c.client_id, existing);
      }
    });

    (ytMaps || []).forEach((m: any) => {
      if (m.clients?.is_active && !targetClients.has(m.client_id)) {
        targetClients.set(m.client_id, {
          clientId: m.client_id,
          clientName: m.clients?.name || "Unknown",
          channelId: m.channel_id,
        });
      }
    });

    const activeAccounts = Array.from(targetClients.values());
    console.log(`Found ${activeAccounts.length} active YouTube accounts across Metricool and Social Accounts to sync`);

    const results: any[] = [];

    for (const account of activeAccounts) {
      const clientId = account.clientId;
      const clientName = account.clientName;
      const channelHandle = account.channelHandle;
      const channelId = account.channelId;

      console.log(`Syncing YouTube for ${clientName} (${channelHandle || channelId || "Metricool config"})...`);

      try {
        // Call the sync-youtube function with auto-resolve enabled
        const { data, error } = await supabase.functions.invoke("sync-youtube", {
          body: {
            clientId,
            accountId: account.accountId,
            channelHandle,
            channelId,
            resolveFromConfig: true,
            periodStart,
            periodEnd,
          },
        });

        if (error) {
          console.error(`Error syncing ${clientName}:`, error);
          results.push({
            clientName,
            channelHandle,
            success: false,
            error: error.message,
          });
        } else {
          console.log(`Successfully synced ${clientName}: ${data?.recordsSynced || 0} records`);
          results.push({
            clientName,
            channelHandle,
            success: true,
            recordsSynced: data?.recordsSynced || 0,
            subscribers: data?.accountMetrics?.subscribers || 0,
          });
        }
      } catch (err: any) {
        console.error(`Exception syncing ${clientName}:`, err);
        results.push({
          clientName,
          channelHandle,
          success: false,
          error: err.message,
        });
      }

      // Small delay between API calls to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    const successCount = results.filter((r) => r.success).length;
    const failCount = results.filter((r) => !r.success).length;

    console.log(`Bulk sync complete: ${successCount} succeeded, ${failCount} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        totalClients: activeAccounts.length,
        successCount,
        failCount,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in sync-youtube-bulk:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
