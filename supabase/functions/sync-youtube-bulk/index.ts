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

    // Get all clients with YouTube accounts
    const { data: youtubeAccounts, error: accountsError } = await supabase
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

    if (accountsError) {
      throw new Error(`Failed to fetch YouTube accounts: ${accountsError.message}`);
    }

    const activeAccounts = youtubeAccounts?.filter((a: any) => a.clients?.is_active) || [];
    console.log(`Found ${activeAccounts.length} active YouTube accounts to sync`);

    const results: any[] = [];

    for (const account of activeAccounts) {
      const clientId = account.client_id;
      const clientData = account.clients as any;
      const clientName = clientData?.name || "Unknown";
      const channelHandle = account.account_id;

      console.log(`Syncing YouTube for ${clientName} (${channelHandle})...`);

      try {
        // Call the sync-youtube function
        const { data, error } = await supabase.functions.invoke("sync-youtube", {
          body: {
            clientId,
            accountId: account.id,
            channelHandle,
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
