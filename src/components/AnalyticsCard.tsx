import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, Eye, Clock, TrendingDown, Layers } from "lucide-react";
import type { AnalyticsData } from "@/hooks/useClientAnalytics";

interface AnalyticsCardProps {
  analytics: AnalyticsData | null;
  isLoading: boolean;
  error?: string | null;
}

const formatDuration = (seconds: number): string => {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);
  return `${minutes}m ${remainingSeconds}s`;
};

const formatNumber = (num: number): string => {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
};

export const AnalyticsCard = ({ analytics, isLoading, error }: AnalyticsCardProps) => {
  if (error) {
    return (
      <Card className="border-destructive/50">
        <CardContent className="pt-4">
          <p className="text-sm text-destructive">{error}</p>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Analytics</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="space-y-1">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-6 w-12" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (!analytics) {
    return (
      <Card className="border-muted">
        <CardContent className="pt-4">
          <p className="text-sm text-muted-foreground">No analytics configured</p>
        </CardContent>
      </Card>
    );
  }

  const metrics = [
    { label: "Visitors", value: formatNumber(analytics.visitors), icon: Users },
    { label: "Page Views", value: formatNumber(analytics.pageViews), icon: Eye },
    { label: "Avg Duration", value: formatDuration(analytics.avgDuration), icon: Clock },
    { label: "Bounce Rate", value: `${analytics.bounceRate.toFixed(1)}%`, icon: TrendingDown },
    { label: "Pages/Visit", value: analytics.pagesPerVisit.toFixed(1), icon: Layers },
  ];

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">Analytics</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-3">
        {metrics.map((metric) => (
          <div key={metric.label} className="flex items-center gap-2">
            <metric.icon className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">{metric.label}</p>
              <p className="text-sm font-semibold">{metric.value}</p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};
