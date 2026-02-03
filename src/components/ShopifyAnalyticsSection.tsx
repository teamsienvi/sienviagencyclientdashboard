import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  Pagination, 
  PaginationContent, 
  PaginationItem, 
  PaginationLink, 
  PaginationNext, 
  PaginationPrevious 
} from "@/components/ui/pagination";
import { cn } from "@/lib/utils";
import { 
  RefreshCw, ShoppingBag, DollarSign, Package, Users, 
  TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight,
  AlertCircle, CheckCircle2, Loader2, ShoppingCart,
  ArrowUpDown, ChevronUp, ChevronDown
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { ShopifyOAuthConnect } from "./ShopifyOAuthConnect";
import { getCurrentReportingWeek, getPreviousReportingWeek } from "@/utils/weeklyDateRange";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface ShopifyAnalyticsSectionProps {
  clientId: string;
  clientName: string;
}

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

interface ConnectionStatus {
  connected: boolean;
  storeName: string | null;
  lastSyncedAt: string | null;
  syncStatus: "synced" | "syncing" | "error";
}

type SortField = "revenue" | "units" | "refunds";
type SortDirection = "asc" | "desc";

const CHART_COLORS = {
  primary: "hsl(var(--primary))",
  secondary: "hsl(var(--chart-2))",
  success: "hsl(142 76% 36%)",
  warning: "hsl(38 92% 50%)",
};

const ShopifyAnalyticsSection = ({ clientId, clientName }: ShopifyAnalyticsSectionProps) => {
  // State
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Data state
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus | null>(null);
  const [summary, setSummary] = useState<ShopifySummary | null>(null);
  const [salesTimeseries, setSalesTimeseries] = useState<TimeseriesPoint[]>([]);
  const [ordersTimeseries, setOrdersTimeseries] = useState<TimeseriesPoint[]>([]);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [orderSources, setOrderSources] = useState<OrderSource[]>([]);
  const [productsPagination, setProductsPagination] = useState({ page: 1, pageSize: 10, total: 0, totalPages: 0 });
  
  // Table sorting
  const [sortField, setSortField] = useState<SortField>("revenue");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

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

  // Fetch all data
  const fetchData = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setRefreshing(true);

    try {
      const isConnected = await fetchConnectionStatus();
      if (!isConnected) {
        setLoading(false);
        setRefreshing(false);
        return;
      }

      // Fetch all data in parallel
      const [summaryRes, salesRes, ordersRes, productsRes, sourcesRes] = await Promise.all([
        supabase.functions.invoke("shopify-analytics", {
          body: {
            clientId,
            endpoint: "summary",
            start: dateRange.start,
            end: dateRange.end,
          },
        }),
        supabase.functions.invoke("shopify-analytics", {
          body: {
            clientId,
            endpoint: "timeseries",
            metric: "net_sales",
            start: dateRange.start,
            end: dateRange.end,
          },
        }),
        supabase.functions.invoke("shopify-analytics", {
          body: {
            clientId,
            endpoint: "timeseries",
            metric: "orders",
            start: dateRange.start,
            end: dateRange.end,
          },
        }),
        supabase.functions.invoke("shopify-analytics", {
          body: {
            clientId,
            endpoint: "top-products",
            page: productsPagination.page,
            pageSize: productsPagination.pageSize,
            start: dateRange.start,
            end: dateRange.end,
            sort: `${sortField}_${sortDirection}`,
          },
        }),
        supabase.functions.invoke("shopify-analytics", {
          body: {
            clientId,
            endpoint: "order-sources",
            start: dateRange.start,
            end: dateRange.end,
          },
        }),
      ]);

      if (summaryRes.data?.success) {
        setSummary(summaryRes.data.data);
      }

      if (salesRes.data?.success) {
        setSalesTimeseries(salesRes.data.data);
      }

      if (ordersRes.data?.success) {
        setOrdersTimeseries(ordersRes.data.data);
      }

      if (productsRes.data?.success) {
        setTopProducts(productsRes.data.data);
        setProductsPagination(productsRes.data.pagination);
      }

      if (sourcesRes.data?.success) {
        setOrderSources(sourcesRes.data.data);
      }
    } catch (err) {
      console.error("Error fetching Shopify data:", err);
      toast.error("Failed to load Shopify analytics");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Fetch products with new pagination/sort
  const fetchProducts = async (page: number) => {
    try {
      const { data, error } = await supabase.functions.invoke("shopify-analytics", {
        body: {
          clientId,
          endpoint: "top-products",
          page,
          pageSize: productsPagination.pageSize,
          start: dateRange.start,
          end: dateRange.end,
          sort: `${sortField}_${sortDirection}`,
        },
      });

      if (error) throw error;
      if (data?.success) {
        setTopProducts(data.data);
        setProductsPagination(data.pagination);
      }
    } catch (err) {
      console.error("Error fetching products:", err);
    }
  };

  // Initial load
  useEffect(() => {
    fetchData();
  }, [clientId]);

  // Refetch when date range or comparison changes
  useEffect(() => {
    if (!loading) {
      fetchData(false);
    }
  }, [dateRange.start, dateRange.end]);

  // Handle sort change
  const handleSort = (field: SortField) => {
    if (field === sortField) {
      setSortDirection(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  useEffect(() => {
    if (!loading && connectionStatus?.connected) {
      fetchProducts(productsPagination.page);
    }
  }, [sortField, sortDirection]);

  // Calculate percentage change
  const calcChange = (current: number, previous?: number): { value: number; isPositive: boolean } | null => {
    if (previous === undefined || previous === 0) return null;
    const change = ((current - previous) / previous) * 100;
    return { value: Math.abs(change), isPositive: change >= 0 };
  };

  // Format currency
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
    }).format(value);
  };

  // Customer donut chart data
  const customerChartData = useMemo(() => {
    if (!summary) return [];
    return [
      { name: "New Customers", value: summary.newCustomers, color: CHART_COLORS.primary },
      { name: "Returning Customers", value: summary.returningCustomers, color: CHART_COLORS.secondary },
    ];
  }, [summary]);

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
          {[...Array(8)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-80" />
          <Skeleton className="h-80" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-green-500/10">
            <ShoppingBag className="h-6 w-6 text-green-600" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">Shopify Analytics</h2>
            <p className="text-sm text-muted-foreground">
              {connectionStatus?.storeName || "Your Store"}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Sync Status */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {connectionStatus?.syncStatus === "synced" && (
              <>
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span>Synced</span>
              </>
            )}
            {connectionStatus?.syncStatus === "syncing" && (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Syncing...</span>
              </>
            )}
            {connectionStatus?.syncStatus === "error" && (
              <>
                <AlertCircle className="h-4 w-4 text-destructive" />
                <span>Sync Error</span>
              </>
            )}
            {connectionStatus?.lastSyncedAt && (
              <span className="text-xs">
                Last: {format(new Date(connectionStatus.lastSyncedAt), "MMM d, h:mm a")}
              </span>
            )}
          </div>

          {/* Reporting Period Badge */}
          <Badge variant="outline" className="text-sm px-3 py-1">
            {reportingWeek.dateRange}
          </Badge>


          {/* Refresh Button */}
          <Button
            variant="outline"
            size="icon"
            onClick={() => fetchData(false)}
            disabled={refreshing}
          >
            <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {/* Net Sales */}
        <KPICard
          title="Net Sales"
          value={formatCurrency(summary?.netSales || 0)}
          icon={DollarSign}
          iconBg="bg-green-500/10"
          iconColor="text-green-600"
        />

        {/* Gross Sales */}
        <KPICard
          title="Gross Sales"
          value={formatCurrency(summary?.grossSales || 0)}
          icon={TrendingUp}
          iconBg="bg-blue-500/10"
          iconColor="text-blue-600"
        />

        {/* Orders */}
        <KPICard
          title="Orders"
          value={summary?.orders?.toLocaleString() || "0"}
          icon={ShoppingCart}
          iconBg="bg-purple-500/10"
          iconColor="text-purple-600"
        />

        {/* AOV */}
        <KPICard
          title="Avg Order Value"
          value={formatCurrency(summary?.averageOrderValue || 0)}
          icon={Package}
          iconBg="bg-orange-500/10"
          iconColor="text-orange-600"
        />

        {/* Refunds */}
        <KPICard
          title="Refunds"
          value={formatCurrency(summary?.refunds || 0)}
          icon={ArrowDownRight}
          iconBg="bg-red-500/10"
          iconColor="text-red-600"
        />

        {/* Discounts */}
        <KPICard
          title="Discounts"
          value={formatCurrency(summary?.discountAmount || 0)}
          icon={DollarSign}
          iconBg="bg-amber-500/10"
          iconColor="text-amber-600"
        />

        {/* New Customers */}
        <KPICard
          title="New Customers"
          value={summary?.newCustomers?.toLocaleString() || "0"}
          icon={Users}
          iconBg="bg-teal-500/10"
          iconColor="text-teal-600"
        />

        {/* Returning Customers */}
        <KPICard
          title="Returning Customers"
          value={summary?.returningCustomers?.toLocaleString() || "0"}
          icon={Users}
          iconBg="bg-indigo-500/10"
          iconColor="text-indigo-600"
        />
      </div>

      {/* Charts Row */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Net Sales Line Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Net Sales Over Time</CardTitle>
            <CardDescription>Daily net sales for the selected period</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={salesTimeseries}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(val) => format(new Date(val), "MMM d")}
                    className="text-xs"
                  />
                  <YAxis
                    tickFormatter={(val) => `$${val >= 1000 ? `${(val / 1000).toFixed(1)}k` : val}`}
                    className="text-xs"
                  />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null;
                      return (
                        <div className="bg-popover border rounded-lg shadow-lg p-3">
                          <p className="font-medium">{format(new Date(label), "MMM d, yyyy")}</p>
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
          </CardContent>
        </Card>

        {/* Orders Bar Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Orders Over Time</CardTitle>
            <CardDescription>Daily order count for the selected period</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={ordersTimeseries}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(val) => format(new Date(val), "MMM d")}
                    className="text-xs"
                  />
                  <YAxis className="text-xs" />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null;
                      return (
                        <div className="bg-popover border rounded-lg shadow-lg p-3">
                          <p className="font-medium">{format(new Date(label), "MMM d, yyyy")}</p>
                          <p className="text-primary font-semibold">
                            {Math.round(payload[0].value as number)} orders
                          </p>
                        </div>
                      );
                    }}
                  />
                  <Bar
                    dataKey="value"
                    fill="hsl(var(--primary))"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Customer Breakdown, Order Sources & Top Products */}
      <div className="grid gap-6 lg:grid-cols-4">
        {/* Customer Donut Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Customer Breakdown</CardTitle>
            <CardDescription>New vs returning customers</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={customerChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {customerChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const data = payload[0].payload;
                      return (
                        <div className="bg-popover border rounded-lg shadow-lg p-3">
                          <p className="font-medium">{data.name}</p>
                          <p className="text-primary font-semibold">{data.value.toLocaleString()}</p>
                        </div>
                      );
                    }}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex justify-center gap-6 mt-4">
              <div className="text-center">
                <p className="text-2xl font-bold">{summary?.newCustomers || 0}</p>
                <p className="text-xs text-muted-foreground">New</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold">{summary?.returningCustomers || 0}</p>
                <p className="text-xs text-muted-foreground">Returning</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Order Sources Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Order Sources</CardTitle>
            <CardDescription>Where orders are coming from</CardDescription>
          </CardHeader>
          <CardContent>
            {orderSources.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">
                No order data available
              </div>
            ) : (
              <>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={orderSources}
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={70}
                        paddingAngle={2}
                        dataKey="orders"
                        nameKey="name"
                      >
                        {orderSources.map((_, index) => (
                          <Cell 
                            key={`source-${index}`} 
                            fill={`hsl(var(--chart-${(index % 5) + 1}))`} 
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
                              <p className="text-sm">{data.orders} orders</p>
                              <p className="text-primary font-semibold">{formatCurrency(data.revenue)}</p>
                            </div>
                          );
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-2 space-y-1 max-h-24 overflow-y-auto">
                  {orderSources.map((source, index) => (
                    <div key={source.name} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-2.5 h-2.5 rounded-full" 
                          style={{ backgroundColor: `hsl(var(--chart-${(index % 5) + 1}))` }}
                        />
                        <span className="truncate max-w-[100px]">{source.name}</span>
                      </div>
                      <span className="font-medium">{source.orders}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Top Products Table */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">Top Products</CardTitle>
            <CardDescription>Best performing products by revenue</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40%]">Product</TableHead>
                    <TableHead 
                      className="cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => handleSort("units")}
                    >
                      <div className="flex items-center gap-1">
                        Units Sold
                        <SortIcon field="units" currentField={sortField} direction={sortDirection} />
                      </div>
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => handleSort("revenue")}
                    >
                      <div className="flex items-center gap-1">
                        Revenue
                        <SortIcon field="revenue" currentField={sortField} direction={sortDirection} />
                      </div>
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => handleSort("refunds")}
                    >
                      <div className="flex items-center gap-1">
                        Refunds
                        <SortIcon field="refunds" currentField={sortField} direction={sortDirection} />
                      </div>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topProducts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                        No products found
                      </TableCell>
                    </TableRow>
                  ) : (
                    topProducts.map((product) => (
                      <TableRow key={product.id}>
                        <TableCell className="font-medium">
                          <span className="line-clamp-2">{product.title}</span>
                        </TableCell>
                        <TableCell>{product.unitsSold.toLocaleString()}</TableCell>
                        <TableCell>{formatCurrency(product.revenue)}</TableCell>
                        <TableCell>
                          {product.refunds > 0 ? (
                            <span className="text-destructive">{formatCurrency(product.refunds)}</span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            {productsPagination.totalPages > 1 && (
              <div className="mt-4">
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious 
                        onClick={() => productsPagination.page > 1 && fetchProducts(productsPagination.page - 1)}
                        className={cn(productsPagination.page <= 1 && "pointer-events-none opacity-50")}
                      />
                    </PaginationItem>
                    {[...Array(productsPagination.totalPages)].map((_, i) => (
                      <PaginationItem key={i}>
                        <PaginationLink
                          onClick={() => fetchProducts(i + 1)}
                          isActive={productsPagination.page === i + 1}
                        >
                          {i + 1}
                        </PaginationLink>
                      </PaginationItem>
                    ))}
                    <PaginationItem>
                      <PaginationNext 
                        onClick={() => productsPagination.page < productsPagination.totalPages && fetchProducts(productsPagination.page + 1)}
                        className={cn(productsPagination.page >= productsPagination.totalPages && "pointer-events-none opacity-50")}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

// KPI Card Component
interface KPICardProps {
  title: string;
  value: string;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
}

const KPICard = ({ title, value, icon: Icon, iconBg, iconColor }: KPICardProps) => {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className={cn("p-2 rounded-lg", iconBg)}>
            <Icon className={cn("h-4 w-4", iconColor)} />
          </div>
        </div>
        <div className="mt-3">
          <p className="text-2xl font-bold">{value}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{title}</p>
        </div>
      </CardContent>
    </Card>
  );
};

// Sort Icon Component
const SortIcon = ({ field, currentField, direction }: { field: SortField; currentField: SortField; direction: SortDirection }) => {
  if (field !== currentField) {
    return <ArrowUpDown className="h-3 w-3 text-muted-foreground" />;
  }
  return direction === "asc" ? (
    <ChevronUp className="h-3 w-3" />
  ) : (
    <ChevronDown className="h-3 w-3" />
  );
};

export default ShopifyAnalyticsSection;
