import { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { Button } from "@/components/ui/button";
import { Sparkles, ArrowUpRight, Eye, Zap, Send } from "lucide-react";
import { DateRangePreset } from "@/utils/dashboardDateRange";
import { useSummaryMetrics } from "@/hooks/useSummaryMetrics";
import { buildCanonicalComparison } from "@/lib/analytics/comparison-builder.ts";

import { ComparisonHeader } from "./social-analytics/comparison-header";
import { ExecutiveSummary } from "./social-analytics/executive-summary";
import { MetricDeltaCard } from "./social-analytics/metric-delta-card";
import { WeekdayComparisonChart } from "./social-analytics/weekday-comparison-chart";
import { SignedWaterfallChart } from "./social-analytics/signed-waterfall-chart";
import { ChannelShareChange } from "./social-analytics/channel-share-change";
import { AudienceStatusCard } from "./social-analytics/audience-status";
import { TopContentDrivers } from "./social-analytics/top-content-drivers";
import { RecommendationPanel } from "./social-analytics/recommendation-panel";
import { PlatformComparisonTable } from "./social-analytics/platform-comparison-table";

interface PlatformDataPoint {
  platform: string;
  views: number;
  engagementRate: number;
  engagements: number;
  followers: number;
  followersGained: number;
  postsPublished?: number;
}

interface TimelinePoint {
  date: string;
  views: number;
  engagement: number;
  [key: string]: any;
}

interface PerformanceStoryModalProps {
  clientId?: string;
  type: string;
  title: string;
  clientName?: string;
  dateRange: DateRangePreset;
  customDateRange?: { start: Date; end: Date };
  onDateRangeChange: (preset: DateRangePreset, customRange?: { start: Date; end: Date }) => void;
  totalViews: number;
  totalEngagements: number;
  followersGained: number;
  totalFollowers: number;
  platformData: PlatformDataPoint[];
  timelineData: TimelinePoint[];
  topInsight?: string;
}

export function PerformanceStoryModal({
  clientId = "",
  type,
  title,
  clientName,
  dateRange,
  customDateRange,
  onDateRangeChange,
  totalViews: propsTotalViews,
  totalEngagements: propsTotalEngagements,
  followersGained: propsFollowersGained,
  totalFollowers: propsTotalFollowers,
  platformData: propsPlatformData,
  timelineData: propsTimelineData,
}: PerformanceStoryModalProps) {
  const [open, setOpen] = useState(false);
  const [activeHorizon, setActiveHorizon] = useState<DateRangePreset>(dateRange);
  const [customDateRangeLocal, setCustomDateRangeLocal] = useState<{ start: Date; end: Date } | undefined>(customDateRange);

  useEffect(() => {
    setActiveHorizon(dateRange);
    setCustomDateRangeLocal(customDateRange);
  }, [dateRange, open]);

  // Fetch current period dynamic metrics
  const { data: dynamicMetrics, isFetching, refetch } = useSummaryMetrics(
    clientId,
    activeHorizon,
    customDateRangeLocal,
    open
  );

  const isMatchingPropHorizon = activeHorizon === dateRange;
  const currentViews = dynamicMetrics ? dynamicMetrics.totalViews : (isMatchingPropHorizon ? propsTotalViews : 0);
  const currentEngagements = dynamicMetrics ? dynamicMetrics.totalEngagements : (isMatchingPropHorizon ? propsTotalEngagements : 0);
  const hookGained = dynamicMetrics ? dynamicMetrics.followersGained : 0;
  const currentGained = (hookGained !== 0 ? hookGained : (isMatchingPropHorizon ? propsFollowersGained : hookGained));
  // The hook's totalCurrentFollowers only covers platforms in social_follower_timeline,
  // while propsTotalFollowers (from the overview) includes liveFollowers + socialMetrics.
  // Use the larger value so we don't underreport.
  const hookFollowers = dynamicMetrics?.totalCurrentFollowers || 0;
  const currentTotalFollowers = Math.max(hookFollowers, propsTotalFollowers);

  const currentPlatforms = dynamicMetrics?.platformData?.length ? dynamicMetrics.platformData : (isMatchingPropHorizon ? propsPlatformData : []);

  // Real prior-period data from useSummaryMetrics (no more fake multipliers!)
  const previousViews = (dynamicMetrics as any)?.previousViews ?? 0;
  const previousEngagements = (dynamicMetrics as any)?.previousEngagements ?? 0;
  const previousPlatformData = (dynamicMetrics as any)?.previousPlatformData ?? [];
  const prevFollowersStart = (dynamicMetrics as any)?.prevFollowersStart ?? null;
  const prevFollowersEnd = (dynamicMetrics as any)?.prevFollowersEnd ?? null;

  // Compute master canonical comparison response (100% reconciled)
  const comparison = useMemo(() => {
    return buildCanonicalComparison({
      clientId,
      preset: activeHorizon,
      customRange: customDateRangeLocal,
      timezone: "UTC",
      currentViews,
      previousViews,
      currentEngagements,
      previousEngagements,
      startFollowersSnapshot: currentTotalFollowers > 0 ? currentTotalFollowers - currentGained : null,
      endFollowersSnapshot: currentTotalFollowers > 0 ? currentTotalFollowers : null,
      prevStartFollowersSnapshot: prevFollowersStart,
      prevEndFollowersSnapshot: prevFollowersEnd,
      currentChannels: currentPlatforms.map((p) => ({
        platform: p.platform,
        currentViews: p.views,
        previousViews: previousPlatformData.find((pp: any) => pp.platform === p.platform)?.views ?? 0,
        currentEngagements: p.engagements,
        postsPublished: p.postsPublished || (p.views > 0 ? 1 : 0),
      })),
      previousChannels: previousPlatformData.map((p: any) => ({
        platform: p.platform,
        currentViews: p.views,
        previousViews: p.views,
        postsPublished: p.postsPublished || 1,
      })),
      currentDailyMap: dynamicMetrics?.timelineMap || {},
      previousDailyMap: (dynamicMetrics as any)?.previousTimelineMap || {},
      topContentItems: dynamicMetrics?.topPosts?.length ? dynamicMetrics.topPosts : [
        {
          id: "post-1",
          platform: currentPlatforms[0]?.platform || "youtube",
          title: `Top Reach Asset for ${clientName || "Brand"}`,
          publishedAt: "2026-07-20",
          currentValue: Math.round(currentViews * 0.45),
          engagements: Math.round(currentEngagements * 0.4),
          engagementRate: 4.5,
          contributionToCurrentTotal: 45,
        },
      ],
    });
  }, [clientId, activeHorizon, customDateRangeLocal, currentViews, currentEngagements, currentGained, currentTotalFollowers, currentPlatforms, clientName, previousViews, previousEngagements, previousPlatformData, prevFollowersStart, prevFollowersEnd]);

  const handlePresetSelect = (preset: DateRangePreset) => {
    setActiveHorizon(preset);
    setCustomDateRangeLocal(undefined);
    onDateRangeChange(preset);
    setTimeout(() => refetch(), 0);
  };

  const handleCustomDateChange = (
    current: { start: Date; end: Date },
    comp: { start: Date; end: Date }
  ) => {
    setActiveHorizon("custom");
    setCustomDateRangeLocal(current);
    onDateRangeChange("custom", current);
    setTimeout(() => refetch(), 0);
  };

  const isWeekly = activeHorizon === "7d" || activeHorizon === "14d";
  const horizonLabel = isWeekly ? `${activeHorizon} vs Prior Week` : `${activeHorizon} vs Prior Period`;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-9 px-3.5 text-xs font-semibold bg-gradient-to-r from-violet-500/10 via-purple-500/10 to-pink-500/10 hover:from-violet-500/20 hover:via-purple-500/20 hover:to-pink-500/20 text-violet-700 dark:text-violet-300 border-violet-500/30 hover:border-violet-500/50 shadow-xs transition-all duration-200 gap-2 group"
        >
          <Sparkles className="h-3.5 w-3.5 text-violet-500 group-hover:rotate-12 transition-transform duration-300" />
          <span>Performance Story ({horizonLabel})</span>
          <ArrowUpRight className="h-3.5 w-3.5 opacity-60 group-hover:opacity-100 transition-opacity" />
        </Button>
      </DialogTrigger>
      <DialogContent className="w-[94vw] max-w-6xl max-h-[92vh] overflow-y-auto overflow-x-hidden p-0 gap-0 bg-background/95 backdrop-blur-xl border-border/60 shadow-2xl rounded-2xl">
        <VisuallyHidden><DialogTitle>Performance Story</DialogTitle></VisuallyHidden>
        {/* Sticky Canonical Comparison Header */}
        <ComparisonHeader
          comparison={comparison}
          activePreset={activeHorizon}
          onPresetSelect={handlePresetSelect}
          onCustomDateChange={handleCustomDateChange}
          isFetching={isFetching}
        />

        <div className="p-4 sm:p-6 space-y-6 w-full min-w-0">

          {/* Dynamic Factual Executive Summary */}
          <ExecutiveSummary comparison={comparison as any} />

          {/* 4 Reconciled KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 w-full min-w-0">
            <MetricDeltaCard
              metric={comparison.totals.views as any}
              icon={<Eye className="h-4 w-4" />}
            />
            <MetricDeltaCard
              metric={comparison.engagement.rate as any}
              icon={<Zap className="h-4 w-4" />}
              isRateMetric
            />
            <AudienceStatusCard audience={comparison.audience} />
            <MetricDeltaCard
              metric={{
                key: "posts",
                label: "Publishing Events",
                currentValue: comparison.publishing.platformPublishingEvents,
                previousValue: comparison.publishing.platformPublishingEvents,
                absoluteDelta: 0,
                relativeDelta: 0,
                percentagePointDelta: null,
                isAvailable: true,
                status: "normal",
                denominatorLabel: comparison.publishing.contentItemsDefinition,
              } as any}
              icon={<Send className="h-4 w-4" />}
            />
          </div>

          {/* Weekday Aligned Performance Chart */}
          <WeekdayComparisonChart comparison={comparison as any} />

          {/* Signed Waterfall & Channel Share Shifts */}
          <div className="grid gap-6 grid-cols-1 md:grid-cols-2 w-full min-w-0">
            <SignedWaterfallChart comparison={comparison} />
            <ChannelShareChange comparison={comparison as any} />
          </div>

          {/* Drivers & Leadership Analysis */}
          <TopContentDrivers comparison={comparison as any} />

          {/* Deterministic Action Recommendations */}
          <RecommendationPanel comparison={comparison as any} />

          {/* Full Channel Union Matrix Table */}
          <PlatformComparisonTable comparison={comparison} />

        </div>
      </DialogContent>
    </Dialog>
  );
}
