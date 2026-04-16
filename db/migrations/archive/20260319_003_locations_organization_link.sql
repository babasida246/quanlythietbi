-- Migration: Link locations to organizations (OU)
-- Each physical location can belong to an organizational unit

ALTER TABLE locations
    ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_locations_organization
    ON locations(organization_id)
    WHERE organization_id IS NOT NULL;
