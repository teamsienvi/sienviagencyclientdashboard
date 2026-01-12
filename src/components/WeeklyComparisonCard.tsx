import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  Users, 
  Eye, 
  Heart, 
  BarChart3, 
  FileText,
  Instagram,
  Facebook,
  Youtube,
  Twitter
} from "lucide-react";
import { WeeklyComparison } from "@/hooks/useWeeklyComparison";

interface WeeklyComparisonCardProps {
  comparison: WeeklyComparison;
  isLoading?: boolean;
}

const platformIcons: Record<string, React.ReactNode> = {
  instagram: <Instagram className="h-4 w-4" />,
  facebook: <Facebook className="h-4 w-4" />,
  youtube: <Youtube className="h-4 w-4" />,
  x: <Twitter className="h-4 w-4" />,
  tiktok: <span className="text-xs font-bold">TT</span>,
  linkedin: <span className="text-xs font-bold">in</span>,
};

const platformColors: Record<string, string> = {
  instagram: "bg-gradient-to-r from-purple-500 to-pink-500",
  facebook: "bg-blue-600",
  youtube: "bg-red-600",
  x: "bg-black",
  tiktok: "bg-black",
  linkedin: "bg-blue-700",
};

const formatNumber = (num: number | null): string => {
  if (num === null) return "—";
  if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
  if (num >= 1000) return (num / 1000).toFixed(1) + "K";
  return num.toLocaleString();
};

const formatPercent = (num: number | null): string => {
  if (num === null) return "—";
  return (num >= 0 ? "+" : "") + num.toFixed(1) + "%";
};

const formatDelta = (delta: number): string => {
  if (delta === 0) return "0";
  return (delta > 0 ? "+" : "") + formatNumber(delta);
};

interface MetricDisplayProps {
  label: string;
  icon: React.ReactNode;
  current: number | null;
  delta: number;
  percent: number | null;
}

const MetricDisplay = ({ label, icon, current, delta, percent }: MetricDisplayProps) => {
  const getTrendIcon = () => {
    if (delta > 0) return <TrendingUp className="h-3 w-3 text-green-500" />;
    if (delta < 0) return <TrendingDown className="h-3 w-3 text-red-500" />;
    return <Minus className="h-3 w-3 text-muted-foreground" />;
  };

  const getTrendColor = () => {
    if (delta > 0) return "text-green-500";
    if (delta < 0) return "text-red-500";
    return "text-muted-foreground";
  };

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <div className="font-semibold text-lg">{formatNumber(current)}</div>
      <div className={`flex items-center gap-1 text-xs ${getTrendColor()}`}>
        {getTrendIcon()}
        <span>{formatDelta(delta)}</span>
        {percent !== null && <span>({formatPercent(percent)})</span>}
      </div>
    </div>
  );
};

export const WeeklyComparisonCard = ({ comparison, isLoading }: WeeklyComparisonCardProps) => {
  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <Skeleton className="h-6 w-32" />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-6 w-20" />
                <Skeleton className="h-4 w-12" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const { platform, current, changes } = comparison;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <div className={`p-1.5 rounded text-white ${platformColors[platform] || "bg-gray-500"}`}>
            {platformIcons[platform] || platform[0].toUpperCase()}
          </div>
          <span className="capitalize">{platform}</span>
          <Badge variant="outline" className="ml-auto text-xs">
            Last 7 days
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <MetricDisplay
            label="Followers"
            icon={<Users className="h-3 w-3" />}
            current={current.followers}
            delta={changes.followers.delta}
            percent={changes.followers.percent}
          />
          <MetricDisplay
            label="Views"
            icon={<Eye className="h-3 w-3" />}
            current={current.totalViews}
            delta={changes.views.delta}
            percent={changes.views.percent}
          />
          <MetricDisplay
            label="Likes"
            icon={<Heart className="h-3 w-3" />}
            current={current.totalLikes}
            delta={changes.likes.delta}
            percent={changes.likes.percent}
          />
          <MetricDisplay
            label="Engagement"
            icon={<BarChart3 className="h-3 w-3" />}
            current={current.engagementRate !== null ? current.engagementRate : null}
            delta={changes.engagementRate.delta}
            percent={null}
          />
          <MetricDisplay
            label="Posts"
            icon={<FileText className="h-3 w-3" />}
            current={current.totalPosts}
            delta={changes.posts.delta}
            percent={changes.posts.percent}
          />
        </div>
      </CardContent>
    </Card>
  );
};

// Skeleton for loading state
export const WeeklyComparisonSkeleton = () => (
  <Card>
    <CardHeader className="pb-2">
      <Skeleton className="h-6 w-32" />
    </CardHeader>
    <CardContent>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-6 w-20" />
            <Skeleton className="h-4 w-12" />
          </div>
        ))}
      </div>
    </CardContent>
  </Card>
);
