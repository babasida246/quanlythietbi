-- Migration 055: Stock receipt/issue enhancements
-- 1. DB-level constraint: on_hand >= 0 in spare_part_stock (prevent negative stock at DB layer)
-- 2. Add supplier/submitter fields to stock_documents (full receipt info)
-- 3. Add spec_fields JSONB to stock_document_lines (per-line catalog spec data)
-- 4. Add available_qty column check function for issue validation

BEGIN;

    -- ================================================================
    -- 1. Non-negative stock constraint (DB-level integrity)
    -- ================================================================
    DO $$
    BEGIN
        IF NOT EXISTS (
        SELECT 1
        FROM information_schema.constraint_column_usage
        WHERE table_name = 'spare_part_stock'
            AND constraint_name = 'spare_part_stock_on_hand_nonneg'
    ) THEN
        ALTER TABLE spare_part_stock
            ADD CONSTRAINT spare_part_stock_on_hand_nonneg CHECK (on_hand >= 0);
    END
    IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
    FROM information_schema.constraint_column_usage
    WHERE table_name = 'spare_part_stock'
        AND constraint_name = 'spare_part_stock_reserved_nonneg'
    ) THEN
    ALTER TABLE spare_part_stock
            ADD CONSTRAINT spare_part_stock_reserved_nonneg CHECK (reserved >= 0);
END
IF;
END $$;

-- ================================================================
-- 2. Stock document header: supplier & submitter info
-- ================================================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'stock_documents' AND column_name = 'supplier'
    ) THEN
    ALTER TABLE stock_documents
            ADD COLUMN supplier VARCHAR
    (255) DEFAULT NULL;
END
IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'stock_documents' AND column_name = 'submitter_name'
    ) THEN
    ALTER TABLE stock_documents
            ADD COLUMN submitter_name VARCHAR
    (255) DEFAULT NULL;
END
IF;
END $$;

-- Receiver name for issue documents (who receives the items)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'stock_documents' AND column_name = 'receiver_name'
    ) THEN
    ALTER TABLE stock_documents
            ADD COLUMN receiver_name VARCHAR
    (255) DEFAULT NULL;
END
IF;
END $$;

-- Department / cost center
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'stock_documents' AND column_name = 'department'
    ) THEN
    ALTER TABLE stock_documents
            ADD COLUMN department VARCHAR
    (255) DEFAULT NULL;
END
IF;
END $$;

-- ================================================================
-- 3. Stock document lines: per-line spec fields (JSONB)
-- ================================================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'stock_document_lines' AND column_name = 'spec_fields'
    ) THEN
    ALTER TABLE stock_document_lines
            ADD COLUMN spec_fields JSONB DEFAULT NULL;
END
IF;
END $$;

-- ================================================================
-- 4. View: real-time stock availability per warehouse+part
-- ================================================================
CREATE OR REPLACE VIEW v_stock_available AS
SELECT
    sps.warehouse_id,
    w.code   AS warehouse_code,
    w.name   AS warehouse_name,
    sps.part_id,
    sp.part_code,
    sp.name  AS part_name,
    sp.uom,
    sps.on_hand,
    sps.reserved,
    GREATEST(sps.on_hand - sps.reserved, 0) AS available,
    sp.min_level
FROM spare_part_stock sps
    JOIN warehouses w ON w.id  = sps.warehouse_id
    JOIN spare_parts sp ON sp.id = sps.part_id;

-- ================================================================
-- 5. Index for warehouse+part stock lookup (post document)
-- ================================================================
CREATE INDEX
IF NOT EXISTS idx_spare_part_stock_part
    ON spare_part_stock
(part_id);

COMMIT;
