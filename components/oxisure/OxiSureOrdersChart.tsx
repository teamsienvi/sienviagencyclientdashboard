"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { OxiDailyOrderPoint } from "@/types/oxisure";
import { format, parseISO } from "date-fns";

interface OxiSureOrdersChartProps {
  data: OxiDailyOrderPoint[];
}

/**
 * Custom tooltip for the area chart — shows date, count, and revenue.
 */
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;

  return (
    <div className="bg-card/95 backdrop-blur-md border border-border rounded-lg shadow-lg px-4 py-3 text-sm">
      <p className="font-medium text-foreground mb-1.5">
        {label ? format(parseISO(label), "MMM d, yyyy") : label}
      </p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <div
            className="h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: p.color }}
          />
          <span className="text-muted-foreground">
            {p.dataKey === "revenue"
              ? `Revenue: $${Number(p.value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
              : `Orders: ${p.value}`}
          </span>
        </div>
      ))}
    </div>
  );
}

/**
 * Area chart showing orders and revenue over time.
 * Dual Y-axis: left = order count, right = revenue.
 */
export function OxiSureOrdersChart({ data }: OxiSureOrdersChartProps) {
  if (!data.length) {
    return (
      <Card className="saas-card">
        <CardHeader>
          <CardTitle className="text-base">Orders Over Time</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-64 text-muted-foreground text-sm">
          No order data for this time range
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="saas-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Orders Over Time</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="oxiOrdersFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#14B8A6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#14B8A6" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="oxiRevenueFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366F1" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#6366F1" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="hsl(var(--border))"
                opacity={0.5}
              />
              <XAxis
                dataKey="date"
                tickFormatter={(v) => {
                  try {
                    return format(parseISO(v), "MMM d");
                  } catch {
                    return v;
                  }
                }}
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                yAxisId="left"
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `$${v}`}
              />
              <Tooltip content={<ChartTooltip />} />
              <Legend
                wrapperStyle={{ fontSize: 12 }}
                formatter={(value: string) =>
                  value === "count" ? "Orders" : "Revenue"
                }
              />
              <Area
                yAxisId="left"
                type="monotone"
                dataKey="count"
                stroke="#14B8A6"
                strokeWidth={2}
                fill="url(#oxiOrdersFill)"
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0 }}
              />
              <Area
                yAxisId="right"
                type="monotone"
                dataKey="revenue"
                stroke="#6366F1"
                strokeWidth={2}
                fill="url(#oxiRevenueFill)"
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
