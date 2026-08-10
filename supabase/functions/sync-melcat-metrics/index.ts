import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.87.1";
import { Pool } from "https://deno.land/x/postgres@v0.19.3/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * sync-melcat-metrics
 *
 * Connects to the MelCat Shopify app's Postgres database (Prisma-managed)
 * and pulls digital product metrics (customers, entitlements, QR campaigns,
 * upgrade funnels, chat sessions, Amazon claims, drops).
 *
 * Results are cached in `platform_analytics_cache` with platform = 'melcat'.
 */

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  let pool: Pool | null = null;

  try {
    const { clientId } = await req.json();

    if (!clientId) {
      throw new Error("Missing clientId");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // MelCat's database connection string (set as Supabase secret)
    const melcatDbUrl = Deno.env.get("MELCAT_DATABASE_URL");
    if (!melcatDbUrl) {
      throw new Error("MELCAT_DATABASE_URL secret is not configured");
    }

    console.log(`[sync-melcat-metrics] Starting sync for client: ${clientId}`);

    // Connect to MelCat's Postgres via connection pool
    pool = new Pool(melcatDbUrl, 1, true);
    const conn = await pool.connect();

    try {
      // ── Core Counters ──
      const totalCustomers = await queryScalar(conn,
        `SELECT COUNT(*) FROM "Customer"`);

      const activeEntitlements = await queryScalar(conn,
        `SELECT COUNT(*) FROM "Entitlement" WHERE revoked = false`);

      const totalQRRedemptions = await queryScalar(conn,
        `SELECT COUNT(*) FROM "QRRedemption"`);

      // Event counts by type
      const eventRows = await conn.queryObject<{ eventType: string; count: number }>(`
        SELECT "eventType", COUNT(*)::int AS count
        FROM "CustomerEvent"
        GROUP BY "eventType"
      `);
      const eventCounts: Record<string, number> = {};
      for (const row of eventRows.rows) {
        eventCounts[row.eventType] = row.count;
      }

      // Unique chat sessions
      const uniqueChatSessions = await queryScalar(conn,
        `SELECT COUNT(DISTINCT "sessionId") FROM "CustomerEvent" WHERE "eventType" = 'chat_sent' AND "sessionId" IS NOT NULL`);

      // Historical chat usage fallback (from legacy Supabase table)
      let totalChats = eventCounts.chat_sent || 0;
      let finalUniqueSessions = uniqueChatSessions;
      try {
        const historicResult = await conn.queryObject<{ total_chats: number; total_sessions: number }>(`
          SELECT
            COALESCE(SUM(chat_count), 0)::int AS total_chats,
            COUNT(*)::int AS total_sessions
          FROM big_mel_chat_usage
        `);
        if (historicResult.rows.length > 0) {
          const { total_chats, total_sessions } = historicResult.rows[0];
          if (totalChats === 0) totalChats = total_chats;
          if (finalUniqueSessions === 0) finalUniqueSessions = total_sessions;
        }
      } catch (_err) {
        console.log("[sync-melcat-metrics] big_mel_chat_usage table not found, skipping historical chat data");
      }

      // Free tier purchases (tunnels/cubes)
      const freeTierRows = await conn.queryObject<{ metadata: any }>(`
        SELECT metadata FROM "CustomerEvent" WHERE "eventType" = 'free_tier_granted'
      `);
      let tunnelsClaimed = 0;
      let cubesClaimed = 0;
      for (const row of freeTierRows.rows) {
        const productType = row.metadata?.productType;
        if (productType === "tunnel") tunnelsClaimed++;
        else if (productType === "cube") cubesClaimed++;
      }

      // Free-to-paid conversion
      const freeTierCustomerIds = await conn.queryObject<{ customerId: string }>(`
        SELECT DISTINCT "customerId" FROM "CustomerEvent"
        WHERE "eventType" = 'free_tier_granted' AND "customerId" IS NOT NULL
      `);
      const freeIds = freeTierCustomerIds.rows.map(r => r.customerId);

      let convertedUpgrades = 0;
      if (freeIds.length > 0) {
        const placeholders = freeIds.map((_, i) => `$${i + 1}`).join(",");
        const upgradeResult = await conn.queryObject<{ count: number }>(
          `SELECT COUNT(DISTINCT "customerId")::int AS count
           FROM "CustomerEvent"
           WHERE "eventType" = 'upgrade_purchased'
             AND "customerId" IN (${placeholders})`,
          freeIds
        );
        convertedUpgrades = upgradeResult.rows[0]?.count || 0;
      }

      const freeToPaidConversionRate = freeIds.length > 0
        ? ((convertedUpgrades / freeIds.length) * 100).toFixed(1) + "%"
        : "0.0%";

      // ── Funnel Metrics ──
      const claimToLibrary = eventCounts.claim_completed
        ? ((eventCounts.library_viewed || 0) / eventCounts.claim_completed * 100).toFixed(1)
        : "0.0";
      const libraryToUpgradeClick = eventCounts.library_viewed
        ? ((eventCounts.upgrade_clicked || 0) / eventCounts.library_viewed * 100).toFixed(1)
        : "0.0";
      const clickToPurchase = eventCounts.upgrade_clicked
        ? ((eventCounts.upgrade_purchased || 0) / eventCounts.upgrade_clicked * 100).toFixed(1)
        : "0.0";

      const dropNotifCount = await queryScalar(conn,
        `SELECT COUNT(*) FROM "DropNotificationLog"`);
      const dropToDownload = dropNotifCount
        ? ((eventCounts.drop_downloaded || 0) / dropNotifCount * 100).toFixed(1)
        : "0.0";

      // ── QR Campaign Performance ──
      const qrCampaigns = await conn.queryObject<{
        campaignHash: string;
        packName: string;
        isActive: boolean;
        redemptions: number;
        uniqueCustomers: number;
      }>(`
        SELECT
          qr."campaignHash",
          COALESCE(p.name, 'N/A') AS "packName",
          qr."isActive",
          (SELECT COUNT(*)::int FROM "QRRedemption" r WHERE r."campaignId" = qr.id) AS redemptions,
          (SELECT COUNT(DISTINCT r."customerId")::int FROM "QRRedemption" r WHERE r."campaignId" = qr.id) AS "uniqueCustomers"
        FROM "QRCampaign" qr
        LEFT JOIN "Pack" p ON qr."packId" = p.id
      `);

      // ── Upgrade Performance (by tier) ──
      const upgradeClicks = await conn.queryObject<{ tier: string; count: number }>(`
        SELECT
          COALESCE(metadata->>'targetTier', 'Unknown') AS tier,
          COUNT(*)::int AS count
        FROM "CustomerEvent"
        WHERE "eventType" = 'upgrade_clicked'
        GROUP BY tier
      `);
      const upgradePurchases = await conn.queryObject<{ tier: string; count: number }>(`
        SELECT
          COALESCE(metadata->>'tierLevel', 'Unknown') AS tier,
          COUNT(*)::int AS count
        FROM "CustomerEvent"
        WHERE "eventType" = 'upgrade_purchased'
        GROUP BY tier
      `);

      const tierStats: Record<string, { clicks: number; purchases: number }> = {};
      for (const row of upgradeClicks.rows) {
        tierStats[row.tier] = { clicks: row.count, purchases: 0 };
      }
      for (const row of upgradePurchases.rows) {
        if (!tierStats[row.tier]) tierStats[row.tier] = { clicks: 0, purchases: 0 };
        tierStats[row.tier].purchases = row.count;
      }

      const upgradePerformance = Object.entries(tierStats).map(([tier, stats]) => ({
        tier,
        clicks: stats.clicks,
        purchases: stats.purchases,
        conversion: stats.clicks ? ((stats.purchases / stats.clicks) * 100).toFixed(1) + "%" : "0.0%"
      }));

      // ── Drop Performance ──
      const drops = await conn.queryObject<{
        title: string;
        requiredTierLevel: number;
        notifsSent: number;
        notifsFailed: number;
      }>(`
        SELECT
          d.title,
          d."requiredTierLevel",
          (SELECT COUNT(*)::int FROM "DropNotificationLog" n WHERE n."dropId" = d.id AND n.status = 'sent') AS "notifsSent",
          (SELECT COUNT(*)::int FROM "DropNotificationLog" n WHERE n."dropId" = d.id AND n.status = 'failed') AS "notifsFailed"
        FROM "Drop" d
      `);

      const dropDownloads = await conn.queryObject<{ dropId: string; count: number }>(`
        SELECT
          metadata->>'dropId' AS "dropId",
          COUNT(*)::int AS count
        FROM "CustomerEvent"
        WHERE "eventType" = 'drop_downloaded'
          AND metadata->>'dropId' IS NOT NULL
        GROUP BY "dropId"
      `);
      const dropDlMap: Record<string, number> = {};
      for (const row of dropDownloads.rows) {
        dropDlMap[row.dropId] = row.count;
      }

      // ── Amazon Claims ──
      const amazonTotalOrders = await queryScalar(conn, `SELECT COUNT(*) FROM "AmazonOrder"`);
      const amazonClaimedOrders = await queryScalar(conn, `SELECT COUNT(*) FROM "AmazonOrder" WHERE "isClaimed" = true`);
      const amazonTotalClaims = await queryScalar(conn, `SELECT COUNT(*) FROM "AmazonClaim"`);
      const amazonPendingClaims = await queryScalar(conn, `SELECT COUNT(*) FROM "AmazonClaim" WHERE status = 'PENDING'`);
      const amazonApprovedClaims = await queryScalar(conn, `SELECT COUNT(*) FROM "AmazonClaim" WHERE status = 'APPROVED'`);

      // ── Tiers info ──
      const tiers = await conn.queryObject<{ name: string; level: number; packCount: number }>(`
        SELECT t.name, t.level, COUNT(p.id)::int AS "packCount"
        FROM "Tier" t
        LEFT JOIN "Pack" p ON p."tierId" = t.id AND p."isActive" = true
        GROUP BY t.id, t.name, t.level
        ORDER BY t.level
      `);

      // ── Assemble payload ──
      const payload = {
        core: {
          totalCustomers,
          activeEntitlements,
          totalQRRedemptions,
          libraryViews: eventCounts.library_viewed || 0,
          assetDownloads: eventCounts.asset_downloaded || 0,
          upgradeClicks: eventCounts.upgrade_clicked || 0,
          upgradePurchases: eventCounts.upgrade_purchased || 0,
          dropNotifications: dropNotifCount,
          dropDownloads: eventCounts.drop_downloaded || 0,
          totalChats,
          uniqueChatSessions: finalUniqueSessions,
          tunnelsClaimed,
          cubesClaimed,
          freeToPaidConversionRate,
        },
        funnel: {
          claimToLibrary: `${claimToLibrary}%`,
          libraryToUpgradeClick: `${libraryToUpgradeClick}%`,
          clickToPurchase: `${clickToPurchase}%`,
          dropToDownload: `${dropToDownload}%`,
        },
        qrCampaigns: qrCampaigns.rows,
        upgradePerformance,
        drops: drops.rows.map(d => ({
          ...d,
          dropDownloaded: dropDlMap[d.title] || 0, // approximate match
          reactivationRate: d.notifsSent
            ? ((dropDlMap[d.title] || 0) / d.notifsSent * 100).toFixed(1) + "%"
            : "0.0%"
        })),
        amazon: {
          totalOrders: amazonTotalOrders,
          claimedOrders: amazonClaimedOrders,
          totalClaims: amazonTotalClaims,
          pendingClaims: amazonPendingClaims,
          approvedClaims: amazonApprovedClaims,
        },
        tiers: tiers.rows,
        syncedAt: new Date().toISOString(),
      };

      conn.release();

      console.log(`[sync-melcat-metrics] Data fetched. Caching to platform_analytics_cache...`);

      // Cache to platform_analytics_cache
      const { error: upsertError } = await supabase
        .from("platform_analytics_cache")
        .upsert({
          client_id: clientId,
          platform: "melcat",
          module: "analytics",
          data: payload,
          collected_at: new Date().toISOString(),
        }, { onConflict: "client_id,platform,module" });

      if (upsertError) {
        console.error("[sync-melcat-metrics] Cache upsert error:", upsertError);
        throw upsertError;
      }

      console.log(`[sync-melcat-metrics] Successfully synced and cached.`);

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );

    } catch (queryErr) {
      conn.release();
      throw queryErr;
    }

  } catch (error: any) {
    console.error("[sync-melcat-metrics] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } finally {
    if (pool) {
      try { await pool.end(); } catch (_) { /* ignore */ }
    }
  }
});

/** Helper: run a COUNT(*) query and return the integer result */
async function queryScalar(conn: any, sql: string): Promise<number> {
  const result = await conn.queryObject<{ count: number }>(sql);
  return Number(result.rows[0]?.count ?? 0);
}
