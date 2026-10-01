/**
 * ╔═══════════════════════════════════════════════════════════════════╗
 * ║  LEGACY v1 TRAFFIC FILTER — DEPRECATED                          ║
 * ║                                                                   ║
 * ║  This module is NO LONGER the active traffic classification       ║
 * ║  engine. It is preserved solely for rollback/backward             ║
 * ║  compatibility with any historical code paths that may still      ║
 * ║  reference the v1 evaluateExclusion() API.                        ║
 * ║                                                                   ║
 * ║  DO NOT use this module for:                                      ║
 * ║    - Active ingestion (track-analytics)                           ║
 * ║    - Backfill processing (backfill-traffic-audit)                 ║
 * ║    - New development of any kind                                  ║
 * ║                                                                   ║
 * ║  CURRENT SOURCE OF TRUTH (v2.2):                                  ║
 * ║    supabase/functions/src/traffic-classifier.ts                   ║
 * ║    → classifyTraffic()                                            ║
 * ║                                                                   ║
 * ║  Key differences from v2.2:                                       ║
 * ║    - v1 used binary is_excluded (no traffic_class, no flags)      ║
 * ║    - v1 geo behavior: country NOT in allowed_countries →          ║
 * ║      automatic exclusion (no geo_mode concept)                    ║
 * ║    - v2.2 separates classification (Stage A) from reporting       ║
 * ║      policy (Stage B), supports geo_mode off/observe/exclude,     ║
 * ║      and never auto-excludes unknown geography                    ║
 * ╚═══════════════════════════════════════════════════════════════════╝
 *
 * @deprecated Use classifyTraffic() from traffic-classifier.ts instead.
 */

// ── Built-in bot / crawler user-agent substrings ────────────────────
export const BUILTIN_BOT_PATTERNS: string[] = [
  // Major search engine bots
  'googlebot', 'bingbot', 'yandexbot', 'baiduspider', 'duckduckbot',
  'slurp',       // Yahoo
  'sogou',
  'exabot',
  'facebot',     // Facebook crawler
  'facebookexternalhit',
  'ia_archiver', // Alexa
  'applebot',

  // Generic bot / spider indicators
  'bot/', 'spider', 'crawl', 'scraper', 'fetch',
  'headless', 'phantomjs', 'puppeteer', 'playwright', 'selenium',
  'curl/', 'wget/', 'python-requests', 'python-urllib',
  'java/', 'httpie', 'postman', 'insomnia',
  'go-http-client', 'node-fetch', 'axios/',
  'nutch', 'archive.org_bot', 'ccbot',

  // SEO / monitoring tools
  'ahrefs', 'semrush', 'mj12bot', 'dotbot', 'rogerbot',
  'screaming frog', 'sitebulb', 'deepcrawl',
  'uptimerobot', 'pingdom', 'newrelic', 'datadog',
  'gtmetrix', 'pagespeed', 'lighthouse',

  // Social previews
  'twitterbot', 'linkedinbot', 'discordbot', 'telegrambot',
  'whatsapp', 'slackbot', 'skypeuri',

  // AI / LLM scrapers
  'gptbot', 'chatgpt', 'claudebot', 'anthropic',
  'perplexitybot', 'bytespider', 'cohere-ai',
];

export interface TrafficRules {
  allowed_countries: string[] | null;   // null = allow all
  team_ips: string[];
  custom_bot_patterns: string[];
  is_active: boolean;
}

export interface ExclusionResult {
  excluded: boolean;
  reason: string | null;
}

/**
 * Determine whether a request should be excluded from clean analytics.
 */
export function evaluateExclusion(opts: {
  userAgent: string;
  country: string;         // 2-letter ISO, 'XX' for unknown
  ipAddress?: string | null;
  rules: TrafficRules | null;
}): ExclusionResult {
  const { userAgent, country, ipAddress, rules } = opts;
  const ua = (userAgent || '').toLowerCase();

  // ── 1. Bot detection (always on, even without per-client rules) ────
  for (const pattern of BUILTIN_BOT_PATTERNS) {
    if (ua.includes(pattern)) {
      return { excluded: true, reason: `bot:${pattern}` };
    }
  }

  // Very short or empty UA is almost always a bot or script
  if (ua.length < 15) {
    return { excluded: true, reason: 'bot:short_ua' };
  }

  // If no per-client rules exist or rules are inactive, stop here
  if (!rules || !rules.is_active) {
    return { excluded: false, reason: null };
  }

  // ── 2. Custom bot patterns from per-client config ──────────────────
  for (const pattern of rules.custom_bot_patterns || []) {
    if (ua.includes(pattern.toLowerCase())) {
      return { excluded: true, reason: `custom_bot:${pattern}` };
    }
  }

  // ── 3. Team / VPN IP exclusion ─────────────────────────────────────
  if (ipAddress && rules.team_ips && rules.team_ips.length > 0) {
    for (const entry of rules.team_ips) {
      if (matchIp(ipAddress, entry)) {
        return { excluded: true, reason: `team_ip:${entry}` };
      }
    }
  }

  // ── 4. LEGACY v1 Geo-fence (automatic exclusion — SUPERSEDED by v2.2) ──
  // v2.2 uses geo_mode (off/observe/exclude) instead of automatic exclusion.
  // This logic is preserved for rollback compatibility only.
  if (rules.allowed_countries && rules.allowed_countries.length > 0) {
    const normalizedCountry = country.toUpperCase().trim();
    // 'XX' (unknown) is excluded unless explicitly allowed
    if (!rules.allowed_countries.includes(normalizedCountry)) {
      return { excluded: true, reason: `geo:${normalizedCountry}` };
    }
  }

  return { excluded: false, reason: null };
}

/**
 * Basic IP matching: exact match or simple CIDR /8, /16, /24, /32 for IPv4.
 */
function matchIp(ip: string, ruleEntry: string): boolean {
  const trimmedRule = ruleEntry.trim();
  const trimmedIp = ip.trim();

  // Exact match
  if (trimmedIp === trimmedRule) return true;

  // CIDR match (IPv4 only for now)
  if (trimmedRule.includes('/')) {
    const [network, prefixStr] = trimmedRule.split('/');
    const prefix = parseInt(prefixStr, 10);
    if (isNaN(prefix) || prefix < 0 || prefix > 32) return false;

    const ipNum = ipv4ToNum(trimmedIp);
    const netNum = ipv4ToNum(network);
    if (ipNum === null || netNum === null) return false;

    const mask = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0;
    return (ipNum & mask) === (netNum & mask);
  }

  return false;
}

function ipv4ToNum(ip: string): number | null {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  let num = 0;
  for (const p of parts) {
    const octet = parseInt(p, 10);
    if (isNaN(octet) || octet < 0 || octet > 255) return null;
    num = (num << 8) | octet;
  }
  return num >>> 0;
}
