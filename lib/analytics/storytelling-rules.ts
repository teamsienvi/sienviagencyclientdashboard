import type {
  MetricComparison,
  ChannelDelta,
  TopDriverPost,
  RecommendationItem,
  DriversAnalysis,
} from "../../types/social-analytics.ts";
import { formatRelativeDelta, formatPercentagePointDelta, formatNum } from "./formatting.ts";

/**
 * Generates a deterministic factual executive summary based strictly on comparison metrics.
 * Mention a post as the driver ONLY when content-level data supports the statement.
 */
export const generateExecutiveSummaryText = (
  views: MetricComparison,
  engagementRate: MetricComparison,
  netFollowers: MetricComparison,
  channelBreakdown: ChannelDelta[],
  topDriverPosts: TopDriverPost[],
  periodLabel: string,
  isWeekly: boolean = false
): string => {
  if (!views.isAvailable || views.status === "unavailable") {
    return "Data is currently unavailable for this period. Please check connection status.";
  }

  if (views.currentValue === 0 && views.previousValue === 0) {
    return `No social activity or views were recorded during the ${periodLabel} period.`;
  }

  // Identify top channel by current volume
  const topChannel = [...channelBreakdown].sort((a, b) => b.currentViews - a.currentViews)[0];
  const topChannelName = topChannel ? topChannel.label : "social channels";

  const viewsDeltaText = views.relativeDelta != null 
    ? `${formatRelativeDelta(views.relativeDelta)} ${isWeekly ? "week over week" : "period over period"}`
    : `by ${formatNum(views.absoluteDelta)} views`;

  const viewsDirectionWord = (views.absoluteDelta || 0) >= 0 ? "increased" : "decreased";

  // ER WoW direction
  const erDeltaText = engagementRate.percentagePointDelta != null
    ? `${formatPercentagePointDelta(engagementRate.percentagePointDelta)}`
    : `${engagementRate.currentValue.toFixed(1)}%`;

  // Net Followers WoW direction
  const followerDeltaText = netFollowers.absoluteDelta !== 0
    ? `${netFollowers.absoluteDelta > 0 ? "+" : ""}${formatNum(netFollowers.absoluteDelta)}`
    : "0 net change";

  // Check top content driver if available and published in current period
  const topPost = topDriverPosts.length > 0 ? topDriverPosts[0] : null;

  let postMention = "";
  if (topPost && topPost.contributionPct >= 25 && topPost.views > 0) {
    postMention = `, driven significantly by "${topPost.title}" on ${topPost.platform} (${formatNum(topPost.views)} views)`;
  }

  return `Views ${viewsDirectionWord} ${viewsDeltaText}, led by ${topChannelName}${postMention}. Engagement rate changed by ${erDeltaText}, while net followers changed by ${followerDeltaText}.`;
};

/**
 * Analyzes drivers: Scale Leader vs Efficiency Leader & low-volume sample warnings.
 */
export const analyzeDrivers = (
  channelBreakdown: ChannelDelta[],
  topPosts: TopDriverPost[]
): DriversAnalysis => {
  const sortedByVolume = [...channelBreakdown].sort((a, b) => b.currentViews - a.currentViews);
  const scaleLeader = sortedByVolume[0]?.currentViews > 0 ? sortedByVolume[0].label : "None";

  // Efficiency leader requires at least 50 views to prevent low-sample skew
  const validForEfficiency = channelBreakdown.filter(c => c.currentViews >= 50);
  const sortedByER = [...validForEfficiency].sort((a, b) => b.currentER - a.currentER);
  const efficiencyLeader = sortedByER[0] ? `${sortedByER[0].label} (${sortedByER[0].currentER.toFixed(1)}% ER)` : "None";

  const lowVolumeWarnings: string[] = [];
  channelBreakdown.forEach(c => {
    if (c.currentViews > 0 && c.currentViews < 50 && c.currentER > 10) {
      lowVolumeWarnings.push(`${c.label} shows a high ER (${c.currentER.toFixed(1)}%) based on a small sample (${c.currentViews} views).`);
    }
  });

  return {
    scaleLeader,
    efficiencyLeader,
    topDriverPosts: topPosts,
    lowVolumeWarnings,
  };
};

/**
 * Deterministic recommendation engine based on empirical metric rules.
 */
export const generateDeterministicRecommendations = (
  views: MetricComparison,
  engagements: MetricComparison,
  netFollowers: MetricComparison,
  postsPublished: MetricComparison,
  drivers: DriversAnalysis,
  channelBreakdown: ChannelDelta[]
): RecommendationItem[] => {
  const recs: RecommendationItem[] = [];

  // Rule 1: Restore posting consistency if post volume declined
  if (postsPublished.absoluteDelta < 0 && views.absoluteDelta < 0) {
    recs.push({
      id: "restore_consistency",
      title: "Restore Posting Consistency",
      reasoning: `Post volume dropped by ${Math.abs(postsPublished.absoluteDelta)} posts week over week, directly correlating with a ${formatRelativeDelta(views.relativeDelta)} decrease in views.`,
      action: "Maintain a steady publishing schedule to keep reach momentum stable across primary channels.",
      type: "restore_consistency",
      severity: "high",
    });
  }

  // Rule 2: Repeat proven content format if a top post drove major reach
  const topPost = drivers.topDriverPosts[0];
  if (topPost && topPost.contributionPct >= 20) {
    recs.push({
      id: "repeat_format",
      title: `Double Down on ${topPost.platform} Content Format`,
      reasoning: `Top post "${topPost.title}" generated ${formatNum(topPost.views)} views (${topPost.contributionPct}% of total reach) with a ${topPost.engagementRate.toFixed(1)}% ER.`,
      action: `Create 2–3 derivative posts matching the style, topic, and visual format of this high-performing post.`,
      type: "repeat_format",
      severity: "high",
    });
  }

  // Rule 3: Improve follower conversion if interactions are high but follower gain is low
  if (engagements.currentValue > 50 && netFollowers.currentValue <= 2) {
    recs.push({
      id: "improve_conversion",
      title: "Optimize Follower Conversion (Calls-to-Action)",
      reasoning: `Your content generated ${formatNum(engagements.currentValue)} interactions, but net follower gain was ${netFollowers.currentValue}. Audience engagement is strong, but conversion into followers is lagging.`,
      action: "Add explicit follow prompts in post captions and pinned comments (e.g. 'Follow for daily insights').",
      type: "improve_conversion",
      severity: "medium",
    });
  }

  // Rule 4: Test a high-efficiency channel if a channel has high ER but low reach share
  const highERLowReach = channelBreakdown.find(c => c.currentER >= 5.0 && c.contributionPct < 15 && c.currentViews > 0);
  if (highERLowReach && recs.length < 3) {
    recs.push({
      id: "test_channel",
      title: `Scale Publishing on ${highERLowReach.label}`,
      reasoning: `${highERLowReach.label} achieved a strong ${highERLowReach.currentER.toFixed(1)}% engagement rate but represents only ${highERLowReach.contributionPct}% of total reach.`,
      action: `Increase publishing frequency on ${highERLowReach.label} to unlock additional audience growth.`,
      type: "test_channel",
      severity: "medium",
    });
  }

  // Fallback default recommendation if fewer than 2 triggered
  if (recs.length === 0) {
    recs.push({
      id: "general_optimization",
      title: "Maintain Cross-Channel Balance",
      reasoning: `Performance is steady across channels. Continue monitoring channel contribution and engagement trends.`,
      action: "Review top content drivers weekly and iterate on top-performing themes.",
      type: "repeat_format",
      severity: "low",
    });
  }

  return recs.slice(0, 3);
};
