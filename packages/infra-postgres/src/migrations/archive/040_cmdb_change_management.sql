-- CMDB change management (P4)
CREATE TABLE IF NOT EXISTS cmdb_changes
(
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','submitted','approved','implemented','closed','canceled')),
    risk TEXT NOT NULL DEFAULT 'medium' CHECK (risk IN ('low','medium','high','critical')),
    primary_ci_id UUID REFERENCES cmdb_cis(id) ON DELETE SET NULL,
    impact_snapshot JSONB,
    implementation_plan TEXT,
    rollback_plan TEXT,
    planned_start_at TIMESTAMPTZ,
    planned_end_at TIMESTAMPTZ,
    requested_by TEXT,
    approved_by TEXT,
    implemented_by TEXT,
    implemented_at TIMESTAMPTZ,
    closed_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cmdb_changes_status ON cmdb_changes(status);
CREATE INDEX IF NOT EXISTS idx_cmdb_changes_risk ON cmdb_changes(risk);
CREATE INDEX IF NOT EXISTS idx_cmdb_changes_primary_ci ON cmdb_changes(primary_ci_id);
CREATE INDEX IF NOT EXISTS idx_cmdb_changes_created_at ON cmdb_changes(created_at DESC);

ALTER TABLE ops_events DROP CONSTRAINT IF EXISTS ops_events_entity_type_check;
ALTER TABLE ops_events
    ADD CONSTRAINT ops_events_entity_type_check
    CHECK (entity_type IN ('repair_order','stock_document','spare_part','warehouse','asset_category','cmdb_ci','cmdb_rel','cmdb_service','cmdb_type','cmdb_schema','cmdb_change'));

