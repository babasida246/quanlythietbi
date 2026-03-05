-- =============================================================================
-- MIGRATION: Fix wf_definitions.request_type to match WfRequestType enum in code
--
-- Root cause: wf_definitions used legacy type names (purchase_plan, asset_issue,
-- asset_dispose, repair_order) that don't match the WfRequestType enum in
-- packages/contracts/src/workflow/index.ts, causing findDefinitionByType() to
-- always return null → auto-approve every request immediately.
--
-- Mapping:
--   purchase_plan  → purchase
--   asset_issue    → asset_request
--   asset_dispose  → disposal_request
--   repair_order   → repair_request
--   repair         → repair_request   (legacy value in wf_requests)
-- =============================================================================
BEGIN;

    -- ── 1. Fix wf_definitions ────────────────────────────────────────────────────
    UPDATE wf_definitions SET request_type = 'purchase'          WHERE key = 'wf-purchase-plan';
    UPDATE wf_definitions SET request_type = 'asset_request'     WHERE key = 'wf-asset-issue';
    UPDATE wf_definitions SET request_type = 'disposal_request'  WHERE key = 'wf-asset-dispose';
    UPDATE wf_definitions SET request_type = 'repair_request'    WHERE key = 'wf-repair-order';

    -- Add 'other' definition if it doesn't exist
    INSERT INTO wf_definitions
        (id, key, name, request_type, version, is_active)
    VALUES
        (gen_random_uuid(), 'wf-other', 'Yêu cầu khác', 'other', 1, true)
    ON CONFLICT
    (key) DO NOTHING;

-- ── 2. Fix wf_requests that use old type names ────────────────────────────────
UPDATE wf_requests SET request_type = 'purchase'
    WHERE request_type = 'purchase_plan';

UPDATE wf_requests SET request_type = 'asset_request'
    WHERE request_type = 'asset_issue';

UPDATE wf_requests SET request_type = 'disposal_request'
    WHERE request_type = 'asset_dispose';

UPDATE wf_requests SET request_type = 'repair_request'
    WHERE request_type IN ('repair_order', 'repair');

-- ── 3. Verify ─────────────────────────────────────────────────────────────────
DO $$
DECLARE
    bad_defs INT;
    bad_reqs INT;
    valid_types TEXT[] := ARRAY['asset_request','repair_request','disposal_request','purchase','other'];
BEGIN
    SELECT COUNT(*)
    INTO bad_defs
    FROM wf_definitions
    WHERE request_type != ALL(valid_types);
    SELECT COUNT(*)
    INTO bad_reqs
    FROM wf_requests
    WHERE request_type != ALL(valid_types);

    IF bad_defs > 0 THEN
        RAISE EXCEPTION 'Migration failed: % wf_definitions still have invalid request_type', bad_defs;
END
IF;
    IF bad_reqs > 0 THEN
        RAISE WARNING 'Warning: % wf_requests still have unrecognised request_type (may be OK if they predate this schema)', bad_reqs;
END
IF;
    RAISE NOTICE 'Migration 20260304_001 complete. Definitions: OK. Requests: OK.';
END $$;

COMMIT;
