/**
 * Top Performing Insights Utilities
 * 
 * Provides tier calculations, influence scoring, and ranking logic
 * for cross-platform content performance analysis.
 */

export interface TopInsightContent {
  id: string;
  post_url: string;
  platform: string;
  published_at: string;
  views: number;
  reach: number;
  likes: number;
  comments: number;
  shares: number;
  followers_at_post_time: number;
}

export interface RankedTopInsight extends TopInsightContent {
  engagement_percentage: number;
  reach_tier: string;
  engagement_tier: string;
  influence_score: number;
}

/**
 * Calculate Reach Tier based on reach value
 * Tier 1: < 1k
 * Tier 2: 1k–5k
 * Tier 3: 5k–20k
 * Tier 4: 20k–100k
 * Tier 5: > 100k
 */
export const calculateReachTier = (reach: number): string => {
  if (reach < 1000) return "Tier 1";
  if (reach < 5000) return "Tier 2";
  if (reach < 20000) return "Tier 3";
  if (reach < 100000) return "Tier 4";
  return "Tier 5";
};

/**
 * Get numeric tier value for reach (for influence calculation)
 */
export const getReachTierNumber = (reach: number): number => {
  if (reach < 1000) return 1;
  if (reach < 5000) return 2;
  if (reach < 20000) return 3;
  if (reach < 100000) return 4;
  return 5;
};

/**
 * Calculate Engagement Tier based on engagement percentage
 * Tier 1: ≥ 7%
 * Tier 2: 5–6.99%
 * Tier 3: 3–4.99%
 * Tier 4: 1–2.99%
 * Tier 5: < 1%
 */
export const calculateEngagementTier = (engagementPercent: number): string => {
  if (engagementPercent >= 7) return "Tier 1";
  if (engagementPercent >= 5) return "Tier 2";
  if (engagementPercent >= 3) return "Tier 3";
  if (engagementPercent >= 1) return "Tier 4";
  return "Tier 5";
};

/**
 * Get numeric tier value for engagement (for influence calculation)
 */
export const getEngagementTierNumber = (engagementPercent: number): number => {
  if (engagementPercent >= 7) return 1;
  if (engagementPercent >= 5) return 2;
  if (engagementPercent >= 3) return 3;
  if (engagementPercent >= 1) return 4;
  return 5;
};

/**
 * Calculate engagement percentage
 * Formula: (likes + comments + shares) / reach * 100
 */
export const calculateEngagementPercentage = (
  likes: number,
  comments: number,
  shares: number,
  reach: number
): number => {
  if (reach === 0) return 0;
  return ((likes + comments + shares) / reach) * 100;
};

/**
 * Calculate Influence Score (1-5)
 * - Start at 1
 * - +1 if Reach Tier ≥ 4 (meaning reach >= 20k)
 * - +1 if Engagement Tier ≤ 2 (meaning engagement >= 5%)
 * - +1 if Views ≥ platform weekly median
 * - Cap at 5
 */
export const calculateInfluenceScore = (
  reachTierNumber: number,
  engagementTierNumber: number,
  views: number,
  platformWeeklyMedianViews: number
): number => {
  let influence = 1;

  // +1 if Reach Tier ≥ 4 (higher tiers mean more reach)
  if (reachTierNumber >= 4) {
    influence += 1;
  }

  // +1 if Engagement Tier ≤ 2 (lower tier number means better engagement)
  if (engagementTierNumber <= 2) {
    influence += 1;
  }

  // +1 if Views ≥ platform weekly median
  if (views >= platformWeeklyMedianViews) {
    influence += 1;
  }

  // Cap at 5
  return Math.min(influence, 5);
};

/**
 * Calculate median views for a platform from content array
 */
export const calculateMedianViews = (contentViews: number[]): number => {
  if (contentViews.length === 0) return 0;
  
  const sorted = [...contentViews].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
};

/**
 * Rank and process top insights from raw content data
 * - Combine content from ALL platforms
 * - Rank by engagement_percentage DESC
 * - Use views as secondary sort
 * - Limit to top N (default: 10)
 */
export const rankTopInsights = (
  content: TopInsightContent[],
  limit: number = 10
): RankedTopInsight[] => {
  // Group content by platform to calculate median views
  const platformViews: Record<string, number[]> = {};
  content.forEach((c) => {
    if (!platformViews[c.platform]) {
      platformViews[c.platform] = [];
    }
    platformViews[c.platform].push(c.views);
  });

  // Calculate median views per platform
  const platformMedians: Record<string, number> = {};
  Object.entries(platformViews).forEach(([platform, views]) => {
    platformMedians[platform] = calculateMedianViews(views);
  });

  // Calculate metrics and tiers for each content item
  const rankedContent: RankedTopInsight[] = content.map((c) => {
    const engagement_percentage = calculateEngagementPercentage(
      c.likes,
      c.comments,
      c.shares,
      c.reach
    );
    
    const reachTierNumber = getReachTierNumber(c.reach);
    const engagementTierNumber = getEngagementTierNumber(engagement_percentage);
    
    const reach_tier = calculateReachTier(c.reach);
    const engagement_tier = calculateEngagementTier(engagement_percentage);
    
    const influence_score = calculateInfluenceScore(
      reachTierNumber,
      engagementTierNumber,
      c.views,
      platformMedians[c.platform] || 0
    );

    return {
      ...c,
      engagement_percentage,
      reach_tier,
      engagement_tier,
      influence_score,
    };
  });

  // Sort by engagement_percentage DESC, then views DESC
  rankedContent.sort((a, b) => {
    if (b.engagement_percentage !== a.engagement_percentage) {
      return b.engagement_percentage - a.engagement_percentage;
    }
    return b.views - a.views;
  });

  // Return top N
  return rankedContent.slice(0, limit);
};

/**
 * Tier tooltip definitions for UI display
 */
export const REACH_TIER_DEFINITIONS = [
  { tier: "Tier 1", range: "< 1k reach" },
  { tier: "Tier 2", range: "1k–5k reach" },
  { tier: "Tier 3", range: "5k–20k reach" },
  { tier: "Tier 4", range: "20k–100k reach" },
  { tier: "Tier 5", range: "> 100k reach" },
];

export const ENGAGEMENT_TIER_DEFINITIONS = [
  { tier: "Tier 1", range: "≥ 7%" },
  { tier: "Tier 2", range: "5–6.99%" },
  { tier: "Tier 3", range: "3–4.99%" },
  { tier: "Tier 4", range: "1–2.99%" },
  { tier: "Tier 5", range: "< 1%" },
];

/**
 * Get badge color based on tier (lower tier = better for engagement)
 */
export const getEngagementTierColor = (tier: string | null): string => {
  switch (tier) {
    case "Tier 1":
      return "bg-green-500";
    case "Tier 2":
      return "bg-emerald-500";
    case "Tier 3":
      return "bg-yellow-500";
    case "Tier 4":
      return "bg-orange-500";
    case "Tier 5":
      return "bg-red-500";
    default:
      return "bg-muted";
  }
};

/**
 * Get badge color based on reach tier (higher tier = better)
 */
export const getReachTierColor = (tier: string | null): string => {
  switch (tier) {
    case "Tier 5":
      return "bg-green-500";
    case "Tier 4":
      return "bg-emerald-500";
    case "Tier 3":
      return "bg-yellow-500";
    case "Tier 2":
      return "bg-orange-500";
    case "Tier 1":
      return "bg-red-500";
    default:
      return "bg-muted";
  }
};

/**
 * Get influence score display with stars or numeric
 */
export const getInfluenceDisplay = (score: number | null): string => {
  if (score === null || score === undefined) return "-";
  return "★".repeat(score) + "☆".repeat(5 - score);
};
