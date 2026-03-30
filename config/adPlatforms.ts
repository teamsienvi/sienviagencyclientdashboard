/**
 * Per-client ad platform configuration for Ads Shredder cards.
 * Maps client names to the ad platforms they use.
 * If a client is not listed here, they get all four platforms by default.
 */

export type AdPlatform = "meta" | "google" | "tiktok" | "amazon";

export const AD_PLATFORM_LABELS: Record<AdPlatform, string> = {
  meta: "Meta/Facebook Ads",
  google: "Google Ads",
  tiktok: "TikTok Ads",
  amazon: "Amazon Ads",
};

/**
 * Explicit overrides. Clients NOT listed here will get the default set
 * (all four platforms) when they have any ads data.
 */
const CLIENT_AD_PLATFORMS: Record<string, AdPlatform[]> = {
  "OxiSure Tech": ["meta", "google", "tiktok", "amazon"],
  "Snarky Pets": ["meta", "google", "tiktok", "amazon"],
  "Serenity Scrolls": ["meta", "google", "tiktok", "amazon"],
  "Ban Batu": ["amazon"],
};

const DEFAULT_AD_PLATFORMS: AdPlatform[] = ["meta", "google", "tiktok", "amazon"];

/**
 * Returns the list of ad platforms a client should see Shredder cards for.
 */
export function getClientAdPlatforms(clientName: string): AdPlatform[] {
  return CLIENT_AD_PLATFORMS[clientName] || DEFAULT_AD_PLATFORMS;
}
