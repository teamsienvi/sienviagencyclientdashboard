import React, { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/browser";
import {
  ShoppingBag, TrendingUp, Package, RefreshCw,
  Eye, ArrowUpRight, ArrowDownRight, Minus,
  BarChart3, ShoppingCart, DollarSign
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { format, subDays, parseISO } from "date-fns";

interface AmazonOrdersCardProps {
  clientId: string;
  clientName: string;
}

type DateRangeOption = 7 | 14 | 30 | 90;

interface DayMetric {
  date: string;
  ordered_product_sales_amount: number;
  units_ordered: number;
  total_order_items: number;
  page_views: number;
}

// ── helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(v: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(v);
}

function formatCompact(v: number) {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}k`;
  return `$${v.toFixed(2)}`;
}

function calcTrend(current: number, prev: number) {
  if (prev === 0) return null;
  const pct = ((current - prev) / prev) * 100;
  return pct;
}

// ── sub-components ────────────────────────────────────────────────────────────

const TrendBadge = ({ pct }: { pct: number | null }) => {
  if (pct === null) return null;
  const isUp = pct >= 0;
  return (
    <span className={cn(
      "inline-flex items-center gap-0.5 text-xs font-medium",
      isUp ? "text-emerald-500" : "text-red-500"
    )}>
      {isUp ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
      {Math.abs(pct).toFixed(1)}%
    </span>
  );
};

const KPICard = ({
  label, value, subValue, trend, icon: Icon, iconColor, description,
}: {
  label: string;
  value: string;
  subValue?: string;
  trend: number | null;
  icon: React.ElementType;
  iconColor: string;
  description?: string;
}) => (
  <div className="flex flex-col p-4 bg-background rounded-xl border border-border/60 shadow-sm gap-2 hover:border-primary/30 transition-colors">
    <div className="flex items-center justify-between">
      <span className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
        <Icon className={cn("w-3.5 h-3.5", iconColor)} />
        {label}
      </span>
      <TrendBadge pct={trend} />
    </div>
    <span className="text-2xl font-bold tracking-tight">{value}</span>
    {subValue && <span className="text-xs text-muted-foreground">{subValue}</span>}
    {description && <span className="text-xs text-muted-foreground/70">{description}</span>}
  </div>
);

const DATE_RANGE_OPTIONS: { label: string; value: DateRangeOption }[] = [
  { label: "7 days", value: 7 },
  { label: "14 days", value: 14 },
  { label: "30 days", value: 30 },
  { label: "90 days", value: 90 },
];

// ── main component ────────────────────────────────────────────────────────────

export function AmazonOrdersCard({ clientId, clientName }: AmazonOrdersCardProps) {
  const supabase = createClient();
  const { toast } = useToast();
  const [isSyncing, setIsSyncing] = useState(false);
  const [days, setDays] = useState<DateRangeOption>(30);

  // ── data fetching ─────────────────────────────────────────────────────────

  const startDate = useMemo(
    () => format(subDays(new Date(), days), "yyyy-MM-dd"),
    [days]
  );

  const { data: rows = [], isLoading, refetch } = useQuery<DayMetric[]>({
    queryKey: ["amazon-sales-metrics", clientId, days],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("amazon_sales_metrics")
        .select("date, ordered_product_sales_amount, units_ordered, total_order_items, page_views")
        .eq("client_id", clientId)
        .gte("date", startDate)
        .order("date", { ascending: true });

      if (error && error.code !== "PGRST116") throw error;
      return (data ?? []) as DayMetric[];
    },
  });

  // ── aggregations ──────────────────────────────────────────────────────────

  const { current, previous, chartData, lastSynced } = useMemo(() => {
    if (!rows.length) return { current: null, previous: null, chartData: [], lastSynced: null };

    const half = Math.ceil(rows.length / 2);
    const prevRows = rows.slice(0, half);
    const currRows = rows.slice(half);

    const sum = (arr: DayMetric[], key: keyof DayMetric) =>
      arr.reduce((s, r) => s + (Number(r[key]) || 0), 0);

    const build = (arr: DayMetric[]) => ({
      revenue: sum(arr, "ordered_product_sales_amount"),
      units: sum(arr, "units_ordered"),
      orders: sum(arr, "total_order_items"),
      pageViews: sum(arr, "page_views"),
    });

    const currAgg = build(currRows);
    const prevAgg = build(prevRows);

    const aov = currAgg.orders > 0 ? currAgg.revenue / currAgg.orders : 0;
    const prevAov = prevAgg.orders > 0 ? prevAgg.revenue / prevAgg.orders : 0;
    const convRate = currAgg.pageViews > 0 ? (currAgg.orders / currAgg.pageViews) * 100 : 0;
    const prevConvRate = prevAgg.pageViews > 0 ? (prevAgg.orders / prevAgg.pageViews) * 100 : 0;
    const unitsPerOrder = currAgg.orders > 0 ? currAgg.units / currAgg.orders : 0;

    const chart = rows.map((r) => ({
      date: r.date,
      revenue: r.ordered_product_sales_amount,
      units: r.units_ordered,
      orders: r.total_order_items,
      pageViews: r.page_views,
    }));

    // last updated
    const lastRow = [...rows].sort((a, b) => b.date.localeCompare(a.date))[0];

    return {
      current: { ...currAgg, aov, convRate, unitsPerOrder },
      previous: { ...prevAgg, aov: prevAov, convRate: prevConvRate },
      chartData: chart,
      lastSynced: lastRow?.date ?? null,
    };
  }, [rows]);

  // ── sync handler ──────────────────────────────────────────────────────────

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/sync-amazon-orders`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.session?.access_token}`,
            "Content-Type": "application/json",
          },
        }
      );
      if (!response.ok) throw new Error("Failed to sync Amazon Orders");
      toast({ title: "Sync Successful", description: "Amazon Orders have been synchronized." });
      refetch();
    } catch {
      toast({
        title: "Sync Failed",
        description: "Could not synchronize Amazon Orders. Please check credentials.",
        variant: "destructive",
      });
    } finally {
      setIsSyncing(false);
    }
  };

  // ── render ────────────────────────────────────────────────────────────────

  const hasData = rows.length > 0;

  return (
    <Card className="border-2 border-primary/10 shadow-lg bg-gradient-to-br from-background to-secondary/5">
      {/* ── Header ── */}
      <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3">
        <div className="space-y-1">
          <CardTitle className="text-xl flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-[#FF9900]" />
            Amazon Orders Analytics
          </CardTitle>
          <CardDescription>Daily Sales &amp; Traffic Report for {clientName}</CardDescription>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Date range pills */}
          <div className="flex items-center gap-1 bg-muted/40 rounded-lg p-1">
            {DATE_RANGE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setDays(opt.value)}
                className={cn(
                  "px-3 py-1 text-xs font-medium rounded-md transition-all duration-150",
                  days === opt.value
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={handleSync}
            disabled={isSyncing}
            className="gap-2"
          >
            <RefreshCw className={cn("w-4 h-4", isSyncing && "animate-spin")} />
            {isSyncing ? "Syncing…" : "Sync Now"}
          </Button>
        </div>
      </CardHeader>

      {/* ── Body ── */}
      <CardContent>
        {isLoading ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
            </div>
            <Skeleton className="h-64 w-full rounded-xl" />
          </div>
        ) : !hasData ? (
          <div className="flex flex-col items-center justify-center h-48 space-y-3 text-center">
            <div className="w-12 h-12 rounded-full bg-[#FF9900]/10 flex items-center justify-center">
              <ShoppingBag className="w-6 h-6 text-[#FF9900]" />
            </div>
            <p className="text-sm text-muted-foreground">No Amazon Orders data found for this period.</p>
            <p className="text-xs text-muted-foreground/70 max-w-sm">
              Configure the client's Amazon SP-API credentials and run a sync to populate data.
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            {/* ── Period badge ── */}
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                Last {days} days · {rows.length} data points
              </Badge>
              {lastSynced && (
                <span className="text-xs text-muted-foreground">
                  Latest: {format(parseISO(lastSynced), "MMM d, yyyy")}
                </span>
              )}
            </div>

            {/* ── KPI grid ── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <KPICard
                label="Total Revenue"
                value={formatCompact(current?.revenue ?? 0)}
                subValue={formatCurrency(current?.revenue ?? 0)}
                trend={calcTrend(current?.revenue ?? 0, previous?.revenue ?? 0)}
                icon={DollarSign}
                iconColor="text-emerald-500"
                description="Ordered product sales"
              />
              <KPICard
                label="Total Orders"
                value={(current?.orders ?? 0).toLocaleString()}
                trend={calcTrend(current?.orders ?? 0, previous?.orders ?? 0)}
                icon={ShoppingCart}
                iconColor="text-orange-500"
              />
              <KPICard
                label="Units Ordered"
                value={(current?.units ?? 0).toLocaleString()}
                trend={calcTrend(current?.units ?? 0, previous?.units ?? 0)}
                icon={Package}
                iconColor="text-blue-500"
              />
              <KPICard
                label="Avg Order Value"
                value={formatCurrency(current?.aov ?? 0)}
                trend={calcTrend(current?.aov ?? 0, previous?.aov ?? 0)}
                icon={TrendingUp}
                iconColor="text-violet-500"
              />
              <KPICard
                label="Page Views"
                value={(current?.pageViews ?? 0).toLocaleString()}
                trend={calcTrend(current?.pageViews ?? 0, previous?.pageViews ?? 0)}
                icon={Eye}
                iconColor="text-sky-500"
              />
              <KPICard
                label="Conversion Rate"
                value={`${(current?.convRate ?? 0).toFixed(2)}%`}
                trend={calcTrend(current?.convRate ?? 0, previous?.convRate ?? 0)}
                icon={BarChart3}
                iconColor="text-pink-500"
                description="Orders ÷ page views"
              />
              <KPICard
                label="Units / Order"
                value={(current?.unitsPerOrder ?? 0).toFixed(2)}
                trend={null}
                icon={Package}
                iconColor="text-amber-500"
                description="Avg units per transaction"
              />
              <KPICard
                label="Daily Avg Revenue"
                value={formatCompact((current?.revenue ?? 0) / Math.max(rows.length, 1))}
                trend={null}
                icon={DollarSign}
                iconColor="text-teal-500"
                description={`Over ${rows.length} days`}
              />
            </div>

            {/* ── Revenue Over Time Chart ── */}
            <Card className="bg-background/50 border-border/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-500" />
                  Revenue Over Time
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
                      <XAxis
                        dataKey="date"
                        tickFormatter={(v) => format(parseISO(v), days <= 14 ? "MMM d" : "MMM d")}
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                        interval={Math.ceil(chartData.length / 6)}
                      />
                      <YAxis
                        tickFormatter={(v) => `$${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`}
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                        width={48}
                      />
                      <Tooltip
                        content={({ active, payload, label }) => {
                          if (!active || !payload?.length) return null;
                          return (
                            <div className="bg-popover border border-border rounded-lg shadow-lg p-3 text-sm">
                              <p className="text-muted-foreground mb-1">
                                {format(parseISO(label as string), "MMM d, yyyy")}
                              </p>
                              <p className="font-semibold text-foreground">
                                {formatCurrency(payload[0].value as number)}
                              </p>
                            </div>
                          );
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="revenue"
                        stroke="#FF9900"
                        strokeWidth={2.5}
                        dot={false}
                        activeDot={{ r: 4, fill: "#FF9900" }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* ── Orders & Units Bar Chart ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card className="bg-background/50 border-border/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <ShoppingCart className="w-4 h-4 text-orange-500" />
                    Daily Orders
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-40">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData} margin={{ top: 2, right: 2, left: 0, bottom: 0 }}>
                        <XAxis
                          dataKey="date"
                          tickFormatter={(v) => format(parseISO(v), "MMM d")}
                          axisLine={false}
                          tickLine={false}
                          tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }}
                          interval={Math.ceil(chartData.length / 5)}
                        />
                        <YAxis
                          axisLine={false}
                          tickLine={false}
                          tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }}
                          width={28}
                          allowDecimals={false}
                        />
                        <Tooltip
                          content={({ active, payload, label }) => {
                            if (!active || !payload?.length) return null;
                            return (
                              <div className="bg-popover border border-border rounded-lg shadow-lg p-2 text-xs">
                                <p className="text-muted-foreground">{format(parseISO(label as string), "MMM d")}</p>
                                <p className="font-semibold">{payload[0].value} orders</p>
                              </div>
                            );
                          }}
                        />
                        <Bar dataKey="orders" fill="#FF9900" radius={[3, 3, 0, 0]} maxBarSize={20} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-background/50 border-border/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Package className="w-4 h-4 text-blue-500" />
                    Daily Units Ordered
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-40">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData} margin={{ top: 2, right: 2, left: 0, bottom: 0 }}>
                        <XAxis
                          dataKey="date"
                          tickFormatter={(v) => format(parseISO(v), "MMM d")}
                          axisLine={false}
                          tickLine={false}
                          tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }}
                          interval={Math.ceil(chartData.length / 5)}
                        />
                        <YAxis
                          axisLine={false}
                          tickLine={false}
                          tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }}
                          width={28}
                          allowDecimals={false}
                        />
                        <Tooltip
                          content={({ active, payload, label }) => {
                            if (!active || !payload?.length) return null;
                            return (
                              <div className="bg-popover border border-border rounded-lg shadow-lg p-2 text-xs">
                                <p className="text-muted-foreground">{format(parseISO(label as string), "MMM d")}</p>
                                <p className="font-semibold">{payload[0].value} units</p>
                              </div>
                            );
                          }}
                        />
                        <Bar dataKey="units" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} maxBarSize={20} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* ── Page Views Chart ── */}
            {(current?.pageViews ?? 0) > 0 && (
              <Card className="bg-background/50 border-border/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Eye className="w-4 h-4 text-sky-500" />
                    Page Views Over Time
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-40">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData} margin={{ top: 2, right: 4, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                        <XAxis
                          dataKey="date"
                          tickFormatter={(v) => format(parseISO(v), "MMM d")}
                          axisLine={false}
                          tickLine={false}
                          tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }}
                          interval={Math.ceil(chartData.length / 5)}
                        />
                        <YAxis
                          tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}
                          axisLine={false}
                          tickLine={false}
                          tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }}
                          width={36}
                        />
                        <Tooltip
                          content={({ active, payload, label }) => {
                            if (!active || !payload?.length) return null;
                            return (
                              <div className="bg-popover border border-border rounded-lg shadow-lg p-2 text-xs">
                                <p className="text-muted-foreground">{format(parseISO(label as string), "MMM d")}</p>
                                <p className="font-semibold">{(payload[0].value as number).toLocaleString()} views</p>
                              </div>
                            );
                          }}
                        />
                        <Line
                          type="monotone"
                          dataKey="pageViews"
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
            )}

            {/* ── Footer ── */}
            <p className="text-xs text-muted-foreground text-right">
              Trend indicators compare first half vs second half of selected period
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
