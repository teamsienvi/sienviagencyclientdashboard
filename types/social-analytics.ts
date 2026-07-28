export type DateRangePreset = "7d" | "14d" | "30d" | "60d" | "90d" | "365d" | "custom";

export type ComparisonMode = "wow_split" | "preceding_period";

export type PlatformDataStatus = "connected" | "delayed" | "disconnected" | "unavailable";

export type MetricStatus = "normal" | "zero_activity" | "unavailable" | "delayed" | "disconnected";

export interface PeriodMeta {
  start: Date;
  end: Date;
  startStr: string;
  endStr: string;
  elapsedDays: number;
  isComplete: boolean;
  label: string;
}

export interface MetricComparison {
  key: string;
  label: string;
  currentValue: number;
  previousValue: number;
  absoluteDelta: number;
  relativeDelta: number | null; // e.g. +25.4%
  percentagePointDelta: number | null; // e.g. +1.2 pp for ER
  isAvailable: boolean;
  status: MetricStatus;
  denominatorLabel?: string;
}

export interface WeekdayPoint {
  weekdayIndex: number; // 0 = Mon, 6 = Sun
  weekdayShort: string; // "Mon", "Tue", ...
  currentDate: string; // "2026-07-20"
  previousDate: string; // "2026-07-13"
  currentViews: number;
  previousViews: number;
  currentEngagements: number;
  previousEngagements: number;
  topContentCurrent?: TopDriverPost | null;
  topContentPrevious?: TopDriverPost | null;
}

export interface ChannelDelta {
  platform: string;
  label: string;
  currentViews: number;
  previousViews: number;
  absoluteDelta: number;
  contributionPct: number; // Share of total views delta
  currentER: number;
  previousER: number;
  erDeltaPp: number;
  currentFollowers: number;
  netFollowers: number;
  postsPublished: number;
  dataStatus: PlatformDataStatus;
}

export interface ChannelSharePoint {
  platform: string;
  label: string;
  currentSharePct: number;
  previousSharePct: number;
  shareDeltaPp: number;
  color: string;
}

export interface TopDriverPost {
  id: string;
  date: string;
  platform: string;
  title: string;
  url?: string;
  thumbnail?: string;
  views: number;
  engagements: number;
  engagementRate: number;
  contributionPct: number;
  isSpikeDriver?: boolean;
}

export interface RecommendationItem {
  id: string;
  title: string;
  reasoning: string;
  action: string;
  type: "repeat_format" | "improve_conversion" | "test_channel" | "restore_consistency";
  severity: "high" | "medium" | "low";
}

export interface DriversAnalysis {
  scaleLeader: string; // Channel with largest view volume
  efficiencyLeader: string; // Channel with highest engagement rate (min volume sample)
  topDriverPosts: TopDriverPost[];
  lowVolumeWarnings: string[];
}

export interface SocialAnalyticsComparison {
  timezone: string;
  generatedAt: string;
  dataCompleteness: "complete" | "partial" | "mixed";
  mode: ComparisonMode;
  currentPeriod: PeriodMeta;
  comparisonPeriod: PeriodMeta;
  metrics: {
    views: MetricComparison;
    engagements: MetricComparison;
    engagementRate: MetricComparison;
    netFollowerChange: MetricComparison;
    combinedFollowers: MetricComparison;
    postsPublished: MetricComparison;
    viewsPerPost: MetricComparison;
  };
  dailySeries: WeekdayPoint[];
  channelBreakdown: ChannelDelta[];
  channelShare: ChannelSharePoint[];
  drivers: DriversAnalysis;
  recommendations: RecommendationItem[];
  platformStatuses: Array<{ platform: string; label: string; status: PlatformDataStatus }>;
  executiveSummaryText: string;
}
