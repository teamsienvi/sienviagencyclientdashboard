import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Standard analytics period - Dec 15-21, 2024
const PERIOD_START = "2024-12-15";
const PERIOD_END = "2024-12-21";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  console.log("Starting scheduled sync for all platforms...");
  console.log(`Period: ${PERIOD_START} to ${PERIOD_END}`);

  const results = {
    youtube: { success: 0, failed: 0, errors: [] as string[] },
    x: { success: 0, failed: 0, errors: [] as string[] },
    instagram: { success: 0, failed: 0, errors: [] as string[] },
    facebook: { success: 0, failed: 0, errors: [] as string[] },
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
      try {
        console.log(`Syncing YouTube for client ${account.client_id}: ${account.account_name || account.account_id}`);
        
        const { data, error } = await supabase.functions.invoke("sync-youtube", {
          body: {
            clientId: account.client_id,
            accountId: account.id,
            channelHandle: account.account_id,
            periodStart: PERIOD_START,
            periodEnd: PERIOD_END,
          },
        });

        if (error) throw error;
        if (data?.success) {
          results.youtube.success++;
          console.log(`  ✓ Synced ${data.recordsSynced || 0} videos`);
        } else {
          throw new Error(data?.error || "Unknown error");
        }
      } catch (err: any) {
        results.youtube.failed++;
        results.youtube.errors.push(`${account.account_id}: ${err.message}`);
        console.error(`  ✗ Failed: ${err.message}`);
      }
      // Small delay to avoid rate limiting
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
      try {
        console.log(`Syncing X for client ${account.client_id}: ${account.account_name || account.account_id}`);
        
        const { data, error } = await supabase.functions.invoke("sync-x", {
          body: {
            clientId: account.client_id,
            accountId: account.id,
            accountExternalId: account.account_id,
            periodStart: PERIOD_START,
            periodEnd: PERIOD_END,
          },
        });

        if (error) throw error;
        if (data?.success) {
          results.x.success++;
          console.log(`  ✓ Synced ${data.recordsSynced || 0} posts`);
        } else {
          throw new Error(data?.error || "Unknown error");
        }
      } catch (err: any) {
        results.x.failed++;
        results.x.errors.push(`${account.account_id}: ${err.message}`);
        console.error(`  ✗ Failed: ${err.message}`);
      }
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

    // Get social account IDs for Meta platforms
    const metaClientIds = (metaOauthAccounts || []).map(a => a.client_id);
    const { data: metaSocialAccounts } = await supabase
      .from("social_accounts")
      .select("id, client_id, platform")
      .in("client_id", metaClientIds)
      .in("platform", ["instagram", "facebook"])
      .eq("is_active", true);

    for (const oauthAccount of metaOauthAccounts || []) {
      const clientName = (oauthAccount.clients as any)?.name || oauthAccount.client_id;

      // Sync Instagram
      if (oauthAccount.instagram_business_id) {
        const igSocialAccount = metaSocialAccounts?.find(
          sa => sa.client_id === oauthAccount.client_id && sa.platform === "instagram"
        );
        
        try {
          console.log(`Syncing Instagram for ${clientName}`);
          
          const { data, error } = await supabase.functions.invoke("sync-meta", {
            body: {
              clientId: oauthAccount.client_id,
              accountId: igSocialAccount?.id,
              platform: "instagram",
              accessToken: oauthAccount.access_token,
              accountExternalId: oauthAccount.instagram_business_id,
              periodStart: PERIOD_START,
              periodEnd: PERIOD_END,
            },
          });

          if (error) throw error;
          if (data?.success) {
            results.instagram.success++;
            console.log(`  ✓ Synced ${data.recordsSynced || 0} posts`);
          } else {
            throw new Error(data?.error || "Unknown error");
          }
        } catch (err: any) {
          results.instagram.failed++;
          results.instagram.errors.push(`${clientName}: ${err.message}`);
          console.error(`  ✗ Failed: ${err.message}`);
        }
        await new Promise(r => setTimeout(r, 500));
      }

      // Sync Facebook
      if (oauthAccount.page_id) {
        const fbSocialAccount = metaSocialAccounts?.find(
          sa => sa.client_id === oauthAccount.client_id && sa.platform === "facebook"
        );
        
        try {
          console.log(`Syncing Facebook for ${clientName}`);
          
          const { data, error } = await supabase.functions.invoke("sync-meta", {
            body: {
              clientId: oauthAccount.client_id,
              accountId: fbSocialAccount?.id,
              platform: "facebook",
              accessToken: oauthAccount.access_token,
              accountExternalId: oauthAccount.page_id,
              periodStart: PERIOD_START,
              periodEnd: PERIOD_END,
            },
          });

          if (error) throw error;
          if (data?.success) {
            results.facebook.success++;
            console.log(`  ✓ Synced ${data.recordsSynced || 0} posts`);
          } else {
            throw new Error(data?.error || "Unknown error");
          }
        } catch (err: any) {
          results.facebook.failed++;
          results.facebook.errors.push(`${clientName}: ${err.message}`);
          console.error(`  ✗ Failed: ${err.message}`);
        }
        await new Promise(r => setTimeout(r, 500));
      }
    }

    console.log("\n=== Scheduled Sync Complete ===");
    console.log("Results:", JSON.stringify(results, null, 2));

    return new Response(
      JSON.stringify({
        success: true,
        period: { start: PERIOD_START, end: PERIOD_END },
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
