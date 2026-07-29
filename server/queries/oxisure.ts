/**
 * Server-side query functions for OxiSure Retention App data.
 * All queries are read-only and run against the OxiSure Supabase project.
 */
import { createOxiClient } from "@/lib/supabase/oxisure";
import type {
  OxiOrderStats,
  OxiSourceBreakdown,
  OxiFulfillmentBreakdown,
  OxiDailyOrderPoint,
  OxiRecentOrder,
  OxiOrderItem,
} from "@/types/oxisure";

type TimeRange = "7d" | "30d" | "90d" | "all";

/**
 * Computes the ISO date string for N days ago, used for time-range filtering.
 */
function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

/**
 * Returns the ISO string for the start of the current month (UTC).
 */
function startOfMonth(): string {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString();
}

/**
 * Maps a TimeRange preset to the number of days for the time-series query.
 */
function rangeToDays(range: TimeRange): number | null {
  switch (range) {
    case "7d":
      return 7;
    case "30d":
      return 30;
    case "90d":
      return 90;
    case "all":
      return null;
  }
}

/**
 * Fetches all OxiSure sales analytics in parallel.
 * @param range — Time range for the ordersOverTime series.
 */
export async function getOxiSureStats(
  range: TimeRange = "30d"
): Promise<OxiOrderStats> {
  const oxi = createOxiClient();
  const days = rangeToDays(range);

  // Build all queries in parallel
  const [
    totalsResult,
    monthResult,
    sourceResult,
    fulfillmentResult,
    timeSeriesResult,
    recentResult,
    trackersResult,
    customersResult,
  ] = await Promise.all([
    // 1. Total orders & revenue (completed only)
    oxi
      .from("orders")
      .select("id, total_amount")
      .eq("status", "completed"),

    // 2. Orders this month (completed only)
    oxi
      .from("orders")
      .select("id, total_amount")
      .eq("status", "completed")
      .gte("created_at", startOfMonth()),

    // 3. By source (completed only) — we aggregate client-side since
    //    Supabase JS doesn't support GROUP BY with SUM natively
    oxi
      .from("orders")
      .select("purchase_source, total_amount")
      .eq("status", "completed"),

    // 4. Fulfillment breakdown (completed only)
    oxi
      .from("orders")
      .select("fulfillment_status")
      .eq("status", "completed"),

    // 5. Orders over time — daily, filtered by range
    (() => {
      let query = oxi
        .from("orders")
        .select("created_at, total_amount")
        .eq("status", "completed")
        .order("created_at", { ascending: true });

      if (days !== null) {
        query = query.gte("created_at", daysAgo(days));
      }
      return query;
    })(),

    // 6. Recent orders with profile join (all statuses for visibility)
    oxi
      .from("orders")
      .select(
        "id, user_id, total_amount, status, fulfillment_status, tracking_number, tracking_url, tracking_company, items, purchase_source, created_at, shopify_order_id, profiles!orders_user_id_fkey(full_name, email)"
      )
      .order("created_at", { ascending: false })
      .limit(50),

    // 7. Active trackers
    oxi
      .from("tracked_products")
      .select("id", { count: "exact", head: true })
      .neq("status", "completed"),

    // 8. Distinct customers
    oxi.from("orders").select("user_id"),
  ]);

  // ── Process totals ──
  const completedOrders = totalsResult.data ?? [];
  const totalOrders = completedOrders.length;
  const totalRevenue = completedOrders.reduce(
    (sum, o) => sum + (Number(o.total_amount) || 0),
    0
  );
  const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  // ── Process month ──
  const monthOrders = monthResult.data ?? [];
  const ordersThisMonth = monthOrders.length;
  const revenueThisMonth = monthOrders.reduce(
    (sum, o) => sum + (Number(o.total_amount) || 0),
    0
  );

  // ── Process source breakdown ──
  const sourceMap = new Map<string, { count: number; revenue: number }>();
  for (const row of sourceResult.data ?? []) {
    const src = row.purchase_source ?? "unknown";
    const existing = sourceMap.get(src) ?? { count: 0, revenue: 0 };
    existing.count++;
    existing.revenue += Number(row.total_amount) || 0;
    sourceMap.set(src, existing);
  }
  const ordersBySource: OxiSourceBreakdown[] = Array.from(
    sourceMap.entries()
  ).map(([source, data]) => ({
    source: source as OxiSourceBreakdown["source"],
    count: data.count,
    revenue: data.revenue,
  }));

  // ── Process fulfillment breakdown ──
  const fulfillmentMap = new Map<string, number>();
  for (const row of fulfillmentResult.data ?? []) {
    const status = row.fulfillment_status ?? "unknown";
    fulfillmentMap.set(status, (fulfillmentMap.get(status) ?? 0) + 1);
  }
  const fulfillmentBreakdown: OxiFulfillmentBreakdown[] = Array.from(
    fulfillmentMap.entries()
  ).map(([status, count]) => ({ status, count }));

  // ── Process time series (aggregate by day) ──
  const dayMap = new Map<string, { count: number; revenue: number }>();
  for (const row of timeSeriesResult.data ?? []) {
    const day = row.created_at?.substring(0, 10) ?? "unknown";
    const existing = dayMap.get(day) ?? { count: 0, revenue: 0 };
    existing.count++;
    existing.revenue += Number(row.total_amount) || 0;
    dayMap.set(day, existing);
  }
  const ordersOverTime: OxiDailyOrderPoint[] = Array.from(
    dayMap.entries()
  )
    .map(([date, data]) => ({ date, count: data.count, revenue: data.revenue }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // ── Process recent orders ──
  const recentOrders: OxiRecentOrder[] = (recentResult.data ?? []).map(
    (row: any) => {
      const profile = row.profiles;
      const items: OxiOrderItem[] = Array.isArray(row.items)
        ? row.items
        : [];

      return {
        id: row.id,
        customerName: profile?.full_name ?? "Unknown",
        customerEmail: profile?.email ?? "",
        purchaseSource: row.purchase_source ?? "unknown",
        items: items.map((i) => ({
          product_name: i.product_name ?? "Unknown Product",
          quantity: i.quantity ?? 1,
        })),
        totalAmount: Number(row.total_amount) || 0,
        status: row.status ?? "unknown",
        fulfillmentStatus: row.fulfillment_status ?? "unknown",
        trackingNumber: row.tracking_number ?? null,
        trackingUrl: row.tracking_url ?? null,
        trackingCompany: row.tracking_company ?? null,
        createdAt: row.created_at,
        shopifyOrderId: row.shopify_order_id ?? null,
      };
    }
  );

  // ── Active trackers ──
  const activeTrackers = trackersResult.count ?? 0;

  // ── Distinct customers ──
  const allUserIds = (customersResult.data ?? []).map(
    (r: any) => r.user_id
  );
  const totalCustomers = new Set(allUserIds).size;

  return {
    totalOrders,
    totalRevenue,
    ordersThisMonth,
    revenueThisMonth,
    averageOrderValue,
    activeTrackers,
    totalCustomers,
    ordersBySource,
    fulfillmentBreakdown,
    ordersOverTime,
    recentOrders,
  };
}
