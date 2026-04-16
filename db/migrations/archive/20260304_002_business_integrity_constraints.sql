-- =============================================================================
-- MIGRATION: Business Integrity Constraints
--
-- Adds CHECK constraints, unique partial indexes, and triggers to enforce:
--  1. WfRequestType enum on wf_definitions and wf_requests
--  2. No double-approval per step (concurrency guard)
--  3. Stock document state machine (only valid transitions allowed)
--  4. Additional performance indexes
-- =============================================================================
BEGIN;

    -- ────────────────────────────────────────────────────────────────────────────
    -- 1. Enforce WfRequestType enum on wf_definitions
    -- ────────────────────────────────────────────────────────────────────────────
    DO $$ 
    BEGIN
        ALTER TABLE wf_definitions
            ADD CONSTRAINT wf_definitions_request_type_check
            CHECK (request_type IN ('asset_request','repair_request','disposal_request','purchase','other'));
        EXCEPTION WHEN duplicate_object THEN NULL;
    END
    $$;

-- ────────────────────────────────────────────────────────────────────────────
-- 2. Enforce WfRequestType enum on wf_requests
-- ────────────────────────────────────────────────────────────────────────────
DO $$ 
BEGIN
    ALTER TABLE wf_requests
            ADD CONSTRAINT wf_requests_request_type_check
            CHECK (request_type IN ('asset_request','repair_request','disposal_request','purchase','other'));
    EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ────────────────────────────────────────────────────────────────────────────
-- 3. Prevent double-approval: at most one 'approved' decision per step slot
--    (UNIQUE partial index: one approved row per request_id + step_no)
-- ────────────────────────────────────────────────────────────────────────────
CREATE UNIQUE INDEX
IF NOT EXISTS uidx_wf_approvals_one_approved_per_step
    ON wf_approvals
(request_id, step_no)
    WHERE status = 'approved';

-- ────────────────────────────────────────────────────────────────────────────
-- 4. Stock document state machine trigger
--    Valid transitions: draft→submitted, submitted→approved, approved→posted
--                       draft→canceled, submitted→canceled, approved→canceled
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_stock_document_state_guard
()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
    valid_transitions TEXT[][] := ARRAY[
        ARRAY['draft',     'submitted'],
        ARRAY['draft',     'canceled'],
        ARRAY['submitted', 'approved'],
        ARRAY['submitted', 'canceled'],
        ARRAY['approved',  'posted'],
        ARRAY['approved',  'canceled']
    ];
pair TEXT[];
BEGIN
    -- Only check status changes
    IF OLD.status = NEW.status THEN
    RETURN NEW;
END
IF;

    -- Check transition is valid
    FOREACH pair SLICE 1 IN ARRAY valid_transitions LOOP
IF OLD.status = pair[1] AND NEW.status = pair[2] THEN
RETURN NEW;
END
IF;
    END LOOP;

    RAISE EXCEPTION 'Invalid stock document status transition: % → % (doc %, id %)',
        OLD.status, NEW.status, OLD.code, OLD.id;
END;
$$;

DROP TRIGGER IF EXISTS trg_stock_document_state
ON stock_documents;
CREATE TRIGGER trg_stock_document_state
    BEFORE
UPDATE OF status ON stock_documents
    FOR EACH ROW
EXECUTE FUNCTION fn_stock_document_state_guard
();

COMMENT ON FUNCTION fn_stock_document_state_guard
() IS
    'Enforces stock document state machine: draft→submitted→approved→posted, with cancel allowed from any non-posted state.';

-- ────────────────────────────────────────────────────────────────────────────
-- 5. Additional performance indexes
-- ────────────────────────────────────────────────────────────────────────────

-- Workflow requests: index on request_type (already exists but ensure it's there)
CREATE INDEX
IF NOT EXISTS idx_wf_requests_type
    ON wf_requests
(request_type);

-- Workflow requests: composite index for common "my requests" query
CREATE INDEX
IF NOT EXISTS idx_wf_requests_requester_status
    ON wf_requests
(requester_id, status);

-- Workflow approvals: index for inbox query (pending approvals for a user)
CREATE INDEX
IF NOT EXISTS idx_wf_approvals_assignee_pending
    ON wf_approvals
(assignee_user_id, status)
    WHERE status = 'pending';

-- Stock documents: index for listing by warehouse+status
CREATE INDEX
IF NOT EXISTS idx_stock_documents_warehouse_status
    ON stock_documents
(warehouse_id, status);

-- ────────────────────────────────────────────────────────────────────────────
-- 6. Verify all new constraints are in place
-- ────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
    cnt INT;
BEGIN
    SELECT COUNT(*)
    INTO cnt
    FROM pg_constraint
    WHERE conname IN (
        'wf_definitions_request_type_check',
        'wf_requests_request_type_check'
    );
    IF cnt < 2 THEN
        RAISE EXCEPTION 'Migration 20260304_002: expected 2 new CHECK constraints, found %', cnt;
END
IF;

    RAISE NOTICE 'Migration 20260304_002 complete. Integrity constraints applied.';
END $$;

COMMIT;
