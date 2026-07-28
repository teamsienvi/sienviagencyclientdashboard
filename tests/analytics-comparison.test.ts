import assert from "node:assert";
import {
  createMetricComparison,
  computeSocialAnalyticsComparison,
} from "../lib/analytics/comparison.ts";

export function runAnalyticsComparisonTests() {
  console.log("▶ Running Analytics Comparison Tests...");

  // Test 1: Absolute and Relative Deltas
  const viewsComp = createMetricComparison("views", "Total Views", 1000, 800);
  assert.strictEqual(viewsComp.absoluteDelta, 200, "1000 - 800 = 200 absolute delta");
  assert.strictEqual(viewsComp.relativeDelta, 25, "800 -> 1000 = +25% relative delta");

  // Test 2: Percentage-Point Delta for Rate Metrics
  const erComp = createMetricComparison("er", "Engagement Rate", 4.2, 3.0, true);
  assert.strictEqual(erComp.percentagePointDelta, 1.2, "4.2% - 3.0% = +1.2 pp");
  assert.strictEqual(erComp.relativeDelta, 40, "3.0% -> 4.2% = +40% relative increase");

  // Test 3: Zero Denominator Handling
  const zeroPrevComp = createMetricComparison("views", "Total Views", 500, 0);
  assert.strictEqual(zeroPrevComp.absoluteDelta, 500, "500 - 0 = 500 absolute delta");
  assert.strictEqual(zeroPrevComp.relativeDelta, 100, "Zero prev denominator relative delta must be 100%");

  // Test 4: Complete WoW System Computation
  const comparison = computeSocialAnalyticsComparison({
    clientId: "test-client-id",
    preset: "14d",
    timezone: "UTC",
    currentMetrics: { views: 748, engagements: 24, followersGained: 21, totalFollowers: 2789, postsPublished: 5 },
    previousMetrics: { views: 500, engagements: 15, followersGained: 10, totalFollowers: 2768, postsPublished: 4 },
    currentPlatformData: [
      { platform: "youtube", views: 325, engagements: 5, followers: 1030, followersGained: 20 },
      { platform: "facebook", views: 34, engagements: 2, followers: 144, followersGained: 1 },
      { platform: "tiktok", views: 389, engagements: 17, followers: 1527, followersGained: 0 },
    ],
    previousPlatformData: [
      { platform: "youtube", views: 200, engagements: 3, followers: 1010, followersGained: 5 },
      { platform: "facebook", views: 20, engagements: 1, followers: 143, followersGained: 0 },
      { platform: "tiktok", views: 280, engagements: 11, followers: 1527, followersGained: 5 },
    ],
  });

  assert.strictEqual(comparison.metrics.views.currentValue, 748);
  assert.strictEqual(comparison.metrics.views.previousValue, 500);
  assert.strictEqual(comparison.metrics.views.absoluteDelta, 248);
  assert.strictEqual(comparison.metrics.netFollowerChange.currentValue, 21);
  assert.strictEqual(comparison.channelBreakdown.length, 3);
  assert.ok(comparison.executiveSummaryText.includes("increased"));

  console.log("✔ Analytics Comparison Tests Passed!");
}
