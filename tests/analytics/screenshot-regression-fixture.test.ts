import assert from "node:assert";
import { buildCanonicalComparison } from "../../lib/analytics/comparison-builder.ts";

export function runScreenshotRegressionFixtureTest() {
  console.log("▶ Running Observed Screenshot Regression Fixture Test...");

  // Fixture values from observed regression screenshot:
  // Overall Current: 2,332 | Overall Prior: 1,866 | Net Delta: +466
  // Visible Channels:
  // FB: Prior 941, Cur 1254 (+313)
  // TT: Prior 398, Cur 530 (+132)
  // YT: Prior 272, Cur 362 (+90)
  // IG: Prior 140, Cur 186 (+46)
  // Missing prior channel: Prior 115, Cur 0 (-115)

  const comparison = buildCanonicalComparison({
    clientId: "serenity-scrolls-id",
    preset: "30d",
    timezone: "America/New_York",
    currentViews: 2332,
    previousViews: 1866,
    currentEngagements: 93,
    previousEngagements: 75,
    currentChannels: [
      { platform: "facebook", currentViews: 1254, previousViews: 941 },
      { platform: "tiktok", currentViews: 530, previousViews: 398 },
      { platform: "youtube", currentViews: 362, previousViews: 272 },
      { platform: "instagram", currentViews: 186, previousViews: 140 },
    ],
    previousChannels: [
      { platform: "facebook", currentViews: 941, previousViews: 941 },
      { platform: "tiktok", currentViews: 398, previousViews: 398 },
      { platform: "youtube", currentViews: 272, previousViews: 272 },
      { platform: "instagram", currentViews: 140, previousViews: 140 },
      { platform: "x", currentViews: 115, previousViews: 115 }, // Prior-only platform
    ],
  });

  // 1. Check Overall Totals
  assert.strictEqual(comparison.totals.views.currentValue, 2332, "Current overall views must be 2332");
  assert.strictEqual(comparison.totals.views.previousValue, 1866, "Prior overall views must be 1866");
  assert.strictEqual(comparison.totals.views.absoluteDelta, 466, "Net delta must be +466");

  // 2. Check Full Channel Union preserves all 5 platforms (FB, TT, YT, IG, X/Other)
  assert.strictEqual(comparison.channels.length, 5, "Channel union must contain 5 platforms");

  const xChannel = comparison.channels.find(c => c.platform === "x" || c.platform === "other");
  assert.ok(xChannel, "Prior-only platform X/Other must be preserved in channel union");
  assert.strictEqual(xChannel.previousValue, 115, "Prior value for X/Other must be 115");
  assert.strictEqual(xChannel.signedDelta, -115, "Signed delta for X/Other must be -115");

  // 3. Verify Delta Reconciliation: +581 (positive channels) - 115 (x) = +466
  const positiveDeltasSum = comparison.channels
    .filter(c => c.signedDelta > 0)
    .reduce((sum, c) => sum + c.signedDelta, 0);
  assert.strictEqual(positiveDeltasSum, 581, "Positive deltas sum must be +581");

  const channelSumDelta = comparison.channels.reduce((sum, c) => sum + c.signedDelta, 0);
  assert.strictEqual(channelSumDelta, 466, "Channel deltas sum must equal overall delta +466");

  // 4. Verify Mathematical Invariants
  assert.strictEqual(comparison.reconciliation.reconciled, true, "Response MUST be marked 100% reconciled");
  assert.strictEqual(comparison.reconciliation.currentTotalsMatch, true, "Current totals must match");
  assert.strictEqual(comparison.reconciliation.previousTotalsMatch, true, "Previous totals must match");
  assert.strictEqual(comparison.reconciliation.deltaTotalsMatch, true, "Delta totals must match");

  // 5. Verify Storytelling Gating (Period-over-Period terminology for 30d)
  assert.ok(comparison.meta.comparisonType === "preceding_period");
  assert.ok(!comparison.executiveSummaryText.toLowerCase().includes("week over week"), "30d narrative must NEVER say week over week");

  console.log("✔ Observed Screenshot Regression Fixture Test Passed! (100% Reconciled)");
}
