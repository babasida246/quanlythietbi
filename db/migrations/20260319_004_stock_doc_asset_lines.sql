-- Migration: 20260319_004_stock_doc_asset_lines
-- Purpose: Extend stock document lines to support equipment asset tracking.
--   - Phiếu nhập kho (receipt) posts auto-create asset records
--   - Phiếu xuất kho (issue) posts deploy assets to locations
-- Idempotent: all statements use IF NOT EXISTS / IF EXISTS / DO $$ IF ... $$

-- 1. Make part_id nullable: asset lines don't reference a spare_part
ALTER TABLE stock_document_lines ALTER COLUMN part_id DROP NOT NULL;

-- 2. Line type discriminator
ALTER TABLE stock_document_lines
    ADD COLUMN IF NOT EXISTS line_type VARCHAR(20) NOT NULL DEFAULT 'spare_part';

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'stock_doc_lines_type_chk'
    ) THEN
        ALTER TABLE stock_document_lines
            ADD CONSTRAINT stock_doc_lines_type_chk
            CHECK (line_type IN ('spare_part', 'asset'));
    END IF;
END $$;

-- 3. Asset identification columns for receipt lines
ALTER TABLE stock_document_lines
    ADD COLUMN IF NOT EXISTS asset_model_id    UUID REFERENCES asset_models(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS asset_category_id UUID REFERENCES asset_categories(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS asset_name        VARCHAR(255),
    ADD COLUMN IF NOT EXISTS asset_code        VARCHAR(100);

-- 4. Asset reference:
--    - issue lines: user selects the specific in-stock asset to deploy
--    - receipt lines: populated after posting (the auto-created asset)
ALTER TABLE stock_document_lines
    ADD COLUMN IF NOT EXISTS asset_id UUID REFERENCES assets(id) ON DELETE SET NULL;

-- 5. Destination location for issue documents (where assets will be deployed)
ALTER TABLE stock_documents
    ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES locations(id) ON DELETE SET NULL;

-- 6. Traceability on assets: which receipt line created this asset
ALTER TABLE assets
    ADD COLUMN IF NOT EXISTS source_doc_line_id UUID REFERENCES stock_document_lines(id) ON DELETE SET NULL;

-- 7. Auto-sequence for asset code generation (format: TBI-YYYY-NNNNNN)
CREATE SEQUENCE IF NOT EXISTS asset_code_seq START 1 INCREMENT 1;

-- 8. Integrity constraint: every line must have at least one identifier
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'stock_doc_lines_content_chk'
    ) THEN
        ALTER TABLE stock_document_lines
            ADD CONSTRAINT stock_doc_lines_content_chk CHECK (
                part_id IS NOT NULL
                OR asset_model_id IS NOT NULL
                OR asset_id IS NOT NULL
            );
    END IF;
END $$;

-- Indexes for new FKs
CREATE INDEX IF NOT EXISTS idx_stock_doc_lines_asset_model  ON stock_document_lines(asset_model_id) WHERE asset_model_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_stock_doc_lines_asset_id     ON stock_document_lines(asset_id) WHERE asset_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_stock_docs_location          ON stock_documents(location_id) WHERE location_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_assets_source_doc_line       ON assets(source_doc_line_id) WHERE source_doc_line_id IS NOT NULL;
