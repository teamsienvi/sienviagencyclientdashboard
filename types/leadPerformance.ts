export interface ClientColdPerformance {
  clientId: string;
  clientBrand: string;
  campaignsCount: number;
  activeCampaignsCount: number;
  emailsSent: number;
  uniqueOpens: number;
  openRate: number; // percentage, e.g. 39.65
  clicks: number;
  replies: number;
  bounces: number;
  bounceRate: number;
  targetPool: number;
  performanceTier: 'high' | 'solid' | 'needs_attention';
}

export interface SegmentPerformance {
  id: string;
  segmentName: string;
  category: string;
  originClient: string;
  campaignsCount: number;
  leadsTotal: number;
  sentCount: number;
  openRate: number;
  replyCount: number;
  replyRate: number;
  bounceCount: number;
  bounceRate: number;
  status: 'recommended' | 'quarantine' | 'testing';
  recommendationTitle: string;
  recommendationNote: string;
  targetClientCandidates: string[];
}

export interface RecentCampaignItem {
  id: string;
  smartleadId: string | null;
  name: string;
  clientBrand: string;
  clientId: string;
  status: string;
  isOngoing: boolean;
  createdDate: string;
  ageDays: number;
  ageWeeks: number;
  sent: number;
  uniqueOpens: number;
  openRate: number;
  clicks: number;
  replies: number;
  bounces: number;
  targetPool: number;
  segment: string;
  reusabilityTag: 'recommended' | 'quarantine' | 'testing';
}

export interface ExecutiveHighlight {
  id: string;
  title: string;
  client: string;
  type: 'success' | 'warning' | 'info';
  headline: string;
  metrics: string;
  body: string;
}

export interface ClientAudienceVerification {
  clientId: string;
  clientBrand: string;
  totalSourced: number;
  validCount: number;
  riskyCount: number;
  invalidCount: number;
  activeCount: number;
  inactiveCount: number;
  unsubCount: number;
  legitimacyRate: number;
  segments?: Array<{
    segmentName: string;
    total: number;
    valid: number;
    risky: number;
    invalid: number;
  }>;
}

export interface LeadPerformanceReportData {
  timeframe: string;
  timeframeLabel: string;
  maxWeeks: number | null;
  totals: {
    totalSent: number;
    totalOpens: number;
    avgOpenRate: number;
    totalClicks: number;
    totalReplies: number;
    totalBounces: number;
    avgBounceRate: number;
    totalTargetPool: number;
    totalCampaigns: number;
    activeCampaigns: number;
    completedCampaigns: number;
  };
  clientBreakdowns: ClientColdPerformance[];
  segmentMatrix: SegmentPerformance[];
  recentCampaigns: RecentCampaignItem[];
  executiveHighlights: ExecutiveHighlight[];
  audienceVerification: ClientAudienceVerification[];
  audienceVerificationTotals: {
    totalSourced: number;
    validCount: number;
    riskyCount: number;
    invalidCount: number;
    activeCount: number;
    inactiveCount: number;
    unsubCount: number;
    avgLegitimacyRate: number;
  };
  lastUpdated: string;
  error?: string;
}
