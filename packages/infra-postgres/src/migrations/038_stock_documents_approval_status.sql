ALTER TABLE stock_documents
    DROP CONSTRAINT IF EXISTS stock_documents_status_check;

ALTER TABLE stock_documents
    ADD CONSTRAINT stock_documents_status_check
    CHECK (status IN ('draft', 'submitted', 'approved', 'posted', 'canceled'));
