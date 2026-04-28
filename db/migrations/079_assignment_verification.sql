-- 079 — Add verification tracking to asset_assignments
-- Stores HOW (barcode / ocr / manual) and WHEN the double-check scan was done,
-- plus a link back to the workflow request that triggered the assignment/return.

ALTER TABLE asset_assignments
    ADD COLUMN IF NOT EXISTS verification_method VARCHAR(20)
        CHECK (verification_method IN ('manual', 'barcode', 'ocr')),
    ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS wf_request_id UUID REFERENCES wf_requests(id);

CREATE INDEX IF NOT EXISTS idx_asset_assignments_wf_request_id
    ON asset_assignments(wf_request_id)
    WHERE wf_request_id IS NOT NULL;
