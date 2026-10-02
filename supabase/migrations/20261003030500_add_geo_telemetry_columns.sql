-- ==============================================================================
-- Migration: 20261003030500_add_geo_telemetry_columns.sql
-- Description: Add geo_source and geo_failure_reason columns for geo capture
--              reliability telemetry. Part of Geo Capture Reliability v1.
-- ==============================================================================

-- Page Views
ALTER TABLE public.web_analytics_page_views 
  ADD COLUMN IF NOT EXISTS geo_source TEXT DEFAULT NULL;
ALTER TABLE public.web_analytics_page_views 
  ADD COLUMN IF NOT EXISTS geo_failure_reason TEXT DEFAULT NULL;

-- Sessions
ALTER TABLE public.web_analytics_sessions 
  ADD COLUMN IF NOT EXISTS geo_source TEXT DEFAULT NULL;
ALTER TABLE public.web_analytics_sessions 
  ADD COLUMN IF NOT EXISTS geo_failure_reason TEXT DEFAULT NULL;

-- Possible values for geo_source:
--   'cf_header'    — Cloudflare/CDN injected header (highest trust)
--   'ip_lookup'    — Server-side IP geolocation API (high trust)
--   'client'       — Client-side browser lookup (low trust)
--   'unresolved'   — All methods failed, country = 'XX'

-- Possible values for geo_failure_reason:
--   NULL                  — No failure (geo resolved successfully)
--   'no_ip'               — No client IP available in headers
--   'header_missing'      — CDN header not present
--   'provider_timeout'    — IP geo API timed out
--   'provider_error'      — IP geo API returned an error
--   'provider_rate_limit' — IP geo API rate limited
--   'invalid_response'    — API response missing country code
--   'private_ip'          — IP is private/reserved (not geolocatable)
