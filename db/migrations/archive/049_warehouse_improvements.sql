-- Migration 049: Warehouse improvements
-- P1: Sequential stock document code generation
-- P1: Idempotency key for document posting
-- P2: Lot/serial/expiry tracking for FEFO

BEGIN;

    -- ==================== P1: Sequential document codes ====================
    CREATE SEQUENCE
    IF NOT EXISTS stock_doc_code_seq START
    WITH 1 INCREMENT BY 1;

-- ==================== P1: Idempotency key ====================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'stock_documents' AND column_name = 'idempotency_key'
    ) THEN
    ALTER TABLE stock_documents ADD COLUMN idempotency_key VARCHAR
    (255) DEFAULT NULL;
    CREATE UNIQUE INDEX
    IF NOT EXISTS stock_documents_idempotency_key_idx
            ON stock_documents
    (idempotency_key) WHERE idempotency_key IS NOT NULL;
END
IF;
END $$;

-- ==================== P2: Lot/serial/expiry tracking ====================
CREATE TABLE
IF NOT EXISTS spare_part_lots
(
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4
(),
    warehouse_id    UUID NOT NULL REFERENCES warehouses
(id) ON
DELETE CASCADE,
    part_id         UUID
NOT NULL REFERENCES spare_parts
(id) ON
DELETE CASCADE,
    lot_number      VARCHAR(100)
NOT NULL,
    serial_no       VARCHAR
(100) DEFAULT NULL,
    manufacture_date DATE DEFAULT NULL,
    expiry_date     DATE DEFAULT NULL,
    on_hand         INTEGER NOT NULL DEFAULT 0 CHECK
(on_hand >= 0),
    reserved        INTEGER NOT NULL DEFAULT 0 CHECK
(reserved >= 0),
    status          VARCHAR
(20) NOT NULL DEFAULT 'active'
                    CHECK
(status IN
('active', 'expired', 'consumed')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW
(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW
(),
    UNIQUE
(warehouse_id, part_id, lot_number)
);

-- Index for FEFO queries (order by expiry date)
CREATE INDEX
IF NOT EXISTS spare_part_lots_fefo_idx
    ON spare_part_lots
(expiry_date ASC NULLS LAST)
    WHERE status = 'active' AND on_hand > 0;

-- Index for warehouse + part lookups
CREATE INDEX
IF NOT EXISTS spare_part_lots_warehouse_part_idx
    ON spare_part_lots
(warehouse_id, part_id);

COMMIT;
