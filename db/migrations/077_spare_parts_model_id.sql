-- Migration 077: Add model_id FK to spare_parts, linking to asset_models catalog
-- This allows spare parts to reference the same model catalog as assets.

ALTER TABLE spare_parts ADD COLUMN IF NOT EXISTS model_id UUID REFERENCES asset_models(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_spare_parts_model_id ON spare_parts(model_id);
