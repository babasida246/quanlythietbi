-- =============================================
-- Migration: 039_reports_alerts_module.sql
-- Module: 10-REPORTS (Reports & Alerts)
-- Description: Database schema for reports and alerts
-- =============================================

-- ==================== REPORT DEFINITIONS ====================

CREATE TABLE IF NOT EXISTS report_definitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Basic info
    report_code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    report_type VARCHAR(50) NOT NULL, -- dashboard, tabular, chart, scheduled
    
    -- Configuration
    data_source VARCHAR(100) NOT NULL, -- assets, licenses, checkouts, etc.
    fields JSONB NOT NULL DEFAULT '[]', -- columns/fields to include
    filters JSONB DEFAULT '[]', -- available filter definitions
    default_filters JSONB DEFAULT '{}', -- default filter values
    grouping JSONB DEFAULT '[]', -- grouping configuration
    sorting JSONB DEFAULT '[]', -- default sort configuration
    chart_config JSONB DEFAULT '{}', -- chart-specific configuration
    
    -- Access control
    access_level VARCHAR(50) NOT NULL DEFAULT 'all', -- all, admin, asset_manager, custom
    allowed_roles JSONB DEFAULT '[]', -- roles that can access
    
    -- Scheduling
    is_scheduled BOOLEAN DEFAULT FALSE,
    schedule_cron VARCHAR(100), -- cron expression
    schedule_recipients JSONB DEFAULT '[]', -- email recipients
    schedule_format VARCHAR(20) DEFAULT 'excel', -- excel, pdf, csv
    last_run_at TIMESTAMP WITH TIME ZONE,
    next_run_at TIMESTAMP WITH TIME ZONE,
    
    -- Status
    is_builtin BOOLEAN DEFAULT FALSE, -- system-provided vs user-created
    is_active BOOLEAN DEFAULT TRUE,
    is_favorite BOOLEAN DEFAULT FALSE,
    view_count INTEGER DEFAULT 0,
    
    -- Audit
    organization_id UUID,
    created_by UUID,
    updated_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT chk_report_type CHECK (report_type IN ('dashboard', 'tabular', 'chart', 'scheduled')),
    CONSTRAINT chk_access_level CHECK (access_level IN ('all', 'admin', 'asset_manager', 'custom'))
);

-- Report execution history
CREATE TABLE IF NOT EXISTS report_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    report_id UUID NOT NULL REFERENCES report_definitions(id) ON DELETE CASCADE,
    
    -- Execution info
    execution_type VARCHAR(20) NOT NULL DEFAULT 'manual', -- manual, scheduled
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, running, completed, failed
    filters_used JSONB DEFAULT '{}', -- actual filters used
    
    -- Results
    row_count INTEGER,
    file_path VARCHAR(500), -- path to generated file if any
    file_format VARCHAR(20), -- excel, pdf, csv
    file_size_bytes INTEGER,
    
    -- Timing
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    duration_ms INTEGER,
    error_message TEXT,
    
    -- Delivery (for scheduled)
    recipients JSONB DEFAULT '[]',
    delivery_status VARCHAR(20), -- pending, sent, failed
    delivery_error TEXT,
    
    -- Audit
    executed_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT chk_execution_type CHECK (execution_type IN ('manual', 'scheduled')),
    CONSTRAINT chk_execution_status CHECK (status IN ('pending', 'running', 'completed', 'failed'))
);

-- ==================== ALERT RULES ====================

CREATE TABLE IF NOT EXISTS alert_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Basic info
    rule_code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    rule_type VARCHAR(50) NOT NULL, -- license, warranty, stock, checkout, depreciation, custom
    
    -- Condition
    condition_field VARCHAR(100) NOT NULL, -- field to check
    condition_operator VARCHAR(20) NOT NULL, -- eq, ne, gt, lt, gte, lte, in, contains
    condition_value JSONB NOT NULL, -- threshold value(s)
    condition_query TEXT, -- custom SQL query for complex conditions
    
    -- Alert configuration
    severity VARCHAR(20) NOT NULL DEFAULT 'warning', -- info, warning, critical
    channel VARCHAR(50) NOT NULL DEFAULT 'both', -- email, in_app, both
    frequency VARCHAR(20) NOT NULL DEFAULT 'once', -- once, daily, weekly
    cooldown_hours INTEGER DEFAULT 24, -- hours between duplicate alerts
    
    -- Recipients
    recipients JSONB NOT NULL DEFAULT '[]', -- user IDs or email addresses
    recipient_roles JSONB DEFAULT '[]', -- roles to notify
    
    -- Status
    is_builtin BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    last_triggered_at TIMESTAMP WITH TIME ZONE,
    trigger_count INTEGER DEFAULT 0,
    
    -- Audit
    organization_id UUID,
    created_by UUID,
    updated_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT chk_rule_type CHECK (rule_type IN ('license', 'warranty', 'stock', 'checkout', 'depreciation', 'custom')),
    CONSTRAINT chk_severity CHECK (severity IN ('info', 'warning', 'critical')),
    CONSTRAINT chk_channel CHECK (channel IN ('email', 'in_app', 'both')),
    CONSTRAINT chk_frequency CHECK (frequency IN ('once', 'daily', 'weekly'))
);

-- Alert history
CREATE TABLE IF NOT EXISTS alert_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    rule_id UUID NOT NULL REFERENCES alert_rules(id) ON DELETE CASCADE,
    
    -- Trigger info
    triggered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    trigger_data JSONB NOT NULL, -- data that triggered the alert
    affected_count INTEGER DEFAULT 1, -- number of items affected
    
    -- Alert content
    title VARCHAR(500) NOT NULL,
    message TEXT NOT NULL,
    severity VARCHAR(20) NOT NULL,
    
    -- Delivery
    recipients_notified JSONB DEFAULT '[]', -- who was notified
    channel_used VARCHAR(50),
    delivery_status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, sent, partial, failed
    delivery_error TEXT,
    
    -- Acknowledgment
    is_acknowledged BOOLEAN DEFAULT FALSE,
    acknowledged_by UUID,
    acknowledged_at TIMESTAMP WITH TIME ZONE,
    acknowledgment_note TEXT,
    
    -- Audit
    organization_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT chk_alert_severity CHECK (severity IN ('info', 'warning', 'critical')),
    CONSTRAINT chk_delivery_status CHECK (delivery_status IN ('pending', 'sent', 'partial', 'failed'))
);

-- User alert preferences
CREATE TABLE IF NOT EXISTS user_alert_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    user_id UUID NOT NULL,
    
    -- Channel preferences
    email_enabled BOOLEAN DEFAULT TRUE,
    in_app_enabled BOOLEAN DEFAULT TRUE,
    
    -- Frequency preferences
    digest_frequency VARCHAR(20) DEFAULT 'immediate', -- immediate, daily, weekly
    digest_time TIME DEFAULT '09:00:00', -- time for daily/weekly digest
    digest_day INTEGER DEFAULT 1, -- day of week for weekly (1=Monday)
    
    -- Severity preferences
    email_min_severity VARCHAR(20) DEFAULT 'warning', -- minimum severity for email
    
    -- Muted rules
    muted_rules JSONB DEFAULT '[]', -- rule IDs to mute
    
    -- Audit
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT chk_digest_freq CHECK (digest_frequency IN ('immediate', 'daily', 'weekly')),
    CONSTRAINT chk_min_severity CHECK (email_min_severity IN ('info', 'warning', 'critical'))
);

-- Dashboard widgets configuration
CREATE TABLE IF NOT EXISTS dashboard_widgets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Widget info
    widget_code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    widget_type VARCHAR(50) NOT NULL, -- pie_chart, bar_chart, line_chart, stat_card, table, timeline, list
    
    -- Data configuration
    data_source VARCHAR(100) NOT NULL,
    data_query TEXT, -- custom query or config
    data_config JSONB DEFAULT '{}',
    
    -- Display configuration
    default_size VARCHAR(20) DEFAULT 'medium', -- small, medium, large, full
    min_width INTEGER DEFAULT 1, -- grid units
    min_height INTEGER DEFAULT 1,
    refresh_interval INTEGER DEFAULT 300, -- seconds, 0 = no auto-refresh
    
    -- Status
    is_builtin BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Audit
    organization_id UUID,
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT chk_widget_type CHECK (widget_type IN ('pie_chart', 'bar_chart', 'line_chart', 'stat_card', 'table', 'timeline', 'list', 'map'))
);

-- User dashboard layouts
CREATE TABLE IF NOT EXISTS user_dashboard_layouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    user_id UUID NOT NULL,
    dashboard_type VARCHAR(50) NOT NULL DEFAULT 'main', -- main, financial, compliance, custom
    
    -- Layout configuration
    layout JSONB NOT NULL DEFAULT '[]', -- widget positions and sizes
    
    -- Audit
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(user_id, dashboard_type)
);

-- ==================== VIEWS ====================

-- View: Report definitions with execution stats
CREATE OR REPLACE VIEW v_report_definitions AS
SELECT 
    r.*,
    u.name as created_by_name,
    (SELECT COUNT(*) FROM report_executions WHERE report_id = r.id) as execution_count,
    (SELECT COUNT(*) FROM report_executions WHERE report_id = r.id AND status = 'completed') as success_count,
    (SELECT MAX(completed_at) FROM report_executions WHERE report_id = r.id AND status = 'completed') as last_success_at
FROM report_definitions r
LEFT JOIN users u ON r.created_by = u.id;

-- View: Alert rules with trigger stats
CREATE OR REPLACE VIEW v_alert_rules AS
SELECT 
    a.*,
    u.name as created_by_name,
    (SELECT COUNT(*) FROM alert_history WHERE rule_id = a.id) as total_triggers,
    (SELECT COUNT(*) FROM alert_history WHERE rule_id = a.id AND triggered_at > NOW() - INTERVAL '30 days') as triggers_last_30_days,
    (SELECT COUNT(*) FROM alert_history WHERE rule_id = a.id AND is_acknowledged = FALSE) as unacknowledged_count
FROM alert_rules a
LEFT JOIN users u ON a.created_by = u.id;

-- View: Recent alerts
CREATE OR REPLACE VIEW v_recent_alerts AS
SELECT 
    h.*,
    r.name as rule_name,
    r.rule_type,
    r.severity as rule_severity
FROM alert_history h
JOIN alert_rules r ON h.rule_id = r.id
ORDER BY h.triggered_at DESC;

-- ==================== FUNCTIONS ====================

-- Generate report code
CREATE OR REPLACE FUNCTION generate_report_code()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.report_code IS NULL OR NEW.report_code = '' THEN
        NEW.report_code := 'RPT-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || 
                           LPAD(NEXTVAL('report_code_seq')::TEXT, 3, '0');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Generate alert rule code
CREATE OR REPLACE FUNCTION generate_alert_rule_code()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.rule_code IS NULL OR NEW.rule_code = '' THEN
        NEW.rule_code := 'ALR-' || UPPER(LEFT(NEW.rule_type, 3)) || '-' || 
                         LPAD(NEXTVAL('alert_rule_code_seq')::TEXT, 3, '0');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Update next run time for scheduled reports
CREATE OR REPLACE FUNCTION calculate_next_run(
    p_cron VARCHAR,
    p_last_run TIMESTAMP WITH TIME ZONE
)
RETURNS TIMESTAMP WITH TIME ZONE AS $$
DECLARE
    v_next_run TIMESTAMP WITH TIME ZONE;
BEGIN
    -- Simplified: for now just add based on common patterns
    -- In production, use a proper cron parser library
    IF p_cron LIKE '0 0 * * *' THEN -- daily
        v_next_run := COALESCE(p_last_run, NOW()) + INTERVAL '1 day';
    ELSIF p_cron LIKE '0 0 * * 1' THEN -- weekly Monday
        v_next_run := COALESCE(p_last_run, NOW()) + INTERVAL '7 days';
    ELSIF p_cron LIKE '0 0 1 * *' THEN -- monthly 1st
        v_next_run := DATE_TRUNC('month', COALESCE(p_last_run, NOW())) + INTERVAL '1 month';
    ELSE
        v_next_run := COALESCE(p_last_run, NOW()) + INTERVAL '1 day';
    END IF;
    
    RETURN v_next_run;
END;
$$ LANGUAGE plpgsql;

-- Check if alert should be sent (respecting cooldown)
CREATE OR REPLACE FUNCTION should_send_alert(
    p_rule_id UUID,
    p_cooldown_hours INTEGER
)
RETURNS BOOLEAN AS $$
DECLARE
    v_last_triggered TIMESTAMP WITH TIME ZONE;
BEGIN
    SELECT MAX(triggered_at) INTO v_last_triggered
    FROM alert_history
    WHERE rule_id = p_rule_id
    AND delivery_status = 'sent';
    
    IF v_last_triggered IS NULL THEN
        RETURN TRUE;
    END IF;
    
    RETURN (NOW() - v_last_triggered) > (p_cooldown_hours * INTERVAL '1 hour');
END;
$$ LANGUAGE plpgsql;

-- ==================== TRIGGERS ====================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Sequences for code generation
CREATE SEQUENCE IF NOT EXISTS report_code_seq START 1;
CREATE SEQUENCE IF NOT EXISTS alert_rule_code_seq START 1;

-- Auto-generate report code
DROP TRIGGER IF EXISTS trg_generate_report_code ON report_definitions;
CREATE TRIGGER trg_generate_report_code
    BEFORE INSERT ON report_definitions
    FOR EACH ROW
    EXECUTE FUNCTION generate_report_code();

-- Auto-generate alert rule code
DROP TRIGGER IF EXISTS trg_generate_alert_rule_code ON alert_rules;
CREATE TRIGGER trg_generate_alert_rule_code
    BEFORE INSERT ON alert_rules
    FOR EACH ROW
    EXECUTE FUNCTION generate_alert_rule_code();

-- Update timestamps
DROP TRIGGER IF EXISTS trg_report_definitions_updated ON report_definitions;
CREATE TRIGGER trg_report_definitions_updated
    BEFORE UPDATE ON report_definitions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_alert_rules_updated ON alert_rules;
CREATE TRIGGER trg_alert_rules_updated
    BEFORE UPDATE ON alert_rules
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_dashboard_widgets_updated ON dashboard_widgets;
CREATE TRIGGER trg_dashboard_widgets_updated
    BEFORE UPDATE ON dashboard_widgets
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_user_dashboard_layouts_updated ON user_dashboard_layouts;
CREATE TRIGGER trg_user_dashboard_layouts_updated
    BEFORE UPDATE ON user_dashboard_layouts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ==================== INDEXES ====================

CREATE INDEX IF NOT EXISTS idx_report_definitions_type ON report_definitions(report_type);
CREATE INDEX IF NOT EXISTS idx_report_definitions_data_source ON report_definitions(data_source);
CREATE INDEX IF NOT EXISTS idx_report_definitions_scheduled ON report_definitions(is_scheduled, next_run_at) WHERE is_scheduled = TRUE;
CREATE INDEX IF NOT EXISTS idx_report_definitions_org ON report_definitions(organization_id);

CREATE INDEX IF NOT EXISTS idx_report_executions_report ON report_executions(report_id);
CREATE INDEX IF NOT EXISTS idx_report_executions_status ON report_executions(status);
CREATE INDEX IF NOT EXISTS idx_report_executions_date ON report_executions(started_at);

CREATE INDEX IF NOT EXISTS idx_alert_rules_type ON alert_rules(rule_type);
CREATE INDEX IF NOT EXISTS idx_alert_rules_active ON alert_rules(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_alert_rules_org ON alert_rules(organization_id);

CREATE INDEX IF NOT EXISTS idx_alert_history_rule ON alert_history(rule_id);
CREATE INDEX IF NOT EXISTS idx_alert_history_triggered ON alert_history(triggered_at);
CREATE INDEX IF NOT EXISTS idx_alert_history_unack ON alert_history(is_acknowledged) WHERE is_acknowledged = FALSE;
CREATE INDEX IF NOT EXISTS idx_alert_history_org ON alert_history(organization_id);

CREATE INDEX IF NOT EXISTS idx_user_alert_prefs_user ON user_alert_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_dashboard_widgets_type ON dashboard_widgets(widget_type);
CREATE INDEX IF NOT EXISTS idx_user_dashboard_layouts_user ON user_dashboard_layouts(user_id);

-- ==================== SEED DATA ====================

-- Insert built-in alert rules
INSERT INTO alert_rules (rule_code, name, description, rule_type, condition_field, condition_operator, condition_value, severity, channel, frequency, cooldown_hours, is_builtin, is_active) VALUES
-- License alerts
('ALR-LIC-001', 'License Expiring Soon', 'Alert when license expires within 30 days', 'license', 'expiry_date', 'lte', '{"days": 30}', 'warning', 'both', 'once', 168, TRUE, TRUE),
('ALR-LIC-002', 'License Expired', 'Alert when license has expired', 'license', 'expiry_date', 'lt', '{"days": 0}', 'critical', 'both', 'daily', 24, TRUE, TRUE),
('ALR-LIC-003', 'License Over-Seat', 'Alert when license seats exceeded', 'license', 'seats_used', 'gt', '{"field": "seats_allowed"}', 'critical', 'both', 'once', 4, TRUE, TRUE),
('ALR-LIC-004', 'License High Usage', 'Alert when license usage exceeds 90%', 'license', 'usage_percent', 'gte', '{"percent": 90}', 'warning', 'email', 'weekly', 168, TRUE, TRUE),

-- Warranty alerts
('ALR-WAR-001', 'Warranty Expiring Soon', 'Alert when warranty expires within 30 days', 'warranty', 'warranty_expiry', 'lte', '{"days": 30}', 'warning', 'both', 'once', 168, TRUE, TRUE),
('ALR-WAR-002', 'Warranty Expired', 'Alert when warranty has expired', 'warranty', 'warranty_expiry', 'lt', '{"days": 0}', 'info', 'in_app', 'once', 720, TRUE, TRUE),

-- Stock alerts
('ALR-STK-001', 'Accessory Low Stock', 'Alert when accessory below minimum quantity', 'stock', 'quantity', 'lte', '{"field": "min_quantity"}', 'warning', 'both', 'daily', 24, TRUE, TRUE),
('ALR-STK-002', 'Consumable Low Stock', 'Alert when consumable below reorder point', 'stock', 'quantity', 'lte', '{"field": "reorder_point"}', 'warning', 'both', 'daily', 24, TRUE, TRUE),
('ALR-STK-003', 'Out of Stock', 'Alert when item is out of stock', 'stock', 'quantity', 'eq', '{"value": 0}', 'critical', 'both', 'once', 4, TRUE, TRUE),

-- Checkout alerts
('ALR-CHK-001', 'Checkout Due Soon', 'Alert when checkout due within 3 days', 'checkout', 'expected_return', 'lte', '{"days": 3}', 'warning', 'both', 'once', 48, TRUE, TRUE),
('ALR-CHK-002', 'Checkout Overdue', 'Alert when checkout is overdue', 'checkout', 'expected_return', 'lt', '{"days": 0}', 'critical', 'both', 'daily', 24, TRUE, TRUE),

-- Depreciation alerts
('ALR-DEP-001', 'Fully Depreciated', 'Alert when asset is fully depreciated', 'depreciation', 'status', 'eq', '{"value": "fully_depreciated"}', 'info', 'in_app', 'once', 720, TRUE, TRUE),
('ALR-DEP-002', 'Near Full Depreciation', 'Alert when asset within 3 months of full depreciation', 'depreciation', 'remaining_months', 'lte', '{"months": 3}', 'warning', 'both', 'once', 168, TRUE, TRUE)

ON CONFLICT (rule_code) DO NOTHING;

-- Insert built-in dashboard widgets
INSERT INTO dashboard_widgets (widget_code, name, description, widget_type, data_source, data_config, default_size, is_builtin, is_active) VALUES
-- Asset widgets
('WDG-ASSET-STATUS', 'Assets by Status', 'Pie chart showing assets by status', 'pie_chart', 'assets', '{"group_by": "status"}', 'medium', TRUE, TRUE),
('WDG-ASSET-CATEGORY', 'Assets by Category', 'Bar chart showing assets by category', 'bar_chart', 'assets', '{"group_by": "category"}', 'large', TRUE, TRUE),
('WDG-ASSET-LOCATION', 'Assets by Location', 'Treemap showing assets by location', 'map', 'assets', '{"group_by": "location"}', 'large', TRUE, TRUE),
('WDG-ASSET-TOTAL', 'Total Assets', 'Total asset count', 'stat_card', 'assets', '{"aggregation": "count"}', 'small', TRUE, TRUE),

-- Financial widgets
('WDG-FIN-VALUE', 'Total Asset Value', 'Total asset value stat', 'stat_card', 'assets', '{"aggregation": "sum", "field": "purchase_cost"}', 'small', TRUE, TRUE),
('WDG-FIN-DEPRECIATION', 'Monthly Depreciation', 'This month depreciation', 'stat_card', 'depreciation', '{"aggregation": "sum", "period": "month"}', 'small', TRUE, TRUE),
('WDG-FIN-TREND', 'Purchase Trend', 'Line chart of purchases over time', 'line_chart', 'assets', '{"group_by": "purchase_date", "interval": "month"}', 'large', TRUE, TRUE),

-- Compliance widgets
('WDG-COMP-LICENSE', 'License Compliance', 'License compliance overview', 'table', 'licenses', '{"fields": ["name", "seats_used", "seats_allowed", "status"]}', 'large', TRUE, TRUE),
('WDG-COMP-OVERDUE', 'Overdue Checkouts', 'List of overdue checkouts', 'list', 'checkouts', '{"filter": "overdue"}', 'medium', TRUE, TRUE),
('WDG-COMP-WARRANTY', 'Warranty Status', 'Warranty expiration overview', 'table', 'assets', '{"fields": ["name", "warranty_expiry", "days_remaining"]}', 'large', TRUE, TRUE),

-- Activity widgets
('WDG-ACT-RECENT', 'Recent Activities', 'Timeline of recent activities', 'timeline', 'activity_log', '{"limit": 10}', 'medium', TRUE, TRUE),
('WDG-ACT-EXPIRING', 'Upcoming Expirations', 'List of upcoming expirations', 'list', 'mixed', '{"types": ["license", "warranty"], "days": 30}', 'medium', TRUE, TRUE)

ON CONFLICT (widget_code) DO NOTHING;

-- Insert built-in report definitions
INSERT INTO report_definitions (report_code, name, description, report_type, data_source, fields, filters, access_level, is_builtin, is_active) VALUES
-- Tabular reports
('RPT-TAB-001', 'Asset List Report', 'Complete list of all assets with customizable columns', 'tabular', 'assets', 
 '["asset_tag", "name", "category", "status", "location", "assigned_to", "purchase_date", "purchase_cost"]',
 '[{"field": "category_id", "label": "Category"}, {"field": "status", "label": "Status"}, {"field": "location_id", "label": "Location"}]',
 'all', TRUE, TRUE),

('RPT-TAB-002', 'License Compliance Report', 'License usage and compliance status', 'tabular', 'licenses',
 '["name", "vendor", "license_type", "seats_allowed", "seats_used", "usage_percent", "expiry_date", "status"]',
 '[{"field": "vendor", "label": "Vendor"}, {"field": "status", "label": "Status"}]',
 'all', TRUE, TRUE),

('RPT-TAB-003', 'Checkout History Report', 'History of asset checkouts', 'tabular', 'checkouts',
 '["asset_name", "checked_out_to", "checkout_date", "expected_return", "actual_return", "status"]',
 '[{"field": "status", "label": "Status"}, {"field": "checkout_date", "label": "Date Range"}]',
 'all', TRUE, TRUE),

('RPT-TAB-004', 'Depreciation Report', 'Asset depreciation details', 'tabular', 'depreciation',
 '["asset_name", "original_cost", "depreciation_amount", "accumulated", "book_value", "percent_depreciated"]',
 '[{"field": "category_id", "label": "Category"}, {"field": "period", "label": "Period"}]',
 'asset_manager', TRUE, TRUE),

('RPT-TAB-005', 'Audit Report', 'Audit session results and discrepancies', 'tabular', 'audits',
 '["audit_code", "name", "status", "total_items", "found", "missing", "misplaced", "completion_rate"]',
 '[{"field": "status", "label": "Status"}, {"field": "date_range", "label": "Date Range"}]',
 'asset_manager', TRUE, TRUE)

ON CONFLICT (report_code) DO NOTHING;
