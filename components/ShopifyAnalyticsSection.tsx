import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import {
  RefreshCw, ShoppingBag, DollarSign, Package, Users,
  TrendingUp, ArrowUpRight, ArrowDownRight,
  AlertCircle, CheckCircle2, Loader2, ShoppingCart,
  ChevronLeft, ChevronRight
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { ShopifyOAuthConnect } from "./ShopifyOAuthConnect";
import { getCurrentReportingWeek } from "@/utils/weeklyDateRange";
import { isDataStale } from "@/lib/freshnessPolicy";
import { useQuery } from "@tanstack/react-query";
import { useSyncState } from "@/hooks/useSyncState";
import {
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface ShopifyAnalyticsSectionProps {
  clientId: string;
  clientName: string;
}

interface ShopifySummary {
  grossSales: number;
  discounts: number;
  returns: number;
  netSales: number;
  shippingCharges: number;
  returnFees: number;
  taxes: number;
  totalSales: number;
  orders: number;
  ordersFulfilled: number;
  ordersUnfulfilled: number;
  averageOrderValue: number;
  newCustomers: number;
  returningCustomers: number;
  returningCustomerRate: number;
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
  source?: string;
  channel?: "organic" | "paid" | "unknown";
  referringSite?: string | null;
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

interface ConnectionStatus {
  connected: boolean;
  storeName: string | null;
  lastSyncedAt: string | null;
  syncStatus: "synced" | "syncing" | "error";
}

const CHART_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

// Mini sparkline component for KPI cards
const MiniSparkline = ({ data, color = "hsl(var(--primary))" }: { data: TimeseriesPoint[]; color?: string }) => {
  if (!data || data.length === 0) return null;

  return (
    <div className="h-10 w-24">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <Line
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={1.5}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

// KPI Card with sparkline (like Shopify)
const KPICardWithSparkline = ({
  title,
  value,
  sparklineData,
  trend,
  trendValue,
}: {
  title: string;
  value: string;
  sparklineData?: TimeseriesPoint[];
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
}) => (
  <Card className="relative overflow-hidden">
    <CardContent className="p-4">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="text-2xl font-bold">{value}</p>
          {trendValue && (
            <div className={cn(
              "flex items-center text-xs",
              trend === "up" && "text-green-600",
              trend === "down" && "text-red-600",
              trend === "neutral" && "text-muted-foreground"
            )}>
              {trend === "up" && <ArrowUpRight className="h-3 w-3 mr-0.5" />}
              {trend === "down" && <ArrowDownRight className="h-3 w-3 mr-0.5" />}
              <span>{trendValue}</span>
            </div>
          )}
        </div>
        {sparklineData && sparklineData.length > 0 && (
          <MiniSparkline data={sparklineData} />
        )}
      </div>
    </CardContent>
  </Card>
);

// Total Sales Breakdown sidebar component
const TotalSalesBreakdown = ({
  summary,
  formatCurrency,
}: {
  summary: ShopifySummary | null;
  formatCurrency: (val: number) => string;
}) => {
  if (!summary) return null;

  const rows = [
    { label: "Gross sales", value: summary.grossSales, color: "text-primary", bold: false },
    { label: "Discounts", value: summary.discounts, color: "text-primary", bold: false },
    { label: "Returns", value: summary.returns, color: "text-primary", bold: false },
    { label: "Net sales", value: summary.netSales, color: "text-primary", bold: true },
    { label: "Shipping charges", value: summary.shippingCharges, color: "text-primary", bold: false },
    { label: "Return fees", value: summary.returnFees, color: "text-primary", bold: false },
    { label: "Taxes", value: summary.taxes, color: "text-primary", bold: false },
    { label: "Total sales", value: summary.totalSales, color: "text-primary", bold: true },
  ];

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Total sales breakdown</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {rows.map((row, idx) => (
          <div
            key={row.label}
            className={cn(
              "flex items-center justify-between py-1",
              idx === 3 && "border-t pt-2 mt-2",
              idx === 7 && "border-t pt-2 mt-2"
            )}
          >
            <span className={cn(
              "text-sm",
              row.bold ? "font-semibold" : "text-muted-foreground"
            )}>
              {row.label}
            </span>
            <span className={cn(
              "text-sm",
              row.bold && "font-semibold"
            )}>
              {formatCurrency(row.value)}
            </span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

// Horizontal bar chart for products (like Shopify - clean style)
const ProductBarChart = ({
  products,
  formatCurrency,
}: {
  products: TopProduct[];
  formatCurrency: (val: number) => string;
}) => {
  const maxRevenue = Math.max(...products.map(p => p.revenue), 1);

  return (
    <div className="space-y-2">
      {products.slice(0, 5).map((product, index) => (
        <div key={product.id} className="flex items-center gap-2">
          <div
            className="h-5 rounded-sm flex-shrink-0"
            style={{
              width: `${Math.max((product.revenue / maxRevenue) * 60, 10)}%`,
              backgroundColor: CHART_COLORS[index % CHART_COLORS.length],
            }}
          />
          <span className="text-xs text-muted-foreground truncate flex-1 min-w-0">
            {product.title}
          </span>
          <span className="text-xs font-medium flex-shrink-0">{formatCurrency(product.revenue)}</span>
        </div>
      ))}
    </div>
  );
};

const ShopifyAnalyticsSection = ({ clientId, clientName }: ShopifyAnalyticsSectionProps) => {
  // State
  const [hasData, setHasData] = useState(false);
  const [channelBreakdown, setChannelBreakdown] = useState<any>(null);

  // Data state
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus | null>(null);
  const [summary, setSummary] = useState<ShopifySummary | null>(null);
  const [totalSalesTimeseries, setTotalSalesTimeseries] = useState<TimeseriesPoint[]>([]);
  const [aovTimeseries, setAovTimeseries] = useState<TimeseriesPoint[]>([]);
  const [ordersTimeseries, setOrdersTimeseries] = useState<TimeseriesPoint[]>([]);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [orderSources, setOrderSources] = useState<OrderSource[]>([]);
  const syncState = useSyncState(clientId, "shopify", "analytics");

  const { data: cachedData, isLoading: isCacheLoading } = useQuery({
    queryKey: ["platform-analytics-cache", clientId, "shopify", "analytics"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("platform_analytics_cache" as any)
        .select("data")
        .eq("client_id", clientId)
        .eq("platform", "shopify")
        .eq("module", "analytics")
        .maybeSingle();

      if (error) throw error;
      return ((data as any)?.data as any) ?? null;
    },
    enabled: !!clientId && (!syncState.isSyncing || syncState.isDegraded),
  });

  // Assign cached data to local variables
  useEffect(() => {
    if (cachedData) {
      setSummary(cachedData.summary || null);
      setTotalSalesTimeseries(cachedData.timeseries?.totalSales || []);
      setAovTimeseries(cachedData.timeseries?.aov || []);
      setOrdersTimeseries(cachedData.timeseries?.orders || []);
      setTopProducts(cachedData.topProducts || []);
      setOrderSources(cachedData.sources || []);
      setChannelBreakdown(cachedData.channelBreakdown || null);
      setOrders(cachedData.recentOrders || []);
      setHasData(true);
    }
  }, [cachedData]);

  const loading = isCacheLoading || (syncState.isSyncing && !cachedData);
  const refreshing = syncState.isSyncing;

  // Orders list state
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersPagination, setOrdersPagination] = useState<{
    nextPageInfo?: string;
    prevPageInfo?: string;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  }>({ hasNextPage: false, hasPrevPage: false });
  const [ordersPageHistory, setOrdersPageHistory] = useState<string[]>([]);

  // Use standardized reporting period (last completed Mon-Sun week)
  const reportingWeek = useMemo(() => getCurrentReportingWeek(), []);
  const dateRange = useMemo(() => ({
    start: format(reportingWeek.start, "yyyy-MM-dd"),
    end: format(reportingWeek.end, "yyyy-MM-dd"),
  }), [reportingWeek]);

  // Fetch connection status
  const fetchConnectionStatus = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("shopify-analytics", {
        body: { clientId, endpoint: "status" },
      });

      if (error) throw error;
      if (data?.success) {
        setConnectionStatus(data.data);
      }
      return data?.data?.connected || false;
    } catch (err) {
      console.error("Error fetching Shopify status:", err);
      return false;
    }
  };

  // Fetch orders list
  const fetchOrders = async (pageInfo?: string) => {
    setOrdersLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("shopify-analytics", {
        body: {
          clientId,
          endpoint: "orders",
          start: dateRange.start,
          end: dateRange.end,
          pageInfo,
          limit: 10,
        },
      });

      if (error) throw error;
      if (data?.success) {
        setOrders(data.data);
        setOrdersPagination(data.pagination);
      }
    } catch (err) {
      console.error("Error fetching orders:", err);
    } finally {
      setOrdersLoading(false);
    }
  };

  const fetchData = async () => {
    const isConnected = await fetchConnectionStatus();
    if (isConnected && !hasData && !syncState.isSyncing) {
      // Force initial sync if connected but no data
      await syncState.retry();
    }
  };

  useEffect(() => {
    fetchData();
  }, [clientId, dateRange.start, dateRange.end]);

  // Format currency
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
    }).format(value);
  };

  // Financial status badge
  const getFinancialStatusBadge = (status: string) => {
    const statusMap: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
      paid: { variant: "default", label: "Paid" },
      pending: { variant: "outline", label: "Pending" },
      refunded: { variant: "destructive", label: "Refunded" },
      partially_refunded: { variant: "secondary", label: "Partial Refund" },
      voided: { variant: "destructive", label: "Voided" },
      authorized: { variant: "outline", label: "Authorized" },
    };
    const config = statusMap[status] || { variant: "outline" as const, label: status };
    return <Badge variant={config.variant} className="text-xs">{config.label}</Badge>;
  };

  // Fulfillment status badge
  const getFulfillmentStatusBadge = (status: string | null) => {
    const statusMap: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
      fulfilled: { variant: "default", label: "Fulfilled" },
      unfulfilled: { variant: "outline", label: "Unfulfilled" },
      partial: { variant: "secondary", label: "Partial" },
      restocked: { variant: "secondary", label: "Restocked" },
    };
    const config = statusMap[status || "unfulfilled"] || { variant: "outline" as const, label: status || "Unfulfilled" };
    return <Badge variant={config.variant} className="text-xs">{config.label}</Badge>;
  };

  // Handle orders pagination
  const handleOrdersNextPage = () => {
    if (ordersPagination.nextPageInfo) {
      setOrdersPageHistory(prev => [...prev, ordersPagination.prevPageInfo || ""]);
      fetchOrders(ordersPagination.nextPageInfo);
    }
  };

  const handleOrdersPrevPage = () => {
    if (ordersPagination.hasPrevPage && ordersPageHistory.length > 0) {
      const prevHistory = [...ordersPageHistory];
      const prevPageInfo = prevHistory.pop();
      setOrdersPageHistory(prevHistory);
      fetchOrders(prevPageInfo || undefined);
    } else if (ordersPagination.hasPrevPage) {
      fetchOrders();
    }
  };

  // Render not connected state - use OAuth connect component
  if (!loading && connectionStatus && !connectionStatus.connected) {
    return (
      <ShopifyOAuthConnect
        clientId={clientId}
        clientName={clientName}
        onConnected={() => fetchData()}
      />
    );
  }

  // Loading skeleton
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-36" />
        </div>
        <div className="grid gap-4 md:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <div className="grid gap-6 lg:grid-cols-4">
          <Skeleton className="lg:col-span-3 h-80" />
          <Skeleton className="h-80" />
        </div>
      </div>
    );
  }

  // Calculate total sales from sources for donut chart center
  const totalSalesFromSources = orderSources.reduce((sum, s) => sum + s.revenue, 0);

  return (
    <div className="space-y-6">
      {/* Header with controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-green-500/10">
            <ShoppingBag className="h-6 w-6 text-green-600" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">Analytics</h2>
            <p className="text-sm text-muted-foreground">
              {connectionStatus?.storeName || "Your Store"}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Reporting Period Badge */}
          <Badge variant="outline" className="text-sm px-3 py-1">
            {reportingWeek.dateRange}
          </Badge>

          {/* Refresh Button */}
          <div className="flex gap-2">
          {syncState.isDegraded && (
            <Badge variant="outline" className="text-amber-500 border-amber-200 bg-amber-50">
              <AlertCircle className="h-3 w-3 mr-1" />
              Showing last known good data
            </Badge>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => syncState.retry()}
            disabled={refreshing}
            className="gap-2 bg-background/50 backdrop-blur-sm"
          >
            <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
            {refreshing ? "Syncing..." : "Refresh Data"}
          </Button>
        </div>
        </div>
      </div>

      {/* Top KPI Row with Sparklines (like Shopify) */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <KPICardWithSparkline
          title="Gross sales"
          value={formatCurrency(summary?.grossSales || 0)}
          sparklineData={totalSalesTimeseries}
          trend={summary?.prevGrossSales !== undefined
            ? (summary.grossSales > summary.prevGrossSales ? "up" : summary.grossSales < summary.prevGrossSales ? "down" : "neutral")
            : undefined}
        />
        <KPICardWithSparkline
          title="Returning customer rate"
          value={`${summary?.returningCustomerRate?.toFixed(0) || 0}%`}
          trend={summary?.prevReturningCustomerRate !== undefined
            ? (summary.returningCustomerRate > summary.prevReturningCustomerRate ? "up" : summary.returningCustomerRate < summary.prevReturningCustomerRate ? "down" : "neutral")
            : undefined}
        />
        <KPICardWithSparkline
          title="Orders fulfilled"
          value={String(summary?.ordersFulfilled || 0)}
          sparklineData={ordersTimeseries}
          trend={summary?.prevOrdersFulfilled !== undefined
            ? (summary.ordersFulfilled > summary.prevOrdersFulfilled ? "up" : summary.ordersFulfilled < summary.prevOrdersFulfilled ? "down" : "neutral")
            : undefined}
        />
        <KPICardWithSparkline
          title="Orders"
          value={String(summary?.orders || 0)}
          sparklineData={ordersTimeseries}
          trend={summary?.prevOrders !== undefined
            ? (summary.orders > summary.prevOrders ? "up" : summary.orders < summary.prevOrders ? "down" : "neutral")
            : undefined}
        />
      </div>

      {/* Total Sales Chart + Breakdown Sidebar */}
      <div className="grid gap-6 lg:grid-cols-4">
        {/* Main Total Sales Chart */}
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-base">Total sales over time</CardTitle>
            <p className="text-2xl font-bold">{formatCurrency(summary?.totalSales || 0)}</p>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={totalSalesTimeseries}>
                  <XAxis
                    dataKey="date"
                    tickFormatter={(val) => format(new Date(val), "MMM d")}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                  />
                  <YAxis
                    tickFormatter={(val) => `$${val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}`}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                  />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null;
                      return (
                        <div className="bg-popover border rounded-lg shadow-lg p-3">
                          <p className="text-sm text-muted-foreground">{format(new Date(label), "MMM d, yyyy")}</p>
                          <p className="text-primary font-semibold">
                            {formatCurrency(payload[0].value as number)}
                          </p>
                        </div>
                      );
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="flex items-center gap-4 mt-4 text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <div className="w-3 h-0.5 bg-primary rounded" />
                <span>{reportingWeek.dateRange}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Total Sales Breakdown Sidebar */}
        <TotalSalesBreakdown summary={summary} formatCurrency={formatCurrency} />
      </div>

      {/* Second Row: Sales by Channel, AOV, Products */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Total Sales by Channel Donut */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Total sales by sales channel</CardTitle>
          </CardHeader>
          <CardContent>
            {orderSources.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">
                No order data available
              </div>
            ) : (
              <div className="relative">
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={orderSources}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={2}
                        dataKey="revenue"
                        nameKey="name"
                      >
                        {orderSources.map((_, index) => (
                          <Cell
                            key={`source-${index}`}
                            fill={CHART_COLORS[index % CHART_COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        content={({ active, payload }) => {
                          if (!active || !payload?.length) return null;
                          const data = payload[0].payload as OrderSource;
                          return (
                            <div className="bg-popover border rounded-lg shadow-lg p-3">
                              <p className="font-medium">{data.name}</p>
                              <p className="text-primary font-semibold">{formatCurrency(data.revenue)}</p>
                            </div>
                          );
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  {/* Center text */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="text-center">
                      <p className="text-lg font-bold">{formatCurrency(totalSalesFromSources)}</p>
                    </div>
                  </div>
                </div>
                <div className="mt-2 space-y-1">
                  {orderSources.slice(0, 4).map((source, index) => (
                    <div key={source.name} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
                        />
                        <span className="text-muted-foreground truncate max-w-[120px]">{source.name}</span>
                      </div>
                      <span className="font-medium">{formatCurrency(source.revenue)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Average Order Value Over Time */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Average order value over time</CardTitle>
            <p className="text-2xl font-bold">{formatCurrency(summary?.averageOrderValue || 0)}</p>
          </CardHeader>
          <CardContent>
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={aovTimeseries}>
                  <XAxis
                    dataKey="date"
                    tickFormatter={(val) => format(new Date(val), "MMM d")}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                  />
                  <YAxis
                    tickFormatter={(val) => `$${val}`}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                    width={40}
                  />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null;
                      return (
                        <div className="bg-popover border rounded-lg shadow-lg p-2 text-sm">
                          <p className="text-muted-foreground">{format(new Date(label), "MMM d")}</p>
                          <p className="font-semibold">{formatCurrency(payload[0].value as number)}</p>
                        </div>
                      );
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Total Sales by Product */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Total sales by product</CardTitle>
          </CardHeader>
          <CardContent>
            {topProducts.length === 0 ? (
              <div className="h-40 flex items-center justify-center text-muted-foreground text-sm">
                No product data available
              </div>
            ) : (
              <ProductBarChart products={topProducts} formatCurrency={formatCurrency} />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Orders Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <ShoppingCart className="h-5 w-5" />
                Orders
              </CardTitle>
              <CardDescription>All orders for the selected period</CardDescription>
            </div>
            <Badge variant="secondary" className="text-sm">
              {summary?.orders || 0} total
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {ordersLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : orders.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <ShoppingCart className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No orders found for this period</p>
            </div>
          ) : (
            <>
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="font-semibold">Order</TableHead>
                      <TableHead className="font-semibold">Date</TableHead>
                      <TableHead className="font-semibold">Customer</TableHead>
                      <TableHead className="font-semibold">Source</TableHead>
                      <TableHead className="font-semibold">Payment</TableHead>
                      <TableHead className="font-semibold">Fulfillment</TableHead>
                      <TableHead className="font-semibold">Items</TableHead>
                      <TableHead className="font-semibold text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orders.map((order) => (
                      <TableRow key={order.id} className="hover:bg-muted/30">
                        <TableCell>
                          <div className="font-medium text-primary">
                            {order.orderNumber}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {format(new Date(order.createdAt), "MMM d, yyyy")}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {format(new Date(order.createdAt), "h:mm a")}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{order.customerName}</div>
                          {order.shippingAddress && (
                            <div className="text-xs text-muted-foreground">
                              {[order.shippingAddress.city, order.shippingAddress.province].filter(Boolean).join(", ")}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="text-xs font-medium">{order.source || "Direct"}</div>
                          <Badge
                            variant="outline"
                            className={`text-[10px] px-1.5 py-0 mt-0.5 ${order.channel === "paid" ? "bg-orange-500/15 text-orange-600 border-orange-200" : "bg-emerald-500/15 text-emerald-600 border-emerald-200"}`}
                          >
                            {order.channel === "paid" ? "Paid" : "Organic"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {getFinancialStatusBadge(order.financialStatus)}
                        </TableCell>
                        <TableCell>
                          {getFulfillmentStatusBadge(order.fulfillmentStatus)}
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {order.itemCount} {order.itemCount === 1 ? "item" : "items"}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="font-semibold">{formatCurrency(order.totalPrice)}</div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between mt-4">
                <div className="text-sm text-muted-foreground">
                  Showing {orders.length} orders
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleOrdersPrevPage}
                    disabled={!ordersPagination.hasPrevPage}
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleOrdersNextPage}
                    disabled={!ordersPagination.hasNextPage}
                  >
                    Next
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ShopifyAnalyticsSection;
