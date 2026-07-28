/**
 * Canonical Metric Definitions and Documentation Strings
 */

export const METRIC_DEFINITIONS = {
  views: {
    label: "Total Views",
    definition: "Normalized count of total video views and post impressions recorded across all connected social channels during the period.",
  },
  reach: {
    label: "Unique Reach",
    definition: "Estimated distinct audience members who viewed content at least once during the period. Distinct from total view impressions.",
  },
  engagementRate: {
    label: "Avg Engagement Rate",
    definition: "Percentage of total view impressions that resulted in audience interactions (Likes + Comments + Shares).",
    denominator: "Total Engagements (Likes + Comments + Shares) ÷ Total Views × 100",
  },
  netFollowers: {
    label: "Net Follower Change",
    definition: "Net change in account followers between boundary snapshots at the start and end of the period.",
  },
  combinedFollowers: {
    label: "Combined Followers",
    definition: "Sum of current follower/subscriber counts across all connected channels. Non-deduplicated cross-channel total.",
  },
  contentItems: {
    label: "Unique Content Items",
    definition: "Distinct content assets (videos, reels, carousels, posts) published during the period.",
  },
  publishingEvents: {
    label: "Platform Publishing Events",
    definition: "Total publishing events across channels. Single cross-posted asset published on 3 channels counts as 3 publishing events.",
  },
};
