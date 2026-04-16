-- Migration: Add location_id and organization_id to asset_assignments
-- Allows tracking where and for which OU an asset is assigned

ALTER TABLE asset_assignments
    ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_asset_assignments_location ON asset_assignments(location_id) WHERE location_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_asset_assignments_org ON asset_assignments(organization_id) WHERE organization_id IS NOT NULL;
