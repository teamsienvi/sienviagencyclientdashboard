# Runbook: Traffic Classification v2.2 Controlled Client Rollout

**Document ID:** RB-TRAFFIC-V2-ROLLOUT  
**Version:** 1.0  
**Effective Date:** 2026-10-01  
**Audience:** Sienvi Agency Engineering, Operations & Data Quality Teams  
**Governing Standard:** Traffic Classification v2.2 Architecture Reference  

---

## 1. Rollout Philosophy & Invariants

Traffic classification alters client-facing KPI metrics by removing illegitimate automation, bot spiders, and internal team traffic. To protect client trust, reporting accuracy, and auditability:

1. **Client-by-Client Only:** Bulk automated backfills across all clients are strictly prohibited. Every client must be processed individually.
2. **Mandatory Dry-Run:** Every rollout must execute a dry-run first to capture projected KPI changes.
3. **Explicit Approval Gate:** A successful dry-run is **NOT** authorization for production backfill. Production backfill requires explicit stakeholder review and approval.
4. **Zero-Trust Authentication:** All dry-runs, production mutations, and rollbacks require authenticated administrator credentials.
5. **No Historical Data Rule:** Clients with 0 historical analytics records must **NOT** be backfilled. They transition directly to live real-time classification.

```text
[1. CLIENT ELIGIBILITY]
          ↓
    [2. DRY-RUN]
          ↓
 [3. IMPACT REVIEW]
          ↓
[4. EXPLICIT APPROVAL] ── (Stop if unapproved)
          ↓
[5. PRODUCTION BACKFILL]
          ↓
 [6. RECONCILIATION]
          ↓
[7. HISTORY VERIFICATION]
          ↓
    [8. COMPLETE]
```

---

## 2. Phase 1 — Client Eligibility Verification

Before initiating any operation for a candidate client:

1. **Verify Analytics Volume:** Check whether historical records exist in `web_analytics_page_views` and `web_analytics_sessions`:
   ```sql
   SELECT 
     (SELECT count(*) FROM web_analytics_page_views WHERE client_id = '<CLIENT_UUID>') AS pv_count,
     (SELECT count(*) FROM web_analytics_sessions WHERE client_id = '<CLIENT_UUID>') AS session_count;
   ```
   * **If count = 0:** Do NOT run an empty historical backfill. Mark:
     ```text
     NO HISTORICAL DATA — BACKFILL NOT REQUIRED
     ```
     Live ingestion via `track-analytics` will classify future events automatically upon deployment.
   * **If count > 0:** Proceed to configuration inspection.

2. **Verify Client Traffic Rules:** Ensure `client_traffic_rules` exists and is populated:
   * `geo_mode`: Verify expected mode (`observe`, `exclude`, or `off`). Default must be `observe`.
   * `allowed_countries`: Confirm intended target geographies.
   * `team_ips`: Confirm known agency and client internal IPs/CIDRs.
   * `custom_bot_patterns`: Confirm known client monitoring agents or crawler signatures.
   * `allowed_ips` / `allowed_cidrs` / `allowed_ua_patterns`: Verify reporting allowlist overrides.

3. **Verify Concurrency Lock:** Confirm no active audit run exists for this client:
   ```sql
   SELECT id, status, dry_run, created_at 
   FROM traffic_audit_runs 
   WHERE client_id = '<CLIENT_UUID>' AND status IN ('pending', 'running') AND dry_run = false;
   ```
   If an active production run exists, **STOP**. Resolve the active run before proceeding.

---

## 3. Phase 2 — Authenticated Dry-Run Execution

Execute an authenticated dry-run using the `backfill-traffic-audit` edge function:

```bash
curl -X POST https://<SUPABASE_URL>/functions/v1/backfill-traffic-audit \
  -H "Authorization: Bearer <ADMIN_USER_JWT>" \
  -H "Content-Type: application/json" \
  -d '{
    "clientId": "<CLIENT_UUID>",
    "dryRun": true
  }'
```

*(Alternatively, trigger via the **Traffic Classification & Audit Panel** in the Admin Dashboard while logged in as an administrator).*

### Output Requirements
The response returns independent breakdowns for page views and sessions:

```text
PAGE VIEWS:
- Raw Count:                [Total scanned]
- Current Reporting Count:  [Currently is_excluded = false]
- Projected Reporting Count:[Dry-run would_include - would_exclude]
- Human:                    [Stage A human class]
- Bot:                      [Stage A bot class]
- Internal:                 [Stage A internal class]
- Suspicious:               [Stage A suspicious class]
- Unknown:                  [Stage A unknown class]
- Would Exclude:            [Count newly marked is_excluded = true]
- Would Include:            [Count newly marked is_excluded = false]
- Absolute KPI Delta:       [Projected - Current]
- Percentage KPI Delta:     [Delta / Current * 100]%

SESSIONS:
- Raw Count:                [Total scanned]
- Current Reporting Count:  [Currently is_excluded = false]
- Projected Reporting Count:[Dry-run would_include - would_exclude]
- Human:                    [Stage A human class]
- Bot:                      [Stage A bot class]
- Internal:                 [Stage A internal class]
- Suspicious:               [Stage A suspicious class]
- Unknown:                  [Stage A unknown class]
- Would Exclude:            [Count newly marked is_excluded = true]
- Would Include:            [Count newly marked is_excluded = false]
- Absolute KPI Delta:       [Projected - Current]
- Percentage KPI Delta:     [Delta / Current * 100]%
```

> [!WARNING]
> **CRITICAL RULE:** Never estimate session impact from page-view statistics. Both tables must be independently evaluated and reported.

---

## 4. Phase 3 — Impact Review

Evaluate the dry-run metrics against operational thresholds:

1. **Exclusion Rate Warning:** If total exclusions exceed **25%** of raw traffic, trigger an operational review.
2. **KPI Movement Warning:** If reporting volume shifts by more than **10 percentage points**, investigate the specific exclusion policies responsible.
3. **Bot & Suspicious Volume:** Inspect top user agents flagged under `known_bot`, `custom_bot`, and `suspicious_automation`. Confirm no legitimate browser UAs are caught.
4. **Internal IP Check:** Verify internal exclusions match actual client/agency office IPs.
5. **Geographic Check:** Review flagged `outside_target_geo` entries. Confirm `geo_mode` behavior matches client expectations (in `observe` mode, outside-target traffic must NOT be excluded).
6. **Unknown Geography Safety:** Confirm that records with unknown country (`geo:unknown`, `XX`, null) remain included in reporting (`is_excluded = false`).

> [!NOTE]
> Configured warning thresholds are advisory. They require human investigation and must **never** automatically alter client policies.

---

## 5. Phase 4 — Explicit Approval Gate

### 🛑 STOP POINT
A completed dry-run produces zero database mutations. **Do NOT proceed automatically to production backfill.**

```text
DRY-RUN SUCCESS ≠ PRODUCTION AUTHORIZATION
```

The operator must document the dry-run impact report and present it for explicit approval from the client lead or account manager:
* Affected client name and UUID
* Total records scanned
* Projected KPI movement (% change in reported page views and sessions)
* Identified bot spiders and internal IP exclusions
* Rollback plan confirmation

**Proceed to Phase 5 ONLY after explicit approval is recorded.**

---

## 6. Phase 5 — Authenticated Production Backfill

Once explicit approval is granted:

1. **Pre-Execution Sanity Check:**
   * Confirm exact client UUID matches the approved dry-run.
   * Confirm client traffic rules have not been altered since dry-run.
   * Confirm table `traffic_classification_history` is accessible.
   * Confirm no other audit runs are active.

2. **Execute Production Backfill:**
   Trigger the production backfill with `dryRun: false` and authenticated admin authorization:
   ```bash
   curl -X POST https://<SUPABASE_URL>/functions/v1/backfill-traffic-audit \
     -H "Authorization: Bearer <ADMIN_USER_JWT>" \
     -H "Content-Type: application/json" \
     -d '{
       "clientId": "<CLIENT_UUID>",
       "dryRun": false
     }'
   ```

3. **Execution Safety Invariant:**
   * Edge function runs cursor-based pagination (default 1,000 batch size).
   * Before updating live rows, exact previous states are written to `traffic_classification_history`.
   * If interrupted by network timeout, the run is resumable via cursor checkpointing.

---

## 7. Phase 6 — Post-Backfill Reconciliation

Immediately following backfill completion, perform two independent mathematical reconciliations:

### 1. Page View Reconciliation
```text
RAW PAGE VIEWS = REPORTING PAGE VIEWS + EXCLUDED PAGE VIEWS
```
Query:
```sql
SELECT
  count(*) AS raw_pv,
  count(*) FILTER (WHERE is_excluded = false) AS reporting_pv,
  count(*) FILTER (WHERE is_excluded = true) AS excluded_pv
FROM web_analytics_page_views
WHERE client_id = '<CLIENT_UUID>';
```
**Verification:** `raw_pv == reporting_pv + excluded_pv` must be **PASS**.

### 2. Session Reconciliation
```text
RAW SESSIONS = REPORTING SESSIONS + EXCLUDED SESSIONS
```
Query:
```sql
SELECT
  count(*) AS raw_sessions,
  count(*) FILTER (WHERE is_excluded = false) AS reporting_sessions,
  count(*) FILTER (WHERE is_excluded = true) AS excluded_sessions
FROM web_analytics_sessions
WHERE client_id = '<CLIENT_UUID>';
```
**Verification:** `raw_sessions == reporting_sessions + excluded_sessions` must be **PASS**.

---

## 8. Phase 7 — History & Audit Verification

Verify the audit trail and rollback snapshots:

1. **Audit Run Record:**
   ```sql
   SELECT id, status, dry_run, records_scanned, records_changed, records_excluded, created_by, created_by_user_id, completed_at
   FROM traffic_audit_runs
   WHERE id = '<AUDIT_RUN_UUID>';
   ```
   * `status` must be `completed`.
   * `created_by` and `created_by_user_id` must reflect the authenticated administrator.
   * `completed_at` must be populated.

2. **Rollback Snapshot Integrity:**
   ```sql
   SELECT count(*) 
   FROM traffic_classification_history 
   WHERE audit_run_id = '<AUDIT_RUN_UUID>';
   ```
   * Snapshot count must equal `records_changed`.
   * Confirm `previous_is_excluded` and `new_is_excluded` are 100% populated.

3. **Field Population Check:**
   Confirm all updated records have:
   * `audit_version = 'traffic-v2'`
   * `evaluated_at IS NOT NULL`
   * `traffic_class` populated (`human`, `bot`, `internal`, `suspicious`)

> [!CAUTION]
> If any reconciliation check fails, immediately flag as:
> `HOLD — INVESTIGATION REQUIRED`
> Evaluate whether Level 2 Rollback is necessary.

---

## 9. Phase 8 — Rollback Policy & Procedure

If a production backfill applies incorrect classifications or client rules were misconfigured, execute rollback:

### Rollback Recovery Hierarchy
* **Level 1 (Classifier Rollback):** Redeploy previous function code if a classifier logic bug is detected.
* **Level 2 (Deterministic Audit Run Rollback):** Primary recovery mechanism. Reverts exact state per snapshot:
  ```bash
  curl -X POST https://<SUPABASE_URL>/functions/v1/backfill-traffic-audit \
    -H "Authorization: Bearer <ADMIN_USER_JWT>" \
    -H "Content-Type: application/json" \
    -d '{
      "action": "rollback",
      "runId": "<AUDIT_RUN_UUID>"
    }'
  ```
  The function reads `traffic_classification_history`, detects if any newer audit run touched the same row, restores the exact previous state, and records audit run status as `rolled_back`.
* **Level 3 (Corrected Versioned Reclassification):** Fix client rules in `client_traffic_rules` and rerun a fresh controlled rollout.
* **Level 4 (Database Disaster Recovery):** Restoring from PostgreSQL physical/logical backup if application-level recovery is compromised.
