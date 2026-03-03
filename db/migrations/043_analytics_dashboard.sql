-- Migration: 043_analytics_dashboard.sql
-- Feature: Advanced Analytics Dashboard
-- Description: Materialized views and tables for asset/CMDB analytics

BEGIN;

-- ============================================================================
-- 1. Asset Analytics Snapshots (daily)
-- ============================================================================
CREATE TABLE IF NOT EXISTS asset_analytics_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
    total_assets INTEGER NOT NULL DEFAULT 0,
    active_assets INTEGER NOT NULL DEFAULT 0,
    in_repair_assets INTEGER NOT NULL DEFAULT 0,
    disposed_assets INTEGER NOT NULL DEFAULT 0,
    unassigned_assets INTEGER NOT NULL DEFAULT 0,
    warranty_expiring_30d INTEGER NOT NULL DEFAULT 0,
    warranty_expired INTEGER NOT NULL DEFAULT 0,
    total_maintenance_tickets INTEGER NOT NULL DEFAULT 0,
    open_tickets INTEGER NOT NULL DEFAULT 0,
    avg_repair_hours NUMERIC(10,2),
    category_breakdown JSONB NOT NULL DEFAULT '{}',
    location_breakdown JSONB NOT NULL DEFAULT '{}',
    vendor_breakdown JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(snapshot_date)
);

-- ============================================================================
-- 2. Cost Tracking
-- ============================================================================
CREATE TABLE IF NOT EXISTS asset_cost_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id UUID NOT NULL,
    cost_type VARCHAR(50) NOT NULL CHECK (cost_type IN (
        'purchase', 'maintenance', 'repair', 'upgrade', 'disposal', 'other'
    )),
    amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    currency VARCHAR(3) NOT NULL DEFAULT 'VND',
    description TEXT,
    recorded_date DATE NOT NULL DEFAULT CURRENT_DATE,
    recorded_by VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 3. Performance Metrics
-- ============================================================================
CREATE TABLE IF NOT EXISTS asset_performance_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id UUID NOT NULL,
    metric_type VARCHAR(50) NOT NULL CHECK (metric_type IN (
        'uptime', 'response_time', 'error_rate', 'utilization',
        'throughput', 'temperature', 'custom'
    )),
    metric_value NUMERIC(12,4) NOT NULL,
    unit VARCHAR(20),
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata JSONB NOT NULL DEFAULT '{}'
);

-- ============================================================================
-- 4. Dashboard Configurations
-- ============================================================================
CREATE TABLE IF NOT EXISTS dashboard_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(100),
    name VARCHAR(200) NOT NULL DEFAULT 'Default',
    layout JSONB NOT NULL DEFAULT '[]',
    widgets JSONB NOT NULL DEFAULT '[]',
    is_default BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_analytics_snapshots_date ON asset_analytics_snapshots(snapshot_date DESC);
CREATE INDEX IF NOT EXISTS idx_cost_records_asset ON asset_cost_records(asset_id);
CREATE INDEX IF NOT EXISTS idx_cost_records_type ON asset_cost_records(cost_type);
CREATE INDEX IF NOT EXISTS idx_cost_records_date ON asset_cost_records(recorded_date DESC);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_asset ON asset_performance_metrics(asset_id, metric_type);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_time ON asset_performance_metrics(recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_dashboard_configs_user ON dashboard_configs(user_id);

COMMIT;
