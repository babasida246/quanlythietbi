-- ============================================================================
-- CMDB Core Tables Migration
-- ============================================================================

-- CI Types Table
CREATE TABLE IF NOT EXISTS cmdb_ci_types (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_cmdb_ci_types__code ON cmdb_ci_types(code);

-- CI Type Versions (Schema Versioning)
CREATE TABLE IF NOT EXISTS cmdb_ci_type_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type_id UUID NOT NULL REFERENCES cmdb_ci_types(id) ON DELETE CASCADE,
    version INTEGER NOT NULL DEFAULT 1,
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'deprecated')),
    created_by VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(type_id, version),
    CONSTRAINT positive_version CHECK (version > 0)
);

CREATE INDEX IF NOT EXISTS ix_cmdb_ci_type_versions__type_id ON cmdb_ci_type_versions(type_id);
CREATE INDEX IF NOT EXISTS ix_cmdb_ci_type_versions__type_id__status ON cmdb_ci_type_versions(type_id, status) WHERE status = 'active';

-- CI Schema Definitions
CREATE TABLE IF NOT EXISTS cmdb_ci_schemas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ci_type_version_id UUID NOT NULL REFERENCES cmdb_ci_type_versions(id) ON DELETE CASCADE,
    attribute_key VARCHAR(100) NOT NULL,
    attribute_label VARCHAR(255) NOT NULL,
    data_type VARCHAR(50) NOT NULL CHECK (data_type IN (
        'text', 'number', 'boolean', 'date', 'datetime', 
        'json', 'url', 'email', 'select', 'multi_select'
    )),
    is_required BOOLEAN DEFAULT false,
    is_indexed BOOLEAN DEFAULT false,
    default_value JSONB,
    validation_rules JSONB DEFAULT '{}',
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(ci_type_version_id, attribute_key)
);

ALTER TABLE cmdb_ci_schemas
    ADD COLUMN IF NOT EXISTS ci_type_version_id UUID;

ALTER TABLE cmdb_ci_schemas
    ADD COLUMN IF NOT EXISTS attribute_key VARCHAR(100);

ALTER TABLE cmdb_ci_schemas
    ADD COLUMN IF NOT EXISTS attribute_label VARCHAR(255);

UPDATE cmdb_ci_schemas
SET ci_type_version_id = version_id
WHERE ci_type_version_id IS NULL
  AND version_id IS NOT NULL;

UPDATE cmdb_ci_schemas
SET attribute_key = attr_key
WHERE attribute_key IS NULL
  AND attr_key IS NOT NULL;

UPDATE cmdb_ci_schemas
SET attribute_label = attr_label
WHERE attribute_label IS NULL
  AND attr_label IS NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'cmdb_ci_schemas_ci_type_version_id_fkey'
    ) THEN
        ALTER TABLE cmdb_ci_schemas
            ADD CONSTRAINT cmdb_ci_schemas_ci_type_version_id_fkey
            FOREIGN KEY (ci_type_version_id)
            REFERENCES cmdb_ci_type_versions(id) ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'cmdb_ci_schemas_ci_type_version_id_attribute_key_key'
    ) THEN
        ALTER TABLE cmdb_ci_schemas
            ADD CONSTRAINT cmdb_ci_schemas_ci_type_version_id_attribute_key_key
            UNIQUE (ci_type_version_id, attribute_key);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS ix_cmdb_ci_schemas__ci_type_version_id ON cmdb_ci_schemas(ci_type_version_id);
CREATE INDEX IF NOT EXISTS ix_cmdb_ci_schemas__ci_type_version_id__display_order ON cmdb_ci_schemas(ci_type_version_id, display_order);

-- Configuration Items (CIs)
CREATE TABLE IF NOT EXISTS cmdb_cis (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type_id UUID NOT NULL REFERENCES cmdb_ci_types(id) ON DELETE RESTRICT,
    asset_id UUID REFERENCES assets(id) ON DELETE SET NULL,
    location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    ci_code VARCHAR(100) UNIQUE,
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'decommissioned', 'maintenance')),
    environment VARCHAR(50) DEFAULT 'prod' CHECK (environment IN ('dev', 'test', 'staging', 'prod')),
    owner_team VARCHAR(255),
    notes TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cis_type ON cmdb_cis(type_id);
CREATE INDEX IF NOT EXISTS idx_cis_asset ON cmdb_cis(asset_id);
CREATE INDEX IF NOT EXISTS idx_cis_location ON cmdb_cis(location_id);
CREATE INDEX IF NOT EXISTS idx_cis_status ON cmdb_cis(status);
CREATE INDEX IF NOT EXISTS idx_cis_environment ON cmdb_cis(environment);
CREATE INDEX IF NOT EXISTS idx_cis_name ON cmdb_cis(name);
CREATE INDEX IF NOT EXISTS idx_cis_ci_code ON cmdb_cis(ci_code);
CREATE INDEX IF NOT EXISTS idx_cis_metadata ON cmdb_cis USING gin(metadata);

-- CI Attribute Values
CREATE TABLE IF NOT EXISTS cmdb_ci_attribute_values (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ci_id UUID NOT NULL REFERENCES cmdb_cis(id) ON DELETE CASCADE,
    schema_id UUID NOT NULL REFERENCES cmdb_ci_schemas(id) ON DELETE RESTRICT,
    attribute_key VARCHAR(100) NOT NULL,
    value JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(ci_id, attribute_key)
);

CREATE INDEX IF NOT EXISTS ix_cmdb_ci_attribute_values__ci_id ON cmdb_ci_attribute_values(ci_id);
CREATE INDEX IF NOT EXISTS ix_cmdb_ci_attribute_values__schema_id ON cmdb_ci_attribute_values(schema_id);
CREATE INDEX IF NOT EXISTS ix_cmdb_ci_attribute_values__attribute_key ON cmdb_ci_attribute_values(attribute_key);
CREATE INDEX IF NOT EXISTS ix_cmdb_ci_attribute_values__value ON cmdb_ci_attribute_values USING gin(value);

-- Relationship Types
CREATE TABLE IF NOT EXISTS cmdb_relationship_types (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    reverse_name VARCHAR(255),
    allowed_from_type_id UUID REFERENCES cmdb_ci_types(id) ON DELETE SET NULL,
    allowed_to_type_id UUID REFERENCES cmdb_ci_types(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rel_types_code ON cmdb_relationship_types(code);
CREATE INDEX IF NOT EXISTS idx_rel_types_from ON cmdb_relationship_types(allowed_from_type_id);
CREATE INDEX IF NOT EXISTS idx_rel_types_to ON cmdb_relationship_types(allowed_to_type_id);

-- Relationships between CIs
CREATE TABLE IF NOT EXISTS cmdb_relationships (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type_id UUID NOT NULL REFERENCES cmdb_relationship_types(id) ON DELETE RESTRICT,
    from_ci_id UUID NOT NULL REFERENCES cmdb_cis(id) ON DELETE CASCADE,
    to_ci_id UUID NOT NULL REFERENCES cmdb_cis(id) ON DELETE CASCADE,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT no_self_relationship CHECK (from_ci_id != to_ci_id),
    UNIQUE(type_id, from_ci_id, to_ci_id)
);

CREATE INDEX IF NOT EXISTS idx_relationships_type ON cmdb_relationships(type_id);
CREATE INDEX IF NOT EXISTS idx_relationships_from ON cmdb_relationships(from_ci_id);
CREATE INDEX IF NOT EXISTS idx_relationships_to ON cmdb_relationships(to_ci_id);
CREATE INDEX IF NOT EXISTS idx_relationships_metadata ON cmdb_relationships USING gin(metadata);

-- Services (Business Services mapped to CIs)
CREATE TABLE IF NOT EXISTS cmdb_services (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    criticality VARCHAR(20) DEFAULT 'normal' CHECK (criticality IN ('low', 'normal', 'high', 'critical')),
    owner VARCHAR(255),
    sla JSONB DEFAULT '{}',
    status VARCHAR(50) DEFAULT 'active',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_services_code ON cmdb_services(code);
CREATE INDEX IF NOT EXISTS idx_services_status ON cmdb_services(status);
CREATE INDEX IF NOT EXISTS idx_services_criticality ON cmdb_services(criticality);
CREATE INDEX IF NOT EXISTS idx_services_metadata ON cmdb_services USING gin(metadata);

-- Service to CI Mapping
CREATE TABLE IF NOT EXISTS cmdb_service_cis (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    service_id UUID NOT NULL REFERENCES cmdb_services(id) ON DELETE CASCADE,
    ci_id UUID NOT NULL REFERENCES cmdb_cis(id) ON DELETE CASCADE,
    dependency_type VARCHAR(50) DEFAULT 'uses',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(service_id, ci_id)
);

CREATE INDEX IF NOT EXISTS idx_service_cis_service ON cmdb_service_cis(service_id);
CREATE INDEX IF NOT EXISTS idx_service_cis_ci ON cmdb_service_cis(ci_id);

-- ============================================================================
-- Seed Data: Default CI Types
-- ============================================================================

INSERT INTO cmdb_ci_types (code, name, description) VALUES
    ('server', 'Server', 'Physical or virtual server'),
    ('network_device', 'Network Device', 'Routers, switches, firewalls'),
    ('storage', 'Storage', 'Storage arrays and systems'),
    ('database', 'Database', 'Database instances'),
    ('application', 'Application', 'Software applications'),
    ('service', 'Service', 'IT services')
ON CONFLICT (code) DO NOTHING;

-- ============================================================================
-- Seed Data: Default Relationship Types
-- ============================================================================

INSERT INTO cmdb_relationship_types (code, name, reverse_name) VALUES
    ('runs_on', 'Runs On', 'Hosts'),
    ('depends_on', 'Depends On', 'Supports'),
    ('connects_to', 'Connects To', 'Connected From'),
    ('part_of', 'Part Of', 'Contains'),
    ('managed_by', 'Managed By', 'Manages')
ON CONFLICT (code) DO NOTHING;

-- ============================================================================
-- CMDB Core Tables Migration Complete
-- ============================================================================
