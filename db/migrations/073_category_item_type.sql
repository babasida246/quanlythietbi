-- Migration 073: Add item_type to asset_categories
-- Distinguishes between asset (individual-tracked equipment),
-- spare_part (quantity-tracked components), and consumable (expendable materials).

ALTER TABLE asset_categories
    ADD COLUMN IF NOT EXISTS item_type VARCHAR(20) NOT NULL DEFAULT 'asset';

CREATE INDEX IF NOT EXISTS idx_asset_categories_item_type ON asset_categories(item_type);
