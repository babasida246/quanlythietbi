-- Migration 068: Add asset_recall and asset_transfer to request_type CHECK constraints
--   Affects: wf_requests.request_type  AND  wf_definitions.request_type
-- Idempotent: scans pg_constraint and drops any check mentioning request_type, then recreates.

-- ── wf_requests ──────────────────────────────────────────────────────────────
DO $$
DECLARE r RECORD;
BEGIN
    FOR r IN
        SELECT c.conname
        FROM pg_constraint c
        JOIN pg_class t ON t.oid = c.conrelid
        WHERE t.relname = 'wf_requests'
          AND c.contype = 'c'
          AND pg_get_constraintdef(c.oid) LIKE '%request_type%'
    LOOP
        EXECUTE format('ALTER TABLE wf_requests DROP CONSTRAINT IF EXISTS %I', r.conname);
    END LOOP;
END $$;

ALTER TABLE wf_requests
    ADD CONSTRAINT wf_requests_request_type_check
    CHECK (request_type IN (
        'asset_request',
        'asset_recall',
        'asset_transfer',
        'repair_request',
        'disposal_request',
        'purchase',
        'other'
    ));

-- ── wf_definitions ───────────────────────────────────────────────────────────
DO $$
DECLARE r RECORD;
BEGIN
    FOR r IN
        SELECT c.conname
        FROM pg_constraint c
        JOIN pg_class t ON t.oid = c.conrelid
        WHERE t.relname = 'wf_definitions'
          AND c.contype = 'c'
          AND pg_get_constraintdef(c.oid) LIKE '%request_type%'
    LOOP
        EXECUTE format('ALTER TABLE wf_definitions DROP CONSTRAINT IF EXISTS %I', r.conname);
    END LOOP;
END $$;

ALTER TABLE wf_definitions
    ADD CONSTRAINT wf_definitions_request_type_check
    CHECK (request_type IN (
        'asset_request',
        'asset_recall',
        'asset_transfer',
        'repair_request',
        'disposal_request',
        'purchase',
        'other'
    ));
