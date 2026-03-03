-- Migration: 042_workflow_automation.sql
-- Feature: Workflow Automation Engine
-- Description: Adds automation rules, scheduled tasks, and notification rules

BEGIN;

-- ============================================================================
-- 1. Workflow Automation Rules
-- ============================================================================
CREATE TABLE IF NOT EXISTS workflow_automation_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(200) NOT NULL,
    description TEXT,
    trigger_type VARCHAR(50) NOT NULL CHECK (trigger_type IN (
        'warranty_expiring', 'maintenance_due', 'status_change',
        'assignment_change', 'schedule', 'threshold', 'custom'
    )),
    trigger_config JSONB NOT NULL DEFAULT '{}',
    conditions JSONB NOT NULL DEFAULT '[]',
    actions JSONB NOT NULL DEFAULT '[]',
    is_active BOOLEAN NOT NULL DEFAULT true,
    priority INTEGER NOT NULL DEFAULT 0,
    created_by VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 2. Workflow Automation Execution Log
-- ============================================================================
CREATE TABLE IF NOT EXISTS workflow_automation_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_id UUID NOT NULL REFERENCES workflow_automation_rules(id) ON DELETE CASCADE,
    trigger_event JSONB NOT NULL DEFAULT '{}',
    actions_executed JSONB NOT NULL DEFAULT '[]',
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN (
        'pending', 'running', 'completed', 'failed', 'skipped'
    )),
    error_message TEXT,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    correlation_id VARCHAR(100)
);

-- ============================================================================
-- 3. Notification Rules
-- ============================================================================
CREATE TABLE IF NOT EXISTS notification_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(200) NOT NULL,
    event_type VARCHAR(50) NOT NULL CHECK (event_type IN (
        'warranty_expiring', 'maintenance_due', 'status_changed',
        'asset_assigned', 'asset_returned', 'workflow_approved',
        'workflow_rejected', 'threshold_exceeded', 'custom'
    )),
    channel VARCHAR(30) NOT NULL DEFAULT 'ui' CHECK (channel IN (
        'ui', 'email', 'slack', 'teams', 'webhook'
    )),
    recipients JSONB NOT NULL DEFAULT '[]',
    template TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 4. Notifications (sent/pending)
-- ============================================================================
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_id UUID REFERENCES notification_rules(id) ON DELETE SET NULL,
    user_id VARCHAR(100),
    title VARCHAR(300) NOT NULL,
    body TEXT,
    channel VARCHAR(30) NOT NULL DEFAULT 'ui',
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN (
        'pending', 'sent', 'read', 'failed'
    )),
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    read_at TIMESTAMPTZ,
    sent_at TIMESTAMPTZ
);

-- ============================================================================
-- 5. Scheduled Tasks
-- ============================================================================
CREATE TABLE IF NOT EXISTS scheduled_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(200) NOT NULL,
    task_type VARCHAR(50) NOT NULL CHECK (task_type IN (
        'warranty_check', 'maintenance_reminder', 'report_generation',
        'data_cleanup', 'sync_external', 'custom'
    )),
    cron_expression VARCHAR(100) NOT NULL DEFAULT '0 8 * * *',
    config JSONB NOT NULL DEFAULT '{}',
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_run_at TIMESTAMPTZ,
    next_run_at TIMESTAMPTZ,
    last_status VARCHAR(20) CHECK (last_status IN ('success', 'failed', 'running')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_automation_rules_trigger ON workflow_automation_rules(trigger_type) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_automation_logs_rule ON workflow_automation_logs(rule_id);
CREATE INDEX IF NOT EXISTS idx_automation_logs_status ON workflow_automation_logs(status);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, status);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notification_rules_event ON notification_rules(event_type) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_scheduled_tasks_next ON scheduled_tasks(next_run_at) WHERE is_active = true;

COMMIT;
