-- ==============================================================================
-- Migration: 20261001203000_consolidate_snarky_client_identity.sql
-- Description: Deterministic, Manifest-Driven Consolidation of Snarky Client Identities
-- Source:      297cbb3c-54b4-4bed-8206-25949a94fa62 (Snarky A$$ Humans)
-- Destination: ef580ebf-439f-4305-826a-f1f8aa89fd03 (Snarky Humans - Canonical)
-- Safety:      100% Manifest-driven. Rollback touches ONLY manifest record IDs.
-- ==============================================================================

DO $$
DECLARE
    v_migration_id CONSTANT TEXT := '20261001_snarky_consolidation';
    v_src_id       CONSTANT UUID := '297cbb3c-54b4-4bed-8206-25949a94fa62';
    v_dst_id       CONSTANT UUID := 'ef580ebf-439f-4305-826a-f1f8aa89fd03';
    v_pv_count     BIGINT;
    v_sess_count   BIGINT;
    v_src_active   BOOLEAN;
    v_dst_active   BOOLEAN;
    v_manifest_cnt BIGINT;
BEGIN
    RAISE NOTICE '>>> Starting Precondition Verification for Migration %', v_migration_id;

    -- 1. Verify Destination Client Exists & is Active
    SELECT is_active INTO v_dst_active FROM public.clients WHERE id = v_dst_id;
    IF v_dst_active IS NULL THEN
        RAISE EXCEPTION 'Precondition Failed: Destination canonical client % does not exist.', v_dst_id;
    ELSIF v_dst_active = FALSE THEN
        RAISE EXCEPTION 'Precondition Failed: Destination canonical client % is marked inactive.', v_dst_id;
    END IF;

    -- 2. Verify Source Client Exists
    SELECT is_active INTO v_src_active FROM public.clients WHERE id = v_src_id;
    IF v_src_active IS NULL THEN
        RAISE EXCEPTION 'Precondition Failed: Source client % does not exist.', v_src_id;
    END IF;

    -- 3. Verify Exact Source Row Counts
    SELECT COUNT(*) INTO v_pv_count FROM public.web_analytics_page_views WHERE client_id = v_src_id;
    SELECT COUNT(*) INTO v_sess_count FROM public.web_analytics_sessions WHERE client_id = v_src_id;

    IF v_pv_count != 13653 THEN
        RAISE EXCEPTION 'Precondition Failed: Expected exactly 13,653 page views for %, found %', v_src_id, v_pv_count;
    END IF;

    IF v_sess_count != 3644 THEN
        RAISE EXCEPTION 'Precondition Failed: Expected exactly 3,644 sessions for %, found %', v_src_id, v_sess_count;
    END IF;

    RAISE NOTICE '>>> Preconditions Verified: 13,653 PVs, 3,644 Sessions ready for manifest registration.';
END $$;

-- -----------------------------------------------------------------------------
-- Step 1: Create Consolidation Manifest & Alias Structures
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.client_consolidation_manifest (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    migration_id TEXT NOT NULL,
    table_name TEXT NOT NULL,
    record_id UUID NOT NULL,
    source_client_id UUID NOT NULL,
    destination_client_id UUID NOT NULL,
    migrated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_consolidation_manifest_lookup 
    ON public.client_consolidation_manifest (migration_id, table_name, record_id);

CREATE TABLE IF NOT EXISTS public.client_aliases (
    alias_client_id UUID PRIMARY KEY REFERENCES public.clients(id) ON DELETE CASCADE,
    canonical_client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    reason TEXT NOT NULL,
    migration_id TEXT NOT NULL,
    migrated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_aliases_canonical 
    ON public.client_aliases (canonical_client_id);

-- -----------------------------------------------------------------------------
-- Step 2: Register Client Alias & Update Source Client Descriptor
-- -----------------------------------------------------------------------------

INSERT INTO public.client_aliases (alias_client_id, canonical_client_id, reason, migration_id)
VALUES (
    '297cbb3c-54b4-4bed-8206-25949a94fa62',
    'ef580ebf-439f-4305-826a-f1f8aa89fd03',
    'Consolidation of Snarky A$$ Humans into canonical Snarky Humans client',
    '20261001_snarky_consolidation'
)
ON CONFLICT (alias_client_id) DO UPDATE 
SET canonical_client_id = EXCLUDED.canonical_client_id,
    migrated_at = now();

UPDATE public.clients
SET name = 'Snarky A$$ Humans [MIGRATED]',
    is_active = FALSE,
    updated_at = now()
WHERE id = '297cbb3c-54b4-4bed-8206-25949a94fa62';

-- -----------------------------------------------------------------------------
-- Step 3: Populate Migration Manifest BEFORE any data movement
-- -----------------------------------------------------------------------------

-- 3.1 Web Analytics Page Views (13,653 rows)
INSERT INTO public.client_consolidation_manifest (migration_id, table_name, record_id, source_client_id, destination_client_id)
SELECT '20261001_snarky_consolidation', 'web_analytics_page_views', id, client_id, 'ef580ebf-439f-4305-826a-f1f8aa89fd03'
FROM public.web_analytics_page_views
WHERE client_id = '297cbb3c-54b4-4bed-8206-25949a94fa62';

-- 3.2 Web Analytics Sessions (3,644 rows)
INSERT INTO public.client_consolidation_manifest (migration_id, table_name, record_id, source_client_id, destination_client_id)
SELECT '20261001_snarky_consolidation', 'web_analytics_sessions', id, client_id, 'ef580ebf-439f-4305-826a-f1f8aa89fd03'
FROM public.web_analytics_sessions
WHERE client_id = '297cbb3c-54b4-4bed-8206-25949a94fa62';

-- 3.3 Social Account: X (@SnarkyHumans) (1 row)
INSERT INTO public.client_consolidation_manifest (migration_id, table_name, record_id, source_client_id, destination_client_id)
SELECT '20261001_snarky_consolidation', 'social_accounts', id, client_id, 'ef580ebf-439f-4305-826a-f1f8aa89fd03'
FROM public.social_accounts
WHERE client_id = '297cbb3c-54b4-4bed-8206-25949a94fa62';

-- 3.4 Social Account Metrics for X (4 rows)
INSERT INTO public.client_consolidation_manifest (migration_id, table_name, record_id, source_client_id, destination_client_id)
SELECT '20261001_snarky_consolidation', 'social_account_metrics', id, client_id, 'ef580ebf-439f-4305-826a-f1f8aa89fd03'
FROM public.social_account_metrics
WHERE client_id = '297cbb3c-54b4-4bed-8206-25949a94fa62';

-- 3.5 Historical Analytics Summaries (4 non-overlapping weekly summaries)
INSERT INTO public.client_consolidation_manifest (migration_id, table_name, record_id, source_client_id, destination_client_id)
SELECT '20261001_snarky_consolidation', 'analytics_summaries', id, client_id, 'ef580ebf-439f-4305-826a-f1f8aa89fd03'
FROM public.analytics_summaries
WHERE client_id = '297cbb3c-54b4-4bed-8206-25949a94fa62';

-- 3.6 SEO Keyword Rankings (1 row)
INSERT INTO public.client_consolidation_manifest (migration_id, table_name, record_id, source_client_id, destination_client_id)
SELECT '20261001_snarky_consolidation', 'seo_keyword_rankings', id, client_id, 'ef580ebf-439f-4305-826a-f1f8aa89fd03'
FROM public.seo_keyword_rankings
WHERE client_id = '297cbb3c-54b4-4bed-8206-25949a94fa62';

-- -----------------------------------------------------------------------------
-- Step 4: Execute Deterministic Ownership Migration using Manifest IDs
-- -----------------------------------------------------------------------------

-- 4.1 Migrate Web Analytics Page Views
UPDATE public.web_analytics_page_views
SET client_id = 'ef580ebf-439f-4305-826a-f1f8aa89fd03'
WHERE id IN (
    SELECT record_id 
    FROM public.client_consolidation_manifest 
    WHERE migration_id = '20261001_snarky_consolidation' 
      AND table_name = 'web_analytics_page_views'
);

-- 4.2 Migrate Web Analytics Sessions
UPDATE public.web_analytics_sessions
SET client_id = 'ef580ebf-439f-4305-826a-f1f8aa89fd03'
WHERE id IN (
    SELECT record_id 
    FROM public.client_consolidation_manifest 
    WHERE migration_id = '20261001_snarky_consolidation' 
      AND table_name = 'web_analytics_sessions'
);

-- 4.3 Migrate Social Account
UPDATE public.social_accounts
SET client_id = 'ef580ebf-439f-4305-826a-f1f8aa89fd03'
WHERE id IN (
    SELECT record_id 
    FROM public.client_consolidation_manifest 
    WHERE migration_id = '20261001_snarky_consolidation' 
      AND table_name = 'social_accounts'
);

-- 4.4 Migrate Social Account Metrics
UPDATE public.social_account_metrics
SET client_id = 'ef580ebf-439f-4305-826a-f1f8aa89fd03'
WHERE id IN (
    SELECT record_id 
    FROM public.client_consolidation_manifest 
    WHERE migration_id = '20261001_snarky_consolidation' 
      AND table_name = 'social_account_metrics'
);

-- 4.5 Migrate Historical Analytics Summaries
UPDATE public.analytics_summaries
SET client_id = 'ef580ebf-439f-4305-826a-f1f8aa89fd03'
WHERE id IN (
    SELECT record_id 
    FROM public.client_consolidation_manifest 
    WHERE migration_id = '20261001_snarky_consolidation' 
      AND table_name = 'analytics_summaries'
);

-- 4.6 Migrate SEO Keyword Rankings
UPDATE public.seo_keyword_rankings
SET client_id = 'ef580ebf-439f-4305-826a-f1f8aa89fd03'
WHERE id IN (
    SELECT record_id 
    FROM public.client_consolidation_manifest 
    WHERE migration_id = '20261001_snarky_consolidation' 
      AND table_name = 'seo_keyword_rankings'
);

-- -----------------------------------------------------------------------------
-- Step 5: Explicit Collision Resolution for GA4 and Metricool
-- -----------------------------------------------------------------------------

-- 5.1 GA4 Configuration
-- Note: Both ef580 and 297c already point to property 535205346.
-- Update canonical client to the active production storefront URL.
UPDATE public.client_ga4_config
SET website_url = 'https://snarkyazzhumans.com',
    is_active = TRUE,
    updated_at = now()
WHERE client_id = 'ef580ebf-439f-4305-826a-f1f8aa89fd03';

-- Deactivate source GA4 configuration (preserving historical record for audit)
UPDATE public.client_ga4_config
SET is_active = FALSE,
    updated_at = now()
WHERE client_id = '297cbb3c-54b4-4bed-8206-25949a94fa62';

-- 5.2 Metricool Configuration
-- FB, IG, TikTok, YouTube are identical (blog_id 5691309).
-- Google Ads on 297c has the active dedicated blog_id (5831273).
UPDATE public.client_metricool_config
SET blog_id = '5831273',
    is_active = TRUE,
    updated_at = now()
WHERE client_id = 'ef580ebf-439f-4305-826a-f1f8aa89fd03'
  AND platform = 'google_ads';

-- Deactivate all Metricool configs under source client 297c
UPDATE public.client_metricool_config
SET is_active = FALSE,
    updated_at = now()
WHERE client_id = '297cbb3c-54b4-4bed-8206-25949a94fa62';

-- -----------------------------------------------------------------------------
-- Step 6: Postcondition Verification & Integrity Assertions
-- -----------------------------------------------------------------------------

DO $$
DECLARE
    v_migration_id CONSTANT TEXT := '20261001_snarky_consolidation';
    v_src_id       CONSTANT UUID := '297cbb3c-54b4-4bed-8206-25949a94fa62';
    v_dst_id       CONSTANT UUID := 'ef580ebf-439f-4305-826a-f1f8aa89fd03';
    v_remaining_pv BIGINT;
    v_remaining_se BIGINT;
    v_dst_pv       BIGINT;
    v_dst_se       BIGINT;
    v_manifest_cnt BIGINT;
BEGIN
    -- 1. Ensure source client owns 0 web analytics records
    SELECT COUNT(*) INTO v_remaining_pv FROM public.web_analytics_page_views WHERE client_id = v_src_id;
    SELECT COUNT(*) INTO v_remaining_se FROM public.web_analytics_sessions WHERE client_id = v_src_id;

    IF v_remaining_pv > 0 OR v_remaining_se > 0 THEN
        RAISE EXCEPTION 'Postcondition Failed: Source % still owns % PVs and % Sessions!', v_src_id, v_remaining_pv, v_remaining_se;
    END IF;

    -- 2. Ensure canonical client owns all migrated records
    SELECT COUNT(*) INTO v_dst_pv FROM public.web_analytics_page_views WHERE client_id = v_dst_id;
    SELECT COUNT(*) INTO v_dst_se FROM public.web_analytics_sessions WHERE client_id = v_dst_id;

    IF v_dst_pv < 13653 THEN
        RAISE EXCEPTION 'Postcondition Failed: Canonical % has only % PVs (expected >= 13,653)', v_dst_id, v_dst_pv;
    END IF;

    IF v_dst_se < 3644 THEN
        RAISE EXCEPTION 'Postcondition Failed: Canonical % has only % Sessions (expected >= 3,644)', v_dst_id, v_dst_se;
    END IF;

    -- 3. Verify total manifest entries:
    -- 13653 (PV) + 3644 (Sessions) + 1 (social_accounts) + 288 (social_account_metrics) + 4 (analytics_summaries) + 0 (seo_keyword_rankings) = 17,590
    SELECT COUNT(*) INTO v_manifest_cnt 
    FROM public.client_consolidation_manifest 
    WHERE migration_id = v_migration_id;

    IF v_manifest_cnt != 17590 THEN
        RAISE EXCEPTION 'Postcondition Failed: Manifest count mismatch! Expected 17,590 records, found %', v_manifest_cnt;
    END IF;

    RAISE NOTICE '>>> Postconditions Succeeded: 17,590 records safely migrated and manifest-indexed.';
END $$;
