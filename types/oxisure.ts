/**
 * TypeScript interfaces for the OxiSure Retention App database schema.
 * These map to the tables in the OxiSure Supabase project
 * (https://hoqzujbwyphxzikuknsk.supabase.co).
 */

/** Shape of a single item inside the orders.items JSONB array. */
export interface OxiOrderItem {
  product_id: string;
  product_name: string;
  variant_id: string;
  quantity: number;
}

/** Row shape from the `orders` table. */
export interface OxiOrder {
  id: string;
  user_id: string;
  quantity: number;
  discount_percent: number | null;
  discount_code: string | null;
  subtotal: number | null;
  total_amount: number;
  status: "pending" | "completed" | "abandoned";
  cart_id: string | null;
  checkout_url: string | null;
  shopify_order_id: string | null;
  financial_status: string | null;
  fulfillment_status: string | null;
  tracking_number: string | null;
  tracking_url: string | null;
  tracking_company: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
  estimated_delivery: string | null;
  items: OxiOrderItem[];
  purchase_source: "retention_app" | "amazon" | "shopify";
  created_at: string;
  updated_at: string;
}

/** Row shape from the `profiles` table. */
export interface OxiProfile {
  id: string;
  full_name: string | null;
  email: string | null;
  user_type: "individual" | "caregiver" | null;
  phone: string | null;
  amazon_connected: boolean;
  shopify_connected: boolean;
  created_at: string;
}

/** Row shape from the `tracked_products` table. */
export interface OxiTrackedProduct {
  id: string;
  user_id: string;
  product_id: string;
  quantity: number;
  purchase_date: string;
  next_replacement_date: string;
  status: "upcoming" | "due_soon" | "overdue" | "completed";
  purchase_source: string;
  avg_daily_use_hours: number | null;
}

/** Row shape from the `products` table. */
export interface OxiProduct {
  id: string;
  name: string;
  price: number;
  replacement_interval_days: number;
  sku: string;
}

/** Revenue/count breakdown by purchase source. */
export interface OxiSourceBreakdown {
  source: "retention_app" | "amazon" | "shopify";
  count: number;
  revenue: number;
}

/** Fulfillment status count. */
export interface OxiFulfillmentBreakdown {
  status: string;
  count: number;
}

/** Daily time-series data point for orders. */
export interface OxiDailyOrderPoint {
  date: string;
  count: number;
  revenue: number;
}

/** A recent order with joined customer profile data. */
export interface OxiRecentOrder {
  id: string;
  customerName: string;
  customerEmail: string;
  purchaseSource: string;
  items: { product_name: string; quantity: number }[];
  totalAmount: number;
  status: string;
  fulfillmentStatus: string;
  trackingNumber: string | null;
  trackingUrl: string | null;
  trackingCompany: string | null;
  createdAt: string;
  shopifyOrderId: string | null;
}

/** Full dashboard stats payload returned by the API route. */
export interface OxiOrderStats {
  totalOrders: number;
  totalRevenue: number;
  ordersThisMonth: number;
  revenueThisMonth: number;
  averageOrderValue: number;
  activeTrackers: number;
  totalCustomers: number;
  ordersBySource: OxiSourceBreakdown[];
  fulfillmentBreakdown: OxiFulfillmentBreakdown[];
  ordersOverTime: OxiDailyOrderPoint[];
  recentOrders: OxiRecentOrder[];
}
