-- Deactivate Substack config for OxiSure Tech (account suspended)
UPDATE client_substack_config
SET is_active = false
WHERE client_id = '1a1edf9f-2ebe-4d40-a904-7295d5033401';
