-- ============================================================
-- Migration 065: Equipment Groups (Nhóm vật tư trang bị)
-- Cross-module classification applied to all asset/item types.
-- ============================================================

-- ── 1. Bảng nhóm vật tư (phân cấp tùy ý) ───────────────────
CREATE TABLE IF NOT EXISTS equipment_groups (
    id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    code                  VARCHAR(50) UNIQUE,
    name                  VARCHAR(255) NOT NULL,
    description           TEXT,
    parent_id             UUID        REFERENCES equipment_groups(id) ON DELETE RESTRICT,
    inherit_parent_fields BOOLEAN     NOT NULL DEFAULT true,
    is_active             BOOLEAN     NOT NULL DEFAULT true,
    sort_order            INT         NOT NULL DEFAULT 0,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_equipment_groups_parent ON equipment_groups(parent_id);
CREATE INDEX IF NOT EXISTS idx_equipment_groups_active  ON equipment_groups(is_active);

-- ── 2. Trường thông tin tùy chỉnh của nhóm ──────────────────
CREATE TABLE IF NOT EXISTS equipment_group_fields (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id      UUID        NOT NULL REFERENCES equipment_groups(id) ON DELETE CASCADE,
    key           VARCHAR(100) NOT NULL,
    label         VARCHAR(255) NOT NULL,
    field_type    TEXT        NOT NULL DEFAULT 'string'
                  CHECK (field_type IN ('string','number','boolean','enum','date')),
    required      BOOLEAN     NOT NULL DEFAULT false,
    enum_values   JSONB,
    default_value TEXT,
    help_text     TEXT,
    sort_order    INT         NOT NULL DEFAULT 0,
    is_active     BOOLEAN     NOT NULL DEFAULT true,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(group_id, key)
);

CREATE INDEX IF NOT EXISTS idx_equipment_group_fields_group ON equipment_group_fields(group_id);

-- ── 3. Thêm group_id vào tất cả các bảng vật tư/thiết bị ────

ALTER TABLE assets
    ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES equipment_groups(id) ON DELETE SET NULL;

ALTER TABLE accessories
    ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES equipment_groups(id) ON DELETE SET NULL;

ALTER TABLE components
    ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES equipment_groups(id) ON DELETE SET NULL;

ALTER TABLE consumables
    ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES equipment_groups(id) ON DELETE SET NULL;

ALTER TABLE spare_parts
    ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES equipment_groups(id) ON DELETE SET NULL;

ALTER TABLE licenses
    ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES equipment_groups(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_assets_group        ON assets(group_id);
CREATE INDEX IF NOT EXISTS idx_accessories_group   ON accessories(group_id);
CREATE INDEX IF NOT EXISTS idx_components_group    ON components(group_id);
CREATE INDEX IF NOT EXISTS idx_consumables_group   ON consumables(group_id);
CREATE INDEX IF NOT EXISTS idx_spare_parts_group   ON spare_parts(group_id);
CREATE INDEX IF NOT EXISTS idx_licenses_group      ON licenses(group_id);
