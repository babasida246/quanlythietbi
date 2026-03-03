-- Migration 057: Workflow Enhancements
-- Adds SLA support (sla_hours per step, due_at per approval task),
-- optimistic locking (version) on approvals, and new event types
-- for delegate / info_requested / withdrawn flows.

BEGIN;

    -- ==================== wf_steps: SLA column ====================
    ALTER TABLE wf_steps
    ADD COLUMN
    IF NOT EXISTS sla_hours INT DEFAULT 48;

-- ==================== wf_approvals: SLA + optimistic lock ====================
ALTER TABLE wf_approvals
    ADD COLUMN
IF NOT EXISTS due_at   TIMESTAMPTZ,
ADD COLUMN
IF NOT EXISTS version  INT NOT NULL DEFAULT 1;

-- Index to efficiently query overdue approvals
CREATE INDEX
IF NOT EXISTS idx_wf_approvals_due_at
    ON wf_approvals
(due_at)
    WHERE status = 'pending' AND due_at IS NOT NULL;

-- ==================== wf_events: extend allowed event_type values ====================
-- Drop old check and recreate with the extended set
ALTER TABLE wf_events
    DROP CONSTRAINT IF EXISTS wf_events_event_type_check
,
ADD  CONSTRAINT wf_events_event_type_check
        CHECK
(event_type IN
(
            'created', 'updated', 'submitted', 'assigned',
            'step_started', 'approved', 'rejected', 'commented',
            'cancelled', 'closed', 'reopened',
            'delegated', 'info_requested', 'withdrawn'
        ));

-- ==================== users: extend role check to include 'accountant' ====================
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
    CHECK (role IN (
        'admin', 'super_admin',
        'it_asset_manager',
        'warehouse_keeper',
        'accountant',
        'technician',
        'requester',
        'user',
        'viewer'
    ));

COMMIT;
