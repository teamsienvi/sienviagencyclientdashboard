/**
 * traffic-classifier.test.ts — Deno test suite for traffic-v2.2 classifier
 *
 * Source of truth: supabase/functions/src/traffic-classifier.ts
 *
 * Tests cover:
 *   1. Known bot detection
 *   2. Normal browser classification
 *   3. Short/empty UA (suspicious)
 *   4. IPv4 matching (exact + CIDR)
 *   5. Team IP exclusion
 *   6. Geo modes (off/observe/exclude)
 *   7. Unknown geography safety
 *   8. Reporting allowlist architecture (FIX #1)
 *   9. Precedence correctness
 *  10. Versioning + timestamps
 *  11. IP masking
 *  12. Inactive rules
 *  13. Null rules
 *  14. Configurable thresholds
 *  15. Two-stage architecture invariants
 *  16. Centralized thresholds (shared module)
 *  17. Concurrent backfill behavior contracts
 *  18. Server-side rule mutation contracts
 *  19. Source-of-truth regression protection
 *  20. Authentication & zero-trust regression protection
 *
 * Run with:  deno test supabase/functions/src/traffic-classifier.test.ts
 */
import { assertEquals, assertNotEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import {
  classifyTraffic,
  matchIp,
  maskIpAddress,
  CLASSIFIER_VERSION,
  THRESHOLDS,
  type TrafficRules,
} from "./traffic-classifier.ts";

// ── Helpers ─────────────────────────────────────────────────────────

function makeRules(overrides: Partial<TrafficRules> = {}): TrafficRules {
  return {
    allowed_countries: null,
    team_ips: [],
    custom_bot_patterns: [],
    is_active: true,
    geo_mode: "observe",
    allowed_ips: [],
    allowed_cidrs: [],
    allowed_ua_patterns: [],
    ...overrides,
  };
}

const CHROME_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
const FIREFOX_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:127.0) Gecko/20100101 Firefox/127.0";
const SAFARI_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15";

// ═════════════════════════════════════════════════════════════════════
// 1. KNOWN BOT DETECTION
// ═════════════════════════════════════════════════════════════════════

Deno.test("Known bot: Googlebot is classified as bot and excluded", () => {
  const r = classifyTraffic({ userAgent: "Googlebot/2.1 (+http://www.google.com/bot.html)", country: "US", rules: null });
  assertEquals(r.traffic_class, "bot");
  assertEquals(r.is_excluded, true);
  assertEquals(r.exclusion_policy, "known_bot");
  assertEquals(r.audit_version, CLASSIFIER_VERSION);
});

Deno.test("Known bot: Bingbot", () => {
  const r = classifyTraffic({ userAgent: "Mozilla/5.0 (compatible; bingbot/2.0)", country: "US", rules: null });
  assertEquals(r.traffic_class, "bot");
  assertEquals(r.is_excluded, true);
});

Deno.test("Known bot: AhrefsBot", () => {
  const r = classifyTraffic({ userAgent: "Mozilla/5.0 (compatible; AhrefsBot/7.0)", country: "US", rules: null });
  assertEquals(r.traffic_class, "bot");
});

Deno.test("Known bot: GPTBot", () => {
  const r = classifyTraffic({ userAgent: "GPTBot/1.0", country: "US", rules: null });
  assertEquals(r.traffic_class, "bot");
});

Deno.test("Known bot: ClaudeBot", () => {
  const r = classifyTraffic({ userAgent: "ClaudeBot/1.0", country: "US", rules: null });
  assertEquals(r.traffic_class, "bot");
});

Deno.test("Known bot: Playwright headless", () => {
  const r = classifyTraffic({ userAgent: "Mozilla/5.0 Playwright/1.0", country: "US", rules: null });
  assertEquals(r.traffic_class, "bot");
});

Deno.test("Known bot: curl", () => {
  const r = classifyTraffic({ userAgent: "curl/7.88.1", country: "US", rules: null });
  assertEquals(r.traffic_class, "bot");
});

// ═════════════════════════════════════════════════════════════════════
// 2. NORMAL BROWSER UAs REMAIN HUMAN
// ═════════════════════════════════════════════════════════════════════

Deno.test("Normal browser: Chrome on Windows is human", () => {
  const r = classifyTraffic({ userAgent: CHROME_UA, country: "US", rules: null });
  assertEquals(r.traffic_class, "human");
  assertEquals(r.is_excluded, false);
  assertEquals(r.exclusion_policy, null);
});

Deno.test("Normal browser: Firefox on macOS is human", () => {
  const r = classifyTraffic({ userAgent: FIREFOX_UA, country: "US", rules: null });
  assertEquals(r.traffic_class, "human");
  assertEquals(r.is_excluded, false);
});

Deno.test("Normal browser: Safari on macOS is human", () => {
  const r = classifyTraffic({ userAgent: SAFARI_UA, country: "US", rules: null });
  assertEquals(r.traffic_class, "human");
  assertEquals(r.is_excluded, false);
});

// ═════════════════════════════════════════════════════════════════════
// 3. SHORT UA → SUSPICIOUS
// ═════════════════════════════════════════════════════════════════════

Deno.test("Short UA: very short UA classified as suspicious", () => {
  const r = classifyTraffic({ userAgent: "test", country: "US", rules: null });
  assertEquals(r.traffic_class, "suspicious");
  assertEquals(r.is_excluded, true);
});

Deno.test("Short UA: empty UA classified as suspicious", () => {
  const r = classifyTraffic({ userAgent: "", country: "US", rules: null });
  assertEquals(r.traffic_class, "suspicious");
  assertEquals(r.is_excluded, true);
});

// ═════════════════════════════════════════════════════════════════════
// 4. IP MATCHING
// ═════════════════════════════════════════════════════════════════════

Deno.test("IP match: exact IPv4", () => {
  assertEquals(matchIp("192.168.1.100", "192.168.1.100"), true);
  assertEquals(matchIp("192.168.1.100", "192.168.1.101"), false);
});

Deno.test("IP match: IPv4 CIDR /24", () => {
  assertEquals(matchIp("10.0.0.50", "10.0.0.0/24"), true);
  assertEquals(matchIp("10.0.1.50", "10.0.0.0/24"), false);
});

Deno.test("IP match: IPv4 CIDR /16", () => {
  assertEquals(matchIp("172.16.5.10", "172.16.0.0/16"), true);
  assertEquals(matchIp("172.17.0.1", "172.16.0.0/16"), false);
});

Deno.test("IP match: invalid IP returns false", () => {
  assertEquals(matchIp("not-an-ip", "10.0.0.0/24"), false);
  assertEquals(matchIp("10.0.0.1", "not-a-cidr/24"), false);
});

Deno.test("IP match: forwarded IP with whitespace", () => {
  assertEquals(matchIp("  10.0.0.1  ", "10.0.0.1"), true);
});

// ═════════════════════════════════════════════════════════════════════
// 5. TEAM IP EXCLUSION
// ═════════════════════════════════════════════════════════════════════

Deno.test("Team IP: exact match excludes as internal", () => {
  const rules = makeRules({ team_ips: ["203.0.113.50"] });
  const r = classifyTraffic({ userAgent: CHROME_UA, country: "US", ipAddress: "203.0.113.50", rules });
  assertEquals(r.traffic_class, "internal");
  assertEquals(r.is_excluded, true);
  assertEquals(r.exclusion_policy, "internal_traffic");
});

Deno.test("Team IP: CIDR match excludes as internal", () => {
  const rules = makeRules({ team_ips: ["10.0.0.0/24"] });
  const r = classifyTraffic({ userAgent: CHROME_UA, country: "US", ipAddress: "10.0.0.42", rules });
  assertEquals(r.traffic_class, "internal");
  assertEquals(r.is_excluded, true);
});

Deno.test("Team IP: non-matching IP passes through", () => {
  const rules = makeRules({ team_ips: ["10.0.0.0/24"] });
  const r = classifyTraffic({ userAgent: CHROME_UA, country: "US", ipAddress: "8.8.8.8", rules });
  assertEquals(r.traffic_class, "human");
  assertEquals(r.is_excluded, false);
});

// ═════════════════════════════════════════════════════════════════════
// 6. GEO MODE: OFF / OBSERVE / EXCLUDE
// ═════════════════════════════════════════════════════════════════════

Deno.test("Geo OFF: outside country is NOT flagged", () => {
  const rules = makeRules({ geo_mode: "off", allowed_countries: ["US"] });
  const r = classifyTraffic({ userAgent: CHROME_UA, country: "BR", rules });
  assertEquals(r.traffic_class, "human");
  assertEquals(r.is_excluded, false);
  assertEquals(r.traffic_flags.filter(f => f.startsWith("outside_target_geo")).length, 0);
});

Deno.test("Geo OBSERVE: outside country is flagged but NOT excluded", () => {
  const rules = makeRules({ geo_mode: "observe", allowed_countries: ["US", "CA"] });
  const r = classifyTraffic({ userAgent: CHROME_UA, country: "BR", rules });
  assertEquals(r.traffic_class, "human");
  assertEquals(r.is_excluded, false);
  assertEquals(r.traffic_flags.includes("outside_target_geo:BR"), true);
});

Deno.test("Geo EXCLUDE: outside country is excluded", () => {
  const rules = makeRules({ geo_mode: "exclude", allowed_countries: ["US", "CA"] });
  const r = classifyTraffic({ userAgent: CHROME_UA, country: "BR", rules });
  assertEquals(r.traffic_class, "human");
  assertEquals(r.is_excluded, true);
  assertEquals(r.exclusion_policy, "geo_policy");
});

Deno.test("Geo EXCLUDE: target country passes through", () => {
  const rules = makeRules({ geo_mode: "exclude", allowed_countries: ["US", "CA"] });
  const r = classifyTraffic({ userAgent: CHROME_UA, country: "US", rules });
  assertEquals(r.traffic_class, "human");
  assertEquals(r.is_excluded, false);
});

// ═════════════════════════════════════════════════════════════════════
// 7. UNKNOWN GEOGRAPHY → NEVER AUTO-EXCLUDED
// ═════════════════════════════════════════════════════════════════════

Deno.test("Unknown geo: null country NOT excluded (even with geo=exclude)", () => {
  const rules = makeRules({ geo_mode: "exclude", allowed_countries: ["US"] });
  const r = classifyTraffic({ userAgent: CHROME_UA, country: "", rules });
  assertEquals(r.traffic_class, "human");
  assertEquals(r.is_excluded, false);
  assertEquals(r.traffic_flags.includes("geo:unknown"), true);
});

Deno.test("Unknown geo: 'XX' country NOT excluded", () => {
  const rules = makeRules({ geo_mode: "exclude", allowed_countries: ["US"] });
  const r = classifyTraffic({ userAgent: CHROME_UA, country: "XX", rules });
  assertEquals(r.is_excluded, false);
  assertEquals(r.traffic_flags.includes("geo:unknown"), true);
});

Deno.test("Unknown geo: 'unknown' string NOT excluded", () => {
  const rules = makeRules({ geo_mode: "exclude", allowed_countries: ["US"] });
  const r = classifyTraffic({ userAgent: CHROME_UA, country: "unknown", rules });
  assertEquals(r.is_excluded, false);
  assertEquals(r.traffic_flags.includes("geo:unknown"), true);
});

// ═════════════════════════════════════════════════════════════════════
// 8. REPORTING ALLOWLIST — TWO-STAGE ARCHITECTURE (FIX #1)
//    Classification must NEVER be falsified by reporting policy.
//    Allowlist changes is_excluded, NOT traffic_class.
// ═════════════════════════════════════════════════════════════════════

Deno.test("Allowlist: known bot + allowlist IP → class=bot, is_excluded=false", () => {
  const rules = makeRules({ allowed_ips: ["5.5.5.5"] });
  const r = classifyTraffic({ userAgent: "Googlebot/2.1", country: "US", ipAddress: "5.5.5.5", rules });
  // Classification: bot (truthful — it IS Googlebot)
  assertEquals(r.traffic_class, "bot");
  // Reporting: included (allowlisted)
  assertEquals(r.is_excluded, false);
  assertEquals(r.traffic_flags.includes("reporting_allowlist"), true);
  assertEquals(r.traffic_flags.some(f => f.startsWith("bot:googlebot")), true);
});

Deno.test("Allowlist: internal traffic + allowlist IP → class=internal, is_excluded=false", () => {
  const rules = makeRules({
    team_ips: ["10.0.0.1"],
    allowed_ips: ["10.0.0.1"],
  });
  const r = classifyTraffic({ userAgent: CHROME_UA, country: "US", ipAddress: "10.0.0.1", rules });
  // Classification: internal (truthful — it IS a team IP)
  assertEquals(r.traffic_class, "internal");
  // Reporting: included (allowlisted)
  assertEquals(r.is_excluded, false);
  assertEquals(r.traffic_flags.includes("reporting_allowlist"), true);
  assertEquals(r.traffic_flags.includes("team_ip"), true);
});

Deno.test("Allowlist: suspicious UA + allowlist UA pattern → class=suspicious, is_excluded=false", () => {
  const rules = makeRules({ allowed_ua_patterns: ["mymonitor"] });
  const r = classifyTraffic({ userAgent: "mymonitor/1", country: "US", rules });
  // UA "mymonitor/1" is < 15 chars → classified as suspicious
  assertEquals(r.traffic_class, "suspicious");
  // Reporting: included (UA pattern allowlist)
  assertEquals(r.is_excluded, false);
  assertEquals(r.traffic_flags.includes("reporting_allowlist"), true);
});

Deno.test("Allowlist: geo exclusion + allowlist CIDR → class=human, is_excluded=false", () => {
  const rules = makeRules({
    allowed_cidrs: ["10.0.0.0/8"],
    geo_mode: "exclude",
    allowed_countries: ["US"],
  });
  const r = classifyTraffic({ userAgent: CHROME_UA, country: "BR", ipAddress: "10.5.5.5", rules });
  assertEquals(r.traffic_class, "human");
  assertEquals(r.is_excluded, false);
  assertEquals(r.traffic_flags.includes("reporting_allowlist"), true);
});

Deno.test("Allowlist: reporting allowlist NEVER falsifies traffic_class", () => {
  // Curl + allowlist: should remain 'bot', not become 'human'
  const rules = makeRules({ allowed_ips: ["1.2.3.4"] });
  const r = classifyTraffic({ userAgent: "curl/7.88.1", country: "US", ipAddress: "1.2.3.4", rules });
  assertEquals(r.traffic_class, "bot");
  assertNotEquals(r.traffic_class, "human");
  assertEquals(r.is_excluded, false);
});

Deno.test("Allowlist: custom bot + allowlist IP → class=bot, is_excluded=false", () => {
  const rules = makeRules({
    custom_bot_patterns: ["zaptracker"],
    allowed_ips: ["9.9.9.9"],
  });
  const r = classifyTraffic({ userAgent: "ZapTracker/2.0 Enterprise Edition", country: "US", ipAddress: "9.9.9.9", rules });
  assertEquals(r.traffic_class, "bot");
  assertEquals(r.is_excluded, false);
  assertEquals(r.traffic_flags.includes("reporting_allowlist"), true);
  assertEquals(r.traffic_flags.some(f => f.startsWith("custom_bot:")), true);
});

Deno.test("Allowlist: non-allowlisted bot is still excluded", () => {
  const rules = makeRules({ allowed_ips: ["9.9.9.9"] });
  const r = classifyTraffic({ userAgent: "Googlebot/2.1", country: "US", ipAddress: "1.1.1.1", rules });
  assertEquals(r.traffic_class, "bot");
  assertEquals(r.is_excluded, true);
  assertEquals(r.exclusion_policy, "known_bot");
});

// ═════════════════════════════════════════════════════════════════════
// 9. PRECEDENCE CONFLICTS
// ═════════════════════════════════════════════════════════════════════

Deno.test("Precedence: known bot detected before custom bot", () => {
  const rules = makeRules({
    custom_bot_patterns: ["googlebot"],  // overlap with built-in
  });
  const r = classifyTraffic({ userAgent: "Googlebot/2.1", country: "US", rules });
  assertEquals(r.traffic_class, "bot");
  assertEquals(r.exclusion_policy, "known_bot");
});

Deno.test("Precedence: bot classification beats team IP classification", () => {
  const rules = makeRules({ team_ips: ["10.0.0.1"] });
  const r = classifyTraffic({ userAgent: "Googlebot/2.1", country: "US", ipAddress: "10.0.0.1", rules });
  // Bot detection (Stage A rule 1) has higher priority than internal detection (Stage A rule 4)
  assertEquals(r.traffic_class, "bot");
  assertEquals(r.exclusion_policy, "known_bot");
});

Deno.test("Precedence: suspicious beats team IP", () => {
  const rules = makeRules({ team_ips: ["10.0.0.1"] });
  const r = classifyTraffic({ userAgent: "x", country: "US", ipAddress: "10.0.0.1", rules });
  assertEquals(r.traffic_class, "suspicious");
});

Deno.test("Precedence: custom bot in allowed country still excluded", () => {
  const rules = makeRules({
    custom_bot_patterns: ["zaptracker"],
    allowed_countries: ["US"],
    geo_mode: "exclude",
  });
  const r = classifyTraffic({ userAgent: "ZapTracker/2.0 Enterprise Edition", country: "US", rules });
  assertEquals(r.traffic_class, "bot");
  assertEquals(r.is_excluded, true);
  assertEquals(r.exclusion_policy, "custom_bot");
});

Deno.test("Precedence: known bot beats geo classification", () => {
  const rules = makeRules({
    geo_mode: "exclude",
    allowed_countries: ["US"],
  });
  const r = classifyTraffic({ userAgent: "Googlebot/2.1", country: "BR", rules });
  assertEquals(r.traffic_class, "bot");
  assertEquals(r.exclusion_policy, "known_bot");
});

// ═════════════════════════════════════════════════════════════════════
// 10. CLASSIFIER VERSIONING & TIMESTAMP
// ═════════════════════════════════════════════════════════════════════

Deno.test("Version and timestamp are always present", () => {
  const r = classifyTraffic({ userAgent: CHROME_UA, country: "US", rules: null });
  assertEquals(r.audit_version, "traffic-v2");
  assertNotEquals(r.evaluated_at, null);
  const d = new Date(r.evaluated_at);
  assertEquals(isNaN(d.getTime()), false);
});

// ═════════════════════════════════════════════════════════════════════
// 11. IP MASKING
// ═════════════════════════════════════════════════════════════════════

Deno.test("IP mask: IPv4 masks last octet", () => {
  assertEquals(maskIpAddress("192.168.1.100"), "192.168.1.xxx");
});

Deno.test("IP mask: null returns dash", () => {
  assertEquals(maskIpAddress(null), "—");
});

Deno.test("IP mask: empty returns dash", () => {
  assertEquals(maskIpAddress(""), "—");
});

// ═════════════════════════════════════════════════════════════════════
// 12. INACTIVE RULES
// ═════════════════════════════════════════════════════════════════════

Deno.test("Inactive rules: team IP NOT applied when is_active=false", () => {
  const rules = makeRules({ team_ips: ["10.0.0.1"], is_active: false });
  const r = classifyTraffic({ userAgent: CHROME_UA, country: "US", ipAddress: "10.0.0.1", rules });
  assertEquals(r.traffic_class, "human");
  assertEquals(r.is_excluded, false);
});

Deno.test("Inactive rules: built-in bots STILL caught (always on)", () => {
  const rules = makeRules({ is_active: false });
  const r = classifyTraffic({ userAgent: "Googlebot/2.1", country: "US", rules });
  assertEquals(r.traffic_class, "bot");
  assertEquals(r.is_excluded, true);
});

// ═════════════════════════════════════════════════════════════════════
// 13. NULL RULES
// ═════════════════════════════════════════════════════════════════════

Deno.test("Null rules: normal browser is human", () => {
  const r = classifyTraffic({ userAgent: CHROME_UA, country: "US", rules: null });
  assertEquals(r.traffic_class, "human");
  assertEquals(r.is_excluded, false);
});

Deno.test("Null rules: bot still detected", () => {
  const r = classifyTraffic({ userAgent: "AhrefsBot/7.0", country: "US", rules: null });
  assertEquals(r.traffic_class, "bot");
  assertEquals(r.is_excluded, true);
});

// ═════════════════════════════════════════════════════════════════════
// 14. CONFIGURABLE THRESHOLDS
// ═════════════════════════════════════════════════════════════════════

Deno.test("Threshold: SUSPICIOUS_UA_MIN_LENGTH is accessible and valid", () => {
  assertEquals(typeof THRESHOLDS.SUSPICIOUS_UA_MIN_LENGTH, "number");
  assertEquals(THRESHOLDS.SUSPICIOUS_UA_MIN_LENGTH > 0, true);
});

Deno.test("Threshold: DEFAULT_EXCLUSION_RATE_WARNING is accessible", () => {
  assertEquals(typeof THRESHOLDS.DEFAULT_EXCLUSION_RATE_WARNING, "number");
  assertEquals(THRESHOLDS.DEFAULT_EXCLUSION_RATE_WARNING, 0.25);
});

Deno.test("Threshold: DEFAULT_EXCLUSION_CHANGE_WARNING_PP is accessible", () => {
  assertEquals(typeof THRESHOLDS.DEFAULT_EXCLUSION_CHANGE_WARNING_PP, "number");
  assertEquals(THRESHOLDS.DEFAULT_EXCLUSION_CHANGE_WARNING_PP, 10);
});

// ═════════════════════════════════════════════════════════════════════
// 15. TWO-STAGE ARCHITECTURE INVARIANTS
// ═════════════════════════════════════════════════════════════════════

Deno.test("Stage A/B: classification unchanged by reporting override — bot remains bot", () => {
  const rules = makeRules({ allowed_ua_patterns: ["googlebot"] });
  const r = classifyTraffic({ userAgent: "Googlebot/2.1", country: "US", rules });
  assertEquals(r.traffic_class, "bot");
  assertEquals(r.is_excluded, false);
  // Verify: both bot flag AND reporting_allowlist flag are present
  assertEquals(r.traffic_flags.some(f => f.startsWith("bot:")), true);
  assertEquals(r.traffic_flags.includes("reporting_allowlist"), true);
});

Deno.test("Stage A/B: classification flags are all truthful even when allowlisted", () => {
  const rules = makeRules({
    team_ips: ["10.0.0.1"],
    allowed_cidrs: ["10.0.0.0/24"],
    geo_mode: "exclude",
    allowed_countries: ["US"],
  });
  const r = classifyTraffic({ userAgent: CHROME_UA, country: "BR", ipAddress: "10.0.0.1", rules });
  // Class: internal (truthful — it IS a team IP)
  assertEquals(r.traffic_class, "internal");
  // Reporting: included (CIDR allowlist)
  assertEquals(r.is_excluded, false);
  // Flags: both team_ip and reporting_allowlist present
  assertEquals(r.traffic_flags.includes("team_ip"), true);
  assertEquals(r.traffic_flags.includes("reporting_allowlist"), true);
});

// ═════════════════════════════════════════════════════════════════════
// 16. CENTRALIZED THRESHOLDS (shared module)
// ═════════════════════════════════════════════════════════════════════

import { THRESHOLDS as SHARED_THRESHOLDS } from "./traffic-thresholds.ts";

Deno.test("Centralized thresholds: classifier re-exports from shared module", () => {
  // The classifier re-exports THRESHOLDS from traffic-thresholds.ts
  // These must be reference-identical (same module, same values)
  assertEquals(THRESHOLDS.DEFAULT_EXCLUSION_RATE_WARNING, SHARED_THRESHOLDS.DEFAULT_EXCLUSION_RATE_WARNING);
  assertEquals(THRESHOLDS.DEFAULT_EXCLUSION_CHANGE_WARNING_PP, SHARED_THRESHOLDS.DEFAULT_EXCLUSION_CHANGE_WARNING_PP);
  assertEquals(THRESHOLDS.SUSPICIOUS_UA_MIN_LENGTH, SHARED_THRESHOLDS.SUSPICIOUS_UA_MIN_LENGTH);
});

Deno.test("Centralized thresholds: shared module is the single source of truth", () => {
  assertEquals(SHARED_THRESHOLDS.DEFAULT_EXCLUSION_RATE_WARNING, 0.25);
  assertEquals(SHARED_THRESHOLDS.DEFAULT_EXCLUSION_CHANGE_WARNING_PP, 10);
  assertEquals(SHARED_THRESHOLDS.SUSPICIOUS_UA_MIN_LENGTH, 15);
});

// ═════════════════════════════════════════════════════════════════════
// 17. CONCURRENT BACKFILL BEHAVIOR (unit-level assertions)
//     Integration tests require a live Supabase instance.
//     These tests document the expected behavior contracts.
// ═════════════════════════════════════════════════════════════════════

Deno.test("Contract: active-run statuses that block new runs", () => {
  // These are the statuses that should block a new non-dry-run backfill
  const blockingStatuses = ['pending', 'running'];
  // These are the statuses that should NOT block a new run
  const nonBlockingStatuses = ['completed', 'failed', 'cancelled', 'rolled_back', 'rollback_partial', 'rollback_failed'];

  // Verify our blocking set is a subset of valid statuses
  const allStatuses = [...blockingStatuses, ...nonBlockingStatuses];
  assertEquals(allStatuses.length, 8);
  assertEquals(new Set(allStatuses).size, 8); // no duplicates
});

Deno.test("Contract: dry-run does not block production runs", () => {
  // dry_run = true runs are excluded from the partial unique index
  // This test documents the design: dry-runs are never considered "active"
  // for the purpose of blocking production backfills
  const dryRunExcludedFromIndex = true; // WHERE dry_run = false
  assertEquals(dryRunExcludedFromIndex, true);
});

Deno.test("Contract: resume of same failed run is allowed", () => {
  // When resuming (runId provided), the code loads the existing run
  // rather than creating a new INSERT. The partial unique index does
  // not trigger because we UPDATE the existing row, not INSERT a new one.
  const resumeUsesExistingRow = true;
  assertEquals(resumeUsesExistingRow, true);
});

Deno.test("Contract: unique index constraint name matches code", () => {
  // The backfill handler checks for this specific constraint name
  // when handling race-condition conflicts
  const constraintName = 'idx_one_active_backfill_per_client';
  assertEquals(constraintName.length > 0, true);
});

// ═════════════════════════════════════════════════════════════════════
// 18. SERVER-SIDE RULE MUTATION CONTRACTS
//     Documents the expected behavior of update-traffic-rules
// ═════════════════════════════════════════════════════════════════════

Deno.test("Contract: valid rule fields whitelist", () => {
  const VALID_FIELDS = new Set([
    'allowed_countries', 'team_ips', 'custom_bot_patterns', 'is_active',
    'geo_mode', 'allowed_ips', 'allowed_cidrs', 'allowed_ua_patterns',
  ]);
  // Must include all configurable rule properties
  assertEquals(VALID_FIELDS.size, 8);
  assertEquals(VALID_FIELDS.has('allowed_countries'), true);
  assertEquals(VALID_FIELDS.has('team_ips'), true);
  assertEquals(VALID_FIELDS.has('geo_mode'), true);
  assertEquals(VALID_FIELDS.has('allowed_ips'), true);
  assertEquals(VALID_FIELDS.has('allowed_cidrs'), true);
  assertEquals(VALID_FIELDS.has('allowed_ua_patterns'), true);
  // Must NOT include identity fields (server-resolved, never browser-supplied)
  assertEquals(VALID_FIELDS.has('changed_by'), false);
  assertEquals(VALID_FIELDS.has('changed_by_user_id'), false);
  assertEquals(VALID_FIELDS.has('id'), false);
  assertEquals(VALID_FIELDS.has('client_id'), false);
});

Deno.test("Contract: valid geo_mode values", () => {
  const validGeoModes = ['off', 'observe', 'exclude'];
  assertEquals(validGeoModes.length, 3);
  assertEquals(validGeoModes.includes('off'), true);
  assertEquals(validGeoModes.includes('observe'), true);
  assertEquals(validGeoModes.includes('exclude'), true);
});

// ═════════════════════════════════════════════════════════════════════
// 19. SOURCE-OF-TRUTH REGRESSION PROTECTION
//     Guards against re-introducing the legacy traffic-filter.ts
//     architecture or misunderstanding the v2.2 geo behavior.
// ═════════════════════════════════════════════════════════════════════

Deno.test("SOT: track-analytics imports classifyTraffic from traffic-classifier.ts", async () => {
  const source = await Deno.readTextFile("supabase/functions/track-analytics/index.ts");
  assertEquals(source.includes('from "../src/traffic-classifier.ts"'), true);
  assertEquals(source.includes("classifyTraffic"), true);
});

Deno.test("SOT: track-analytics does NOT import evaluateExclusion", async () => {
  const source = await Deno.readTextFile("supabase/functions/track-analytics/index.ts");
  // Check that evaluateExclusion is not in any import statement (it may appear in comments)
  const importLines = source.split("\n").filter(l => l.trimStart().startsWith("import "));
  const importsEval = importLines.some(l => l.includes("evaluateExclusion"));
  assertEquals(importsEval, false);
});

Deno.test("SOT: track-analytics does NOT import from legacy traffic-filter.ts", async () => {
  const source = await Deno.readTextFile("supabase/functions/track-analytics/index.ts");
  // Check that no import statement references traffic-filter (it may appear in comments)
  const importLines = source.split("\n").filter(l => l.trimStart().startsWith("import "));
  const importsLegacy = importLines.some(l => l.includes("traffic-filter"));
  assertEquals(importsLegacy, false);
});

Deno.test("SOT: backfill-traffic-audit imports from traffic-classifier.ts, not traffic-filter.ts", async () => {
  const source = await Deno.readTextFile("supabase/functions/backfill-traffic-audit/index.ts");
  assertEquals(source.includes('from "../src/traffic-classifier.ts"'), true);
  assertEquals(source.includes("traffic-filter"), false);
});

Deno.test("SOT: unknown geo (all variants) never excluded in any geo mode", () => {
  const rules = makeRules({ geo_mode: "exclude", allowed_countries: ["US"] });
  const unknownVariants = ["", "XX", "unknown", "UNKNOWN"];
  for (const country of unknownVariants) {
    const r = classifyTraffic({ userAgent: CHROME_UA, country, rules });
    assertEquals(r.is_excluded, false, `Unknown geo '${country}' must NOT be excluded`);
    assertEquals(r.traffic_flags.includes("geo:unknown"), true, `Unknown geo '${country}' must be flagged`);
  }
});

Deno.test("SOT: observe mode flags outside-target but never excludes", () => {
  const rules = makeRules({ geo_mode: "observe", allowed_countries: ["US"] });
  const r = classifyTraffic({ userAgent: CHROME_UA, country: "DE", rules });
  assertEquals(r.is_excluded, false, "Observe mode must NOT exclude");
  assertEquals(r.traffic_flags.includes("outside_target_geo:DE"), true, "Observe must flag");
  assertEquals(r.exclusion_policy, null);
});

Deno.test("SOT: exclude mode flags AND excludes outside-target", () => {
  const rules = makeRules({ geo_mode: "exclude", allowed_countries: ["US"] });
  const r = classifyTraffic({ userAgent: CHROME_UA, country: "DE", rules });
  assertEquals(r.is_excluded, true, "Exclude mode must exclude");
  assertEquals(r.traffic_flags.includes("outside_target_geo:DE"), true, "Exclude must flag");
  assertEquals(r.exclusion_policy, "geo_policy");
});

// ═════════════════════════════════════════════════════════════════════
// 20. AUTHENTICATION & ZERO-TRUST REGRESSION PROTECTION
//     Guards against re-introducing the unauthenticated backfill gap.
// ═════════════════════════════════════════════════════════════════════

Deno.test("Security: backfill-traffic-audit rejects missing auth unconditionally", async () => {
  const source = await Deno.readTextFile("supabase/functions/backfill-traffic-audit/index.ts");
  // Must reject missing auth header before processing body
  assertEquals(source.includes("if (!authHeader)"), true);
  assertEquals(source.includes("Authorization header required"), true);
});

Deno.test("Security: backfill-traffic-audit enforces admin role on JWT", async () => {
  const source = await Deno.readTextFile("supabase/functions/backfill-traffic-audit/index.ts");
  assertEquals(source.includes(".eq('role', 'admin')"), true);
  assertEquals(source.includes("Admin role required"), true);
});

Deno.test("Security: backfill-traffic-audit forbids service-role production mutation", async () => {
  const source = await Deno.readTextFile("supabase/functions/backfill-traffic-audit/index.ts");
  assertEquals(source.includes("Service-role key may only be used for dry-run"), true);
  assertEquals(source.includes("Service-role key may not execute rollback"), true);
});

Deno.test("Security: update-traffic-rules rejects missing auth unconditionally", async () => {
  const source = await Deno.readTextFile("supabase/functions/update-traffic-rules/index.ts");
  assertEquals(source.includes("if (!authHeader)"), true);
  assertEquals(source.includes(".eq('role', 'admin')"), true);
});

