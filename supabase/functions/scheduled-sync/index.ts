import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Dynamic date calculation for current and previous week
function getAnalyticsPeriods() {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0 = Sunday

  // Current week: starts on Sunday
  const currentWeekStart = new Date(now);
  currentWeekStart.setDate(now.getDate() - dayOfWeek);
  currentWeekStart.setHours(0, 0, 0, 0);

  const currentWeekEnd = new Date(currentWeekStart);
  currentWeekEnd.setDate(currentWeekStart.getDate() + 6);

  // Previous week
  const previousWeekEnd = new Date(currentWeekStart);
  previousWeekEnd.setDate(currentWeekStart.getDate() - 1);

  const previousWeekStart = new Date(previousWeekEnd);
  previousWeekStart.setDate(previousWeekEnd.getDate() - 6);

  const formatDate = (d: Date) => d.toISOString().split('T')[0];

  return {
    current: { start: formatDate(currentWeekStart), end: formatDate(currentWeekEnd) },
    previous: { start: formatDate(previousWeekStart), end: formatDate(previousWeekEnd) },
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const periods = getAnalyticsPeriods();

  console.log("Starting scheduled sync for all platforms...");
  console.log(`Current Period: ${periods.current.start} to ${periods.current.end}`);
  console.log(`Previous Period: ${periods.previous.start} to ${periods.previous.end}`);
  console.log(`Sync started at: ${new Date().toISOString()}`);

  const results = {
    youtube: { success: 0, failed: 0, errors: [] as string[] },
    x: { success: 0, failed: 0, errors: [] as string[] },
    instagram: { success: 0, failed: 0, errors: [] as string[] },
    facebook: { success: 0, failed: 0, errors: [] as string[] },
    tiktok: { success: 0, failed: 0, errors: [] as string[] },
    linkedin: { success: 0, failed: 0, errors: [] as string[] },
  };

  // Helper to sync a platform for both periods
  const syncBothPeriods = async (
    syncFn: (periodStart: string, periodEnd: string) => Promise<{ success: boolean; recordsSynced?: number; error?: string }>,
    platformKey: keyof typeof results,
    accountName: string
  ) => {
    // Sync current period
    try {
      const currentResult = await syncFn(periods.current.start, periods.current.end);
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
      const prevResult = await syncFn(periods.previous.start, periods.previous.end);
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

    // 3. TIKTOK SYNC
    console.log("\n=== Syncing TikTok ===");
    const { data: tiktokAccounts } = await supabase
      .from("social_accounts")
      .select("id, client_id, account_id, account_name, access_token_encrypted")
      .eq("platform", "tiktok")
      .eq("is_active", true);

    for (const account of tiktokAccounts || []) {
      const accountName = account.account_name || account.account_id;
      console.log(`Syncing TikTok for client ${account.client_id}: ${accountName}`);

      await syncBothPeriods(
        async (periodStart, periodEnd) => {
          const { data, error } = await supabase.functions.invoke("sync-tiktok", {
            body: {
              clientId: account.client_id,
              accountId: account.id,
              platform: "tiktok",
              accessToken: account.access_token_encrypted,
              accountExternalId: account.account_id,
              periodStart,
              periodEnd,
            },
          });
          if (error) throw error;
          return data;
        },
        "tiktok",
        accountName
      );
      await new Promise(r => setTimeout(r, 500));
    }

    // 3b. TIKTOK DEMOGRAPHICS SYNC VIA METRICOOL
    console.log("\n=== Syncing TikTok Demographics (Metricool) ===");
    const { data: tiktokMetricoolConfigs } = await supabase
      .from("client_metricool_config")
      .select(`client_id, user_id, blog_id, clients(name)`)
      .eq("platform", "tiktok")
      .eq("is_active", true);

    for (const config of tiktokMetricoolConfigs || []) {
      const clientName = (config.clients as any)?.name || config.client_id;
      console.log(`Syncing TikTok demographics for ${clientName}`);

      try {
        // Sync gender demographics
        const { error: genderError } = await supabase.functions.invoke("metricool-distribution", {
          body: {
            metric: "gender",
            network: "tiktok",
            subject: "account",
            from: `${periods.current.start}T00:00:00`,
            to: `${periods.current.end}T23:59:59`,
            userId: config.user_id,
            blogId: config.blog_id || undefined,
            clientId: config.client_id, // enables persistence
          },
        });
        if (genderError) {
          console.error(`  ✗ Gender demographics failed: ${genderError.message}`);
        } else {
          console.log(`  ✓ Gender demographics synced`);
        }

        await new Promise(r => setTimeout(r, 300));

        // Sync country demographics
        const { error: countryError } = await supabase.functions.invoke("metricool-distribution", {
          body: {
            metric: "country",
            network: "tiktok",
            subject: "account",
            from: `${periods.current.start}T00:00:00`,
            to: `${periods.current.end}T23:59:59`,
            userId: config.user_id,
            blogId: config.blog_id || undefined,
            clientId: config.client_id, // enables persistence
          },
        });
        if (countryError) {
          console.error(`  ✗ Country demographics failed: ${countryError.message}`);
        } else {
          console.log(`  ✓ Country demographics synced`);
        }

        await new Promise(r => setTimeout(r, 300));
      } catch (err: any) {
        console.error(`  ✗ Demographics sync failed for ${clientName}: ${err.message}`);
      }
    }

    // 4. LINKEDIN SYNC
    console.log("\n=== Syncing LinkedIn ===");
    const { data: linkedinAccounts } = await supabase
      .from("social_accounts")
      .select("id, client_id, account_id, account_name, access_token_encrypted")
      .eq("platform", "linkedin")
      .eq("is_active", true);

    for (const account of linkedinAccounts || []) {
      const accountName = account.account_name || account.account_id;
      console.log(`Syncing LinkedIn for client ${account.client_id}: ${accountName}`);

      await syncBothPeriods(
        async (periodStart, periodEnd) => {
          const { data, error } = await supabase.functions.invoke("sync-linkedin", {
            body: {
              clientId: account.client_id,
              accountId: account.id,
              platform: "linkedin",
              accessToken: account.access_token_encrypted,
              accountExternalId: account.account_id,
              periodStart,
              periodEnd,
            },
          });
          if (error) throw error;
          return data;
        },
        "linkedin",
        accountName
      );
      await new Promise(r => setTimeout(r, 500));
    }

    // 5. META (INSTAGRAM & FACEBOOK) SYNC VIA METRICOOL
    console.log("\n=== Syncing Meta via Metricool (Instagram & Facebook) ===");

    // Fetch all active Metricool configs for Instagram
    const { data: instagramConfigs } = await supabase
      .from("client_metricool_config")
      .select(`
        client_id,
        user_id,
        blog_id,
        clients(name)
      `)
      .eq("platform", "instagram")
      .eq("is_active", true);

    for (const config of instagramConfigs || []) {
      const clientName = (config.clients as any)?.name || config.client_id;
      console.log(`Syncing Instagram (Metricool) for ${clientName}`);

      await syncBothPeriods(
        async (periodStart, periodEnd) => {
          const { data, error } = await supabase.functions.invoke("sync-metricool-instagram", {
            body: {
              clientId: config.client_id,
              periodStart,
              periodEnd,
            },
          });
          if (error) throw error;
          return { success: true, recordsSynced: data?.recordsSynced || 0 };
        },
        "instagram",
        clientName
      );
      await new Promise(r => setTimeout(r, 500));
    }

    // Fetch all active Metricool configs for Facebook
    const { data: facebookConfigs } = await supabase
      .from("client_metricool_config")
      .select(`
        client_id,
        user_id,
        blog_id,
        clients(name)
      `)
      .eq("platform", "facebook")
      .eq("is_active", true);

    for (const config of facebookConfigs || []) {
      const clientName = (config.clients as any)?.name || config.client_id;
      console.log(`Syncing Facebook (Metricool) for ${clientName}`);

      await syncBothPeriods(
        async (periodStart, periodEnd) => {
          const { data, error } = await supabase.functions.invoke("sync-metricool-facebook", {
            body: {
              clientId: config.client_id,
              periodStart,
              periodEnd,
            },
          });
          if (error) throw error;
          return { success: true, recordsSynced: data?.recordsSynced || 0 };
        },
        "facebook",
        clientName
      );
      await new Promise(r => setTimeout(r, 500));
    }

    console.log("\n=== Scheduled Sync Complete ===");
    console.log("Results:", JSON.stringify(results, null, 2));

    return new Response(
      JSON.stringify({
        success: true,
        periods,
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
