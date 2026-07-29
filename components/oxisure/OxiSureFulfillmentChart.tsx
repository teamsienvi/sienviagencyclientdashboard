"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LabelList,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { OxiFulfillmentBreakdown } from "@/types/oxisure";

interface OxiSureFulfillmentChartProps {
  data: OxiFulfillmentBreakdown[];
}

const STATUS_COLORS: Record<string, string> = {
  unfulfilled: "#9CA3AF",
  shipped: "#3B82F6",
  in_transit: "#EAB308",
  out_for_delivery: "#A855F7",
  delivered: "#22C55E",
  unknown: "#CBD5E1",
};

const STATUS_LABELS: Record<string, string> = {
  unfulfilled: "Unfulfilled",
  shipped: "Shipped",
  in_transit: "In Transit",
  out_for_delivery: "Out for Delivery",
  delivered: "Delivered",
  unknown: "Unknown",
};

/**
 * Horizontal bar chart showing fulfillment status breakdown.
 * Color-coded bars with count labels.
 */
export function OxiSureFulfillmentChart({ data }: OxiSureFulfillmentChartProps) {
  const chartData = data
    .map((d) => ({
      name: STATUS_LABELS[d.status] ?? d.status,
      count: d.count,
      fill: STATUS_COLORS[d.status] ?? "#CBD5E1",
    }))
    .sort((a, b) => b.count - a.count);

  if (!chartData.length) {
    return (
      <Card className="saas-card">
        <CardHeader>
          <CardTitle className="text-base">Fulfillment Status</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-64 text-muted-foreground text-sm">
          No fulfillment data available
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="saas-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Fulfillment Status</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ top: 4, right: 40, left: 4, bottom: 4 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="hsl(var(--border))"
                opacity={0.5}
                horizontal={false}
              />
              <XAxis
                type="number"
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
              />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                tickLine={false}
                axisLine={false}
                width={120}
              />
              <Tooltip
                cursor={{ fill: "hsl(var(--accent))", opacity: 0.3 }}
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  fontSize: "13px",
                }}
                formatter={(value: number) => [`${value} orders`, "Count"]}
              />
              <Bar dataKey="count" radius={[0, 6, 6, 0]} barSize={24}>
                {chartData.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} />
                ))}
                <LabelList
                  dataKey="count"
                  position="right"
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    fill: "hsl(var(--muted-foreground))",
                  }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
