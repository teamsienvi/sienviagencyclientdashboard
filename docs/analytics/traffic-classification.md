# Traffic Classification System — Architecture Reference

> **Canonical Classifier**: [`traffic-classifier.ts`](file:///c:/Users/Iris/OneDrive/Work/sienviagencyclientdashboard/supabase/functions/src/traffic-classifier.ts)  
> **Version**: v2.2 (`traffic-v2`)  
> **Status**: Production  
> **Rollout**: Controlled client-by-client  
> **Last updated**: 2026-10-01  

---

## 1. System Overview

The Traffic Classification system governs data quality and analytics hygiene across the Sienvi Agency Client Dashboard. It determines what each incoming analytics event **is** (evidence-based classification) and whether it should appear in **client KPI reporting** (policy-based reporting).

The system operates as a strict two-stage pipeline:

```text
Visitor Event → track-analytics → classifyTraffic() 
                    ↓
        STAGE A — CLASSIFICATION (Truthful evidence)
                    ↓
        STAGE B — REPORTING POLICY (Allowlist / Exclusions)
                    ↓
        Database Persistence & Client KPI Views
```

### Stage A — Traffic Classification
Determines what the traffic actually **is**, based strictly on empirical evidence. Classification is immutable and is never falsified by allowlists or client preferences.

| Priority | Rule | Resulting Class |
| :--- | :--- | :--- |
| 1 | Built-in known bot user-agent (50+ patterns) | `bot` |
| 2 | Custom bot user-agent patterns (client-configured) | `bot` |
| 3 | Suspicious automation (short/empty user-agent < 15 chars) | `suspicious` |
| 4 | Team / internal IP or CIDR match | `internal` |
| 5 | Standard browser pattern | `human` |

### Stage B — Reporting Policy
Determines `is_excluded` based on classification rules and allowlists. Reporting allowlists override `is_excluded` to `false`, but **never** alter `traffic_class` (a bot remains classified as `bot`).

| Priority | Policy Rule | Reporting Effect |
| :--- | :--- | :--- |
| 1 | Reporting allowlist match (IP, CIDR, UA pattern) | `is_excluded = false` (`reporting_allowlist` flag) |
| 2 | Internal traffic exclusion | `is_excluded = true` (`internal_traffic` policy) |
| 3 | Known or custom bot exclusion | `is_excluded = true` (`known_bot` / `custom_bot`) |
| 4 | Suspicious automation exclusion | `is_excluded = true` (`suspicious_automation`) |
| 5 | Geographic reporting policy | Governed by `geo_mode` (see Section 2) |
| 6 | Default policy | `is_excluded = false` (included in client KPIs) |

---

## 2. Geographic Reporting Policy (`geo_mode`)

The geographic reporting behavior is controlled dynamically per client by `geo_mode`, **not** by the mere presence of `allowed_countries`.

* **`off`**: Geographic filtering disabled. `allowed_countries` is ignored.
* **`observe` (Default)**: Outside-target country traffic is **flagged** for visibility but **included** in reporting (`traffic_flags += outside_target_geo:XX`, `is_excluded = false`).
* **`exclude`**: Outside-target country traffic is **flagged and excluded** from reporting (`is_excluded = true`, `exclusion_policy = geo_policy`).

### Unknown Geography Invariant
When country code is unknown (`null`, `""`, `"XX"`, `"unknown"`):
- Flagged with `geo:unknown`
- **NEVER excluded solely because geography is unknown**, in all modes (including `exclude`).

### Seed Configuration
Initial database migration seeded `allowed_countries = ["US"]` with `geo_mode = "observe"`. Non-US human traffic is never excluded unless an administrator explicitly updates the client configuration to `geo_mode = "exclude"`.

---

## 3. Security & Authorization Model

Traffic Classification operations adhere to a strict **zero-trust authentication architecture**:
1. **Public Ingestion**: `track-analytics` accepts public analytics events and runs `classifyTraffic()` server-side.
2. **Rule Mutation**: [`update-traffic-rules`](file:///c:/Users/Iris/OneDrive/Work/sienviagencyclientdashboard/supabase/functions/update-traffic-rules/index.ts) requires a valid user JWT with `role = 'admin'` in `user_roles`. Identity (`changed_by_user_id`) is strictly extracted from server-validated JWT tokens, never accepted from client request payloads. All changes append an immutable record to `traffic_rule_audit_log`.
3. **Historical Backfill & Rollback**: [`backfill-traffic-audit`](file:///c:/Users/Iris/OneDrive/Work/sienviagencyclientdashboard/supabase/functions/backfill-traffic-audit/index.ts) rejects unauthenticated requests with `401 Unauthorized` unconditionally (covering `dryRun: false`, `dryRun: true`, and `action: "rollback"`). Non-admin JWTs are rejected with `403 Forbidden`. Authenticated machine dry-runs require explicit Bearer service-role tokens. Service-role credentials cannot execute mutations or rollbacks.

---

## 4. Backfill, Dry-Run & Rollback Procedure

Historical reclassification processes analytics in cursor-based batches:
* **Dry-Run Requirement**: Rollout for any client must begin with an authenticated `dryRun: true`. Dry-runs calculate separate page-view and session statistics without database mutation.
* **Per-Table Breakdown**: The engine independently computes metrics for `web_analytics_page_views` and `web_analytics_sessions`.
* **Concurrency Lock**: Enforces a strict maximum of one active production run per client via `traffic_audit_runs` unique constraint.
* **Snapshot Rollback (Level 2)**: Prior to updating rows in a production backfill, exact snapshots of previous states are saved to `traffic_classification_history`. The `action: "rollback"` endpoint provides deterministic restoration.

### Four-Level Recovery Hierarchy
1. **Level 1**: Classifier function rollback (redeploy previous edge function).
2. **Level 2**: Deterministic audit-run rollback via `traffic_classification_history` (primary recovery).
3. **Level 3**: Corrected versioned reclassification (rerun with updated rules).
4. **Level 4**: Database disaster recovery.

---

## 5. Incident Reference & Production PlayIQ State

* **Incident Documentation**: [`docs/incidents/2026-10-01-traffic-backfill-auth-gap.md`](file:///c:/Users/Iris/OneDrive/Work/sienviagencyclientdashboard/docs/incidents/2026-10-01-traffic-backfill-auth-gap.md)  
  Documents the authorization gap discovered during deployment testing where unauthenticated requests could trigger mutations. The flaw was remediated in commits `8bad745` and `e23128a`.
* **PlayIQ Production Historical Run**:
  * **Run ID**: `48e490ac-b366-44bf-874b-995e86e2f695`
  * **Actor**: `created_by = system` (preserved truthfully)
  * **Status**: `completed`
  * **Records Processed**: 2,048 (1,985 page views + 63 sessions)
  * **Exclusions**: 15 (10 page views + 5 sessions, 100% confirmed bots)
  * **Reconciliation**: 1,975 reporting PVs + 10 excluded PVs = 1,985 total; 58 reporting sessions + 5 excluded sessions = 63 total.
  * **Rollback Snapshots**: 2,048 snapshots verified intact (`ROLLBACK DATA INTEGRITY: PASS`).
  * **Status**: Completed. PlayIQ must **not** be backfilled again.

---

## 6. Component Map

| Component | Path | Function |
| :--- | :--- | :--- |
| **Classification Engine** | [`traffic-classifier.ts`](file:///c:/Users/Iris/OneDrive/Work/sienviagencyclientdashboard/supabase/functions/src/traffic-classifier.ts) | Canonical source of truth: `classifyTraffic()`, `rulesFromDbRow()` |
| **Ingestion Edge Function** | [`track-analytics/index.ts`](file:///c:/Users/Iris/OneDrive/Work/sienviagencyclientdashboard/supabase/functions/track-analytics/index.ts) | Real-time page view and session ingestion |
| **Rule Mutation Function** | [`update-traffic-rules/index.ts`](file:///c:/Users/Iris/OneDrive/Work/sienviagencyclientdashboard/supabase/functions/update-traffic-rules/index.ts) | Server-side rule upsert and audit logging |
| **Backfill Function** | [`backfill-traffic-audit/index.ts`](file:///c:/Users/Iris/OneDrive/Work/sienviagencyclientdashboard/supabase/functions/backfill-traffic-audit/index.ts) | Authenticated backfill, dry-run, and rollback |
| **Shared Thresholds** | [`traffic-thresholds.ts`](file:///c:/Users/Iris/OneDrive/Work/sienviagencyclientdashboard/supabase/functions/src/traffic-thresholds.ts) | Centralized constants shared across edge functions and React |
| **Admin UI Panel** | [`TrafficAuditPanel.tsx`](file:///c:/Users/Iris/OneDrive/Work/sienviagencyclientdashboard/components/analytics/TrafficAuditPanel.tsx) | Client admin interface for rules, dry-run, and audit runs |
| **Test Suite** | [`traffic-classifier.test.ts`](file:///c:/Users/Iris/OneDrive/Work/sienviagencyclientdashboard/supabase/functions/src/traffic-classifier.test.ts) | 71 automated tests across 20 functional and security sections |
| **Legacy Shim** | [`traffic-filter.ts`](file:///c:/Users/Iris/OneDrive/Work/sienviagencyclientdashboard/supabase/functions/src/traffic-filter.ts) | Deprecated compatibility module (no active imports) |
