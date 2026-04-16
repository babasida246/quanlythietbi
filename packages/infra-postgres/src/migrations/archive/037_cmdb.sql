-- CMDB core tables
CREATE TABLE IF NOT EXISTS cmdb_ci_types
(
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cmdb_ci_types_code ON cmdb_ci_types(code);

CREATE TABLE IF NOT EXISTS cmdb_ci_type_versions
(
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type_id UUID NOT NULL REFERENCES cmdb_ci_types(id) ON DELETE CASCADE,
    version INT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('draft','active','retired')),
    created_by TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (type_id, version)
);

CREATE INDEX IF NOT EXISTS idx_cmdb_ci_type_versions_status ON cmdb_ci_type_versions(type_id, status);

CREATE TABLE IF NOT EXISTS cmdb_ci_type_attr_defs
(
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    version_id UUID NOT NULL REFERENCES cmdb_ci_type_versions(id) ON DELETE CASCADE,
    key TEXT NOT NULL,
    label TEXT NOT NULL,
    field_type TEXT NOT NULL CHECK (field_type IN ('string','number','boolean','enum','date','ip','mac','cidr','hostname','port','regex','json','multi_enum')),
    required BOOLEAN NOT NULL DEFAULT false,
    unit TEXT,
    enum_values JSONB,
    pattern TEXT,
    min_value NUMERIC,
    max_value NUMERIC,
    step_value NUMERIC,
    min_len INT,
    max_len INT,
    default_value JSONB,
    is_searchable BOOLEAN NOT NULL DEFAULT false,
    is_filterable BOOLEAN NOT NULL DEFAULT false,
    sort_order INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (version_id, key)
);

CREATE INDEX IF NOT EXISTS idx_cmdb_ci_type_attr_defs_version ON cmdb_ci_type_attr_defs(version_id, sort_order);

CREATE TABLE IF NOT EXISTS cmdb_cis
(
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type_id UUID NOT NULL REFERENCES cmdb_ci_types(id) ON DELETE RESTRICT,
    name TEXT NOT NULL,
    ci_code TEXT UNIQUE NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('active','planned','maintenance','retired')) DEFAULT 'active',
    environment TEXT NOT NULL CHECK (environment IN ('prod','uat','dev')) DEFAULT 'prod',
    asset_id UUID REFERENCES assets(id) ON DELETE SET NULL,
    location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
    owner_team TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cmdb_cis_type ON cmdb_cis(type_id);
CREATE INDEX IF NOT EXISTS idx_cmdb_cis_asset ON cmdb_cis(asset_id);
CREATE INDEX IF NOT EXISTS idx_cmdb_cis_location ON cmdb_cis(location_id);

CREATE TABLE IF NOT EXISTS cmdb_ci_attr_values
(
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ci_id UUID NOT NULL REFERENCES cmdb_cis(id) ON DELETE CASCADE,
    version_id UUID NOT NULL REFERENCES cmdb_ci_type_versions(id) ON DELETE RESTRICT,
    key TEXT NOT NULL,
    value JSONB,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (ci_id, key)
);

CREATE INDEX IF NOT EXISTS idx_cmdb_ci_attr_values_ci ON cmdb_ci_attr_values(ci_id);

CREATE TABLE IF NOT EXISTS cmdb_relationship_types
(
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    reverse_name TEXT,
    allowed_from_type_id UUID REFERENCES cmdb_ci_types(id) ON DELETE SET NULL,
    allowed_to_type_id UUID REFERENCES cmdb_ci_types(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS cmdb_relationships
(
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type_id UUID NOT NULL REFERENCES cmdb_relationship_types(id) ON DELETE CASCADE,
    from_ci_id UUID NOT NULL REFERENCES cmdb_cis(id) ON DELETE CASCADE,
    to_ci_id UUID NOT NULL REFERENCES cmdb_cis(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('active','retired')) DEFAULT 'active',
    since_date DATE,
    note TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cmdb_relationships_from ON cmdb_relationships(from_ci_id);
CREATE INDEX IF NOT EXISTS idx_cmdb_relationships_to ON cmdb_relationships(to_ci_id);

CREATE TABLE IF NOT EXISTS cmdb_services
(
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    criticality TEXT,
    owner TEXT,
    sla TEXT,
    status TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cmdb_service_members
(
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    service_id UUID NOT NULL REFERENCES cmdb_services(id) ON DELETE CASCADE,
    ci_id UUID NOT NULL REFERENCES cmdb_cis(id) ON DELETE CASCADE,
    role TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cmdb_service_members_service ON cmdb_service_members(service_id);
CREATE INDEX IF NOT EXISTS idx_cmdb_service_members_ci ON cmdb_service_members(ci_id);

ALTER TABLE repair_orders
    ADD COLUMN IF NOT EXISTS ci_id UUID REFERENCES cmdb_cis(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_repair_orders_ci ON repair_orders(ci_id, opened_at DESC);

ALTER TABLE ops_events DROP CONSTRAINT IF EXISTS ops_events_entity_type_check;
ALTER TABLE ops_events
    ADD CONSTRAINT ops_events_entity_type_check
    CHECK (entity_type IN ('repair_order','stock_document','spare_part','warehouse','asset_category','cmdb_ci','cmdb_rel','cmdb_service','cmdb_type','cmdb_schema'));
