import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Standard analytics periods - syncs both current and previous week for comparisons
const CURRENT_PERIOD = { start: "2024-12-15", end: "2024-12-21" };
const PREVIOUS_PERIOD = { start: "2024-12-08", end: "2024-12-14" };

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  console.log("Starting scheduled sync for all platforms...");
  console.log(`Current Period: ${CURRENT_PERIOD.start} to ${CURRENT_PERIOD.end}`);
  console.log(`Previous Period: ${PREVIOUS_PERIOD.start} to ${PREVIOUS_PERIOD.end}`);

  const results = {
    youtube: { success: 0, failed: 0, errors: [] as string[] },
    x: { success: 0, failed: 0, errors: [] as string[] },
    instagram: { success: 0, failed: 0, errors: [] as string[] },
    facebook: { success: 0, failed: 0, errors: [] as string[] },
  };

  // Helper to sync a platform for both periods
  const syncBothPeriods = async (
    syncFn: (periodStart: string, periodEnd: string) => Promise<{ success: boolean; recordsSynced?: number; error?: string }>,
    platformKey: keyof typeof results,
    accountName: string
  ) => {
    // Sync current period
    try {
      const currentResult = await syncFn(CURRENT_PERIOD.start, CURRENT_PERIOD.end);
      if (currentResult.success) {
        console.log(`  ✓ Current period: ${currentResult.recordsSynced || 0} records`);
      } else {
        throw new Error(currentResult.error || "Unknown error");
      }
    } catch (err: any) {
      console.error(`  ✗ Current period failed: ${err.message}`);
      results[platformKey].errors.push(`${accountName} (current): ${err.message}`);
    }

    // Sync previous period for comparison
    try {
      const prevResult = await syncFn(PREVIOUS_PERIOD.start, PREVIOUS_PERIOD.end);
      if (prevResult.success) {
        results[platformKey].success++;
        console.log(`  ✓ Previous period: ${prevResult.recordsSynced || 0} records`);
      } else {
        throw new Error(prevResult.error || "Unknown error");
      }
    } catch (err: any) {
      results[platformKey].failed++;
      console.error(`  ✗ Previous period failed: ${err.message}`);
      results[platformKey].errors.push(`${accountName} (previous): ${err.message}`);
    }
  };

  try {
    // 1. YOUTUBE SYNC
    console.log("\n=== Syncing YouTube ===");
    const { data: youtubeAccounts } = await supabase
      .from("social_accounts")
      .select("id, client_id, account_id, account_name")
      .eq("platform", "youtube")
      .eq("is_active", true);

    for (const account of youtubeAccounts || []) {
      const accountName = account.account_name || account.account_id;
      console.log(`Syncing YouTube for client ${account.client_id}: ${accountName}`);
      
      await syncBothPeriods(
        async (periodStart, periodEnd) => {
          const { data, error } = await supabase.functions.invoke("sync-youtube", {
            body: {
              clientId: account.client_id,
              accountId: account.id,
              channelHandle: account.account_id,
              periodStart,
              periodEnd,
            },
          });
          if (error) throw error;
          return data;
        },
        "youtube",
        accountName
      );
      await new Promise(r => setTimeout(r, 500));
    }

    // 2. X (TWITTER) SYNC
    console.log("\n=== Syncing X (Twitter) ===");
    const { data: xAccounts } = await supabase
      .from("social_accounts")
      .select("id, client_id, account_id, account_name")
      .eq("platform", "x")
      .eq("is_active", true);

    for (const account of xAccounts || []) {
      const accountName = account.account_name || account.account_id;
      console.log(`Syncing X for client ${account.client_id}: ${accountName}`);
      
      await syncBothPeriods(
        async (periodStart, periodEnd) => {
          const { data, error } = await supabase.functions.invoke("sync-x", {
            body: {
              clientId: account.client_id,
              accountId: account.id,
              accountExternalId: account.account_id,
              periodStart,
              periodEnd,
            },
          });
          if (error) throw error;
          return data;
        },
        "x",
        accountName
      );
      await new Promise(r => setTimeout(r, 500));
    }

    // 3. META (INSTAGRAM & FACEBOOK) SYNC
    console.log("\n=== Syncing Meta (Instagram & Facebook) ===");
    const { data: metaOauthAccounts } = await supabase
      .from("social_oauth_accounts")
      .select(`
        id, client_id, access_token, instagram_business_id, page_id,
        clients(name)
      `)
      .eq("is_active", true);

    const metaClientIds = (metaOauthAccounts || []).map(a => a.client_id);
    const { data: metaSocialAccounts } = await supabase
      .from("social_accounts")
      .select("id, client_id, platform")
      .in("client_id", metaClientIds.length > 0 ? metaClientIds : ["none"])
      .in("platform", ["instagram", "facebook"])
      .eq("is_active", true);

    for (const oauthAccount of metaOauthAccounts || []) {
      const clientName = (oauthAccount.clients as any)?.name || oauthAccount.client_id;

      // Sync Instagram
      if (oauthAccount.instagram_business_id) {
        const igSocialAccount = metaSocialAccounts?.find(
          sa => sa.client_id === oauthAccount.client_id && sa.platform === "instagram"
        );
        
        console.log(`Syncing Instagram for ${clientName}`);
        await syncBothPeriods(
          async (periodStart, periodEnd) => {
            const { data, error } = await supabase.functions.invoke("sync-meta", {
              body: {
                clientId: oauthAccount.client_id,
                accountId: igSocialAccount?.id,
                platform: "instagram",
                accessToken: oauthAccount.access_token,
                accountExternalId: oauthAccount.instagram_business_id,
                periodStart,
                periodEnd,
              },
            });
            if (error) throw error;
            return data;
          },
          "instagram",
          clientName
        );
        await new Promise(r => setTimeout(r, 500));
      }

      // Sync Facebook
      if (oauthAccount.page_id) {
        const fbSocialAccount = metaSocialAccounts?.find(
          sa => sa.client_id === oauthAccount.client_id && sa.platform === "facebook"
        );
        
        console.log(`Syncing Facebook for ${clientName}`);
        await syncBothPeriods(
          async (periodStart, periodEnd) => {
            const { data, error } = await supabase.functions.invoke("sync-meta", {
              body: {
                clientId: oauthAccount.client_id,
                accountId: fbSocialAccount?.id,
                platform: "facebook",
                accessToken: oauthAccount.access_token,
                accountExternalId: oauthAccount.page_id,
                periodStart,
                periodEnd,
              },
            });
            if (error) throw error;
            return data;
          },
          "facebook",
          clientName
        );
        await new Promise(r => setTimeout(r, 500));
      }
    }

    console.log("\n=== Scheduled Sync Complete ===");
    console.log("Results:", JSON.stringify(results, null, 2));

    return new Response(
      JSON.stringify({
        success: true,
        periods: {
          current: CURRENT_PERIOD,
          previous: PREVIOUS_PERIOD,
        },
        results,
        timestamp: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Scheduled sync error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
