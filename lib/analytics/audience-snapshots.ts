import type { ReconciledAudience, AudienceStatus } from "./comparison-contract.ts";

export interface BoundarySnapshotInput {
  startSnapshot: number | null;
  endSnapshot: number | null;
  prevStartSnapshot?: number | null;
  prevEndSnapshot?: number | null;
  statusOverride?: AudienceStatus;
  coverageCount?: number;
  missingPlatforms?: string[];
}

export const resolveAudienceSnapshots = (
  input: BoundarySnapshotInput
): ReconciledAudience => {
  const {
    startSnapshot,
    endSnapshot,
    prevStartSnapshot,
    prevEndSnapshot,
    statusOverride,
    coverageCount = 4,
    missingPlatforms = [],
  } = input;

  if (statusOverride && statusOverride !== "available") {
    return {
      currentBoundaryCount: endSnapshot,
      previousBoundaryCount: startSnapshot,
      netChange: null,
      previousPeriodNetChange: null,
      status: statusOverride,
      statusLabel: statusOverride === "no_baseline" ? "No Baseline" : statusOverride === "unsupported" ? "Unsupported" : "Partial Sync",
      coverageCount,
      missingPlatforms,
    };
  }

  // Follower change is valid ONLY when both required boundary snapshots exist
  const hasCurrentBoundary = startSnapshot != null && endSnapshot != null && startSnapshot > 0 && endSnapshot > 0;
  const hasPreviousBoundary = prevStartSnapshot != null && prevEndSnapshot != null && prevStartSnapshot > 0 && prevEndSnapshot > 0;

  if (!hasCurrentBoundary) {
    return {
      currentBoundaryCount: endSnapshot || null,
      previousBoundaryCount: startSnapshot || null,
      netChange: null,
      previousPeriodNetChange: null,
      status: "no_baseline",
      statusLabel: "No Baseline Snapshot",
      coverageCount,
      missingPlatforms,
    };
  }

  const netChange = endSnapshot! - startSnapshot!;
  const previousPeriodNetChange = hasPreviousBoundary ? prevEndSnapshot! - prevStartSnapshot! : null;

  return {
    currentBoundaryCount: endSnapshot,
    previousBoundaryCount: startSnapshot,
    netChange,
    previousPeriodNetChange,
    status: "available",
    statusLabel: "Boundary Baseline Verified",
    coverageCount,
    missingPlatforms,
  };
};
