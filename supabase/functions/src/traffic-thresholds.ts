/**
 * traffic-thresholds.ts — Single source of truth for traffic classification thresholds
 *
 * Shared between:
 *   - traffic-classifier.ts (Edge Function / Deno runtime)
 *   - TrafficAuditPanel.tsx (Browser / React runtime)
 *
 * This module is intentionally runtime-neutral:
 *   - No Deno-specific imports
 *   - No browser-specific imports
 *   - Pure constants only
 *
 * To use in Edge Functions:
 *   import { THRESHOLDS } from "../src/traffic-thresholds.ts";
 *
 * To use in React (via bundler):
 *   import { THRESHOLDS } from "@/lib/traffic-thresholds";
 *   (requires a re-export shim — see lib/traffic-thresholds.ts)
 */

export const THRESHOLDS = {
  /** Warn when exclusion rate exceeds this fraction of raw traffic */
  DEFAULT_EXCLUSION_RATE_WARNING: 0.25,

  /** Warn when exclusion rate changes by this many percentage points */
  DEFAULT_EXCLUSION_CHANGE_WARNING_PP: 10,

  /** UA shorter than this is classified as suspicious automation */
  SUSPICIOUS_UA_MIN_LENGTH: 15,
} as const;

export type ThresholdsConfig = typeof THRESHOLDS;
