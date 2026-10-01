# Traffic Classification System — Architecture Reference

> **Source of truth**: [`traffic-classifier.ts`](file:///c:/Users/Iris/OneDrive/Work/sienviagencyclientdashboard/supabase/functions/src/traffic-classifier.ts)
> **Version**: v2.2 (`traffic-v2`)
> **Last updated**: 2026-10-01

## System Overview

The Traffic Classification system determines what each analytics event **is** (bot, human, internal, suspicious) and whether it should appear in **client KPI reporting**.

It operates as a two-stage pipeline:

```
Visitor → track-analytics → classifyTraffic() → Stage A (Classification) → Stage B (Reporting Policy) → Persist
```

### Stage A — Traffic Classification

Determines what the traffic actually **is**, based on evidence. Classification is never modified by allowlists or reporting policy.

| Priority | Rule | Class |
|----------|------|-------|
| 1 | Built-in known bot UA (50+ patterns) | `bot` |
| 2 | Custom bot UA patterns (per-client) | `bot` |
| 3 | Suspicious automation (short/empty UA) | `suspicious` |
| 4 | Team / internal IP match | `internal` |
| 5 | Default | `human` |

### Stage B — Reporting Policy

Decides `is_excluded` based on classification + rules. Allowlists may override `is_excluded` but **never** change `traffic_class`.

| Priority | Rule | Effect |
|----------|------|--------|
| 1 | Reporting allowlist (IP, CIDR, UA pattern) | `is_excluded = false` |
| 2 | Internal traffic | `is_excluded = true` |
| 3 | Known/custom bot | `is_excluded = true` |
| 4 | Suspicious automation | `is_excluded = true` |
| 5 | Geographic reporting policy | Depends on `geo_mode` (see below) |
| 6 | Default include | `is_excluded = false` |

---

## Geographic Reporting Policy (`geo_mode`)

The geographic reporting behavior is controlled by `geo_mode`, **not** by the mere presence of `allowed_countries`.

### `off`
No geo-based reporting action. `allowed_countries` is ignored.

### `observe` (default)
Outside-target country traffic is **flagged** but **included** in reporting:
- `traffic_flags += outside_target_geo:XX`
- `is_excluded` remains `false`

### `exclude`
Outside-target country traffic is **flagged** and **excluded** from reporting:
- `traffic_flags += outside_target_geo:XX`
- `is_excluded = true`
- `exclusion_policy = geo_policy`

### Unknown Geography
Values such as `null`, `""`, `"XX"`, `"unknown"` are:
- Flagged as `geo:unknown`
- **Never** excluded solely because geography is unknown
- This applies in all geo modes, including `exclude`

### US-Only Seed Data
The original v1 migration seeded `allowed_countries = ["US"]` for active clients. This does **not** mean all non-US traffic is excluded, because v2.2 defaults `geo_mode` to `"observe"`. Non-US traffic is only excluded when an administrator explicitly sets `geo_mode = "exclude"`.

---

## Component Map

### Source of Truth (Classification Engine)
| File | Role |
|------|------|
| [`traffic-classifier.ts`](file:///c:/Users/Iris/OneDrive/Work/sienviagencyclientdashboard/supabase/functions/src/traffic-classifier.ts) | **Canonical** classification engine — `classifyTraffic()` |

### Active Ingestion
| File | Role |
|------|------|
| [`track-analytics/index.ts`](file:///c:/Users/Iris/OneDrive/Work/sienviagencyclientdashboard/supabase/functions/track-analytics/index.ts) | Real-time page view + session ingestion, calls `classifyTraffic()` |

### Rule Mutation
| File | Role |
|------|------|
| [`update-traffic-rules/index.ts`](file:///c:/Users/Iris/OneDrive/Work/sienviagencyclientdashboard/supabase/functions/update-traffic-rules/index.ts) | Server-side rule upsert + audit logging |

### Historical Processing
| File | Role |
|------|------|
| [`backfill-traffic-audit/index.ts`](file:///c:/Users/Iris/OneDrive/Work/sienviagencyclientdashboard/supabase/functions/backfill-traffic-audit/index.ts) | Cursor-based backfill + rollback |

### Rollback / History
| Table | Role |
|-------|------|
| `traffic_audit_runs` | Backfill run tracking (status, stats, cursor) |
| `traffic_classification_history` | Per-row snapshots for deterministic rollback |

### Admin UI
| File | Role |
|------|------|
| [`TrafficAuditPanel.tsx`](file:///c:/Users/Iris/OneDrive/Work/sienviagencyclientdashboard/components/analytics/TrafficAuditPanel.tsx) | Dashboard panel: rules config, backfill/rollback, stats |

### Shared Thresholds
| File | Role |
|------|------|
| [`traffic-thresholds.ts`](file:///c:/Users/Iris/OneDrive/Work/sienviagencyclientdashboard/supabase/functions/src/traffic-thresholds.ts) | Runtime-neutral thresholds shared between Edge Functions and React |

### Tests
| File | Role |
|------|------|
| [`traffic-classifier.test.ts`](file:///c:/Users/Iris/OneDrive/Work/sienviagencyclientdashboard/supabase/functions/src/traffic-classifier.test.ts) | Deno test suite — 40+ tests covering all classification and policy scenarios |

---

## Legacy (Non-Authoritative)

| File | Status | Notes |
|------|--------|-------|
| [`traffic-filter.ts`](file:///c:/Users/Iris/OneDrive/Work/sienviagencyclientdashboard/supabase/functions/src/traffic-filter.ts) | **DEPRECATED** | v1 binary exclusion engine. Preserved for rollback compatibility only. Has no active imports. |

Key differences from v2.2:
- v1 used binary `is_excluded` with no `traffic_class`, `traffic_flags`, or `exclusion_policy`
- v1 geo behavior: country NOT in `allowed_countries` → automatic exclusion (no `geo_mode`)
- v2.2 separates classification (Stage A) from reporting policy (Stage B)

---

## Persisted Fields (v2.2)

Each page view and session record stores:

| Field | Description |
|-------|-------------|
| `traffic_class` | `bot` / `internal` / `suspicious` / `human` / `unknown` |
| `traffic_flags` | Array of classification metadata strings |
| `is_excluded` | Whether the record is excluded from KPI reporting |
| `exclude_reason` | Human-readable reason (backward compat with v1) |
| `exclusion_policy` | Policy that triggered exclusion (`known_bot`, `custom_bot`, `internal_traffic`, `suspicious_automation`, `geo_policy`) |
| `audit_version` | Classifier version stamp (`traffic-v2`) |
| `evaluated_at` | ISO 8601 UTC timestamp of classification |
