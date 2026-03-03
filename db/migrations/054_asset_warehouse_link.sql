-- Migration 054: Link assets to warehouses
-- Adds warehouse_id FK on the assets table so assets with status
-- 'in_stock' (or 'in_repair') can be associated with a specific warehouse.

BEGIN;

    -- Add warehouse_id column to assets
    ALTER TABLE assets
    ADD COLUMN
    IF NOT EXISTS warehouse_id UUID
        REFERENCES warehouses
    (id) ON
    DELETE
    SET NULL;

    CREATE INDEX
    IF NOT EXISTS idx_assets_warehouse_id ON assets
    (warehouse_id);

    -- Seed: assign existing in_stock / in_repair assets to the correct warehouse
    -- LAP-DELL-003, LAP-HP-003  → WH-CNTT (IT general warehouse)
    UPDATE assets SET warehouse_id = 'a0100000-0000-0000-0000-000000000001'
WHERE asset_code IN ('LAP-DELL-003', 'LAP-HP-003');

    -- SRV-DELL-002              → WH-DC  (Data-center warehouse)
    UPDATE assets SET warehouse_id = 'a0100000-0000-0000-0000-000000000002'
WHERE asset_code = 'SRV-DELL-002';

    -- FW-FTN-002 (in_repair)    → WH-CN1 (branch warehouse – sent for repair)
    UPDATE assets SET warehouse_id = 'a0100000-0000-0000-0000-000000000003'
WHERE asset_code = 'FW-FTN-002';

    COMMIT;
