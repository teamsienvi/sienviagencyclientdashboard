import type { DateRangePreset } from "../../types/social-analytics.ts";
import type {
  CanonicalComparisonResponse,
  ReconciledMetric,
  DailySeriesPoint,
  TopDriverContent,
  PlatformDataStatus,
} from "./comparison-contract.ts";
import { resolveComparisonBoundaries, buildAlignedWeekdayDates } from "./date-boundaries.ts";
import { resolveAudienceSnapshots } from "./audience-snapshots.ts";
import { buildFullChannelUnion, type RawChannelInput } from "./channel-union.ts";
import { reconcileAnalyticsData } from "./reconciliation.ts";
import {
  generateExecutiveSummaryText,
  analyzeDrivers,
  generateDeterministicRecommendations,
} from "./storytelling-rules.ts";
import { METRIC_DEFINITIONS } from "./metric-definitions.ts";

export interface ComparisonBuilderInput {
  clientId: string;
  preset: DateRangePreset;
  customRange?: { start: Date; end: Date };
  timezone?: string;
  // Overall totals
  currentViews: number;
  previousViews: number;
  currentEngagements: number;
  previousEngagements: number;
  // Audience boundaries
  startFollowersSnapshot?: number | null;
  endFollowersSnapshot?: number | null;
  prevStartFollowersSnapshot?: number | null;
  prevEndFollowersSnapshot?: number | null;
  // Channels
  currentChannels: RawChannelInput[];
  previousChannels: RawChannelInput[];
  // Content & Daily
  dailySeriesPoints?: DailySeriesPoint[];
  currentDailyMap?: Record<string, { views?: number; engagements?: number; engagement?: number; [key: string]: any }>;
  previousDailyMap?: Record<string, { views?: number; engagements?: number; engagement?: number; [key: string]: any }>;
  topContentItems?: TopDriverContent[];
  platformStatuses?: Array<{ platform: string; label: string; status: PlatformDataStatus }>;
}

export const buildCanonicalComparison = (
  input: ComparisonBuilderInput
): CanonicalComparisonResponse => {
  const {
    clientId,
    preset,
    customRange,
    timezone = "UTC",
    currentViews,
    previousViews,
    currentEngagements,
    previousEngagements,
    startFollowersSnapshot = null,
    endFollowersSnapshot = null,
    prevStartFollowersSnapshot = null,
    prevEndFollowersSnapshot = null,
    currentChannels,
    previousChannels,
    dailySeriesPoints: inputDailySeriesPoints = [],
    currentDailyMap = {},
    previousDailyMap = {},
    topContentItems = [],
  } = input;

  // 1. Boundaries
  const { current, previous, comparisonType, adaptiveGranularity } = resolveComparisonBoundaries(preset, customRange);

  let dailySeriesPoints = inputDailySeriesPoints;
  if (!dailySeriesPoints || dailySeriesPoints.length === 0) {
    const dates = buildAlignedWeekdayDates(current, previous);
    dailySeriesPoints = dates.map((w) => {
      const curData = currentDailyMap[w.currentDate] || {};
      const prevData = previousDailyMap[w.previousDate] || {};
      return {
        date: w.currentDate,
        compDate: w.previousDate,
        label: w.currentLabel,
        weekday: w.weekdayShort,
        currentViews: curData.views || 0,
        previousViews: prevData.views || 0,
        currentEngagements: curData.engagements || curData.engagement || 0,
        previousEngagements: prevData.engagements || prevData.engagement || 0,
        isCurrentComplete: true,
        isPreviousComplete: true,
      };
    });
  }

  // 2. Metrics Totals
  const viewsDelta = currentViews - previousViews;
  const viewsRel = previousViews > 0 ? Number(((viewsDelta / previousViews) * 100).toFixed(1)) : (currentViews > 0 ? 100 : 0);

  const viewsMetric: ReconciledMetric = {
    key: "views",
    label: "Total Views",
    currentValue: currentViews,
    previousValue: previousViews,
    absoluteDelta: viewsDelta,
    relativeDelta: viewsRel,
    percentagePointDelta: null,
    isAvailable: true,
    metricDefinition: METRIC_DEFINITIONS.views.definition,
  };

  const engDelta = currentEngagements - previousEngagements;
  const engRel = previousEngagements > 0 ? Number(((engDelta / previousEngagements) * 100).toFixed(1)) : (currentEngagements > 0 ? 100 : 0);

  const engagementsMetric: ReconciledMetric = {
    key: "engagements",
    label: "Total Engagements",
    currentValue: currentEngagements,
    previousValue: previousEngagements,
    absoluteDelta: engDelta,
    relativeDelta: engRel,
    percentagePointDelta: null,
    isAvailable: true,
    metricDefinition: "Sum of Likes + Comments + Shares across channels.",
  };

  // 3. Engagement Rate Metric
  const curER = currentViews > 0 ? (currentEngagements / currentViews) * 100 : 0;
  const prevER = previousViews > 0 ? (previousEngagements / previousViews) * 100 : 0;
  const erPp = Number((curER - prevER).toFixed(1));
  const erRel = prevER > 0 ? Number((((curER - prevER) / prevER) * 100).toFixed(1)) : null;

  const erMetric: ReconciledMetric = {
    key: "engagementRate",
    label: "Avg Engagement Rate",
    currentValue: Number(curER.toFixed(1)),
    previousValue: Number(prevER.toFixed(1)),
    absoluteDelta: Number((curER - prevER).toFixed(1)),
    relativeDelta: erRel,
    percentagePointDelta: erPp,
    isAvailable: true,
    metricDefinition: METRIC_DEFINITIONS.engagementRate.definition,
    denominatorDefinition: METRIC_DEFINITIONS.engagementRate.denominator,
  };

  // 4. Audience Snapshots
  const audience = resolveAudienceSnapshots({
    startSnapshot: startFollowersSnapshot,
    endSnapshot: endFollowersSnapshot,
    prevStartSnapshot: prevStartFollowersSnapshot,
    prevEndSnapshot: prevEndFollowersSnapshot,
  });

  // 5. Channel Union & Share Shift
  const channels = buildFullChannelUnion(
    currentChannels,
    previousChannels,
    currentViews,
    previousViews
  );

  // 6. Publishing
  const contentItemsCount = topContentItems.length;
  const publishingEventsCount = currentChannels.reduce((sum, c) => sum + (c.postsPublished || (c.currentViews > 0 ? 1 : 0)), 0);

  const publishing = {
    uniqueContentItems: contentItemsCount,
    platformPublishingEvents: publishingEventsCount,
    platformNativePosts: publishingEventsCount,
    contentItemsDefinition: METRIC_DEFINITIONS.contentItems.definition,
  };

  // 7. Channel Share Points for charts
  const channelShare = channels.map((c) => ({
    platform: c.platform,
    label: c.label,
    currentSharePct: c.currentShare,
    previousSharePct: c.previousShare,
    shareDeltaPp: c.shareDeltaPp,
    color: "#8b5cf6",
  }));

  // 8. Drivers Analysis
  const channelDeltaInputs = channels.map((c) => ({
    platform: c.platform,
    label: c.label,
    currentViews: c.currentValue,
    previousViews: c.previousValue,
    absoluteDelta: c.signedDelta,
    contributionPct: c.contributionToNetDelta,
    currentER: c.currentValue > 0 ? 4.0 : 0,
    previousER: c.previousValue > 0 ? 4.0 : 0,
    erDeltaPp: 0,
    currentFollowers: 0,
    netFollowers: 0,
    postsPublished: 1,
    dataStatus: c.dataStatus,
  }));

  const driverPosts = topContentItems.map((p) => ({
    id: p.id,
    date: p.publishedAt,
    platform: p.platform,
    title: p.title,
    views: p.currentValue,
    engagements: p.engagements,
    engagementRate: p.engagementRate,
    contributionPct: p.contributionToCurrentTotal,
  }));

  const drivers = analyzeDrivers(channelDeltaInputs, driverPosts);

  // 9. Gated Recommendations
  const followersMetric: ReconciledMetric = {
    key: "followers",
    label: "Net Followers",
    currentValue: audience.netChange,
    previousValue: audience.previousPeriodNetChange,
    absoluteDelta: audience.netChange,
    relativeDelta: null,
    percentagePointDelta: null,
    isAvailable: audience.status === "available",
    metricDefinition: METRIC_DEFINITIONS.netFollowers.definition,
  };

  const postsMetric: ReconciledMetric = {
    key: "posts",
    label: "Publishing Events",
    currentValue: publishingEventsCount,
    previousValue: publishingEventsCount,
    absoluteDelta: 0,
    relativeDelta: 0,
    percentagePointDelta: null,
    isAvailable: true,
    metricDefinition: METRIC_DEFINITIONS.publishingEvents.definition,
  };

  const recommendations = generateDeterministicRecommendations(
    viewsMetric as any,
    engagementsMetric as any,
    followersMetric as any,
    postsMetric as any,
    drivers,
    channelDeltaInputs
  ).map((rec) => ({
    ruleId: rec.id,
    title: rec.title,
    requiredMetrics: ["views", "engagements"],
    evidence: rec.reasoning,
    confidence: "high" as const,
    action: rec.action,
    type: rec.type,
    suppressedReason: audience.status !== "available" && rec.type === "improve_conversion" ? "Suppressed due to missing follower baseline snapshot" : null,
  })).filter(r => !r.suppressedReason);

  // 10. Reconciliation
  const reconciliation = reconcileAnalyticsData(
    viewsMetric,
    channels,
    dailySeriesPoints,
    erMetric,
    audience
  );

  // 11. Narrative
  const executiveSummaryText = generateExecutiveSummaryText(
    viewsMetric as any,
    erMetric as any,
    followersMetric as any,
    channelDeltaInputs,
    driverPosts,
    current.label,
    comparisonType === "wow_split"
  );

  const defaultStatuses: Array<{ platform: string; label: string; status: PlatformDataStatus }> = [
    { platform: "youtube", label: "YouTube", status: "connected" },
    { platform: "tiktok", label: "TikTok", status: "connected" },
    { platform: "facebook", label: "Facebook", status: "connected" },
    { platform: "instagram", label: "Instagram", status: "connected" },
  ];

  return {
    meta: {
      reportingTimezone: timezone,
      generatedAt: new Date().toISOString(),
      currentPeriod: current,
      comparisonPeriod: previous,
      comparisonType,
      preset,
      rangeCompleteness: current.isComplete ? "complete" : "partial",
      dataCompleteness: "complete",
      calculationVersion: "v2.0_reconciled",
      adaptiveGranularity,
    },
    totals: {
      views: viewsMetric,
      engagements: engagementsMetric,
    },
    engagement: {
      rate: erMetric,
    },
    audience,
    publishing,
    channels,
    dailySeries: dailySeriesPoints,
    topContent: topContentItems,
    recommendations,
    reconciliation,
    executiveSummaryText,
  };
};
