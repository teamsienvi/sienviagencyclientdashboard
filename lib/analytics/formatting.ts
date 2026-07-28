/**
 * Formatting utilities for analytics metrics, deltas, and percentage points.
 */

export const formatNum = (n: number | null | undefined): string => {
  if (n == null || isNaN(n)) return "0";
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
};

export const formatDeltaValue = (
  delta: number | null | undefined,
  isPercentagePoint: boolean = false
): string => {
  if (delta == null || isNaN(delta)) return "—";
  if (delta === 0) return "0";

  const prefix = delta > 0 ? "+" : "";
  if (isPercentagePoint) {
    return `${prefix}${delta.toFixed(1)} pp`;
  }

  return `${prefix}${formatNum(delta)}`;
};

export const formatRelativeDelta = (rel: number | null | undefined): string => {
  if (rel == null || isNaN(rel)) return "—";
  if (rel === 0) return "0%";
  const prefix = rel > 0 ? "+" : "";
  return `${prefix}${rel.toFixed(1)}%`;
};

export const formatPercentagePointDelta = (pp: number | null | undefined): string => {
  if (pp == null || isNaN(pp)) return "—";
  if (pp === 0) return "0.0 pp";
  const prefix = pp > 0 ? "+" : "";
  return `${prefix}${pp.toFixed(1)} pp`;
};

export const getDirectionSymbol = (delta: number | null | undefined): "↑" | "↓" | "→" => {
  if (delta == null || isNaN(delta) || delta === 0) return "→";
  return delta > 0 ? "↑" : "↓";
};

export const getDirectionLabel = (delta: number | null | undefined): "Increase" | "Decline" | "No Change" => {
  if (delta == null || isNaN(delta) || delta === 0) return "No Change";
  return delta > 0 ? "Increase" : "Decline";
};
