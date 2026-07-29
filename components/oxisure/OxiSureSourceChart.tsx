"use client";

import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { OxiSourceBreakdown } from "@/types/oxisure";

interface OxiSureSourceChartProps {
  data: OxiSourceBreakdown[];
}

const SOURCE_COLORS: Record<string, string> = {
  amazon: "#FF9900",
  shopify: "#96BF48",
  retention_app: "#36C2B4",
};

const SOURCE_LABELS: Record<string, string> = {
  amazon: "Amazon",
  shopify: "Shopify",
  retention_app: "Retention App",
};

/**
 * Custom tooltip for the donut chart.
 */
function SourceTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const item = payload[0];

  return (
    <div className="bg-card/95 backdrop-blur-md border border-border rounded-lg shadow-lg px-4 py-3 text-sm">
      <div className="flex items-center gap-2 mb-1">
        <div
          className="h-2.5 w-2.5 rounded-full"
          style={{ backgroundColor: item.payload.fill }}
        />
        <span className="font-medium text-foreground">{item.name}</span>
      </div>
      <p className="text-muted-foreground">
        {item.payload.count} orders · ${Number(item.value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </p>
    </div>
  );
}

/**
 * Donut chart showing revenue breakdown by purchase source.
 * Amazon = orange, Shopify = green, Retention App = teal.
 */
export function OxiSureSourceChart({ data }: OxiSureSourceChartProps) {
  const totalRevenue = data.reduce((sum, d) => sum + d.revenue, 0);

  const chartData = data.map((d) => ({
    name: SOURCE_LABELS[d.source] ?? d.source,
    value: d.revenue,
    count: d.count,
    fill: SOURCE_COLORS[d.source] ?? "#94A3B8",
  }));

  if (!chartData.length) {
    return (
      <Card className="saas-card">
        <CardHeader>
          <CardTitle className="text-base">Revenue by Source</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-64 text-muted-foreground text-sm">
          No source data available
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="saas-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Revenue by Source</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64 relative">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={90}
                paddingAngle={3}
                strokeWidth={0}
              >
                {chartData.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip content={<SourceTooltip />} />
              <Legend
                wrapperStyle={{ fontSize: 12 }}
                formatter={(value: string) => (
                  <span className="text-muted-foreground">{value}</span>
                )}
              />
            </PieChart>
          </ResponsiveContainer>
          {/* Center label */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ marginBottom: 28 }}>
            <div className="text-center">
              <p className="text-xl font-bold text-foreground">
                ${totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </p>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                Total
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
