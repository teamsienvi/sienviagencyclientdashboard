import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ShopifySummary {
  netSales: number;
  grossSales: number;
  orders: number;
  averageOrderValue: number;
  refunds: number;
  discountAmount: number;
  newCustomers: number;
  returningCustomers: number;
  prevNetSales?: number;
  prevGrossSales?: number;
  prevOrders?: number;
  prevAverageOrderValue?: number;
  prevRefunds?: number;
  prevDiscountAmount?: number;
  prevNewCustomers?: number;
  prevReturningCustomers?: number;
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

// Make Shopify Admin API request using OAuth token
async function shopifyRequest(shopDomain: string, accessToken: string, endpoint: string) {
  const url = endpoint.startsWith("http") 
    ? endpoint 
    : `https://${shopDomain}/admin/api/2024-01/${endpoint}`;
  console.log(`[shopify-analytics] Fetching: ${url}`);
  
  const response = await fetch(url, {
    headers: {
      "X-Shopify-Access-Token": accessToken,
      "Content-Type": "application/json",
    },
  });
  
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

// Calculate summary from orders
// Uses total_price to match Shopify admin view (includes shipping)
function calculateSummary(orders: any[], customers: any[]): ShopifySummary {
  let grossSales = 0;
  let netSales = 0;
  let refunds = 0;
  let discountAmount = 0;
  
  console.log(`[shopify-analytics] Processing ${orders.length} orders for summary`);
  
  for (const order of orders) {
    // Use total_price to match Shopify admin display (includes shipping)
    const totalPrice = parseFloat(order.total_price || "0");
    const subtotal = parseFloat(order.subtotal_price || "0");
    const totalDiscount = parseFloat(order.total_discounts || "0");
    const totalRefund = (order.refunds || []).reduce((sum: number, r: any) => {
      return sum + (r.transactions || []).reduce((tSum: number, t: any) => tSum + parseFloat(t.amount || "0"), 0);
    }, 0);
    
    console.log(`[shopify-analytics] Order ${order.name}: total_price=${totalPrice}, subtotal=${subtotal}, status=${order.financial_status}`);
    
    // Gross sales = total before any refunds
    grossSales += totalPrice + totalRefund;
    // Net sales = total after refunds
    netSales += totalPrice - totalRefund;
    refunds += totalRefund;
    discountAmount += totalDiscount;
  }
  
  const orderCount = orders.filter(o => o.financial_status !== "refunded").length;
  const avgOrderValue = orderCount > 0 ? netSales / orderCount : 0;
  
  // Count new vs returning customers
  const newCustomers = customers.filter(c => c.orders_count === 1).length;
  const returningCustomers = customers.filter(c => c.orders_count > 1).length;
  
  console.log(`[shopify-analytics] Summary: netSales=${netSales}, grossSales=${grossSales}, orders=${orderCount}`);
  
  return {
    netSales: Math.round(netSales * 100) / 100,
    grossSales: Math.round(grossSales * 100) / 100,
    orders: orderCount,
    averageOrderValue: Math.round(avgOrderValue * 100) / 100,
    refunds: Math.round(refunds * 100) / 100,
    discountAmount: Math.round(discountAmount * 100) / 100,
    newCustomers,
    returningCustomers,
  };
}

// Calculate timeseries from orders
function calculateTimeseries(orders: any[], startDate: string, endDate: string, metric: string): TimeseriesPoint[] {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const dailyData: Record<string, number> = {};
  
  // Initialize all days
  const current = new Date(start);
  while (current <= end) {
    const dateStr = current.toISOString().split("T")[0];
    dailyData[dateStr] = 0;
    current.setDate(current.getDate() + 1);
  }
  
  // Aggregate order data by day
  for (const order of orders) {
    if (order.financial_status === "refunded") continue;
    
    const orderDate = new Date(order.created_at).toISOString().split("T")[0];
    if (dailyData[orderDate] !== undefined) {
      switch (metric) {
        case "net_sales":
          // Use total_price to match Shopify admin
          dailyData[orderDate] += parseFloat(order.total_price || "0");
          break;
        case "orders":
          dailyData[orderDate] += 1;
          break;
        case "average_order_value":
          dailyData[orderDate] += parseFloat(order.total_price || "0");
          break;
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

// Transform Shopify orders to our OrderItem format
function transformOrders(orders: any[]): OrderItem[] {
  return orders.map((order) => ({
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
  }));
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
              prevNetSales: prevSummary.netSales,
              prevGrossSales: prevSummary.grossSales,
              prevOrders: prevSummary.orders,
              prevAverageOrderValue: prevSummary.averageOrderValue,
              prevRefunds: prevSummary.refunds,
              prevDiscountAmount: prevSummary.discountAmount,
              prevNewCustomers: prevSummary.newCustomers,
              prevReturningCustomers: prevSummary.returningCustomers,
            },
            period: { start, end },
            lastSyncedAt: new Date().toISOString(),
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "timeseries": {
        const metric = body.metric || "net_sales";
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
        
        // Aggregate orders by source
        const sourceData: Record<string, { orders: number; revenue: number }> = {};
        
        for (const order of orders) {
          if (order.financial_status === "refunded") continue;
          
          // Get order source from source_name, referring_site, or app IDs
          let sourceName = order.source_name || "Unknown";
          
          // Map common source names to friendlier labels
          if (sourceName === "web" || sourceName === "shopify_draft_order") {
            sourceName = "Online Store";
          } else if (sourceName === "pos") {
            sourceName = "Point of Sale";
          } else if (sourceName === "580111") {
            // TikTok Shop app ID
            sourceName = "TikTok Shop";
          } else if (order.referring_site?.includes("tiktok")) {
            sourceName = "TikTok";
          } else if (order.referring_site?.includes("facebook") || order.referring_site?.includes("instagram")) {
            sourceName = "Meta (FB/IG)";
          } else if (order.referring_site?.includes("google")) {
            sourceName = "Google";
          } else if (order.referring_site?.includes("pinterest")) {
            sourceName = "Pinterest";
          } else if (sourceName === "iphone" || sourceName === "android") {
            sourceName = "Mobile App";
          }
          
          if (!sourceData[sourceName]) {
            sourceData[sourceName] = { orders: 0, revenue: 0 };
          }
          
          sourceData[sourceName].orders += 1;
          sourceData[sourceName].revenue += parseFloat(order.total_price || "0");
        }
        
        // Convert to array and sort by revenue
        const sources: OrderSource[] = Object.entries(sourceData)
          .map(([name, stats]) => ({
            name,
            orders: stats.orders,
            revenue: Math.round(stats.revenue * 100) / 100,
          }))
          .sort((a, b) => b.revenue - a.revenue);
        
        return new Response(
          JSON.stringify({
            success: true,
            data: sources,
            period: { start, end },
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // NEW: Orders list endpoint (similar to Shopify Admin)
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
