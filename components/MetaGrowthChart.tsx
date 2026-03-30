import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Users, Image as ImageIcon } from "lucide-react";
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { format, parseISO } from "date-fns";

interface TimelineDataPoint {
  dateTime: string;
  value: number;
}

interface MetaGrowthChartProps {
  followersTimeline: TimelineDataPoint[];
  currentFollowers: number | null;
  newFollowers: number | null;
  totalContent: number | null;
  platform: "instagram" | "facebook";
}

const MetaGrowthChart = ({
  followersTimeline,
  currentFollowers,
  newFollowers,
  totalContent,
  platform,
}: MetaGrowthChartProps) => {
  // Transform timeline data for the chart
  const chartData = followersTimeline.map((point) => {
    const date = parseISO(point.dateTime);
    return {
      date: format(date, "MMM d"),
      fullDate: point.dateTime,
      followers: point.value,
      // Placeholder for posts count per day (we'll need this from content data if available)
      posts: 0,
    };
  });

  // If no timeline data, don't render
  if (chartData.length === 0) {
    return null;
  }

  // Calculate min/max for Y axis with some padding
  const followerValues = chartData.map((d) => d.followers);
  const minFollowers = Math.min(...followerValues);
  const maxFollowers = Math.max(...followerValues);
  const yPadding = Math.max(1, Math.ceil((maxFollowers - minFollowers) * 0.1));
  const yMin = Math.max(0, minFollowers - yPadding);
  const yMax = maxFollowers + yPadding;

  // Platform-specific colors
  const platformColors = {
    instagram: {
      line: "hsl(var(--chart-1))",
      bar: "hsl(38, 92%, 50%)", // Orange/amber for posts
      gradient: "from-purple-500/10 to-pink-500/10",
      accent: "text-pink-500",
    },
    facebook: {
      line: "hsl(var(--chart-2))",
      bar: "hsl(38, 92%, 50%)", // Orange/amber for posts
      gradient: "from-blue-500/10 to-blue-600/10",
      accent: "text-blue-500",
    },
  };

  const colors = platformColors[platform];

  return (
    <Card className={`bg-gradient-to-r ${colors.gradient} border-0`}>
      <CardContent className="pt-4 pb-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-muted-foreground">Growth</h3>
          <div className="flex gap-2">
            {/* Followers Badge */}
            <Badge
              variant="secondary"
              className="bg-primary/20 text-primary border-0 px-3 py-1.5"
            >
              <span className="text-lg font-bold">
                {currentFollowers?.toLocaleString() ?? "—"}
              </span>
              {newFollowers != null && newFollowers !== 0 && (
                <span className={`ml-1 ${newFollowers > 0 ? "text-green-600" : "text-red-600"}`}>
                  {newFollowers > 0 ? (
                    <TrendingUp className="h-3 w-3 inline" />
                  ) : (
                    <TrendingDown className="h-3 w-3 inline" />
                  )}
                </span>
              )}
              <span className="text-xs ml-1 opacity-80">Followers</span>
            </Badge>
            {/* Total Content Badge */}
            <Badge
              variant="secondary"
              className="bg-amber-500/20 text-amber-700 dark:text-amber-400 border-0 px-3 py-1.5"
            >
              <span className="text-lg font-bold">{totalContent ?? "—"}</span>
              <span className="text-xs ml-1 opacity-80">Total content</span>
            </Badge>
          </div>
        </div>

        <div className="h-[140px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={chartData}
              margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
            >
              <defs>
                <linearGradient id={`lineGradient-${platform}`} x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor={colors.line} stopOpacity={0.8} />
                  <stop offset="100%" stopColor={colors.line} stopOpacity={1} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="hsl(var(--muted-foreground) / 0.1)"
              />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                axisLine={false}
                tickLine={false}
                dy={5}
              />
              <YAxis
                domain={[yMin, yMax]}
                tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                axisLine={false}
                tickLine={false}
                width={35}
                tickFormatter={(value) => value.toLocaleString()}
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className="bg-popover border border-border rounded-lg shadow-lg p-2 text-xs">
                        <p className="font-medium text-foreground mb-1">{label}</p>
                        <p className="text-muted-foreground">
                          <Users className="h-3 w-3 inline mr-1" />
                          Followers: {payload[0]?.value?.toLocaleString()}
                        </p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              {/* Followers Line */}
              <Line
                type="monotone"
                dataKey="followers"
                stroke={`url(#lineGradient-${platform})`}
                strokeWidth={2}
                dot={{
                  fill: colors.line,
                  strokeWidth: 0,
                  r: 3,
                }}
                activeDot={{
                  fill: colors.line,
                  strokeWidth: 2,
                  stroke: "hsl(var(--background))",
                  r: 5,
                }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};

export default MetaGrowthChart;
