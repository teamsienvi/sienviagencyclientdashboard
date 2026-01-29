import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
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
  // Comparison values (previous period)
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

// Generate mock data for development/demo purposes
function generateMockSummary(startDate: string, endDate: string, compare: boolean): ShopifySummary {
  // Generate realistic-looking mock data based on date range
  const start = new Date(startDate);
  const end = new Date(endDate);
  const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  
  const baseOrders = days * 8 + Math.floor(Math.random() * days * 5);
  const avgOrderValue = 45 + Math.random() * 30;
  const grossSales = baseOrders * avgOrderValue;
  const discountAmount = grossSales * (0.05 + Math.random() * 0.1);
  const refunds = grossSales * (0.02 + Math.random() * 0.03);
  const netSales = grossSales - discountAmount - refunds;
  const totalCustomers = Math.floor(baseOrders * 0.85);
  const returningRate = 0.25 + Math.random() * 0.15;
  const returningCustomers = Math.floor(totalCustomers * returningRate);
  const newCustomers = totalCustomers - returningCustomers;

  const summary: ShopifySummary = {
    netSales: Number(netSales.toFixed(2)),
    grossSales: Number(grossSales.toFixed(2)),
    orders: baseOrders,
    averageOrderValue: Number(avgOrderValue.toFixed(2)),
    refunds: Number(refunds.toFixed(2)),
    discountAmount: Number(discountAmount.toFixed(2)),
    newCustomers,
    returningCustomers,
  };

  if (compare) {
    // Generate comparison data (slightly different from current)
    const prevMultiplier = 0.85 + Math.random() * 0.3; // 85% to 115% of current
    summary.prevNetSales = Number((netSales * prevMultiplier).toFixed(2));
    summary.prevGrossSales = Number((grossSales * prevMultiplier).toFixed(2));
    summary.prevOrders = Math.floor(baseOrders * prevMultiplier);
    summary.prevAverageOrderValue = Number((avgOrderValue * (0.9 + Math.random() * 0.2)).toFixed(2));
    summary.prevRefunds = Number((refunds * prevMultiplier).toFixed(2));
    summary.prevDiscountAmount = Number((discountAmount * prevMultiplier).toFixed(2));
    summary.prevNewCustomers = Math.floor(newCustomers * prevMultiplier);
    summary.prevReturningCustomers = Math.floor(returningCustomers * prevMultiplier);
  }

  return summary;
}

function generateMockTimeseries(startDate: string, endDate: string, metric: string): TimeseriesPoint[] {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const points: TimeseriesPoint[] = [];
  
  const current = new Date(start);
  while (current <= end) {
    const dayOfWeek = current.getDay();
    // Higher values on weekends for e-commerce
    const weekendMultiplier = dayOfWeek === 0 || dayOfWeek === 6 ? 1.3 : 1;
    
    let baseValue: number;
    if (metric === "net_sales") {
      baseValue = 250 + Math.random() * 400;
    } else if (metric === "orders") {
      baseValue = 5 + Math.random() * 12;
    } else {
      baseValue = 100 + Math.random() * 200;
    }
    
    points.push({
      date: current.toISOString().split("T")[0],
      value: Number((baseValue * weekendMultiplier).toFixed(2)),
    });
    
    current.setDate(current.getDate() + 1);
  }
  
  return points;
}

function generateMockTopProducts(page: number, pageSize: number, sort: string): { products: TopProduct[]; total: number } {
  const allProducts = [
    { id: "prod_1", title: "Snarky Pet Bandana - Sass Level Expert", imageUrl: null, unitsSold: 156, revenue: 3899.44, refunds: 78.00 },
    { id: "prod_2", title: "Attitude Adjustment Cat Collar", imageUrl: null, unitsSold: 132, revenue: 2639.68, refunds: 52.79 },
    { id: "prod_3", title: "Professional Treat Beggar Dog Tag", imageUrl: null, unitsSold: 98, revenue: 1960.02, refunds: 39.20 },
    { id: "prod_4", title: "Drama Queen Leash - Limited Edition", imageUrl: null, unitsSold: 87, revenue: 2609.13, refunds: 0 },
    { id: "prod_5", title: "Sarcasm Loading... Pet Bowl", imageUrl: null, unitsSold: 76, revenue: 1139.24, refunds: 22.78 },
    { id: "prod_6", title: "Not Your Average Pet Parent Tote", imageUrl: null, unitsSold: 65, revenue: 1624.35, refunds: 32.49 },
    { id: "prod_7", title: "Fluffy Overlord Throne Bed", imageUrl: null, unitsSold: 54, revenue: 2699.46, refunds: 53.99 },
    { id: "prod_8", title: "Zero Barks Given Sweater", imageUrl: null, unitsSold: 48, revenue: 1439.52, refunds: 28.79 },
    { id: "prod_9", title: "Certified Good Boy Certificate Frame", imageUrl: null, unitsSold: 42, revenue: 839.58, refunds: 0 },
    { id: "prod_10", title: "Chaos Coordinator Pet Parent Mug", imageUrl: null, unitsSold: 38, revenue: 569.62, refunds: 11.39 },
    { id: "prod_11", title: "Professional Zoomies Champion Medal", imageUrl: null, unitsSold: 35, revenue: 524.65, refunds: 0 },
    { id: "prod_12", title: "Nap Expert Cat Blanket", imageUrl: null, unitsSold: 31, revenue: 774.69, refunds: 15.49 },
  ];

  // Sort products
  const sortedProducts = [...allProducts];
  if (sort === "revenue_desc") {
    sortedProducts.sort((a, b) => b.revenue - a.revenue);
  } else if (sort === "revenue_asc") {
    sortedProducts.sort((a, b) => a.revenue - b.revenue);
  } else if (sort === "units_desc") {
    sortedProducts.sort((a, b) => b.unitsSold - a.unitsSold);
  } else if (sort === "units_asc") {
    sortedProducts.sort((a, b) => a.unitsSold - b.unitsSold);
  }

  const startIdx = (page - 1) * pageSize;
  const endIdx = startIdx + pageSize;
  
  return {
    products: sortedProducts.slice(startIdx, endIdx),
    total: sortedProducts.length,
  };
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const pathParts = url.pathname.split("/").filter(Boolean);
    
    // Parse the endpoint from URL or body
    const body = req.method === "POST" ? await req.json() : {};
    const endpoint = body.endpoint || pathParts[pathParts.length - 1];
    const clientId = body.clientId;

    console.log(`[shopify-analytics] Endpoint: ${endpoint}, Client: ${clientId}`);

    // Validate clientId
    if (!clientId) {
      return new Response(
        JSON.stringify({ success: false, error: "clientId is required" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // Check if client has Shopify connected (stub - always true for Snarky Pets)
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: client } = await supabase
      .from("clients")
      .select("id, name")
      .eq("id", clientId)
      .maybeSingle();

    if (!client) {
      return new Response(
        JSON.stringify({ success: false, error: "Client not found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 404 }
      );
    }

    // For demo purposes, only enable Shopify for "Snarky Pets"
    const isShopifyConnected = client.name === "Snarky Pets";

    if (endpoint === "status") {
      return new Response(
        JSON.stringify({
          success: true,
          data: {
            connected: isShopifyConnected,
            storeName: isShopifyConnected ? "Snarky Pets Store" : null,
            lastSyncedAt: isShopifyConnected ? new Date().toISOString() : null,
            syncStatus: "synced",
          },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!isShopifyConnected) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Shopify not connected for this client",
          connected: false,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // Handle different endpoints
    switch (endpoint) {
      case "summary": {
        const start = body.start || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
        const end = body.end || new Date().toISOString().split("T")[0];
        const compare = body.compare === true || body.compare === "true";

        const summary = generateMockSummary(start, end, compare);
        
        return new Response(
          JSON.stringify({
            success: true,
            data: summary,
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

        const timeseries = generateMockTimeseries(start, end, metric);
        
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
        const sort = body.sort || "revenue_desc";

        const { products, total } = generateMockTopProducts(page, pageSize, sort);
        
        return new Response(
          JSON.stringify({
            success: true,
            data: products,
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
