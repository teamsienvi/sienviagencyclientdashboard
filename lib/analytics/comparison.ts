import type {
  SocialAnalyticsComparison,
  MetricComparison,
  WeekdayPoint,
  ChannelDelta,
  ChannelSharePoint,
  TopDriverPost,
  PlatformDataStatus,
  DateRangePreset,
  ComparisonMode,
} from "../../types/social-analytics.ts";
import {
  calculateComparisonPeriods,
  buildAlignedWeekdayDates,
} from "./date-ranges.ts";
import {
  generateExecutiveSummaryText,
  analyzeDrivers,
  generateDeterministicRecommendations,
} from "./storytelling-rules.ts";

export interface ComputeComparisonParams {
  clientId: string;
  preset: DateRangePreset;
  customRange?: { start: Date; end: Date };
  forcedMode?: ComparisonMode;
  timezone?: string;
  // Raw inputs for current and previous period
  currentMetrics: {
    views: number;
    engagements: number;
    followersGained: number;
    totalFollowers: number;
    postsPublished: number;
  };
  previousMetrics: {
    views: number;
    engagements: number;
    followersGained: number;
    totalFollowers: number;
    postsPublished: number;
  };
  currentPlatformData: Array<{
    platform: string;
    views: number;
    engagements: number;
    followers: number;
    followersGained: number;
    postsPublished?: number;
  }>;
  previousPlatformData: Array<{
    platform: string;
    views: number;
    engagements: number;
    followers: number;
    followersGained: number;
    postsPublished?: number;
  }>;
  currentDailyMap?: Record<string, { views: number; engagements: number; [key: string]: any }>;
  previousDailyMap?: Record<string, { views: number; engagements: number; [key: string]: any }>;
  postsContent?: Array<{
    id: string;
    published_at: string;
    platform: string;
    title: string;
    thumbnail?: string;
    views: number;
    engagements: number;
  }>;
  platformStatuses?: Array<{ platform: string; status: PlatformDataStatus }>;
}

export const createMetricComparison = (
  key: string,
  label: string,
  cur: number,
  prev: number,
  isRate: boolean = false,
  denominatorLabel?: string
): MetricComparison => {
  const absoluteDelta = cur - prev;
  let relativeDelta: number | null = null;
  let percentagePointDelta: number | null = null;

  if (isRate) {
    percentagePointDelta = Number(absoluteDelta.toFixed(1));
    relativeDelta = prev > 0 ? Number(((absoluteDelta / prev) * 100).toFixed(1)) : null;
  } else {
    relativeDelta = prev > 0 ? Number(((absoluteDelta / prev) * 100).toFixed(1)) : (cur > 0 ? 100 : 0);
  }

  const isAvailable = true;
  const status = cur === 0 && prev === 0 ? "zero_activity" : "normal";

  return {
    key,
    label,
    currentValue: cur,
    previousValue: prev,
    absoluteDelta,
    relativeDelta,
    percentagePointDelta,
    isAvailable,
    status,
    denominatorLabel,
  };
};

export const computeSocialAnalyticsComparison = (
  params: ComputeComparisonParams
): SocialAnalyticsComparison => {
  const {
    preset,
    customRange,
    forcedMode,
    timezone = "UTC",
    currentMetrics,
    previousMetrics,
    currentPlatformData,
    previousPlatformData,
    currentDailyMap = {},
    previousDailyMap = {},
    postsContent = [],
    platformStatuses = [],
  } = params;

  // 1. Calculate Period Boundaries
  const { current, previous, mode } = calculateComparisonPeriods(
    preset,
    customRange,
    forcedMode
  );

  // 2. Metric Comparisons
  const curER = currentMetrics.views > 0 ? (currentMetrics.engagements / currentMetrics.views) * 100 : 0;
  const prevER = previousMetrics.views > 0 ? (previousMetrics.engagements / previousMetrics.views) * 100 : 0;

  const curVPP = currentMetrics.postsPublished > 0 ? currentMetrics.views / currentMetrics.postsPublished : 0;
  const prevVPP = previousMetrics.postsPublished > 0 ? previousMetrics.views / previousMetrics.postsPublished : 0;

  const views = createMetricComparison("views", "Total Views / Reach", currentMetrics.views, previousMetrics.views);
  const engagements = createMetricComparison("engagements", "Total Engagements", currentMetrics.engagements, previousMetrics.engagements);
  const engagementRate = createMetricComparison("engagementRate", "Avg Engagement Rate", Number(curER.toFixed(1)), Number(prevER.toFixed(1)), true, "Total Engagements ÷ Total Views");
  const netFollowerChange = createMetricComparison("netFollowerChange", "Net Follower Gain", currentMetrics.followersGained, previousMetrics.followersGained);
  const combinedFollowers = createMetricComparison("combinedFollowers", "Combined Followers", currentMetrics.totalFollowers, previousMetrics.totalFollowers);
  const postsPublished = createMetricComparison("postsPublished", "Posts Published", currentMetrics.postsPublished, previousMetrics.postsPublished);
  const viewsPerPost = createMetricComparison("viewsPerPost", "Views per Post", Math.round(curVPP), Math.round(prevVPP));

  // 3. Aligned Weekday Series (Mon-Sun)
  const weekdayDates = buildAlignedWeekdayDates(current, previous);
  const dailySeries: WeekdayPoint[] = weekdayDates.map((w) => {
    const curDayData = currentDailyMap[w.currentDate] || { views: 0, engagements: 0 };
    const prevDayData = previousDailyMap[w.previousDate] || { views: 0, engagements: 0 };

    return {
      weekdayIndex: w.weekdayIndex,
      weekdayShort: w.weekdayShort,
      currentDate: w.currentDate,
      previousDate: w.previousDate,
      currentViews: curDayData.views || 0,
      previousViews: prevDayData.views || 0,
      currentEngagements: curDayData.engagements || 0,
      previousEngagements: prevDayData.engagements || 0,
    };
  });

  // 4. Channel Breakdown & Contribution to Delta
  const allPlatforms = new Set([
    ...currentPlatformData.map((p) => p.platform.toLowerCase()),
    ...previousPlatformData.map((p) => p.platform.toLowerCase()),
  ]);

  const totalViewsDelta = Math.max(1, Math.abs(currentMetrics.views - previousMetrics.views));

  const channelBreakdown: ChannelDelta[] = Array.from(allPlatforms).map((platKey) => {
    const curP = currentPlatformData.find((p) => p.platform.toLowerCase() === platKey) || {
      platform: platKey,
      views: 0,
      engagements: 0,
      followers: 0,
      followersGained: 0,
      postsPublished: 0,
    };
    const prevP = previousPlatformData.find((p) => p.platform.toLowerCase() === platKey) || {
      platform: platKey,
      views: 0,
      engagements: 0,
      followers: 0,
      followersGained: 0,
      postsPublished: 0,
    };

    const absDelta = curP.views - prevP.views;
    const contribPct = Math.round((absDelta / totalViewsDelta) * 100);

    const cER = curP.views > 0 ? (curP.engagements / curP.views) * 100 : 0;
    const pER = prevP.views > 0 ? (prevP.engagements / prevP.views) * 100 : 0;
    const erDeltaPp = Number((cER - pER).toFixed(1));

    const platLabel = platKey.charAt(0).toUpperCase() + platKey.slice(1);
    const statusObj = platformStatuses.find((s) => s.platform.toLowerCase() === platKey);

    return {
      platform: platKey,
      label: platLabel,
      currentViews: curP.views,
      previousViews: prevP.views,
      absoluteDelta: absDelta,
      contributionPct: contribPct,
      currentER: Number(cER.toFixed(1)),
      previousER: Number(pER.toFixed(1)),
      erDeltaPp,
      currentFollowers: curP.followers,
      netFollowers: curP.followersGained,
      postsPublished: curP.postsPublished || 0,
      dataStatus: statusObj ? statusObj.status : "connected",
    };
  }).sort((a, b) => Math.abs(b.absoluteDelta) - Math.abs(a.absoluteDelta));

  // 5. Channel Share Changes
  const channelShareColors: Record<string, string> = {
    youtube: "#ef4444",
    tiktok: "#f43f5e",
    facebook: "#3b82f6",
    instagram: "#d946ef",
    x: "#64748b",
    linkedin: "#0a66c2",
  };

  const channelShare: ChannelSharePoint[] = channelBreakdown.map((c) => {
    const curShare = currentMetrics.views > 0 ? (c.currentViews / currentMetrics.views) * 100 : 0;
    const prevShare = previousMetrics.views > 0 ? (c.previousViews / previousMetrics.views) * 100 : 0;
    const shareDeltaPp = Number((curShare - prevShare).toFixed(1));

    return {
      platform: c.platform,
      label: c.label,
      currentSharePct: Number(curShare.toFixed(1)),
      previousSharePct: Number(prevShare.toFixed(1)),
      shareDeltaPp,
      color: channelShareColors[c.platform] || "#8b5cf6",
    };
  });

  // 6. Top Content Drivers
  const topContent: TopDriverPost[] = postsContent.map((p) => {
    const postER = p.views > 0 ? (p.engagements / p.views) * 100 : 0;
    const contrib = currentMetrics.views > 0 ? Math.round((p.views / currentMetrics.views) * 100) : 0;

    return {
      id: p.id,
      date: p.published_at ? p.published_at.split("T")[0] : "",
      platform: p.platform,
      title: p.title || "Untitled Post",
      thumbnail: p.thumbnail,
      views: p.views,
      engagements: p.engagements,
      engagementRate: Number(postER.toFixed(1)),
      contributionPct: contrib,
      isSpikeDriver: contrib >= 20,
    };
  }).sort((a, b) => b.views - a.views).slice(0, 5);

  // 7. Driver Analysis
  const drivers = analyzeDrivers(channelBreakdown, topContent);

  // 8. Deterministic Recommendations
  const recommendations = generateDeterministicRecommendations(
    views,
    engagements,
    netFollowerChange,
    postsPublished,
    drivers,
    channelBreakdown
  );

  // 9. Executive Summary Text
  const executiveSummaryText = generateExecutiveSummaryText(
    views,
    engagementRate,
    netFollowerChange,
    channelBreakdown,
    topContent,
    current.label
  );

  // 10. Platform Statuses
  const defaultStatuses: Array<{ platform: string; label: string; status: PlatformDataStatus }> = [
    { platform: "youtube", label: "YouTube", status: "connected" },
    { platform: "tiktok", label: "TikTok", status: "connected" },
    { platform: "facebook", label: "Facebook", status: "connected" },
    { platform: "instagram", label: "Instagram", status: "connected" },
  ];

  return {
    timezone,
    generatedAt: new Date().toISOString(),
    dataCompleteness: current.isComplete ? "complete" : "partial",
    mode,
    currentPeriod: current,
    comparisonPeriod: previous,
    metrics: {
      views,
      engagements,
      engagementRate,
      netFollowerChange,
      combinedFollowers,
      postsPublished,
      viewsPerPost,
    },
    dailySeries,
    channelBreakdown,
    channelShare,
    drivers,
    recommendations,
    platformStatuses: defaultStatuses,
    executiveSummaryText,
  };
};
