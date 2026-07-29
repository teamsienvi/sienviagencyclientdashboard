"use client";

import { useState } from "react";
import { Smartphone, RefreshCw, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useOxiSureStats } from "@/hooks/useOxiSureStats";
import { OxiSureKpiCards } from "./OxiSureKpiCards";
import { OxiSureOrdersChart } from "./OxiSureOrdersChart";
import { OxiSureSourceChart } from "./OxiSureSourceChart";
import { OxiSureFulfillmentChart } from "./OxiSureFulfillmentChart";
import { OxiSureOrderTable } from "./OxiSureOrderTable";

type TimeRange = "7d" | "30d" | "90d" | "all";

const RANGE_OPTIONS: { value: TimeRange; label: string }[] = [
  { value: "7d", label: "7D" },
  { value: "30d", label: "30D" },
  { value: "90d", label: "90D" },
  { value: "all", label: "All" },
];

/**
 * OxiSure Retention App Sales Analytics section.
 * Integrates into the OxiSure Tech client dashboard as a teal-themed zone.
 *
 * WHY a section component and not a page: The user requested sales data
 * to live under the existing OxiSure client dashboard, not a standalone page.
 */
export function OxiSureAppSalesSection() {
  const [range, setRange] = useState<TimeRange>("30d");
  const { data: stats, isLoading, isError, refetch } = useOxiSureStats(range);

  // ── Loading state ──
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <SectionHeader />
          <RangeSelector range={range} onChange={setRange} />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-72 rounded-xl" />
        <div className="grid md:grid-cols-2 gap-4">
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  // ── Error state ──
  if (isError || !stats) {
    return (
      <div className="space-y-6">
        <SectionHeader />
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <AlertCircle className="h-10 w-10 text-destructive/60 mb-3" />
          <p className="text-muted-foreground mb-4">
            Unable to load retention app sales data.
            <br />
            <span className="text-xs">Check that OXISURE_SUPABASE_SERVICE_KEY is configured.</span>
          </p>
          <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  // ── Loaded state ──
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <SectionHeader />
        <RangeSelector range={range} onChange={setRange} />
      </div>

      {/* KPI Cards */}
      <OxiSureKpiCards stats={stats} />

      {/* Orders Over Time */}
      <OxiSureOrdersChart data={stats.ordersOverTime} />

      {/* Source + Fulfillment side by side */}
      <div className="grid md:grid-cols-2 gap-4">
        <OxiSureSourceChart data={stats.ordersBySource} />
        <OxiSureFulfillmentChart data={stats.fulfillmentBreakdown} />
      </div>

      {/* Order Feed Table */}
      <OxiSureOrderTable orders={stats.recentOrders} />
    </div>
  );
}

/** Section header with icon and description. */
function SectionHeader() {
  return (
    <div className="flex items-center gap-3">
      <div className="p-2 rounded-lg bg-teal-100 dark:bg-teal-500/20">
        <Smartphone className="h-5 w-5 text-teal-600 dark:text-teal-400" />
      </div>
      <div>
        <h3 className="font-semibold text-xl text-teal-950 dark:text-teal-100 tracking-tight">
          Retention App Sales
        </h3>
        <p className="text-sm text-teal-600/80 dark:text-teal-300/70 mt-0.5">
          Orders, revenue, and fulfillment from the OxiSure mobile app
        </p>
      </div>
    </div>
  );
}

/** Time range toggle selector. */
function RangeSelector({
  range,
  onChange,
}: {
  range: TimeRange;
  onChange: (v: TimeRange) => void;
}) {
  return (
    <div className="inline-flex rounded-lg border border-teal-200 dark:border-teal-500/30 p-0.5 bg-teal-50/50 dark:bg-teal-500/5">
      {RANGE_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
            range === opt.value
              ? "bg-teal-500 text-white shadow-sm"
              : "text-teal-600 dark:text-teal-400 hover:bg-teal-100 dark:hover:bg-teal-500/10"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
