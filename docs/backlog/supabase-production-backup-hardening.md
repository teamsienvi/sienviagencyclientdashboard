# Infrastructure Backlog: Supabase Production Database Backup Hardening

**Item ID:** BACKLOG-INFRA-SUPABASE-BACKUP  
**Status:** Open / Proposed  
**Priority:** High (Disaster Recovery & Business Continuity)  
**Component:** Database Infrastructure & Disaster Recovery  
**Target Project:** `mhuxrnxajtiwxauhlhlv` ("Sienvi Client Analytics Dashboard", ap-southeast-1)  
**Created:** 2026-10-01  

---

## 1. Problem Statement & Current Risk Assessment

During the production closeout and certification of Traffic Classification v2.2, direct empirical inspection of the production Supabase project settings in Microsoft Edge confirmed the current backup posture:

| Metric | Verified Production State |
| :--- | :--- |
| **Supabase Plan Tier** | Free Plan |
| **Automatic Scheduled Backups** | **NO** (Not included on Free Plan) |
| **Latest Verified Backup** | **NONE** |
| **Backup Retention Period** | **NONE** |
| **Point in Time Recovery (PITR)** | **DISABLED** (Requires Pro Plan + Add-on) |

### Operational Risk
* **Application Layer Safety:** Traffic Classification v2.2 maintains deterministic Level 2 application-level rollback via `traffic_classification_history` (2,048 snapshots verified intact for PlayIQ). Classification errors can be reverted with `action: "rollback"`.
* **Database Disaster Recovery Gap:** In the event of catastrophic data corruption, infrastructure failure, accidental table drop, or database-wide loss, **no automated database-level backup exists** to restore the project to a prior point in time.
* **Scope Note:** This gap is an infrastructure-tier constraint and is **NOT** a defect in the Traffic Classification v2.2 code or data quality engine.

---

## 2. Evaluation of Hardening Options

### Option A — Upgrade Supabase Project to Pro Plan (Recommended Baseline)
* **Description:** Upgrade the project from Free to Pro ($25/month).
* **Capabilities Provided:**
  * Automated daily database backups taken around midnight in the project region (`ap-southeast-1`).
  * 7-day backup retention.
  * Direct one-click snapshot restoration via the Supabase Dashboard.
  * Increased compute and egress quotas for scaling multi-client ingestion.
* **Pros:** Native platform integration, zero custom scripts or maintenance, official Supabase SLA.
* **Cons:** Monthly hosting cost ($25/mo).
* **Recommendation:** Strongly recommended as the immediate operational baseline for an agency production database.

---

### Option B — Scheduled External PostgreSQL Backup / Export Workflow
* **Description:** Implement a scheduled GitHub Action or server-side cron job executing a secure `pg_dump` or Supabase CLI export directly into an encrypted S3/GCS bucket.
* **Requirements & Standards:**
  * Must follow Sienvi Agency security standards: secrets stored server-side only in repository secrets or vault.
  * Cloud-native CLI tooling only (`pg_dump` with SSL / `supabase db dump`).
  * Strict prohibition on unvetted third-party automation platforms or webhooks.
  * Target storage must enforce AES-256 encryption at rest and lifecycle expiration (e.g. 30-day retention).
* **Pros:** Works on Free Plan; allows off-site disaster recovery independent of Supabase.
* **Cons:** Requires maintenance of export workflows, monitoring for failure alerting, and credential rotation.

---

### Option C — Point-in-Time Recovery (PITR)
* **Description:** Add continuous physical write-ahead log (WAL) archiving to allow restoration down to a specific second.
* **Capabilities Provided:** Granular restoration to any specific second within a rolling 7-day window.
* **Cost:** Pro Plan ($25/mo) + PITR Add-on ($100/mo).
* **Evaluation:** At current analytics volumes (PlayIQ: ~2,000 records; Snarky: ~17,000 records), PITR is not immediately cost-effective. However, Option C should be re-evaluated when agency client count and real-time transaction volumes warrant sub-minute disaster recovery.

---

## 3. Implementation Guardrails

When this backlog item is scheduled for execution:
1. Do not introduce untrusted third-party automation services.
2. All database connection strings and service keys must remain strictly in server-side environment variables or secrets vaults.
3. Test a mock restore into a sandbox database to verify dump validity before certifying disaster recovery.
