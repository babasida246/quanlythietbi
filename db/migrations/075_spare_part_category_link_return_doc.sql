-- Migration 075: Link spare_parts to asset_categories + add return doc_type + item_group on documents
-- Changes:
--   1. spare_parts.category_id  → FK to asset_categories(id)
--   2. stock_documents.doc_type → add 'return' value
--   3. stock_documents.item_group → filter column ('asset' | 'spare_part' | 'consumable')

-- ── 1. spare_parts: add category_id FK ───────────────────────────────────────
ALTER TABLE spare_parts
    ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES asset_categories(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_spare_parts_category_id ON spare_parts(category_id);

-- ── 2. stock_documents: expand doc_type CHECK to include 'return' ─────────────
DO $$
DECLARE r RECORD;
BEGIN
    FOR r IN
        SELECT c.conname
        FROM pg_constraint c
        JOIN pg_class t ON t.oid = c.conrelid
        WHERE t.relname = 'stock_documents'
          AND c.contype = 'c'
          AND pg_get_constraintdef(c.oid) LIKE '%doc_type%'
    LOOP
        EXECUTE format('ALTER TABLE stock_documents DROP CONSTRAINT IF EXISTS %I', r.conname);
    END LOOP;
END $$;

ALTER TABLE stock_documents
    ADD CONSTRAINT stock_documents_doc_type_check
    CHECK (doc_type IN ('receipt', 'issue', 'adjust', 'transfer', 'return'));

-- ── 3. stock_documents: add item_group column ─────────────────────────────────
ALTER TABLE stock_documents
    ADD COLUMN IF NOT EXISTS item_group VARCHAR(20)
    CONSTRAINT stock_documents_item_group_check
    CHECK (item_group IS NULL OR item_group IN ('asset', 'spare_part', 'consumable'));
