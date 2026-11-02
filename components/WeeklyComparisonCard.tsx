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
  Twitter,
  HelpCircle,
  Info
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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

const formatDelta = (delta: number, isPercent = false): string => {
  if (delta === 0) return "0";
  if (isPercent) {
    return (delta > 0 ? "+" : "") + delta.toFixed(2) + "% pts";
  }
  return (delta > 0 ? "+" : "") + formatNumber(delta);
};

interface MetricDisplayProps {
  label: string;
  icon: React.ReactNode;
  current: number | null;
  delta: number;
  percent: number | null;
  tooltipText: string;
  isPercent?: boolean;
}

const MetricDisplay = ({ label, icon, current, delta, percent, tooltipText, isPercent }: MetricDisplayProps) => {
  const getTrendIcon = () => {
    if (delta > 0) return <TrendingUp className="h-3 w-3 text-emerald-400" />;
    if (delta < 0) return <TrendingDown className="h-3 w-3 text-red-400" />;
    return <Minus className="h-3 w-3 text-muted-foreground" />;
  };

  const getTrendColor = () => {
    if (delta > 0) return "text-emerald-400";
    if (delta < 0) return "text-red-400";
    return "text-muted-foreground";
  };

  const formattedCurrent = current === null 
    ? "—" 
    : isPercent 
      ? `${current.toFixed(2)}%` 
      : formatNumber(current);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex flex-col gap-1 p-2 rounded-lg hover:bg-muted/40 transition-colors cursor-help border border-transparent hover:border-border/40">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              {icon}
              <span className="font-medium">{label}</span>
            </div>
            <HelpCircle className="h-3 w-3 opacity-40 hover:opacity-100 transition-opacity" />
          </div>
          <div className="font-semibold text-lg tracking-tight">{formattedCurrent}</div>
          {!(label === "Followers" && delta < 0) && (
            <div className={`flex items-center gap-1 text-xs ${getTrendColor()}`}>
              {getTrendIcon()}
              <span>{formatDelta(delta, isPercent)}</span>
              {percent !== null && !isPercent && <span>({formatPercent(percent)})</span>}
            </div>
          )}
        </div>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[240px] text-xs p-2.5">
        <p className="font-semibold mb-1 text-foreground">{label}</p>
        <p className="text-muted-foreground leading-relaxed">{tooltipText}</p>
      </TooltipContent>
    </Tooltip>
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
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
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
    <TooltipProvider delayDuration={150}>
      <Card className="overflow-hidden border border-border/60">
        <CardHeader className="pb-2 bg-muted/10 border-b border-border/30">
          <CardTitle className="flex items-center gap-2 text-base">
            <div className={`p-1.5 rounded text-white ${platformColors[platform] || "bg-gray-500"}`}>
              {platformIcons[platform] || platform[0].toUpperCase()}
            </div>
            <span className="capitalize font-semibold">{platform}</span>
            <Badge variant="outline" className="ml-auto text-[11px] font-normal border-primary/30 text-primary">
              Last 7 Days vs Previous 7
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            <MetricDisplay
              label="Followers"
              icon={<Users className="h-3.5 w-3.5 text-blue-400" />}
              current={current.followers}
              delta={changes.followers.delta}
              percent={changes.followers.percent}
              tooltipText="Total subscribers/followers following your profile at period close. Measures overall brand reach and retained audience."
            />
            <MetricDisplay
              label="Views"
              icon={<Eye className="h-3.5 w-3.5 text-purple-400" />}
              current={current.totalViews}
              delta={changes.views.delta}
              percent={changes.views.percent}
              tooltipText="Total video views and content impressions on screens during the week. Measures algorithmic reach and discoverability."
            />
            <MetricDisplay
              label="Likes"
              icon={<Heart className="h-3.5 w-3.5 text-pink-400" />}
              current={current.totalLikes}
              delta={changes.likes.delta}
              percent={changes.likes.percent}
              tooltipText="Total positive reactions and likes received on content in the last 7 days. Reflects content resonance and audience affinity."
            />
            <MetricDisplay
              label="Engagement"
              icon={<BarChart3 className="h-3.5 w-3.5 text-emerald-400" />}
              current={current.engagementRate !== null ? current.engagementRate : null}
              delta={changes.engagementRate.delta}
              percent={null}
              isPercent={true}
              tooltipText="Engagement Rate: Percentage of viewers who actively interacted (liked, commented, shared, saved). Higher indicates an active, converting audience."
            />
            <MetricDisplay
              label="Posts"
              icon={<FileText className="h-3.5 w-3.5 text-amber-400" />}
              current={current.totalPosts}
              delta={changes.posts.delta}
              percent={changes.posts.percent}
              tooltipText="Number of new posts, videos, or reels published this week. Measures publishing consistency and campaign cadence."
            />
          </div>

          <div className="mt-3 pt-2.5 border-t border-border/30 flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Info className="h-3 w-3 shrink-0 text-primary/70" />
            <span>Hover over any metric to see its definition. Green indicates positive growth over the prior 7 days.</span>
          </div>
        </CardContent>
      </Card>
    </TooltipProvider>
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
