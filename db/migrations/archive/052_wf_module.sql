-- Migration 052: Workflow Request & Approval Module (wf_*)
-- Multi-step approval engine with definitions, steps, events, and audit trail

BEGIN;

    -- ==================== wf_definitions ====================
    -- Defines the approval workflow template (e.g. "assign_asset_v1")
    CREATE TABLE
    IF NOT EXISTS wf_definitions
    (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid
    (),
    key         VARCHAR
    (100) NOT NULL UNIQUE,   -- e.g. 'assign_asset_v1'
    name        VARCHAR
    (255) NOT NULL,
    request_type VARCHAR
    (80) NOT NULL,          -- maps to wf_requests.request_type
    version     INT NOT NULL DEFAULT 1,
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now
    (),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now
    ()
);

    -- ==================== wf_steps ====================
    -- Individual approval steps within a definition
    CREATE TABLE
    IF NOT EXISTS wf_steps
    (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid
    (),
    definition_id   UUID NOT NULL REFERENCES wf_definitions
    (id) ON
    DELETE CASCADE,
    step_no         INT
    NOT NULL,              -- 1-based ordering
    name            VARCHAR
    (255) NOT NULL,
    approver_rule   JSONB NOT NULL DEFAULT '{}',    -- { "type": "user"|"role"|"ou_head", "value": "..." }
    on_approve      JSONB NOT NULL DEFAULT '{}',    -- { "next_step": 2 } or { "complete": true }
    on_reject       JSONB NOT NULL DEFAULT '{"cancel": true}',
    UNIQUE
    (definition_id, step_no)
);

    -- ==================== wf_requests ====================
    -- Individual workflow requests submitted by users
    CREATE TABLE
    IF NOT EXISTS wf_requests
    (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid
    (),
    code            VARCHAR
    (50) NOT NULL UNIQUE,   -- REQ-2026-000001
    title           VARCHAR
    (500) NOT NULL,
    request_type    VARCHAR
    (80) NOT NULL,
    priority        VARCHAR
    (20) NOT NULL DEFAULT 'normal'
                        CHECK
    (priority IN
    ('low','normal','high','urgent')),
    status          VARCHAR
    (30) NOT NULL DEFAULT 'draft'
                        CHECK
    (status IN
    ('draft','submitted','in_review','approved',
                                          'rejected','cancelled','closed')),
    requester_id    UUID NOT NULL REFERENCES users
    (id) ON
    DELETE RESTRICT,
    requester_ou_id UUID
    REFERENCES org_units
    (id) ON
    DELETE
    SET NULL
    ,
    definition_id   UUID REFERENCES wf_definitions
    (id) ON
    DELETE
    SET NULL
    ,
    current_step_no INT,
    due_at          TIMESTAMPTZ,
    payload         JSONB NOT NULL DEFAULT '{}',   -- type-specific fields
    submitted_at    TIMESTAMPTZ,
    closed_at       TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now
    (),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now
    ()
);

    CREATE INDEX
    IF NOT EXISTS idx_wf_requests_requester  ON wf_requests
    (requester_id);
    CREATE INDEX
    IF NOT EXISTS idx_wf_requests_status     ON wf_requests
    (status);
    CREATE INDEX
    IF NOT EXISTS idx_wf_requests_type       ON wf_requests
    (request_type);
    CREATE INDEX
    IF NOT EXISTS idx_wf_requests_definition ON wf_requests
    (definition_id);

    -- ==================== wf_approvals ====================
    -- Individual approval tasks assigned to a user/group for a step
    CREATE TABLE
    IF NOT EXISTS wf_approvals
    (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid
    (),
    request_id          UUID NOT NULL REFERENCES wf_requests
    (id) ON
    DELETE CASCADE,
    step_id             UUID
    NOT NULL REFERENCES wf_steps
    (id) ON
    DELETE RESTRICT,
    step_no             INT
    NOT NULL,
    assignee_user_id    UUID REFERENCES users
    (id) ON
    DELETE
    SET NULL
    ,
    assignee_group_id   UUID,                   -- future: role/group id
    status              VARCHAR
    (20) NOT NULL DEFAULT 'pending'
                            CHECK
    (status IN
    ('pending','approved','rejected','skipped','cancelled')),
    comment             TEXT,
    decision_at         TIMESTAMPTZ,
    decision_by         UUID REFERENCES users
    (id) ON
    DELETE
    SET NULL
    ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now
    (),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now
    ()
);

    CREATE INDEX
    IF NOT EXISTS idx_wf_approvals_request    ON wf_approvals
    (request_id);
    CREATE INDEX
    IF NOT EXISTS idx_wf_approvals_assignee   ON wf_approvals
    (assignee_user_id);
    CREATE INDEX
    IF NOT EXISTS idx_wf_approvals_status     ON wf_approvals
    (status);

    -- ==================== wf_events ====================
    -- Full immutable audit trail for every state change
    CREATE TABLE
    IF NOT EXISTS wf_events
    (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid
    (),
    request_id  UUID NOT NULL REFERENCES wf_requests
    (id) ON
    DELETE CASCADE,
    event_type  VARCHAR(50)
    NOT NULL
                    CHECK
    (event_type IN
    ('created','updated','submitted','assigned',
                                          'step_started','approved','rejected',
                                          'commented','cancelled','closed','reopened')),
    actor_id    UUID REFERENCES users
    (id) ON
    DELETE
    SET NULL
    ,
    meta        JSONB NOT NULL DEFAULT '{}',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now
    ()
);

    CREATE INDEX
    IF NOT EXISTS idx_wf_events_request ON wf_events
    (request_id);
    CREATE INDEX
    IF NOT EXISTS idx_wf_events_actor   ON wf_events
    (actor_id);

    -- ==================== wf_attachments ====================
    CREATE TABLE
    IF NOT EXISTS wf_attachments
    (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid
    (),
    request_id  UUID NOT NULL REFERENCES wf_requests
    (id) ON
    DELETE CASCADE,
    file_key    VARCHAR(500)
    NOT NULL,
    filename    VARCHAR
    (255) NOT NULL,
    size        BIGINT,
    mime        VARCHAR
    (100),
    uploaded_by UUID REFERENCES users
    (id) ON
    DELETE
    SET NULL
    ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now
    ()
);

    CREATE INDEX
    IF NOT EXISTS idx_wf_attachments_request ON wf_attachments
    (request_id);

    -- ==================== Sequence helper for REQ codes ====================
    CREATE SEQUENCE
    IF NOT EXISTS wf_request_seq START
    WITH 1 INCREMENT BY 1;

COMMIT;
