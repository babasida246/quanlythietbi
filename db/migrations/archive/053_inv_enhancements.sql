-- Migration 053: Inventory Enhancements
-- Adds posted_at / posted_by / ref_request_id to stock_documents
-- Adds demo seed: 1 approved issue (awaiting post) + 1 draft transfer

BEGIN;

    -- ==================== Stock Document Enhancements ====================

    -- Add posted audit columns (nullable, no breaking change)
    ALTER TABLE stock_documents
    ADD COLUMN
    IF NOT EXISTS posted_at  TIMESTAMPTZ,
    ADD COLUMN
    IF NOT EXISTS posted_by  TEXT,
    ADD COLUMN
    IF NOT EXISTS rejected_at TIMESTAMPTZ,
    ADD COLUMN
    IF NOT EXISTS rejected_by TEXT,
    ADD COLUMN
    IF NOT EXISTS ref_request_id UUID REFERENCES wf_requests
    (id) ON
    DELETE
    SET NULL;

    CREATE INDEX
    IF NOT EXISTS idx_stock_documents_ref_request ON stock_documents
    (ref_request_id)
    WHERE ref_request_id IS NOT NULL;

-- Update existing posted document to have posted_at populated
UPDATE stock_documents
SET    posted_at  = updated_at,
       posted_by  = approved_by
WHERE  status = 'posted' AND posted_at IS NULL;

COMMIT;
