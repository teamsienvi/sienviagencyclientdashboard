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
    return `No activity or reach was recorded during the ${periodLabel} period.`;
  }

  // Identify top channel by current volume
  const topChannel = [...channelBreakdown].sort((a, b) => b.currentViews - a.currentViews)[0];
  const topChannelName = topChannel ? topChannel.label : "traffic channels";

  const viewsDeltaText = views.relativeDelta != null 
    ? `${formatRelativeDelta(views.relativeDelta)} ${isWeekly ? "week over week" : "period over period"}`
    : `by ${formatNum(views.absoluteDelta)} views`;

  const viewsDirectionWord = (views.absoluteDelta || 0) >= 0 ? "increased" : "decreased";

  // ER WoW direction
  const erDeltaText = engagementRate.percentagePointDelta != null
    ? `${formatPercentagePointDelta(engagementRate.percentagePointDelta)}`
    : `${engagementRate.currentValue.toFixed(1)}%`;

  // Net Followers WoW direction (if available)
  const hasFollowers = netFollowers.isAvailable && netFollowers.currentValue !== null && netFollowers.currentValue !== undefined;
  const followerDeltaText = hasFollowers
    ? (netFollowers.absoluteDelta !== 0
        ? `${netFollowers.absoluteDelta > 0 ? "+" : ""}${formatNum(netFollowers.absoluteDelta)} net followers`
        : "0 net follower change")
    : null;

  // Check top content driver if available and published in current period
  const topPost = topDriverPosts.length > 0 ? topDriverPosts[0] : null;

  let postMention = "";
  if (topPost && topPost.contributionPct >= 20 && topPost.views > 0) {
    postMention = `, driven significantly by "${topPost.title}" on ${topPost.platform} (${formatNum(topPost.views)} reach)`;
  }

  if (followerDeltaText) {
    return `Reach ${viewsDirectionWord} ${viewsDeltaText}, led by ${topChannelName}${postMention}. Engagement rate changed by ${erDeltaText}, while audience changed by ${followerDeltaText}.`;
  }

  return `Traffic & reach ${viewsDirectionWord} ${viewsDeltaText}, led by ${topChannelName}${postMention}. Engagement rate changed by ${erDeltaText} across active channels.`;
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
  channelBreakdown: ChannelDelta[],
  options?: { isWebsite?: boolean; isHairtamin?: boolean }
): RecommendationItem[] => {
  const recs: RecommendationItem[] = [];

  const topPost = drivers.topDriverPosts[0];
  const isWebsite =
    Boolean(options?.isWebsite || options?.isHairtamin) ||
    views.label?.toLowerCase().includes("session") ||
    drivers.topDriverPosts.some(
      (p) =>
        p.platform?.toLowerCase() === "website" ||
        p.platform?.toLowerCase().includes("search") ||
        p.platform?.toLowerCase().includes("google")
    ) ||
    (!netFollowers.isAvailable && views.currentValue > 100);

  // Rule 1: Restore posting consistency (social) OR audit traffic acquisition channels (web)
  if (isWebsite) {
    if (views.absoluteDelta < 0) {
      recs.push({
        id: "audit_traffic_sources",
        title: "Optimize Traffic Acquisition & Funnel Inflow",
        reasoning: `Site sessions dropped by ${formatNum(Math.abs(views.absoluteDelta))} (${formatRelativeDelta(views.relativeDelta)}) week over week. Re-evaluating paid campaign performance, email flow triggers, and search rankings will help recover session momentum.`,
        action: "Review acquisition channels with negative delta and reallocate marketing efforts toward high-converting traffic sources.",
        type: "restore_consistency",
        severity: "high",
      });
    }
  } else {
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
  }

  // Rule 2: Repeat proven content format (social) OR optimize product CRO / search rankings (web)
  if (topPost && topPost.contributionPct >= 20) {
    if (isWebsite) {
      const isSearch = topPost.platform?.toLowerCase().includes("search") || topPost.platform?.toLowerCase().includes("gsc");
      if (isSearch) {
        recs.push({
          id: "optimize_search_ranking",
          title: "Defend & Expand Top Search Query Ranking",
          reasoning: `Top search driver "${topPost.title}" generated ${formatNum(topPost.views)} search clicks (${topPost.contributionPct}% of organic traffic) with a ${topPost.engagementRate.toFixed(1)}% CTR.`,
          action: "Expand on-page keyword depth, optimize product schema markup, and build internal links to keep ranking positions strong.",
          type: "improve_conversion",
          severity: "high",
        });
      } else {
        recs.push({
          id: "optimize_product_cro",
          title: "Scale Conversion Rate & Bundles on Top Product Page",
          reasoning: `Top landing page "${topPost.title}" captured ${formatNum(topPost.views)} visits (${topPost.contributionPct}% of total site traffic) with a ${topPost.engagementRate.toFixed(1)}% engagement rate.`,
          action: "Optimize product page conversion flow, test bundle discounts/upsells, and showcase verified customer reviews above the fold.",
          type: "improve_conversion",
          severity: "high",
        });
      }
    } else {
      recs.push({
        id: "repeat_format",
        title: `Double Down on ${topPost.platform} Content Format`,
        reasoning: `Top post "${topPost.title}" generated ${formatNum(topPost.views)} views (${topPost.contributionPct}% of total reach) with a ${topPost.engagementRate.toFixed(1)}% ER.`,
        action: `Create 2–3 derivative posts matching the style, topic, and visual format of this high-performing post.`,
        type: "repeat_format",
        severity: "high",
      });
    }
  }

  // Rule 3: Improve follower conversion (for social) or CRO conversion (for web)
  if (isWebsite) {
    if (engagements.currentValue > 50 && views.currentValue > 100) {
      recs.push({
        id: "optimize_web_conversion",
        title: "Optimize Landing Page Conversion & Checkout Funnel",
        reasoning: `Your site recorded ${formatNum(views.currentValue)} visits and ${formatNum(engagements.currentValue)} engaged sessions. Strong high-intent traffic presents a prime opportunity for CRO improvements.`,
        action: "A/B test clear value props, prominent free shipping thresholds, and friction-free 1-click checkout options.",
        type: "improve_conversion",
        severity: "medium",
      });
    }
  } else {
    if (engagements.currentValue > 50 && netFollowers.isAvailable && netFollowers.currentValue !== null && netFollowers.currentValue <= 2) {
      recs.push({
        id: "improve_conversion",
        title: "Optimize Follower Conversion (Calls-to-Action)",
        reasoning: `Your content generated ${formatNum(engagements.currentValue)} interactions, but net follower gain was ${netFollowers.currentValue}. Audience engagement is strong, but conversion into followers is lagging.`,
        action: "Add explicit follow prompts in post captions and pinned comments (e.g. 'Follow for daily insights').",
        type: "improve_conversion",
        severity: "medium",
      });
    }
  }

  // Rule 4: Scale Inbound Traffic (web) OR Scale Publishing (social) on high ER channel
  const highERLowReach = channelBreakdown.find(c => c.currentER >= 5.0 && c.contributionPct < 15 && c.currentViews > 0);
  if (highERLowReach && recs.length < 3) {
    if (isWebsite) {
      recs.push({
        id: "scale_traffic_channel",
        title: `Scale Inbound Traffic from ${highERLowReach.label}`,
        reasoning: `${highERLowReach.label} delivered a strong ${highERLowReach.currentER.toFixed(1)}% session engagement rate but currently represents only ${highERLowReach.contributionPct}% of total site visits.`,
        action: `Increase marketing focus and ad/email campaigns on ${highERLowReach.label} to drive more high-intent visitors to the site.`,
        type: "test_channel",
        severity: "medium",
      });
    } else {
      recs.push({
        id: "test_channel",
        title: `Scale Publishing on ${highERLowReach.label}`,
        reasoning: `${highERLowReach.label} achieved a strong ${highERLowReach.currentER.toFixed(1)}% engagement rate but represents only ${highERLowReach.contributionPct}% of total reach.`,
        action: `Increase publishing frequency on ${highERLowReach.label} to unlock additional audience growth.`,
        type: "test_channel",
        severity: "medium",
      });
    }
  }

  // Fallback default recommendation if fewer than 2 triggered
  if (recs.length === 0) {
    if (isWebsite) {
      recs.push({
        id: "general_optimization",
        title: "Maintain Multi-Channel Traffic Mix & Site CRO",
        reasoning: `Site traffic and session engagement are steady across acquisition channels. Continue optimizing top landing pages and monitoring bounce rate trends.`,
        action: "Review top product landing pages weekly and iterate on merchandising, product bundles, and page speed.",
        type: "repeat_format",
        severity: "low",
      });
    } else {
      recs.push({
        id: "general_optimization",
        title: "Maintain Cross-Channel Balance",
        reasoning: `Performance is steady across channels. Continue monitoring channel contribution and engagement trends.`,
        action: "Review top content drivers weekly and iterate on top-performing themes.",
        type: "repeat_format",
        severity: "low",
      });
    }
  }

  return recs.slice(0, 3);
};
