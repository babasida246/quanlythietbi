-- =====================================================
-- Migration: 20260326_001_ou_organization_mapping.sql
-- Description: Explicit OU -> Organization mapping for scoped data access
-- =====================================================

CREATE TABLE IF NOT EXISTS ou_organization_mappings (
    ou_id UUID PRIMARY KEY REFERENCES org_units(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ou_organization_mappings_org
    ON ou_organization_mappings(organization_id);

-- Backfill by normalized name matching for known OU/Organization pairs.
INSERT INTO ou_organization_mappings (ou_id, organization_id)
SELECT ou.id, org.id
FROM org_units ou
JOIN organizations org
    ON LOWER(TRIM(ou.name)) = LOWER(TRIM(org.name))
ON CONFLICT (ou_id) DO UPDATE
SET organization_id = EXCLUDED.organization_id,
    updated_at = NOW();
