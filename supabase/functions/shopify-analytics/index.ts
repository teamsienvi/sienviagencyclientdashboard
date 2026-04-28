import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ShopifySummary {
  // Core sales metrics (Shopify definitions)
  grossSales: number;        // Product subtotals + discounts (before discounts/returns)
  discounts: number;         // Total discount amount
  returns: number;           // Total refund amount
  netSales: number;          // Gross - Discounts - Returns (product revenue)
  shippingCharges: number;   // Total shipping collected
  returnFees: number;        // Fees for returns (usually 0)
  taxes: number;             // Total tax collected
  totalSales: number;        // Net Sales + Shipping + Taxes (what customer pays)

  // Order metrics
  orders: number;
  ordersFulfilled: number;
  ordersUnfulfilled: number;
  averageOrderValue: number;

  // Customer metrics
  newCustomers: number;
  returningCustomers: number;
  returningCustomerRate: number;

  // Previous period for comparison
  prevGrossSales?: number;
  prevNetSales?: number;
  prevTotalSales?: number;
  prevOrders?: number;
  prevOrdersFulfilled?: number;
  prevAverageOrderValue?: number;
  prevReturningCustomerRate?: number;
}

interface TimeseriesPoint {
  date: string;
  value: number;
}

interface TopProduct {
  id: string;
  title: string;
  imageUrl: string | null;
  unitsSold: number;
  revenue: number;
  refunds: number;
}

interface OrderSource {
  name: string;
  orders: number;
  revenue: number;
}

interface OrderItem {
  id: string;
  orderNumber: string;
  createdAt: string;
  customerName: string;
  customerEmail: string;
  financialStatus: string;
  fulfillmentStatus: string;
  totalPrice: number;
  subtotalPrice: number;
  totalShipping: number;
  totalTax: number;
  totalDiscounts: number;
  itemCount: number;
  source: string;
  channel: "organic" | "paid" | "unknown";
  referringSite: string | null;
  lineItems: {
    title: string;
    quantity: number;
    price: number;
  }[];
  shippingAddress?: {
    city: string;
    province: string;
    country: string;
  };
}

// Parse Link header for cursor-based pagination
function parseLinkHeader(linkHeader: string | null): { next?: string; previous?: string } {
  if (!linkHeader) return {};
  const links: { next?: string; previous?: string } = {};

  const parts = linkHeader.split(",");
  for (const part of parts) {
    const match = part.match(/<([^>]+)>;\s*rel="([^"]+)"/);
    if (match) {
      const [, url, rel] = match;
      if (rel === "next") links.next = url;
      if (rel === "previous") links.previous = url;
    }
  }
  return links;
}

// Sleep helper for rate limiting
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Make Shopify Admin API request with retry logic for rate limiting
async function shopifyRequest(shopDomain: string, accessToken: string, endpoint: string, retries = 3): Promise<{ json: any; linkHeader: string | null }> {
  const url = endpoint.startsWith("http")
    ? endpoint
    : `https://${shopDomain}/admin/api/2024-01/${endpoint}`;
  console.log(`[shopify-analytics] Fetching: ${url}`);

  for (let attempt = 0; attempt <= retries; attempt++) {
    const response = await fetch(url, {
      headers: {
        "X-Shopify-Access-Token": accessToken,
        "Content-Type": "application/json",
      },
    });

    // Handle rate limiting (429)
    if (response.status === 429) {
      const retryAfter = response.headers.get("Retry-After");
      const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : Math.pow(2, attempt) * 1000;
      console.log(`[shopify-analytics] Rate limited, waiting ${waitTime}ms before retry ${attempt + 1}/${retries}`);

      if (attempt < retries) {
        await sleep(waitTime);
        continue;
      }
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[shopify-analytics] API error: ${response.status} - ${errorText}`);
      throw new Error(`Shopify API error: ${response.status}`);
    }

    return {
      json: await response.json(),
      linkHeader: response.headers.get("Link"),
    };
  }

  throw new Error("Shopify API error: 429 - Rate limited after retries");
}

// Fetch ALL orders with cursor-based pagination (handles > 250 orders)
async function fetchAllOrders(shopDomain: string, accessToken: string, startDate: string, endDate: string) {
  const allOrders: any[] = [];
  let nextUrl: string | undefined;

  const initialParams = new URLSearchParams({
    created_at_min: `${startDate}T00:00:00Z`,
    created_at_max: `${endDate}T23:59:59Z`,
    status: "any",
    limit: "250",
  });

  let endpoint = `orders.json?${initialParams}`;

  do {
    const { json, linkHeader } = await shopifyRequest(shopDomain, accessToken, endpoint);
    const orders = json.orders || [];
    allOrders.push(...orders);

    const links = parseLinkHeader(linkHeader);
    nextUrl = links.next;
    if (nextUrl) {
      endpoint = nextUrl;
    }
  } while (nextUrl);

  console.log(`[shopify-analytics] Fetched ${allOrders.length} total orders`);
  return allOrders;
}

// Fetch orders within a date range (single page for speed)
async function fetchOrders(shopDomain: string, accessToken: string, startDate: string, endDate: string) {
  const params = new URLSearchParams({
    created_at_min: `${startDate}T00:00:00Z`,
    created_at_max: `${endDate}T23:59:59Z`,
    status: "any",
    limit: "250",
  });

  const { json } = await shopifyRequest(shopDomain, accessToken, `orders.json?${params}`);
  return json.orders || [];
}

// Fetch paginated orders for display (with full pagination info)
async function fetchOrdersPage(
  shopDomain: string,
  accessToken: string,
  startDate: string,
  endDate: string,
  pageInfo?: string,
  limit: number = 20
) {
  let endpoint: string;

  if (pageInfo) {
    endpoint = `orders.json?limit=${limit}&page_info=${pageInfo}`;
  } else {
    const params = new URLSearchParams({
      created_at_min: `${startDate}T00:00:00Z`,
      created_at_max: `${endDate}T23:59:59Z`,
      status: "any",
      limit: String(limit),
    });
    endpoint = `orders.json?${params}`;
  }

  const { json, linkHeader } = await shopifyRequest(shopDomain, accessToken, endpoint);
  const links = parseLinkHeader(linkHeader);

  // Extract page_info from URLs
  const getPageInfo = (url?: string) => {
    if (!url) return undefined;
    const parsed = new URL(url);
    return parsed.searchParams.get("page_info") || undefined;
  };

  return {
    orders: json.orders || [],
    nextPageInfo: getPageInfo(links.next),
    prevPageInfo: getPageInfo(links.previous),
  };
}

// Fetch products
async function fetchProducts(shopDomain: string, accessToken: string, limit = 50) {
  const { json } = await shopifyRequest(shopDomain, accessToken, `products.json?limit=${limit}`);
  return json.products || [];
}

// Fetch customers
async function fetchCustomers(shopDomain: string, accessToken: string, startDate: string, endDate: string) {
  const params = new URLSearchParams({
    created_at_min: `${startDate}T00:00:00Z`,
    created_at_max: `${endDate}T23:59:59Z`,
    limit: "250",
  });

  const { json } = await shopifyRequest(shopDomain, accessToken, `customers.json?${params}`);
  return json.customers || [];
}

// Calculate summary from orders - matching Shopify's exact definitions
function calculateSummary(orders: any[], customers: any[]): ShopifySummary {
  let grossSales = 0;
  let discounts = 0;
  let returns = 0;
  let shippingCharges = 0;
  let taxes = 0;
  let ordersFulfilled = 0;
  let ordersUnfulfilled = 0;

  console.log(`[shopify-analytics] Processing ${orders.length} orders for summary`);

  for (const order of orders) {
    // Subtotal = product line items total (after line discounts, before order discounts, excludes shipping/tax)
    const subtotal = parseFloat(order.subtotal_price || "0");
    const totalDiscount = parseFloat(order.total_discounts || "0");
    const shipping = parseFloat(order.total_shipping_price_set?.shop_money?.amount || order.shipping_lines?.[0]?.price || "0");
    const tax = parseFloat(order.total_tax || "0");

    // Calculate refund amounts
    const totalRefund = (order.refunds || []).reduce((sum: number, r: any) => {
      return sum + (r.transactions || []).reduce((tSum: number, t: any) => tSum + parseFloat(t.amount || "0"), 0);
    }, 0);

    // Gross sales = subtotal + discounts (what it would have been at full price)
    grossSales += subtotal + totalDiscount;
    discounts += totalDiscount;
    returns += totalRefund;
    shippingCharges += shipping;
    taxes += tax;

    // Track fulfillment status
    if (order.fulfillment_status === "fulfilled") {
      ordersFulfilled++;
    } else if (order.financial_status !== "refunded") {
      ordersUnfulfilled++;
    }

    console.log(`[shopify-analytics] Order ${order.name}: subtotal=${subtotal}, discounts=${totalDiscount}, shipping=${shipping}, tax=${tax}, refunds=${totalRefund}`);
  }

  // Net sales = Gross - Discounts - Returns (product revenue only)
  const netSales = grossSales - discounts - returns;

  // Total sales = Net Sales + Shipping + Taxes (what customer actually pays)
  const totalSales = netSales + shippingCharges + taxes;

  const orderCount = orders.filter(o => o.financial_status !== "refunded").length;
  // AOV based on total sales (what customers pay)
  const avgOrderValue = orderCount > 0 ? totalSales / orderCount : 0;

  // Count new vs returning customers
  const newCustomers = customers.filter(c => c.orders_count === 1).length;
  const returningCustomers = customers.filter(c => c.orders_count > 1).length;
  const totalCustomers = newCustomers + returningCustomers;
  const returningCustomerRate = totalCustomers > 0 ? (returningCustomers / totalCustomers) * 100 : 0;

  console.log(`[shopify-analytics] Summary: grossSales=${grossSales}, netSales=${netSales}, totalSales=${totalSales}, orders=${orderCount}, fulfilled=${ordersFulfilled}`);

  return {
    grossSales: Math.round(grossSales * 100) / 100,
    discounts: Math.round(discounts * 100) / 100,
    returns: Math.round(returns * 100) / 100,
    netSales: Math.round(netSales * 100) / 100,
    shippingCharges: Math.round(shippingCharges * 100) / 100,
    returnFees: 0, // Shopify doesn't expose this separately
    taxes: Math.round(taxes * 100) / 100,
    totalSales: Math.round(totalSales * 100) / 100,
    orders: orderCount,
    ordersFulfilled,
    ordersUnfulfilled,
    averageOrderValue: Math.round(avgOrderValue * 100) / 100,
    newCustomers,
    returningCustomers,
    returningCustomerRate: Math.round(returningCustomerRate * 100) / 100,
  };
}

// Calculate timeseries from orders
function calculateTimeseries(orders: any[], startDate: string, endDate: string, metric: string): TimeseriesPoint[] {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const dailyData: Record<string, number> = {};
  const dailyCounts: Record<string, number> = {};

  // Initialize all days
  const current = new Date(start);
  while (current <= end) {
    const dateStr = current.toISOString().split("T")[0];
    dailyData[dateStr] = 0;
    dailyCounts[dateStr] = 0;
    current.setDate(current.getDate() + 1);
  }

  // Aggregate order data by day
  for (const order of orders) {
    if (order.financial_status === "refunded") continue;

    const orderDate = new Date(order.created_at).toISOString().split("T")[0];
    if (dailyData[orderDate] !== undefined) {
      const subtotal = parseFloat(order.subtotal_price || "0");
      const shipping = parseFloat(order.total_shipping_price_set?.shop_money?.amount || "0");
      const tax = parseFloat(order.total_tax || "0");
      const totalPrice = subtotal + shipping + tax;

      switch (metric) {
        case "total_sales":
          dailyData[orderDate] += totalPrice;
          break;
        case "net_sales":
          dailyData[orderDate] += subtotal;
          break;
        case "orders":
          dailyData[orderDate] += 1;
          break;
        case "average_order_value":
          dailyData[orderDate] += totalPrice;
          dailyCounts[orderDate] += 1;
          break;
      }
    }
  }

  // For AOV, calculate the average
  if (metric === "average_order_value") {
    for (const date of Object.keys(dailyData)) {
      if (dailyCounts[date] > 0) {
        dailyData[date] = dailyData[date] / dailyCounts[date];
      }
    }
  }

  // Convert to array
  const points: TimeseriesPoint[] = [];
  for (const [date, value] of Object.entries(dailyData).sort()) {
    points.push({ date, value: Math.round(value * 100) / 100 });
  }

  return points;
}

// Calculate top products from orders
function calculateTopProducts(orders: any[], products: any[]): { products: TopProduct[]; total: number } {
  const productSales: Record<string, { unitsSold: number; revenue: number; refunds: number }> = {};

  // Aggregate sales data
  for (const order of orders) {
    for (const lineItem of order.line_items || []) {
      const productId = String(lineItem.product_id);
      if (!productSales[productId]) {
        productSales[productId] = { unitsSold: 0, revenue: 0, refunds: 0 };
      }
      productSales[productId].unitsSold += lineItem.quantity;
      productSales[productId].revenue += parseFloat(lineItem.price || "0") * lineItem.quantity;
    }

    // Track refunds
    for (const refund of order.refunds || []) {
      for (const lineItem of refund.refund_line_items || []) {
        const productId = String(lineItem.line_item?.product_id);
        if (productSales[productId]) {
          productSales[productId].refunds += lineItem.quantity;
        }
      }
    }
  }

  // Create product map for details
  const productMap: Record<string, any> = {};
  for (const product of products) {
    productMap[String(product.id)] = product;
  }

  // Build top products list
  const topProducts: TopProduct[] = Object.entries(productSales)
    .map(([id, stats]) => {
      const product = productMap[id];
      return {
        id,
        title: product?.title || `Product ${id}`,
        imageUrl: product?.image?.src || null,
        unitsSold: stats.unitsSold,
        revenue: Math.round(stats.revenue * 100) / 100,
        refunds: stats.refunds,
      };
    })
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);

  return { products: topProducts, total: Object.keys(productSales).length };
}

// Determine order source and channel (organic vs paid) from Shopify order data
function classifyOrderSource(order: any): { source: string; channel: "organic" | "paid" | "unknown" } {
  const landingSite = (order.landing_site || "").toLowerCase();
  const referringSite = (order.referring_site || "").toLowerCase();
  const sourceName = (order.source_name || "").toLowerCase();

  // Parse UTM parameters from landing_site
  let utmSource = "";
  let utmMedium = "";
  let utmCampaign = "";
  try {
    if (landingSite && (landingSite.includes("utm_") || landingSite.includes("?") || landingSite.includes("&"))) {
      const queryStr = landingSite.includes("?") ? landingSite.split("?")[1] : landingSite;
      const params = new URLSearchParams(queryStr);
      utmSource = (params.get("utm_source") || "").toLowerCase();
      utmMedium = (params.get("utm_medium") || "").toLowerCase();
      utmCampaign = params.get("utm_campaign") || "";
    }
  } catch (e) {
    // Ignore URL parse errors
  }

  // Check if it's a paid ad
  const isPaidMedium = ["cpc", "paid", "ppc", "paid_social", "paidsocial", "ad", "ads"].includes(utmMedium);
  const isPaidSource = utmSource.includes("fb") || utmSource.includes("facebook") || utmSource.includes("ig") || utmSource.includes("instagram") || utmSource.includes("meta") || utmSource.includes("google") || utmSource.includes("tiktok");
  const hasCampaign = utmCampaign.length > 0;
  const isPaid = isPaidMedium || (isPaidSource && hasCampaign);

  // Determine source name
  if (utmSource) {
    // Has UTM tracking
    if (utmSource.includes("facebook") || utmSource.includes("fb") || utmSource.includes("meta")) {
      return { source: isPaid ? "Meta Ads (FB)" : "Facebook (Organic)", channel: isPaid ? "paid" : "organic" };
    }
    if (utmSource.includes("instagram") || utmSource.includes("ig")) {
      return { source: isPaid ? "Meta Ads (IG)" : "Instagram (Organic)", channel: isPaid ? "paid" : "organic" };
    }
    if (utmSource.includes("google")) {
      return { source: isPaid ? "Google Ads" : "Google (Organic)", channel: isPaid ? "paid" : "organic" };
    }
    if (utmSource.includes("tiktok")) {
      return { source: isPaid ? "TikTok Ads" : "TikTok (Organic)", channel: isPaid ? "paid" : "organic" };
    }
    if (utmSource.includes("pinterest")) {
      return { source: isPaid ? "Pinterest Ads" : "Pinterest (Organic)", channel: isPaid ? "paid" : "organic" };
    }
    return { source: isPaid ? `${utmSource} (Paid)` : `${utmSource} (Organic)`, channel: isPaid ? "paid" : "organic" };
  }

  // No UTM — check referring_site
  if (referringSite) {
    if (referringSite.includes("facebook.com") || referringSite.includes("fb.com") || referringSite.includes("l.facebook.com")) {
      return { source: "Facebook (Organic)", channel: "organic" };
    }
    if (referringSite.includes("instagram.com") || referringSite.includes("l.instagram.com")) {
      return { source: "Instagram (Organic)", channel: "organic" };
    }
    if (referringSite.includes("google.com") || referringSite.includes("google.")) {
      return { source: "Google (Organic)", channel: "organic" };
    }
    if (referringSite.includes("tiktok.com")) {
      return { source: "TikTok (Organic)", channel: "organic" };
    }
    if (referringSite.includes("pinterest.com")) {
      return { source: "Pinterest (Organic)", channel: "organic" };
    }
    return { source: `Referral (${referringSite.replace(/https?:\/\//, "").split("/")[0]})`, channel: "organic" };
  }

  // No referring site — check source_name
  if (sourceName === "web" || sourceName === "shopify_draft_order") {
    return { source: "Direct / Online Store", channel: "organic" };
  }
  if (sourceName === "pos") {
    return { source: "Point of Sale", channel: "organic" };
  }
  if (sourceName === "580111") {
    return { source: "TikTok Shop", channel: "paid" };
  }
  if (sourceName === "iphone" || sourceName === "android") {
    return { source: "Mobile App", channel: "organic" };
  }

  return { source: "Direct / Unknown", channel: "unknown" };
}

// Transform Shopify orders to our OrderItem format
function transformOrders(orders: any[]): OrderItem[] {
  return orders.map((order) => {
    const { source, channel } = classifyOrderSource(order);
    return {
      id: String(order.id),
      orderNumber: order.name || `#${order.order_number}`,
      createdAt: order.created_at,
      customerName: order.customer
        ? `${order.customer.first_name || ""} ${order.customer.last_name || ""}`.trim() || "Guest"
        : "Guest",
      customerEmail: order.customer?.email || order.email || "",
      financialStatus: order.financial_status || "pending",
      fulfillmentStatus: order.fulfillment_status || "unfulfilled",
      totalPrice: parseFloat(order.total_price || "0"),
      subtotalPrice: parseFloat(order.subtotal_price || "0"),
      totalShipping: parseFloat(order.total_shipping_price_set?.shop_money?.amount || "0"),
      totalTax: parseFloat(order.total_tax || "0"),
      totalDiscounts: parseFloat(order.total_discounts || "0"),
      itemCount: (order.line_items || []).reduce((sum: number, item: any) => sum + item.quantity, 0),
      source,
      channel,
      referringSite: order.referring_site || null,
      lineItems: (order.line_items || []).map((item: any) => ({
        title: item.title,
        quantity: item.quantity,
        price: parseFloat(item.price || "0"),
      })),
      shippingAddress: order.shipping_address ? {
        city: order.shipping_address.city || "",
        province: order.shipping_address.province || "",
        country: order.shipping_address.country || "",
      } : undefined,
    };
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const pathParts = url.pathname.split("/").filter(Boolean);

    const body = req.method === "POST" ? await req.json() : {};
    const endpoint = body.endpoint || pathParts[pathParts.length - 1];
    const clientId = body.clientId;

    console.log(`[shopify-analytics] Endpoint: ${endpoint}, Client: ${clientId}`);

    if (!clientId) {
      return new Response(
        JSON.stringify({ success: false, error: "clientId is required" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check for OAuth connection
    const { data: connection, error: connError } = await supabase
      .from("shopify_oauth_connections")
      .select("shop_domain, access_token, is_active")
      .eq("client_id", clientId)
      .eq("is_active", true)
      .maybeSingle();

    if (endpoint === "status") {
      const isConnected = !!connection && !!connection.access_token;
      return new Response(
        JSON.stringify({
          success: true,
          data: {
            connected: isConnected,
            storeName: isConnected ? connection.shop_domain : null,
            lastSyncedAt: isConnected ? new Date().toISOString() : null,
            syncStatus: isConnected ? "synced" : "not_connected",
          },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!connection || !connection.access_token) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Shopify not connected. Please connect via OAuth.",
          connected: false,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    const { shop_domain: shopDomain, access_token: accessToken } = connection;

    switch (endpoint) {
      case "sync": {
        const start = body.start || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
        const end = body.end || new Date().toISOString().split("T")[0];

        // Calculate previous period for comparison
        const startDate = new Date(start);
        const endDate = new Date(end);
        const periodLength = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        const prevStart = new Date(startDate);
        prevStart.setDate(prevStart.getDate() - periodLength);
        const prevEnd = new Date(startDate);
        prevEnd.setDate(prevEnd.getDate() - 1);

        const prevStartStr = prevStart.toISOString().split("T")[0];
        const prevEndStr = prevEnd.toISOString().split("T")[0];

        // Fetch ALL required data once
        const [orders, customers, prevOrders, prevCustomers, products] = await Promise.all([
          fetchOrders(shopDomain, accessToken, start, end),
          fetchCustomers(shopDomain, accessToken, start, end),
          fetchOrders(shopDomain, accessToken, prevStartStr, prevEndStr),
          fetchCustomers(shopDomain, accessToken, prevStartStr, prevEndStr),
          fetchProducts(shopDomain, accessToken, 100),
        ]);

        const summary = calculateSummary(orders, customers);
        const prevSummary = calculateSummary(prevOrders, prevCustomers);
        const fullSummary = {
          ...summary,
          prevGrossSales: prevSummary.grossSales,
          prevNetSales: prevSummary.netSales,
          prevTotalSales: prevSummary.totalSales,
          prevOrders: prevSummary.orders,
          prevOrdersFulfilled: prevSummary.ordersFulfilled,
          prevAverageOrderValue: prevSummary.averageOrderValue,
          prevReturningCustomerRate: prevSummary.returningCustomerRate,
        };

        const totalSalesTimeseries = calculateTimeseries(orders, start, end, "total_sales");
        const aovTimeseries = calculateTimeseries(orders, start, end, "average_order_value");
        const ordersTimeseries = calculateTimeseries(orders, start, end, "orders");

        const { products: topProducts } = calculateTopProducts(orders, products);

        const sourceData: Record<string, { orders: number; revenue: number; channel: string }> = {};
        let totalOrganic = 0; let totalPaid = 0; let revenueOrganic = 0; let revenuePaid = 0;
        for (const order of orders) {
          if (order.financial_status === "refunded") continue;
          const { source, channel } = classifyOrderSource(order);
          const revenue = parseFloat(order.total_price || "0");
          if (!sourceData[source]) sourceData[source] = { orders: 0, revenue: 0, channel };
          sourceData[source].orders += 1;
          sourceData[source].revenue += revenue;
          if (channel === "paid") { totalPaid++; revenuePaid += revenue; } else { totalOrganic++; revenueOrganic += revenue; }
        }
        const sources = Object.entries(sourceData).map(([name, stats]) => ({ name, orders: stats.orders, revenue: Math.round(stats.revenue * 100) / 100, channel: stats.channel })).sort((a, b) => b.revenue - a.revenue);

        const recentOrders = transformOrders(orders).slice(0, 20);

        const responsePayload = {
          summary: fullSummary,
          timeseries: { totalSales: totalSalesTimeseries, aov: aovTimeseries, orders: ordersTimeseries },
          topProducts: topProducts.slice(0, 10),
          sources,
          channelBreakdown: { organic: { orders: totalOrganic, revenue: Math.round(revenueOrganic * 100) / 100 }, paid: { orders: totalPaid, revenue: Math.round(revenuePaid * 100) / 100 } },
          recentOrders,
          period: { start, end }
        };

        const { error: upsertError } = await supabase
          .from('platform_analytics_cache')
          .upsert({
            client_id: clientId,
            platform: 'shopify',
            module: 'analytics',
            data: responsePayload,
            collected_at: new Date().toISOString()
          }, { onConflict: 'client_id,platform,module' });
          
        if (upsertError) console.error("Failed to cache shopify data:", upsertError);

        return new Response(
          JSON.stringify({ success: true, data: responsePayload }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "summary": {
        const start = body.start || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
        const end = body.end || new Date().toISOString().split("T")[0];

        // Calculate previous period for comparison
        const startDate = new Date(start);
        const endDate = new Date(end);
        const periodLength = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        const prevStart = new Date(startDate);
        prevStart.setDate(prevStart.getDate() - periodLength);
        const prevEnd = new Date(startDate);
        prevEnd.setDate(prevEnd.getDate() - 1);

        const prevStartStr = prevStart.toISOString().split("T")[0];
        const prevEndStr = prevEnd.toISOString().split("T")[0];

        // Fetch current and previous period data
        const [orders, customers, prevOrders, prevCustomers] = await Promise.all([
          fetchOrders(shopDomain, accessToken, start, end),
          fetchCustomers(shopDomain, accessToken, start, end),
          fetchOrders(shopDomain, accessToken, prevStartStr, prevEndStr),
          fetchCustomers(shopDomain, accessToken, prevStartStr, prevEndStr),
        ]);

        const summary = calculateSummary(orders, customers);
        const prevSummary = calculateSummary(prevOrders, prevCustomers);

        return new Response(
          JSON.stringify({
            success: true,
            data: {
              ...summary,
              prevGrossSales: prevSummary.grossSales,
              prevNetSales: prevSummary.netSales,
              prevTotalSales: prevSummary.totalSales,
              prevOrders: prevSummary.orders,
              prevOrdersFulfilled: prevSummary.ordersFulfilled,
              prevAverageOrderValue: prevSummary.averageOrderValue,
              prevReturningCustomerRate: prevSummary.returningCustomerRate,
            },
            period: { start, end },
            lastSyncedAt: new Date().toISOString(),
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "timeseries": {
        const metric = body.metric || "total_sales";
        const start = body.start || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
        const end = body.end || new Date().toISOString().split("T")[0];

        const orders = await fetchOrders(shopDomain, accessToken, start, end);
        const timeseries = calculateTimeseries(orders, start, end, metric);

        return new Response(
          JSON.stringify({
            success: true,
            data: timeseries,
            metric,
            period: { start, end },
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "top-products": {
        const page = parseInt(body.page) || 1;
        const pageSize = parseInt(body.pageSize) || 10;
        const start = body.start || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
        const end = body.end || new Date().toISOString().split("T")[0];

        const [orders, products] = await Promise.all([
          fetchOrders(shopDomain, accessToken, start, end),
          fetchProducts(shopDomain, accessToken, 100),
        ]);

        const { products: topProducts, total } = calculateTopProducts(orders, products);

        return new Response(
          JSON.stringify({
            success: true,
            data: topProducts.slice((page - 1) * pageSize, page * pageSize),
            pagination: {
              page,
              pageSize,
              total,
              totalPages: Math.ceil(total / pageSize),
            },
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "order-sources": {
        const start = body.start || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
        const end = body.end || new Date().toISOString().split("T")[0];

        const orders = await fetchOrders(shopDomain, accessToken, start, end);

        // Aggregate orders by source using improved classification
        const sourceData: Record<string, { orders: number; revenue: number; channel: string }> = {};
        let totalOrganic = 0;
        let totalPaid = 0;
        let revenueOrganic = 0;
        let revenuePaid = 0;

        for (const order of orders) {
          if (order.financial_status === "refunded") continue;

          const { source, channel } = classifyOrderSource(order);
          const revenue = parseFloat(order.total_price || "0");

          if (!sourceData[source]) {
            sourceData[source] = { orders: 0, revenue: 0, channel };
          }
          sourceData[source].orders += 1;
          sourceData[source].revenue += revenue;

          if (channel === "paid") {
            totalPaid++;
            revenuePaid += revenue;
          } else {
            totalOrganic++;
            revenueOrganic += revenue;
          }
        }

        // Convert to array and sort by revenue
        const sources = Object.entries(sourceData)
          .map(([name, stats]) => ({
            name,
            orders: stats.orders,
            revenue: Math.round(stats.revenue * 100) / 100,
            channel: stats.channel,
          }))
          .sort((a, b) => b.revenue - a.revenue);

        return new Response(
          JSON.stringify({
            success: true,
            data: sources,
            channelBreakdown: {
              organic: { orders: totalOrganic, revenue: Math.round(revenueOrganic * 100) / 100 },
              paid: { orders: totalPaid, revenue: Math.round(revenuePaid * 100) / 100 },
            },
            period: { start, end },
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Orders list endpoint (similar to Shopify Admin)
      case "orders": {
        const start = body.start || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
        const end = body.end || new Date().toISOString().split("T")[0];
        const pageInfo = body.pageInfo;
        const limit = parseInt(body.limit) || 20;

        const { orders, nextPageInfo, prevPageInfo } = await fetchOrdersPage(
          shopDomain,
          accessToken,
          start,
          end,
          pageInfo,
          limit
        );

        const transformedOrders = transformOrders(orders);

        return new Response(
          JSON.stringify({
            success: true,
            data: transformedOrders,
            pagination: {
              nextPageInfo,
              prevPageInfo,
              hasNextPage: !!nextPageInfo,
              hasPrevPage: !!prevPageInfo,
            },
            period: { start, end },
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ success: false, error: `Unknown endpoint: ${endpoint}` }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
        );
    }
  } catch (error: unknown) {
    console.error("[shopify-analytics] Error:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
