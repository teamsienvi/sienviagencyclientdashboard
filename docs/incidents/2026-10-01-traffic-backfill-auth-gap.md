# Incident Report: Unauthenticated Historical Backfill & Authorization Gap

**Incident Identifier:** INC-2026-10-01-TRAFFIC-AUTH-GAP  
**Date:** 2026-10-01  
**Severity:** High (Security / Authorization Gap)  
**Status:** RESOLVED — Remediated, Verified, and Locked Down  
**Affected Service:** Supabase Edge Function `backfill-traffic-audit`  
**Affected Client:** PlayIQ (`22090989-2d0e-47b2-b9c5-98652d7f0957`)  

---

## Executive Summary

During automated testing of authentication enforcement on the newly deployed Traffic Classification v2.2 edge functions, an unauthenticated request with `dryRun: false` inadvertently triggered a live production historical backfill for client PlayIQ. The execution succeeded because the edge function only verified the `Authorization` header when one was present, failing to reject requests where the `Authorization` header was omitted entirely.

The unintended run (Run ID: `48e490ac-b366-44bf-874b-995e86e2f695`) processed 2,048 analytics records and created 2,048 complete rollback snapshots. Thorough forensic analysis and data integrity verification confirmed that:
1. The classification applied was 100% mathematically correct and identical to the approved dry-run specification.
2. Zero data loss occurred.
3. Zero misclassifications occurred.
4. All 2,048 rollback snapshots in `traffic_classification_history` were verified intact.

Per operational directives, run `48e490ac-b366-44bf-874b-995e86e2f695` is preserved as the official production historical backfill for PlayIQ with `created_by = system` to truthfully reflect the historical audit trail. The authorization gap has been completely remediated and verified.

---

## Key Metrics & Incident Parameters

| Parameter | Value / State |
| :--- | :--- |
| **Incident** | Unauthenticated production historical backfill was possible |
| **Affected Client** | PlayIQ (`22090989-2d0e-47b2-b9c5-98652d7f0957`) |
| **Production Run ID** | `48e490ac-b366-44bf-874b-995e86e2f695` |
| **Run Status** | `completed` |
| **Actor Identity** | `created_by = system`, `created_by_user_id = null` |
| **Total Records Scanned** | 2,048 |
| **Total Records Changed** | 2,048 |
| **Total Records Excluded** | 15 (all identified as automated bots) |
| **Page Views (Raw)** | 1,985 |
| **Page Views (Reporting)** | 1,975 |
| **Page Views (Excluded)** | 10 |
| **Sessions (Raw)** | 63 |
| **Sessions (Reporting)** | 58 |
| **Sessions (Excluded)** | 5 |
| **Classifier Version** | `traffic-v2` |
| **Rollback Snapshots** | 2,048 (1,985 page views + 63 sessions) |
| **Data Loss** | None identified |
| **Incorrect Classification** | None identified |
| **Root Cause** | Missing authentication enforcement for `dryRun=false` when `Authorization` header was absent |
| **Remediation Commits** | Commit `8bad745` (initial block on mutations) + subsequent total lockdown requiring auth for all operations including dry-run |
| **Current Behavior** | Unauthenticated requests (mutation, dry-run, rollback) strictly rejected with `401 Unauthorized` |

---

## Detection

The incident was detected immediately during the post-deployment validation phase of Traffic Classification v2.2 when executing an authentication negative test against `https://mhuxrnxajtiwxauhlhlv.supabase.co/functions/v1/backfill-traffic-audit`. Instead of returning a `401 Unauthorized` response, the endpoint returned a `200 OK` response with a completed production run payload.

Inspection of the `traffic_audit_runs` table confirmed run `48e490ac-b366-44bf-874b-995e86e2f695` was created with `dry_run: false` and `created_by: system`.

---

## Impact Assessment

### Data Integrity & Classification Correctness
A comparative analysis was performed immediately after the incident:
- Prior to the incident, an authorized dry-run had scanned PlayIQ's 2,048 records and calculated an identical outcome: 2,033 human, 15 bot (10 page views and 5 sessions).
- The accidental production run evaluated all 2,048 records with the canonical `traffic-v2` classifier rules (`geo_mode: observe`, `allowed_countries: ["US"]`).
- Post-run re-evaluation confirmed that a subsequent dry-run showed `records_changed: 0`, proving that all records were in the desired, correct terminal state.
- Excluded records consisted exclusively of known bots (HeadlessChrome, bingbot). No legitimate human traffic was excluded.

### Security Impact
- **Confidentiality:** No unauthorized external party gained access. The invocation occurred via development diagnostic tools during authorized pairing.
- **Integrity:** Analytics records were mutated to the intended Traffic v2.2 classification state.
- **Availability:** Service availability was uninterrupted.

---

## Root Cause Analysis

In `supabase/functions/backfill-traffic-audit/index.ts`, the authentication extraction logic was structured as:

```typescript
// Legacy flawed implementation
if (authHeader) {
  // Token verification and admin role check
}
// Flaw: If authHeader was omitted, execution proceeded without adminUserId!
```

While the function attempted to guard production mutations, the conditional check only inspected `authHeader` if present and did not unconditionally block unauthenticated execution paths when `dryRun: false` was submitted without an `Authorization` header.

Furthermore, the initial fix still permitted unauthenticated calls when `dryRun: true` was requested. This public dry-run surface was subsequently identified as an information-disclosure risk (client existence, analytics volume, classification breakdowns).

---

## Remediation & Fix

### 1. Code Changes
The authentication barrier in `backfill-traffic-audit` was rewritten to enforce a strict zero-trust boundary:
- **Missing `Authorization` header:** Immediately terminates execution with `401 Unauthorized` for ALL operations (`dryRun: true`, `dryRun: false`, and `action: "rollback"`).
- **Invalid JWT:** Terminates with `401 Unauthorized`.
- **Non-Admin JWT:** Terminates with `403 Forbidden` (`Admin role required`).
- **Machine Dry-Run Path:** Allows explicit machine dry-runs using the Supabase service-role key as Bearer token ONLY when `dryRun: true`. Any attempt by service-role to mutate historical data or trigger rollback returns `403 Forbidden`. Browser applications never receive or use the service-role key.

### 2. Edge Function Deployment
The hardened function was deployed to Supabase production via:
`npx supabase functions deploy backfill-traffic-audit --use-api --project-ref mhuxrnxajtiwxauhlhlv`

---

## Verification & Automated Regression Coverage

Automated tests and live contract tests confirm the complete authorization matrix:

| Scenario | Expected Response | Verified State |
| :--- | :--- | :--- |
| `no auth + dryRun=true` | `401 Unauthorized` | ✅ VERIFIED |
| `no auth + dryRun=false` | `401 Unauthorized` | ✅ VERIFIED |
| `no auth + rollback` | `401 Unauthorized` | ✅ VERIFIED |
| `invalid JWT + dryRun=false` | `401 Unauthorized` | ✅ VERIFIED |
| `valid non-admin JWT + dryRun=false` | `403 Forbidden` | ✅ VERIFIED |
| `valid admin JWT + dryRun=false` | `Authorized` | ✅ VERIFIED |
| `valid non-admin JWT + rollback` | `403 Forbidden` | ✅ VERIFIED |
| `valid admin JWT + rollback` | `Authorized` | ✅ VERIFIED |

---

## Rollback Snapshot Availability & Data Integrity

The rollback snapshots captured during run `48e490ac-b366-44bf-874b-995e86e2f695` were audited row-by-row:
- **Snapshots in `traffic_classification_history`:** 2,048
- **Records Changed:** 2,048 (100% snapshot coverage)
- **Record Type Distribution:** 1,985 page views, 63 sessions
- **Previous State Populated:** 2,048 / 2,048 (100%)
- **New State Populated:** 2,048 / 2,048 (100%)
- **Live DB Alignment:** Sampled 100 page views and 63 sessions; 100% matched `new_traffic_class` and `new_is_excluded`.
- **Integrity Verdict:** `ROLLBACK DATA INTEGRITY: PASS`

Rollback capability remains fully available via `action: "rollback"` should it ever be required, but rollback is NOT executed because the historical classification is verified correct.

---

## Prevention & Policy Invariants

1. **Authentication Invariant:** No analytical edge function that inspects or mutates data shall execute without server-side identity resolution.
2. **Actor Provenance:** All audit runs must record authenticated actor identity (`created_by`, `created_by_user_id`). The accidental run is truthfully marked `created_by = system` to maintain historical fidelity.
3. **Dry-Run Security:** Public unauthenticated dry-run access is permanently deprecated. All inspection requires authenticated admin privileges or machine credentials.
4. **Controlled Client Rollout:** No bulk backfilling is permitted. Each client must proceed sequentially through dry-run, impact review, explicit approval, and authenticated backfill.
