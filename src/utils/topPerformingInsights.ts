/**
 * Sienvi Social Scoring AI - Performance Index Framework
 * 
 * Calculates a Performance Index for each social media post using Sienvi's
 * official Flushed-Out Scoring Framework. Every post is scored across four
 * weighted dimensions—Reach, Engagement, Influence, and Conversion—and then
 * classified into one of five performance tiers.
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
  reach_score: number;
  engagement_tier: string;
  engagement_score: number;
  influence_score: number;
  conversion_score: number;
  total_score: number;
  performance_tier: string;
}

/**
 * Calculate Reach Score based on views (Visibility Power) - 40% weight
 * Tier 1: 1M+ views → 100 points
 * Tier 2: 500K–1M → 80 points
 * Tier 3: 100K–500K → 60 points
 * Tier 4: 50K–100K → 40 points
 * Tier 5: <50K → 20 points
 */
export const calculateReachScore = (views: number): { tier: string; score: number } => {
  if (views >= 1000000) return { tier: "Tier 1", score: 100 };
  if (views >= 500000) return { tier: "Tier 2", score: 80 };
  if (views >= 100000) return { tier: "Tier 3", score: 60 };
  if (views >= 50000) return { tier: "Tier 4", score: 40 };
  return { tier: "Tier 5", score: 20 };
};

/**
 * Calculate Engagement Score based on engagement % (Audience Depth) - 30% weight
 * Tier 1: 8%+ → 100 points
 * Tier 2: 5–8% → 80 points
 * Tier 3: 3–5% → 60 points
 * Tier 4: 1–3% → 40 points
 * Tier 5: <1% → 20 points
 */
export const calculateEngagementScore = (engagementPercent: number): { tier: string; score: number } => {
  if (engagementPercent >= 8) return { tier: "Tier 1", score: 100 };
  if (engagementPercent >= 5) return { tier: "Tier 2", score: 80 };
  if (engagementPercent >= 3) return { tier: "Tier 3", score: 60 };
  if (engagementPercent >= 1) return { tier: "Tier 4", score: 40 };
  return { tier: "Tier 5", score: 20 };
};

/**
 * Calculate Influence Score (Brand Positioning) - 20% weight
 * Automatically calculated based on reach and engagement performance
 * Level 1-5 converts to: 20, 40, 60, 80, 100 points
 */
export const calculateInfluenceScore = (
  reachScore: number,
  engagementScore: number,
  views: number,
  platformMedianViews: number
): number => {
  let level = 1;
  
  // +1 if reach score is high (60+)
  if (reachScore >= 60) level += 1;
  
  // +1 if engagement score is high (60+)
  if (engagementScore >= 60) level += 1;
  
  // +1 if views exceed platform median
  if (views >= platformMedianViews && platformMedianViews > 0) level += 1;
  
  // +1 if both reach and engagement are excellent (80+)
  if (reachScore >= 80 && engagementScore >= 80) level += 1;
  
  level = Math.min(level, 5);
  return level * 20; // Convert to points: 20, 40, 60, 80, 100
};

/**
 * Calculate Conversion Score (Business Impact) - 10% weight
 * Automatically estimated based on engagement signals
 * Level 1-5 converts to: 20, 40, 60, 80, 100 points
 */
export const calculateConversionScore = (
  engagementPercent: number,
  comments: number,
  shares: number
): number => {
  let level = 1;
  
  // Higher engagement suggests better conversion potential
  if (engagementPercent >= 3) level += 1;
  if (engagementPercent >= 6) level += 1;
  
  // Comments indicate deeper engagement
  if (comments >= 50) level += 1;
  
  // Shares indicate viral/conversion potential
  if (shares >= 20) level += 1;
  
  level = Math.min(level, 5);
  return level * 20; // Convert to points: 20, 40, 60, 80, 100
};

/**
 * Calculate Total Performance Score using Sienvi's weighted formula:
 * TotalScore = (ReachScore × 0.4) + (EngagementScore × 0.3) + (InfluenceScore × 0.2) + (ConversionScore × 0.1)
 */
export const calculateTotalScore = (
  reachScore: number,
  engagementScore: number,
  influenceScore: number,
  conversionScore: number
): number => {
  return Math.round(
    (reachScore * 0.4) + 
    (engagementScore * 0.3) + 
    (influenceScore * 0.2) + 
    (conversionScore * 0.1)
  );
};

/**
 * Determine Performance Tier based on total score:
 * Authority: 85–100
 * Influence: 70–84
 * Growth: 55–69
 * Presence: 40–54
 * Developing: <40
 */
export const getPerformanceTier = (totalScore: number): string => {
  if (totalScore >= 85) return "Authority";
  if (totalScore >= 70) return "Influence";
  if (totalScore >= 55) return "Growth";
  if (totalScore >= 40) return "Presence";
  return "Developing";
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
 * Rank and process top insights using Sienvi's Performance Index Framework
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

  // Calculate all scores for each content item
  const rankedContent: RankedTopInsight[] = content.map((c) => {
    const engagement_percentage = calculateEngagementPercentage(
      c.likes,
      c.comments,
      c.shares,
      c.reach
    );
    
    const reachResult = calculateReachScore(c.views);
    const engagementResult = calculateEngagementScore(engagement_percentage);
    
    const influence_score = calculateInfluenceScore(
      reachResult.score,
      engagementResult.score,
      c.views,
      platformMedians[c.platform] || 0
    );
    
    const conversion_score = calculateConversionScore(
      engagement_percentage,
      c.comments,
      c.shares
    );
    
    const total_score = calculateTotalScore(
      reachResult.score,
      engagementResult.score,
      influence_score,
      conversion_score
    );
    
    const performance_tier = getPerformanceTier(total_score);

    return {
      ...c,
      engagement_percentage,
      reach_tier: reachResult.tier,
      reach_score: reachResult.score,
      engagement_tier: engagementResult.tier,
      engagement_score: engagementResult.score,
      influence_score,
      conversion_score,
      total_score,
      performance_tier,
    };
  });

  // Sort by total_score DESC, then views DESC
  rankedContent.sort((a, b) => {
    if (b.total_score !== a.total_score) {
      return b.total_score - a.total_score;
    }
    return b.views - a.views;
  });

  // Return top N
  return rankedContent.slice(0, limit);
};

/**
 * Tier definitions for UI tooltips
 */
export const REACH_TIER_DEFINITIONS = [
  { tier: "Tier 1", range: "1M+ views", score: 100 },
  { tier: "Tier 2", range: "500K–1M views", score: 80 },
  { tier: "Tier 3", range: "100K–500K views", score: 60 },
  { tier: "Tier 4", range: "50K–100K views", score: 40 },
  { tier: "Tier 5", range: "<50K views", score: 20 },
];

export const ENGAGEMENT_TIER_DEFINITIONS = [
  { tier: "Tier 1", range: "8%+", score: 100 },
  { tier: "Tier 2", range: "5–8%", score: 80 },
  { tier: "Tier 3", range: "3–5%", score: 60 },
  { tier: "Tier 4", range: "1–3%", score: 40 },
  { tier: "Tier 5", range: "<1%", score: 20 },
];

export const PERFORMANCE_TIER_DEFINITIONS = [
  { tier: "Authority", range: "85–100", color: "bg-purple-600" },
  { tier: "Influence", range: "70–84", color: "bg-blue-600" },
  { tier: "Growth", range: "55–69", color: "bg-green-600" },
  { tier: "Presence", range: "40–54", color: "bg-yellow-600" },
  { tier: "Developing", range: "<40", color: "bg-gray-500" },
];

/**
 * Get badge color for performance tier
 */
export const getPerformanceTierColor = (tier: string): string => {
  switch (tier) {
    case "Authority":
      return "bg-purple-600";
    case "Influence":
      return "bg-blue-600";
    case "Growth":
      return "bg-green-600";
    case "Presence":
      return "bg-yellow-600";
    case "Developing":
      return "bg-gray-500";
    default:
      return "bg-muted";
  }
};

/**
 * Get badge color based on reach tier
 */
export const getReachTierColor = (tier: string | null): string => {
  switch (tier) {
    case "Tier 1":
      return "bg-purple-600";
    case "Tier 2":
      return "bg-blue-600";
    case "Tier 3":
      return "bg-green-600";
    case "Tier 4":
      return "bg-yellow-600";
    case "Tier 5":
      return "bg-gray-500";
    default:
      return "bg-muted";
  }
};

/**
 * Get badge color based on engagement tier
 */
export const getEngagementTierColor = (tier: string | null): string => {
  switch (tier) {
    case "Tier 1":
      return "bg-purple-600";
    case "Tier 2":
      return "bg-blue-600";
    case "Tier 3":
      return "bg-green-600";
    case "Tier 4":
      return "bg-yellow-600";
    case "Tier 5":
      return "bg-gray-500";
    default:
      return "bg-muted";
  }
};

/**
 * Format platform name for display
 */
export const formatPlatformName = (platform: string): string => {
  const names: Record<string, string> = {
    youtube: "YouTube",
    tiktok: "TikTok",
    instagram: "Instagram",
    facebook: "Facebook",
    x: "X",
    linkedin: "LinkedIn",
  };
  return names[platform.toLowerCase()] || platform;
};

/**
 * Get influence score display (legacy - kept for compatibility)
 */
export const getInfluenceDisplay = (score: number | null): string => {
  if (score === null || score === undefined) return "-";
  const level = score / 20; // Convert back to 1-5 scale
  return `${level}/5`;
};
