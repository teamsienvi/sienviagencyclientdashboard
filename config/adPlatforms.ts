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
  "BSUE Brow & Lash": [],
  "PlayIQ": [],
  "Hwabelle": ["amazon"],
  "The Haven At Deer Park": [],
  "Cissie Pryor Presents": [],
  "Father Figure Formula": [],
  "Sienvi Agency": [],
  "The Billionaire Brother": [],
  "CheerCPT": [],
  "HAIRtamin": [],
};

const DEFAULT_AD_PLATFORMS: AdPlatform[] = ["meta", "google", "tiktok", "amazon"];

/**
 * Returns the list of ad platforms a client should see Shredder cards for.
 */
export function getClientAdPlatforms(clientName: string): AdPlatform[] {
  return CLIENT_AD_PLATFORMS[clientName] || DEFAULT_AD_PLATFORMS;
}

/**
 * Clients with a live Amazon SP-API orders integration (sync-amazon-orders edge function).
 * This is SEPARATE from Amazon Ads — Ban Batu has Amazon Ads but NOT SP-API orders access.
 */
const AMAZON_ORDERS_CLIENTS = new Set([
  "Serenity Scrolls",
  "Hwabelle",
]);

/**
 * Returns true if this client has Amazon SP-API orders analytics enabled.
 */
export function hasAmazonOrdersAnalytics(clientName: string): boolean {
  return AMAZON_ORDERS_CLIENTS.has(clientName);
}
