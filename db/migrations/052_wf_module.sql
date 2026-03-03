-- Migration 052: Workflow Request & Approval Module (wf_*)
-- Multi-step approval engine with definitions, steps, events, and audit trail

BEGIN;

-- ==================== wf_definitions ====================
-- Defines the approval workflow template (e.g. "assign_asset_v1")
CREATE TABLE IF NOT EXISTS wf_definitions (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key         VARCHAR(100) NOT NULL UNIQUE,   -- e.g. 'assign_asset_v1'
    name        VARCHAR(255) NOT NULL,
    request_type VARCHAR(80) NOT NULL,          -- maps to wf_requests.request_type
    version     INT NOT NULL DEFAULT 1,
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ==================== wf_steps ====================
-- Individual approval steps within a definition
CREATE TABLE IF NOT EXISTS wf_steps (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    definition_id   UUID NOT NULL REFERENCES wf_definitions(id) ON DELETE CASCADE,
    step_no         INT NOT NULL,              -- 1-based ordering
    name            VARCHAR(255) NOT NULL,
    approver_rule   JSONB NOT NULL DEFAULT '{}',    -- { "type": "user"|"role"|"ou_head", "value": "..." }
    on_approve      JSONB NOT NULL DEFAULT '{}',    -- { "next_step": 2 } or { "complete": true }
    on_reject       JSONB NOT NULL DEFAULT '{"cancel": true}',
    UNIQUE (definition_id, step_no)
);

-- ==================== wf_requests ====================
-- Individual workflow requests submitted by users
CREATE TABLE IF NOT EXISTS wf_requests (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code            VARCHAR(50) NOT NULL UNIQUE,   -- REQ-2026-000001
    title           VARCHAR(500) NOT NULL,
    request_type    VARCHAR(80) NOT NULL,
    priority        VARCHAR(20) NOT NULL DEFAULT 'normal'
                        CHECK (priority IN ('low','normal','high','urgent')),
    status          VARCHAR(30) NOT NULL DEFAULT 'draft'
                        CHECK (status IN ('draft','submitted','in_review','approved',
                                          'rejected','cancelled','closed')),
    requester_id    UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    requester_ou_id UUID REFERENCES org_units(id) ON DELETE SET NULL,
    definition_id   UUID REFERENCES wf_definitions(id) ON DELETE SET NULL,
    current_step_no INT,
    due_at          TIMESTAMPTZ,
    payload         JSONB NOT NULL DEFAULT '{}',   -- type-specific fields
    submitted_at    TIMESTAMPTZ,
    closed_at       TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wf_requests_requester  ON wf_requests(requester_id);
CREATE INDEX IF NOT EXISTS idx_wf_requests_status     ON wf_requests(status);
CREATE INDEX IF NOT EXISTS idx_wf_requests_type       ON wf_requests(request_type);
CREATE INDEX IF NOT EXISTS idx_wf_requests_definition ON wf_requests(definition_id);

-- ==================== wf_approvals ====================
-- Individual approval tasks assigned to a user/group for a step
CREATE TABLE IF NOT EXISTS wf_approvals (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id          UUID NOT NULL REFERENCES wf_requests(id) ON DELETE CASCADE,
    step_id             UUID NOT NULL REFERENCES wf_steps(id) ON DELETE RESTRICT,
    step_no             INT NOT NULL,
    assignee_user_id    UUID REFERENCES users(id) ON DELETE SET NULL,
    assignee_group_id   UUID,                   -- future: role/group id
    status              VARCHAR(20) NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending','approved','rejected','skipped','cancelled')),
    comment             TEXT,
    decision_at         TIMESTAMPTZ,
    decision_by         UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wf_approvals_request    ON wf_approvals(request_id);
CREATE INDEX IF NOT EXISTS idx_wf_approvals_assignee   ON wf_approvals(assignee_user_id);
CREATE INDEX IF NOT EXISTS idx_wf_approvals_status     ON wf_approvals(status);

-- ==================== wf_events ====================
-- Full immutable audit trail for every state change
CREATE TABLE IF NOT EXISTS wf_events (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id  UUID NOT NULL REFERENCES wf_requests(id) ON DELETE CASCADE,
    event_type  VARCHAR(50) NOT NULL
                    CHECK (event_type IN ('created','updated','submitted','assigned',
                                          'step_started','approved','rejected',
                                          'commented','cancelled','closed','reopened')),
    actor_id    UUID REFERENCES users(id) ON DELETE SET NULL,
    meta        JSONB NOT NULL DEFAULT '{}',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wf_events_request ON wf_events(request_id);
CREATE INDEX IF NOT EXISTS idx_wf_events_actor   ON wf_events(actor_id);

-- ==================== wf_attachments ====================
CREATE TABLE IF NOT EXISTS wf_attachments (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id  UUID NOT NULL REFERENCES wf_requests(id) ON DELETE CASCADE,
    file_key    VARCHAR(500) NOT NULL,
    filename    VARCHAR(255) NOT NULL,
    size        BIGINT,
    mime        VARCHAR(100),
    uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wf_attachments_request ON wf_attachments(request_id);

-- ==================== Sequence helper for REQ codes ====================
CREATE SEQUENCE IF NOT EXISTS wf_request_seq START WITH 1 INCREMENT BY 1;

-- ==================== SEED DATA ====================

-- Insert workflow definition: assign_asset (2-step approval)
INSERT INTO wf_definitions (id, key, name, request_type, version, is_active)
VALUES (
    'b1000000-0000-0000-0000-000000000001',
    'assign_asset_v1',
    'Cấp phát thiết bị (2 bước)',
    'assign',
    1,
    TRUE
)
ON CONFLICT (key) DO NOTHING;

-- Insert workflow definition: return_asset (1-step approval)
INSERT INTO wf_definitions (id, key, name, request_type, version, is_active)
VALUES (
    'b1000000-0000-0000-0000-000000000002',
    'return_asset_v1',
    'Thu hồi thiết bị (1 bước)',
    'return',
    1,
    TRUE
)
ON CONFLICT (key) DO NOTHING;

-- Assign Asset: Step 1 - Department head approves
INSERT INTO wf_steps (id, definition_id, step_no, name, approver_rule, on_approve, on_reject)
VALUES (
    'c1000000-0000-0000-0000-000000000011',
    'b1000000-0000-0000-0000-000000000001',
    1,
    'Trưởng bộ phận phê duyệt',
    '{"type": "role", "value": "department_head"}',
    '{"next_step": 2}',
    '{"cancel": true}'
)
ON CONFLICT DO NOTHING;

-- Assign Asset: Step 2 - Asset manager approves and fulfills
INSERT INTO wf_steps (id, definition_id, step_no, name, approver_rule, on_approve, on_reject)
VALUES (
    'c1000000-0000-0000-0000-000000000012',
    'b1000000-0000-0000-0000-000000000001',
    2,
    'Quản lý tài sản thực hiện cấp phát',
    '{"type": "role", "value": "asset_manager"}',
    '{"complete": true}',
    '{"cancel": true}'
)
ON CONFLICT DO NOTHING;

-- Return Asset: Step 1 - Asset manager confirms return
INSERT INTO wf_steps (id, definition_id, step_no, name, approver_rule, on_approve, on_reject)
VALUES (
    'c1000000-0000-0000-0000-000000000021',
    'b1000000-0000-0000-0000-000000000002',
    1,
    'Quản lý tài sản xác nhận thu hồi',
    '{"type": "role", "value": "asset_manager"}',
    '{"complete": true}',
    '{"cancel": true}'
)
ON CONFLICT DO NOTHING;

-- ==================== Sample wf_requests (demo data) ====================
-- These reference users that exist in the seed; skip if users don't exist

DO $$
DECLARE
    v_requester_id UUID;
    v_req1_id UUID := 'd1000000-0000-0000-0000-000000000001';
    v_req2_id UUID := 'd1000000-0000-0000-0000-000000000002';
    v_req3_id UUID := 'd1000000-0000-0000-0000-000000000003';
    v_def1_id UUID := 'b1000000-0000-0000-0000-000000000001';
    v_def2_id UUID := 'b1000000-0000-0000-0000-000000000002';
    v_step11_id UUID := 'c1000000-0000-0000-0000-000000000011';
    v_step21_id UUID := 'c1000000-0000-0000-0000-000000000021';
BEGIN
    -- Get a demo requester (use first regular user)
    SELECT id INTO v_requester_id FROM users
    WHERE email NOT LIKE '%admin%'
    ORDER BY created_at ASC
    LIMIT 1;

    IF v_requester_id IS NULL THEN
        RAISE NOTICE 'No non-admin users found; skipping wf_requests seed.';
        RETURN;
    END IF;

    -- Sample request 1: assign laptop (draft)
    INSERT INTO wf_requests (id, code, title, request_type, priority, status,
                             requester_id, definition_id, current_step_no, payload, created_at, updated_at)
    VALUES (
        v_req1_id,
        'REQ-2026-000001',
        'Yêu cầu cấp phát Laptop Dell XPS 15',
        'assign',
        'normal',
        'draft',
        v_requester_id,
        v_def1_id,
        NULL,
        '{"asset_model": "Dell XPS 15", "reason": "Làm việc tại nhà", "department": "IT"}',
        now() - interval '5 days',
        now() - interval '5 days'
    )
    ON CONFLICT (code) DO NOTHING;

    -- Sample request 2: assign laptop (submitted, step 1 pending)
    INSERT INTO wf_requests (id, code, title, request_type, priority, status,
                             requester_id, definition_id, current_step_no, payload, submitted_at, created_at, updated_at)
    VALUES (
        v_req2_id,
        'REQ-2026-000002',
        'Yêu cầu cấp phát màn hình 27 inch',
        'assign',
        'high',
        'in_review',
        v_requester_id,
        v_def1_id,
        1,
        '{"asset_model": "Dell U2722D", "reason": "Nâng cấp thiết bị văn phòng", "department": "IT"}',
        now() - interval '3 days',
        now() - interval '3 days',
        now() - interval '3 days'
    )
    ON CONFLICT (code) DO NOTHING;

    -- Create pending approval for request 2, step 1
    INSERT INTO wf_approvals (request_id, step_id, step_no, status, created_at, updated_at)
    VALUES (v_req2_id, v_step11_id, 1, 'pending', now() - interval '3 days', now() - interval '3 days')
    ON CONFLICT DO NOTHING;

    -- Event: request 2 created
    INSERT INTO wf_events (request_id, event_type, actor_id, meta, created_at)
    VALUES (v_req2_id, 'created', v_requester_id, '{"note": "Tạo yêu cầu"}', now() - interval '3 days')
    ON CONFLICT DO NOTHING;

    -- Event: request 2 submitted
    INSERT INTO wf_events (request_id, event_type, actor_id, meta, created_at)
    VALUES (v_req2_id, 'submitted', v_requester_id, '{}', now() - interval '3 days' + interval '5 minutes')
    ON CONFLICT DO NOTHING;

    -- Sample request 3: return asset (approved/closed)
    INSERT INTO wf_requests (id, code, title, request_type, priority, status,
                             requester_id, definition_id, current_step_no, payload,
                             submitted_at, closed_at, created_at, updated_at)
    VALUES (
        v_req3_id,
        'REQ-2026-000003',
        'Thu hồi Laptop HP cũ - đã thay mới',
        'return',
        'low',
        'closed',
        v_requester_id,
        v_def2_id,
        NULL,
        '{"asset_tag": "HP-001", "reason": "Máy hỏng, đã thay máy mới"}',
        now() - interval '7 days',
        now() - interval '6 days',
        now() - interval '7 days',
        now() - interval '6 days'
    )
    ON CONFLICT (code) DO NOTHING;

END $$;

COMMIT;
