-- Migration: 045_integration_hub.sql
-- Feature: Integration Hub with third-party connectors
-- Description: Connector configs, sync rules, webhook management

BEGIN;

    -- ============================================================================
    -- 1. Integration Connectors
    -- ============================================================================
    CREATE TABLE
    IF NOT EXISTS integration_connectors
    (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid
    (),
    name VARCHAR
    (200) NOT NULL,
    provider VARCHAR
    (50) NOT NULL CHECK
    (provider IN
    (
        'servicenow', 'jira', 'slack', 'teams', 'aws', 'azure',
        'email', 'webhook', 'csv_import', 'api_generic'
    )),
    config JSONB NOT NULL DEFAULT '{}',
    credentials_ref VARCHAR
    (200),
    is_active BOOLEAN NOT NULL DEFAULT false,
    health_status VARCHAR
    (20) DEFAULT 'unknown' CHECK
    (health_status IN
    (
        'healthy', 'degraded', 'error', 'unknown'
    )),
    last_health_check TIMESTAMPTZ,
    created_by VARCHAR
    (100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW
    (),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW
    ()
);

    -- ============================================================================
    -- 2. Sync Rules
    -- ============================================================================
    CREATE TABLE
    IF NOT EXISTS integration_sync_rules
    (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid
    (),
    connector_id UUID NOT NULL REFERENCES integration_connectors
    (id) ON
    DELETE CASCADE,
    name VARCHAR(200)
    NOT NULL,
    direction VARCHAR
    (20) NOT NULL DEFAULT 'inbound' CHECK
    (direction IN
    (
        'inbound', 'outbound', 'bidirectional'
    )),
    entity_type VARCHAR
    (50) NOT NULL,
    field_mappings JSONB NOT NULL DEFAULT '[]',
    filter_conditions JSONB NOT NULL DEFAULT '{}',
    schedule_cron VARCHAR
    (100),
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_sync_at TIMESTAMPTZ,
    last_sync_status VARCHAR
    (20),
    last_sync_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW
    (),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW
    ()
);

    -- ============================================================================
    -- 3. Sync Logs
    -- ============================================================================
    CREATE TABLE
    IF NOT EXISTS integration_sync_logs
    (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid
    (),
    sync_rule_id UUID NOT NULL REFERENCES integration_sync_rules
    (id) ON
    DELETE CASCADE,
    direction VARCHAR(20) NOT NULL,
    records_processed INTEGER NOT NULL DEFAULT 0,
    records_created INTEGER
    NOT NULL DEFAULT 0,
    records_updated INTEGER NOT NULL DEFAULT 0,
    records_failed INTEGER NOT NULL DEFAULT 0,
    errors JSONB NOT NULL DEFAULT '[]',
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW
    (),
    completed_at TIMESTAMPTZ,
    status VARCHAR
    (20) NOT NULL DEFAULT 'running'
);

-- ============================================================================
-- 4. Webhooks
-- ============================================================================
CREATE TABLE
IF NOT EXISTS integration_webhooks
(
    id UUID PRIMARY KEY DEFAULT gen_random_uuid
(),
    connector_id UUID REFERENCES integration_connectors
(id) ON
DELETE CASCADE,
    name VARCHAR(200)
NOT NULL,
    url VARCHAR
(500) NOT NULL,
    secret VARCHAR
(200),
    events VARCHAR
(50)[] NOT NULL DEFAULT '{}',
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_triggered_at TIMESTAMPTZ,
    failure_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW
()
);

-- Indexes
CREATE INDEX
IF NOT EXISTS idx_connectors_provider ON integration_connectors
(provider);
CREATE INDEX
IF NOT EXISTS idx_sync_rules_connector ON integration_sync_rules
(connector_id);
CREATE INDEX
IF NOT EXISTS idx_sync_logs_rule ON integration_sync_logs
(sync_rule_id);
CREATE INDEX
IF NOT EXISTS idx_webhooks_connector ON integration_webhooks
(connector_id);

COMMIT;
