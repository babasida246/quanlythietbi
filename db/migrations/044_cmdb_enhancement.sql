-- Migration: 044_cmdb_enhancement.sql
-- Feature: Intelligent CMDB Enhancement
-- Description: Auto-discovery, impact analysis, smart tagging

BEGIN;

-- ============================================================================
-- 1. Discovery Rules
-- ============================================================================
CREATE TABLE IF NOT EXISTS cmdb_discovery_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(200) NOT NULL,
    discovery_type VARCHAR(50) NOT NULL CHECK (discovery_type IN (
        'network_scan', 'agent_based', 'cloud_api', 'manual_import'
    )),
    scope JSONB NOT NULL DEFAULT '[]',
    schedule_cron VARCHAR(100),
    mapping_rules JSONB NOT NULL DEFAULT '[]',
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_run_at TIMESTAMPTZ,
    last_status VARCHAR(20),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 2. Discovery Results
-- ============================================================================
CREATE TABLE IF NOT EXISTS cmdb_discovery_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_id UUID NOT NULL REFERENCES cmdb_discovery_rules(id) ON DELETE CASCADE,
    discovered_data JSONB NOT NULL DEFAULT '{}',
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN (
        'pending', 'confirmed', 'rejected', 'auto_applied'
    )),
    confidence NUMERIC(3,2) NOT NULL DEFAULT 0.0,
    ci_id UUID,
    reviewed_by VARCHAR(100),
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 3. Impact Analysis Rules
-- ============================================================================
CREATE TABLE IF NOT EXISTS cmdb_impact_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(200) NOT NULL,
    source_ci_type_id UUID,
    relationship_type_id UUID,
    impact_level VARCHAR(20) NOT NULL DEFAULT 'medium' CHECK (impact_level IN (
        'critical', 'high', 'medium', 'low', 'info'
    )),
    propagation_depth INTEGER NOT NULL DEFAULT 3,
    conditions JSONB NOT NULL DEFAULT '{}',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 4. Smart Tags
-- ============================================================================
CREATE TABLE IF NOT EXISTS cmdb_smart_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tag_name VARCHAR(100) NOT NULL,
    tag_category VARCHAR(50) NOT NULL DEFAULT 'auto',
    color VARCHAR(7) DEFAULT '#3b82f6',
    description TEXT,
    auto_assign_rules JSONB NOT NULL DEFAULT '[]',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cmdb_ci_tags (
    ci_id UUID NOT NULL,
    tag_id UUID NOT NULL REFERENCES cmdb_smart_tags(id) ON DELETE CASCADE,
    assigned_by VARCHAR(20) NOT NULL DEFAULT 'manual' CHECK (assigned_by IN (
        'manual', 'auto', 'ai'
    )),
    confidence NUMERIC(3,2) DEFAULT 1.0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (ci_id, tag_id)
);

-- ============================================================================
-- 5. Change Impact Assessment
-- ============================================================================
CREATE TABLE IF NOT EXISTS cmdb_change_assessments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(300) NOT NULL,
    description TEXT,
    target_ci_ids UUID[] NOT NULL DEFAULT '{}',
    impact_analysis JSONB NOT NULL DEFAULT '{}',
    risk_score NUMERIC(3,1) NOT NULL DEFAULT 0.0,
    status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN (
        'draft', 'analyzing', 'reviewed', 'approved', 'rejected', 'executed'
    )),
    created_by VARCHAR(100),
    reviewed_by VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_discovery_rules_type ON cmdb_discovery_rules(discovery_type) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_discovery_results_rule ON cmdb_discovery_results(rule_id);
CREATE INDEX IF NOT EXISTS idx_discovery_results_status ON cmdb_discovery_results(status);
CREATE INDEX IF NOT EXISTS idx_ci_tags_ci ON cmdb_ci_tags(ci_id);
CREATE INDEX IF NOT EXISTS idx_ci_tags_tag ON cmdb_ci_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_change_assessments_status ON cmdb_change_assessments(status);

COMMIT;
