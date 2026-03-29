-- Add per-client reporting timezone to Metricool config
ALTER TABLE client_metricool_config
  ADD COLUMN IF NOT EXISTS reporting_timezone TEXT NOT NULL DEFAULT 'America/Chicago';

COMMENT ON COLUMN client_metricool_config.reporting_timezone
  IS 'IANA timezone used for all Metricool API calls and dashboard date filtering for this client/platform.';
