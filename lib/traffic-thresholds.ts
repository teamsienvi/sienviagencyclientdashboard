/**
 * Traffic classification thresholds used by the Traffic Audit Panel
 * and the traffic-classifier edge function.
 */
export const THRESHOLDS = {
  /** Warn when more than this fraction of sessions are excluded */
  DEFAULT_EXCLUSION_RATE_WARNING: 0.25,
} as const;
