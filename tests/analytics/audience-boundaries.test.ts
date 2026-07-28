import assert from "node:assert";
import { resolveAudienceSnapshots } from "../../lib/analytics/audience-snapshots.ts";

export function runAudienceBoundariesTests() {
  console.log("▶ Running Audience Boundaries & Baseline Gating Test...");

  // Test 1: Complete boundary snapshots exist (1,010 -> 1,030 = +20)
  const completeAudience = resolveAudienceSnapshots({
    startSnapshot: 1010,
    endSnapshot: 1030,
    prevStartSnapshot: 1000,
    prevEndSnapshot: 1010,
  });
  assert.strictEqual(completeAudience.netChange, 20, "Net change must be +20");
  assert.strictEqual(completeAudience.status, "available", "Status must be available");

  // Test 2: Missing baseline snapshot (start is null/0)
  const missingBaseline = resolveAudienceSnapshots({
    startSnapshot: null,
    endSnapshot: 1030,
  });
  assert.strictEqual(missingBaseline.netChange, null, "Net change must be null when start snapshot is missing");
  assert.strictEqual(missingBaseline.status, "no_baseline", "Status must be no_baseline");

  // Test 3: Verified Zero net change (1,527 -> 1,527 = 0)
  const verifiedZero = resolveAudienceSnapshots({
    startSnapshot: 1527,
    endSnapshot: 1527,
  });
  assert.strictEqual(verifiedZero.netChange, 0, "Net change must be 0 for verified boundaries");
  assert.strictEqual(verifiedZero.currentBoundaryCount, 1527);
  assert.strictEqual(verifiedZero.previousBoundaryCount, 1527);

  console.log("✔ Audience Boundaries & Baseline Gating Test Passed!");
}
