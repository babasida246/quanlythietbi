-- =====================================================
-- Migration: 20260319_001_organizations_hierarchy.sql
-- Description: Add hierarchy support to organizations
--              (parent_id for OU tree) + description/code fields
-- =====================================================

-- 1. Add parent_id, code, description to organizations
ALTER TABLE organizations
    ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS code VARCHAR(50),
    ADD COLUMN IF NOT EXISTS description TEXT,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- 2. Unique code per organization (when set)
CREATE UNIQUE INDEX IF NOT EXISTS idx_organizations_code
    ON organizations(code)
    WHERE code IS NOT NULL;

-- 3. Index for tree traversal
CREATE INDEX IF NOT EXISTS idx_organizations_parent
    ON organizations(parent_id);

-- 4. Add FK from asset_checkouts.organization_id → organizations (if not exists)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'fk_asset_checkouts_organization'
          AND table_name = 'asset_checkouts'
    ) THEN
        ALTER TABLE asset_checkouts
            ADD CONSTRAINT fk_asset_checkouts_organization
            FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE SET NULL;
    END IF;
END $$;
