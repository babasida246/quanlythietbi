-- Link locations to LDAP-synced OU tree (org_units)
-- Allows mapping a physical location to an Active Directory Organizational Unit

ALTER TABLE locations
    ADD COLUMN IF NOT EXISTS ou_id UUID REFERENCES org_units(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_locations_ou_id ON locations(ou_id) WHERE ou_id IS NOT NULL;
