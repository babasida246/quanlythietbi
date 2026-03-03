-- Asset category spec definitions
CREATE TABLE IF NOT EXISTS asset_category_spec_defs
(
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category_id UUID NOT NULL REFERENCES asset_categories(id) ON DELETE CASCADE,
    key TEXT NOT NULL,
    label TEXT NOT NULL,
    field_type TEXT NOT NULL CHECK (field_type IN ('string','number','boolean','enum','date')),
    unit TEXT,
    required BOOLEAN NOT NULL DEFAULT false,
    enum_values JSONB,
    min_value NUMERIC,
    max_value NUMERIC,
    step_value NUMERIC,
    default_value JSONB,
    help_text TEXT,
    sort_order INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (category_id, key)
);

ALTER TABLE asset_category_spec_defs
    ADD COLUMN IF NOT EXISTS category_id UUID;

UPDATE asset_category_spec_defs defs
SET category_id = versions.category_id
FROM asset_category_spec_versions versions
WHERE defs.version_id = versions.id
  AND defs.category_id IS NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'asset_category_spec_defs_category_id_fkey'
    ) THEN
        ALTER TABLE asset_category_spec_defs
            ADD CONSTRAINT asset_category_spec_defs_category_id_fkey
            FOREIGN KEY (category_id) REFERENCES asset_categories(id) ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'asset_category_spec_defs_category_id_key'
    ) THEN
        ALTER TABLE asset_category_spec_defs
            ADD CONSTRAINT asset_category_spec_defs_category_id_key UNIQUE (category_id, key);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_category_spec_defs_category ON asset_category_spec_defs(category_id, sort_order);
