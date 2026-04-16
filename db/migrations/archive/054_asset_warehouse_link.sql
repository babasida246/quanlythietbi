-- Migration 054: Link assets to warehouses
-- Adds warehouse_id FK on the assets table so assets with status
-- 'in_stock' (or 'in_repair') can be associated with a specific warehouse.

BEGIN;

    -- Add warehouse_id column to assets
    ALTER TABLE assets
    ADD COLUMN IF NOT EXISTS warehouse_id UUID
        REFERENCES warehouses(id) ON DELETE SET NULL;

    CREATE INDEX IF NOT EXISTS idx_assets_warehouse_id ON assets(warehouse_id);

    COMMIT;
