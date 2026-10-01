/**
 * Re-export of the canonical traffic thresholds from the Edge Function shared source.
 *
 * This shim allows the React app (via bundler path alias @/lib/...)
 * to import from the single source of truth without a Deno import path.
 *
 * The canonical definition lives in:
 *   supabase/functions/src/traffic-thresholds.ts
 */

// Re-export values directly (bundler resolves the relative path)
export { THRESHOLDS } from "../../supabase/functions/src/traffic-thresholds";
export type { ThresholdsConfig } from "../../supabase/functions/src/traffic-thresholds";
