/**
 * traffic-classifier.ts — Traffic Classification & Analytics Data Quality Layer v2.2
 *
 * ╔═══════════════════════════════════════════════════════════════════╗
 * ║  CANONICAL PRODUCTION SOURCE OF TRUTH                            ║
 * ║                                                                   ║
 * ║  This module is the single authoritative traffic classification   ║
 * ║  engine for the Sienvi Agency Client Dashboard.                   ║
 * ║  All active ingestion and backfill paths MUST use                 ║
 * ║  classifyTraffic() from this module.                              ║
 * ╚═══════════════════════════════════════════════════════════════════╝
 *
 * Handles:
 *   - Bot detection (50+ built-in patterns + per-client custom patterns)
 *   - Suspicious automation heuristics (short/empty UA)
 *   - Internal/team traffic identification (IP exact + CIDR matching)
 *   - Reporting allowlists (IP, CIDR, UA pattern — override is_excluded)
 *   - Geographic reporting modes (off / observe / exclude via geo_mode)
 *   - Traffic flags (classification metadata preserved per-record)
 *   - Exclusion policy (why a record was excluded from reporting)
 *   - Audit versioning (CLASSIFIER_VERSION stamped per-record)
 *   - Evaluated timestamp (ISO 8601 UTC per-record)
 *
 * Active consumers:
 *   - track-analytics/index.ts   (real-time ingestion)
 *   - backfill-traffic-audit/index.ts (historical reclassification)
 *
 * Legacy:
 *   - traffic-filter.ts is the DEPRECATED v1 module. Do not use.
 *
 * The classifier operates in two conceptual stages:
 *
 * ═══════════════════════════════════════════════════════════════════════
 * STAGE A — TRAFFIC CLASSIFICATION (what the traffic actually IS)
 * ═══════════════════════════════════════════════════════════════════════
 *
 *  Priority  Rule                     Class
 *  ────────  ───────────────────────── ────────────
 *  1         Built-in known bot UA     bot
 *  2         Custom bot UA patterns    bot
 *  3         Suspicious automation     suspicious
 *  4         Team / internal IP        internal
 *  5         Human / unknown           human
 *
 *  Classification is NEVER changed by reporting policy or allowlist.
 *  A Googlebot remains class=bot even if explicitly allowlisted.
 *
 * ═══════════════════════════════════════════════════════════════════════
 * STAGE B — REPORTING POLICY (should the record appear in KPI reporting?)
 * ═══════════════════════════════════════════════════════════════════════
 *
 *  Priority  Rule                         Effect
 *  ────────  ──────────────────────────── ─────────
 *  1         Reporting allowlist override  is_excluded = false
 *  2         Internal traffic policy       is_excluded = true
 *  3         Bot policy                    is_excluded = true
 *  4         Suspicious policy             is_excluded = true
 *  5         Geographic reporting policy   depends on geo_mode:
 *              off     → no geo-based action
 *              observe → flag outside_target_geo:XX, is_excluded = false
 *              exclude → flag outside_target_geo:XX, is_excluded = true
 *  6         Default include               is_excluded = false
 *
 *  Unknown geography (null, '', 'XX', 'unknown') is NEVER auto-excluded.
 *  It is flagged as geo:unknown for observability only.
 *
 *  NOTE: The v1 migration may have seeded allowed_countries = ["US"] for
 *  existing clients, but v2.2 defaults geo_mode to "observe", meaning
 *  non-US traffic is flagged but NOT excluded unless an administrator
 *  explicitly sets geo_mode = "exclude".
 *
 * ═══════════════════════════════════════════════════════════════════════
 */

export const CLASSIFIER_VERSION = 'traffic-v2';

// ── Configurable thresholds ─────────────────────────────────────────
// Single source of truth lives in traffic-thresholds.ts.
// Re-exported here for backward compatibility with existing imports.
import { THRESHOLDS as _THRESHOLDS } from "./traffic-thresholds.ts";
export const THRESHOLDS = _THRESHOLDS;

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

// ── Types ───────────────────────────────────────────────────────────

export type TrafficClass = 'human' | 'bot' | 'internal' | 'suspicious' | 'unknown';
export type GeoMode = 'off' | 'observe' | 'exclude';

export interface TrafficRules {
  allowed_countries: string[] | null;  // null = allow all
  team_ips: string[];
  custom_bot_patterns: string[];
  is_active: boolean;
  geo_mode: GeoMode;
  allowed_ips: string[];
  allowed_cidrs: string[];
  allowed_ua_patterns: string[];
}

export interface ClassificationResult {
  traffic_class: TrafficClass;
  traffic_flags: string[];
  is_excluded: boolean;
  exclusion_policy: string | null;
  exclude_reason: string | null;     // backward-compat with v1
  audit_version: string;
  evaluated_at: string;              // ISO 8601 UTC
}

export interface ClassifyInput {
  userAgent: string;
  country: string;           // 2-letter ISO, 'XX' for unknown
  ipAddress?: string | null;
  rules: TrafficRules | null;
}

// ── Backward compatibility shim (LEGACY — do not use in new code) ───
// v1 callers used evaluateExclusion() from the now-deprecated traffic-filter.ts.
// This shim maps the v1 API to classifyTraffic() so any stale imports from
// traffic-classifier.ts continue to work. New code MUST use classifyTraffic().
// NOTE: This shim forces geo_mode='exclude' when allowed_countries is set,
// which was the v1 behavior. The v2.2 default is geo_mode='observe'.
/** @deprecated Use classifyTraffic() directly. */
export function evaluateExclusion(opts: {
  userAgent: string;
  country: string;
  ipAddress?: string | null;
  rules: {
    allowed_countries: string[] | null;
    team_ips: string[];
    custom_bot_patterns: string[];
    is_active: boolean;
  } | null;
}): { excluded: boolean; reason: string | null } {
  // Map v1 rules to v2 format
  const v2Rules: TrafficRules | null = opts.rules ? {
    ...opts.rules,
    geo_mode: (opts.rules.allowed_countries && opts.rules.allowed_countries.length > 0) ? 'exclude' : 'off',
    allowed_ips: [],
    allowed_cidrs: [],
    allowed_ua_patterns: [],
  } : null;

  const result = classifyTraffic({
    userAgent: opts.userAgent,
    country: opts.country,
    ipAddress: opts.ipAddress,
    rules: v2Rules,
  });

  return {
    excluded: result.is_excluded,
    reason: result.exclude_reason,
  };
}

// ── Main classifier ─────────────────────────────────────────────────

/**
 * Classify a traffic record using two-stage architecture:
 *   Stage A: Determine traffic_class from evidence (never affected by allowlist)
 *   Stage B: Apply reporting policy to decide is_excluded
 */
export function classifyTraffic(input: ClassifyInput): ClassificationResult {
  const { userAgent, country, ipAddress, rules } = input;
  const ua = (userAgent || '').toLowerCase();
  const now = new Date().toISOString();
  const flags: string[] = [];

  // ═══════════════════════════════════════════════════════════════════
  // STAGE A — TRAFFIC CLASSIFICATION
  // Determine what the traffic actually IS using evidence.
  // Classification is never modified by allowlist or reporting policy.
  // ═══════════════════════════════════════════════════════════════════

  let traffic_class: TrafficClass = 'human';
  let classificationReason: string | null = null;

  // A1. Built-in known bot UA detection (always active)
  for (const pattern of BUILTIN_BOT_PATTERNS) {
    if (ua.includes(pattern)) {
      traffic_class = 'bot';
      classificationReason = `bot:${pattern}`;
      flags.push(`bot:${pattern}`);
      break;
    }
  }

  // A2. Custom bot UA patterns (per-client, only if not already classified)
  if (traffic_class === 'human' && rules && rules.is_active) {
    for (const pattern of rules.custom_bot_patterns || []) {
      if (ua.includes(pattern.toLowerCase())) {
        traffic_class = 'bot';
        classificationReason = `custom_bot:${pattern}`;
        flags.push(`custom_bot:${pattern}`);
        break;
      }
    }
  }

  // A3. Suspicious automation heuristics
  if (traffic_class === 'human' && ua.length < THRESHOLDS.SUSPICIOUS_UA_MIN_LENGTH) {
    traffic_class = 'suspicious';
    classificationReason = 'bot:short_ua';
    flags.push('suspicious:short_ua');
  }

  // A4. Team / internal IP detection
  if (traffic_class === 'human' && rules && rules.is_active && ipAddress && rules.team_ips.length > 0) {
    for (const entry of rules.team_ips) {
      if (matchIp(ipAddress, entry)) {
        traffic_class = 'internal';
        classificationReason = `team_ip:${entry}`;
        flags.push('team_ip');
        break;
      }
    }
  }

  // A5. Geo flags (classification metadata, not exclusion decision)
  const normalizedCountry = (country || '').toUpperCase().trim();
  const isUnknownGeo = !normalizedCountry || normalizedCountry === 'XX' ||
    normalizedCountry === 'UNKNOWN' || normalizedCountry.length < 2;

  if (isUnknownGeo) {
    flags.push('geo:unknown');
  }

  if (rules && rules.is_active && rules.geo_mode !== 'off' &&
      rules.allowed_countries && rules.allowed_countries.length > 0) {
    if (!isUnknownGeo && !rules.allowed_countries.includes(normalizedCountry)) {
      flags.push(`outside_target_geo:${normalizedCountry}`);
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // STAGE B — REPORTING POLICY
  // Decide is_excluded based on classification + rules.
  // Allowlist may override is_excluded but NEVER changes traffic_class.
  // ═══════════════════════════════════════════════════════════════════

  let is_excluded = false;
  let exclusion_policy: string | null = null;
  let exclude_reason: string | null = null;

  // B1. Check reporting allowlist (highest priority — overrides exclusion)
  let isAllowlisted = false;
  if (rules && rules.is_active) {
    // IP allowlist
    if (ipAddress && rules.allowed_ips.length > 0) {
      for (const allowedIp of rules.allowed_ips) {
        if (ipAddress.trim() === allowedIp.trim()) {
          flags.push('reporting_allowlist');
          isAllowlisted = true;
          break;
        }
      }
    }
    // CIDR allowlist
    if (!isAllowlisted && ipAddress && rules.allowed_cidrs.length > 0) {
      for (const cidr of rules.allowed_cidrs) {
        if (matchIp(ipAddress, cidr)) {
          flags.push('reporting_allowlist');
          isAllowlisted = true;
          break;
        }
      }
    }
    // UA pattern allowlist
    if (!isAllowlisted && rules.allowed_ua_patterns.length > 0) {
      for (const pattern of rules.allowed_ua_patterns) {
        if (ua.includes(pattern.toLowerCase())) {
          flags.push('reporting_allowlist');
          isAllowlisted = true;
          break;
        }
      }
    }
  }

  if (isAllowlisted) {
    // Reporting allowlist: include in reporting regardless of classification
    is_excluded = false;
    exclusion_policy = null;
    exclude_reason = null;
  } else {
    // B2–B4. Apply default exclusion policy based on classification
    switch (traffic_class) {
      case 'internal':
        is_excluded = true;
        exclusion_policy = 'internal_traffic';
        exclude_reason = classificationReason;
        break;
      case 'bot':
        is_excluded = true;
        // Determine sub-policy from flags
        exclusion_policy = flags.some(f => f.startsWith('custom_bot:')) ? 'custom_bot' : 'known_bot';
        exclude_reason = classificationReason;
        break;
      case 'suspicious':
        is_excluded = true;
        exclusion_policy = 'suspicious_automation';
        exclude_reason = classificationReason;
        break;
      default:
        // human or unknown — not excluded by classification alone
        break;
    }

    // B5. Geographic reporting policy (only for non-excluded human traffic)
    if (!is_excluded && rules && rules.is_active && rules.geo_mode === 'exclude' &&
        rules.allowed_countries && rules.allowed_countries.length > 0) {
      if (!isUnknownGeo && !rules.allowed_countries.includes(normalizedCountry)) {
        is_excluded = true;
        exclusion_policy = 'geo_policy';
        exclude_reason = `geo:${normalizedCountry}`;
      }
      // Unknown geo: NEVER excluded by geo policy
    }
  }

  return {
    traffic_class,
    traffic_flags: flags,
    is_excluded,
    exclusion_policy,
    exclude_reason,
    audit_version: CLASSIFIER_VERSION,
    evaluated_at: now,
  };
}

// ── IP matching utilities ───────────────────────────────────────────

/**
 * Match an IP address against a rule entry.
 * Supports exact IPv4 match and IPv4 CIDR notation.
 */
export function matchIp(ip: string, ruleEntry: string): boolean {
  const trimmedRule = ruleEntry.trim();
  const trimmedIp = ip.trim();

  // Exact match
  if (trimmedIp === trimmedRule) return true;

  // CIDR match (IPv4 only)
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

// ── Helper: mask IP for UI display ──────────────────────────────────

export function maskIpAddress(ip: string | null): string {
  if (!ip) return '—';
  const trimmed = ip.trim();

  // IPv4: mask last octet
  const ipv4Parts = trimmed.split('.');
  if (ipv4Parts.length === 4) {
    return `${ipv4Parts[0]}.${ipv4Parts[1]}.${ipv4Parts[2]}.xxx`;
  }

  // IPv6 or other: mask last segment
  if (trimmed.includes(':')) {
    const segments = trimmed.split(':');
    if (segments.length > 2) {
      return segments.slice(0, -1).join(':') + ':xxxx';
    }
  }

  return trimmed.slice(0, Math.max(4, trimmed.length - 3)) + 'xxx';
}

// ── Helper: build v2 TrafficRules from a DB row ─────────────────────

export function rulesFromDbRow(row: Record<string, unknown>): TrafficRules {
  return {
    allowed_countries: (row.allowed_countries as string[] | null) || null,
    team_ips: (row.team_ips as string[] || []),
    custom_bot_patterns: (row.custom_bot_patterns as string[] || []),
    is_active: row.is_active as boolean,
    geo_mode: (row.geo_mode as GeoMode) || 'observe',
    allowed_ips: (row.allowed_ips as string[] || []),
    allowed_cidrs: (row.allowed_cidrs as string[] || []),
    allowed_ua_patterns: (row.allowed_ua_patterns as string[] || []),
  };
}
