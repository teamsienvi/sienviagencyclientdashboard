import React, { useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Eye, Zap, Info } from "lucide-react";
import type { SocialAnalyticsComparison } from "@/types/social-analytics";
import { formatNum } from "@/lib/analytics/formatting.ts";

interface WeekdayComparisonChartProps {
  comparison: SocialAnalyticsComparison;
}

export const WeekdayComparisonChart: React.FC<WeekdayComparisonChartProps> = ({ comparison }: any) => {
  const [metricKey, setMetricKey] = useState<"views" | "engagements">("views");
  const dailySeries = comparison.dailySeries || [];
  const currentPeriod = comparison.meta?.currentPeriod || comparison.currentPeriod || { label: "Current Period" };
  const comparisonPeriod = comparison.meta?.comparisonPeriod || comparison.comparisonPeriod || { label: "Prior Period" };

  const chartData = dailySeries.map((d: any) => ({
    weekday: d.weekdayShort || d.weekday || "Day",
    currentValue: metricKey === "views" ? (d.currentViews ?? d.views ?? 0) : (d.currentEngagements ?? d.engagements ?? d.engagement ?? 0),
    previousValue: metricKey === "views" ? (d.previousViews ?? 0) : (d.previousEngagements ?? 0),
    currentDate: d.currentDate || d.date || "",
    previousDate: d.previousDate || d.compDate || "",
  }));

  const CustomWeekdayTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const curData = payload.find((p: any) => p.dataKey === "currentValue");
      const prevData = payload.find((p: any) => p.dataKey === "previousValue");
      const curVal = curData?.value || 0;
      const prevVal = prevData?.value || 0;
      const delta = curVal - prevVal;
      const prefix = delta > 0 ? "+" : "";

      return (
        <div className="bg-slate-900/95 border border-white/15 p-3.5 rounded-xl shadow-2xl text-white text-xs space-y-2 backdrop-blur-md">
          <div className="border-b border-white/10 pb-1 flex items-center justify-between gap-4">
            <span className="font-bold text-violet-300">{label} Comparison</span>
            <span className="text-[10px] text-slate-400 font-mono">Weekday Aligned</span>
          </div>
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-1.5 text-slate-200">
                <span className="w-2.5 h-2.5 rounded-full bg-violet-500 inline-block" />
                Current ({curData?.payload?.currentDate}):
              </span>
              <span className="font-bold text-white">{formatNum(curVal)}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-1.5 text-slate-400">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-400 inline-block" />
                Prior ({prevData?.payload?.previousDate}):
              </span>
              <span className="font-bold text-slate-300">{formatNum(prevVal)}</span>
            </div>
            <div className="border-t border-white/10 pt-1 flex items-center justify-between gap-4 font-semibold text-[11px]">
              <span className="text-slate-400">Net Delta:</span>
              <span className={delta > 0 ? "text-emerald-400" : delta < 0 ? "text-rose-400" : "text-slate-300"}>
                {prefix}{formatNum(delta)}
              </span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-card border border-border/60 rounded-2xl p-5 shadow-xs space-y-4">
      
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h4 className="text-base font-bold tracking-tight text-foreground flex items-center gap-2">
            <span>Weekday Performance Comparison (Mon–Sun)</span>
          </h4>
          <p className="text-xs text-muted-foreground">
            Current Period ({currentPeriod.label}) vs. Prior Period ({comparisonPeriod.label})
          </p>
        </div>

        {/* Metric Selector Buttons */}
        <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-xl border border-border/40 shrink-0">
          <button
            onClick={() => setMetricKey("views")}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              metricKey === "views"
                ? "bg-background text-foreground shadow-xs font-bold text-violet-600 dark:text-violet-400"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Eye className="h-3.5 w-3.5 text-violet-500" />
            <span>Views</span>
          </button>
          <button
            onClick={() => setMetricKey("engagements")}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              metricKey === "engagements"
                ? "bg-background text-foreground shadow-xs font-bold text-pink-600 dark:text-pink-400"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Zap className="h-3.5 w-3.5 text-pink-500" />
            <span>Engagements</span>
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 p-2.5 rounded-lg bg-violet-500/10 border border-violet-500/20 text-xs text-violet-700 dark:text-violet-300">
        <Info className="h-4 w-4 shrink-0 text-violet-500" />
        <span>
          Solid line represents the Current Period ({currentPeriod.label}). Dashed line represents the Prior Period ({comparisonPeriod.label}).
        </span>
      </div>

      {/* Weekday Straight-Line Comparison Chart */}
      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" opacity={0.08} />
            <XAxis dataKey="weekday" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "currentColor", opacity: 0.8 }} />
            <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "currentColor", opacity: 0.6 }} tickFormatter={(v) => formatNum(v)} />
            <RechartsTooltip content={<CustomWeekdayTooltip />} />
            <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "10px" }} />
            
            {/* Current Period: Solid Line */}
            <Line
              type="linear"
              dataKey="currentValue"
              name={`Current (${currentPeriod.label})`}
              stroke="#8b5cf6"
              strokeWidth={3}
              dot={{ r: 5, fill: "#8b5cf6" }}
              activeDot={{ r: 7 }}
            />
            {/* Previous Period: Dashed Line */}
            <Line
              type="linear"
              dataKey="previousValue"
              name={`Prior (${comparisonPeriod.label})`}
              stroke="#94a3b8"
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={{ r: 4, fill: "#94a3b8" }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

    </div>
  );
};
