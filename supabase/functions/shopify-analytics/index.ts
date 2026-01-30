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

// Return empty/zero data - awaiting real Shopify integration
function generateEmptySummary(): ShopifySummary {
  return {
    netSales: 0,
    grossSales: 0,
    orders: 0,
    averageOrderValue: 0,
    refunds: 0,
    discountAmount: 0,
    newCustomers: 0,
    returningCustomers: 0,
  };
}

// Return empty timeseries - awaiting real Shopify integration
function generateEmptyTimeseries(startDate: string, endDate: string): TimeseriesPoint[] {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const points: TimeseriesPoint[] = [];
  
  const current = new Date(start);
  while (current <= end) {
    points.push({
      date: current.toISOString().split("T")[0],
      value: 0,
    });
    current.setDate(current.getDate() + 1);
  }
  
  return points;
}

// Return empty products - awaiting real Shopify integration
function generateEmptyTopProducts(): { products: TopProduct[]; total: number } {
  return {
    products: [],
    total: 0,
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

    // Enable Shopify for Snarky Pets and OxiSure Tech
    const shopifyEnabledClients = ["Snarky Pets", "OxiSure Tech"];
    const isShopifyConnected = shopifyEnabledClients.includes(client.name);

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

        const summary = generateEmptySummary();
        
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

        const timeseries = generateEmptyTimeseries(start, end);
        
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

        const { products, total } = generateEmptyTopProducts();
        
        return new Response(
          JSON.stringify({
            success: true,
            data: products,
            pagination: {
              page,
              pageSize,
              total,
              totalPages: 0,
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
