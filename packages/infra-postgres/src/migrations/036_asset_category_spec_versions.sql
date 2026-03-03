-- Spec versions + advanced spec defs
CREATE TABLE IF NOT EXISTS asset_category_spec_versions
(
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category_id UUID NOT NULL REFERENCES asset_categories(id) ON DELETE CASCADE,
    version INT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('draft','active','retired')),
    created_by TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (category_id, version)
);

CREATE INDEX IF NOT EXISTS idx_spec_versions_category_status ON asset_category_spec_versions(category_id, status);

ALTER TABLE asset_models
    ADD COLUMN IF NOT EXISTS spec_version_id UUID REFERENCES asset_category_spec_versions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_asset_models_spec_version_id ON asset_models(spec_version_id);
CREATE INDEX IF NOT EXISTS idx_asset_models_spec_gin ON asset_models USING GIN (spec);

ALTER TABLE asset_category_spec_defs
    ADD COLUMN IF NOT EXISTS version_id UUID REFERENCES asset_category_spec_versions(id) ON DELETE CASCADE;

ALTER TABLE asset_category_spec_defs
    ADD COLUMN IF NOT EXISTS pattern TEXT,
    ADD COLUMN IF NOT EXISTS min_len INT,
    ADD COLUMN IF NOT EXISTS max_len INT,
    ADD COLUMN IF NOT EXISTS precision INT,
    ADD COLUMN IF NOT EXISTS scale INT,
    ADD COLUMN IF NOT EXISTS normalize TEXT,
    ADD COLUMN IF NOT EXISTS is_readonly BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS computed_expr TEXT,
    ADD COLUMN IF NOT EXISTS is_searchable BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS is_filterable BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE asset_category_spec_defs DROP CONSTRAINT IF EXISTS asset_category_spec_defs_field_type_check;
ALTER TABLE asset_category_spec_defs
    ADD CONSTRAINT asset_category_spec_defs_field_type_check
    CHECK (field_type IN ('string','number','boolean','enum','date','ip','mac','hostname','cidr','port','regex','json','multi_enum'));

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'asset_category_spec_defs'
          AND column_name = 'category_id'
    ) THEN
        EXECUTE $sql$
            INSERT INTO asset_category_spec_versions (id, category_id, version, status, created_at)
            SELECT uuid_generate_v4(), category_id, 1, 'active', NOW()
            FROM (
                SELECT DISTINCT category_id
                FROM asset_category_spec_defs
            ) AS defs
            ON CONFLICT (category_id, version) DO NOTHING
        $sql$;

        EXECUTE $sql$
            UPDATE asset_category_spec_defs AS defs
            SET version_id = versions.id
            FROM asset_category_spec_versions AS versions
            WHERE defs.category_id = versions.category_id
              AND versions.version = 1
              AND defs.version_id IS NULL
        $sql$;
    END IF;
END $$;

ALTER TABLE asset_category_spec_defs
    ALTER COLUMN version_id SET NOT NULL;

ALTER TABLE asset_category_spec_defs DROP CONSTRAINT IF EXISTS asset_category_spec_defs_category_id_key;
DROP INDEX IF EXISTS idx_category_spec_defs_category;

CREATE UNIQUE INDEX IF NOT EXISTS idx_category_spec_defs_version_key ON asset_category_spec_defs(version_id, key);
CREATE INDEX IF NOT EXISTS idx_category_spec_defs_version ON asset_category_spec_defs(version_id, sort_order);

ALTER TABLE asset_category_spec_defs DROP COLUMN IF EXISTS category_id;

UPDATE asset_models AS models
SET spec_version_id = versions.id
FROM asset_category_spec_versions AS versions
WHERE models.category_id = versions.category_id
  AND versions.status = 'active'
  AND models.spec_version_id IS NULL;

ALTER TABLE ops_events DROP CONSTRAINT IF EXISTS ops_events_entity_type_check;
ALTER TABLE ops_events
    ADD CONSTRAINT ops_events_entity_type_check
    CHECK (entity_type IN ('repair_order','stock_document','spare_part','warehouse','asset_category'));
