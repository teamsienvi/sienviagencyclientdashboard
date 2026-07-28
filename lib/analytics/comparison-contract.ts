import type { DateRangePreset } from "../../types/social-analytics.ts";

export type ComparisonType = "wow_split" | "preceding_period";

export type DataCoverageStatus = "complete" | "partial" | "mixed";

export type PlatformDataStatus = "connected" | "delayed" | "disconnected" | "unavailable";

export type AudienceStatus = "available" | "no_baseline" | "unsupported" | "partial" | "stale" | "sync_error";

export interface PeriodBoundaries {
  start: Date;
  end: Date;
  startStr: string;
  endStr: string;
  elapsedDays: number;
  isComplete: boolean;
  label: string;
}

export interface ReconciledMetric {
  key: string;
  label: string;
  currentValue: number | null;
  previousValue: number | null;
  absoluteDelta: number | null;
  relativeDelta: number | null; // e.g. +25.0%
  percentagePointDelta: number | null; // e.g. +1.2 pp
  isAvailable: boolean;
  metricDefinition: string;
  denominatorDefinition?: string;
  statusLabel?: string;
}

export interface ReconciledAudience {
  currentBoundaryCount: number | null;
  previousBoundaryCount: number | null;
  netChange: number | null;
  previousPeriodNetChange: number | null;
  status: AudienceStatus;
  statusLabel: string;
  coverageCount: number;
  missingPlatforms: string[];
}

export interface ReconciledPublishing {
  uniqueContentItems: number;
  platformPublishingEvents: number;
  platformNativePosts: number;
  contentItemsDefinition: string;
}

export interface ChannelUnionRow {
  platform: string;
  label: string;
  currentValue: number;
  previousValue: number;
  signedDelta: number;
  currentShare: number; // Percentage 0-100
  previousShare: number; // Percentage 0-100
  shareDeltaPp: number; // Percentage points
  contributionToNetDelta: number; // Percentage of total signed delta
  dataStatus: PlatformDataStatus;
  lastSyncedAt?: string;
  isOtherCategory?: boolean;
}

export interface DailySeriesPoint {
  date: string;
  compDate: string;
  label: string;
  weekday: string;
  currentViews: number;
  previousViews: number;
  currentEngagements: number;
  previousEngagements: number;
  isCurrentComplete: boolean;
  isPreviousComplete: boolean;
}

export interface TopDriverContent {
  id: string;
  platform: string;
  title: string;
  url?: string;
  publishedAt: string;
  currentValue: number;
  engagements: number;
  engagementRate: number;
  contributionToCurrentTotal: number; // Share of total current views
  incrementalContribution?: number | null;
  thumbnail?: string;
}

export interface GatedRecommendation {
  ruleId: string;
  title: string;
  requiredMetrics: string[];
  evidence: string;
  confidence: "high" | "medium" | "low";
  action: string;
  suppressedReason?: string | null;
  type: "repeat_format" | "improve_conversion" | "test_channel" | "restore_consistency";
}

export interface ReconciliationSummary {
  reconciled: boolean;
  currentTotalsMatch: boolean;
  previousTotalsMatch: boolean;
  deltaTotalsMatch: boolean;
  currentSharesSumTo100: boolean;
  previousSharesSumTo100: boolean;
  shareDeltasSumToZero: boolean;
  engagementFormulaMatches: boolean;
  discrepancies: string[];
}

export interface CanonicalComparisonResponse {
  meta: {
    reportingTimezone: string;
    generatedAt: string;
    currentPeriod: PeriodBoundaries;
    comparisonPeriod: PeriodBoundaries;
    comparisonType: ComparisonType;
    preset: DateRangePreset;
    rangeCompleteness: "complete" | "partial";
    dataCompleteness: DataCoverageStatus;
    calculationVersion: string;
    adaptiveGranularity: "daily" | "weekly" | "monthly";
  };
  totals: {
    views: ReconciledMetric;
    engagements: ReconciledMetric;
  };
  engagement: {
    rate: ReconciledMetric;
  };
  audience: ReconciledAudience;
  publishing: ReconciledPublishing;
  channels: ChannelUnionRow[];
  dailySeries: DailySeriesPoint[];
  topContent: TopDriverContent[];
  recommendations: GatedRecommendation[];
  reconciliation: ReconciliationSummary;
  executiveSummaryText: string;
}
