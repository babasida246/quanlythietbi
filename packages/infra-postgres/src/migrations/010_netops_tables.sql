-- NetOps tables for devices, configs, lint, changes, orchestration
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Devices
CREATE TABLE IF NOT EXISTS net_devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    hostname TEXT NOT NULL,
    vendor TEXT NOT NULL,
    model TEXT,
    os_version TEXT,
    mgmt_ip TEXT NOT NULL,
    site TEXT,
    role TEXT,
    tags JSONB DEFAULT '[]'::jsonb,
    status TEXT NOT NULL DEFAULT 'active',
    last_seen_at TIMESTAMPTZ,
    created_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    serial_number TEXT,
    location TEXT,
    notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_net_devices_vendor ON net_devices(vendor);
CREATE INDEX IF NOT EXISTS idx_net_devices_site ON net_devices(site);
CREATE INDEX IF NOT EXISTS idx_net_devices_role ON net_devices(role);
CREATE INDEX IF NOT EXISTS idx_net_devices_status ON net_devices(status);

-- Config versions
CREATE TABLE IF NOT EXISTS net_config_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id UUID NOT NULL REFERENCES net_devices(id) ON DELETE CASCADE,
    config_type TEXT NOT NULL,
    raw_config TEXT,
    config_hash TEXT,
    normalized_config JSONB,
    parser_version TEXT,
    parse_errors JSONB,
    file_size_bytes INTEGER,
    line_count INTEGER,
    collected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    collected_by TEXT,
    source TEXT NOT NULL,
    parent_version_id UUID REFERENCES net_config_versions(id),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_net_config_versions_device ON net_config_versions(device_id);
CREATE INDEX IF NOT EXISTS idx_net_config_versions_type ON net_config_versions(config_type);
CREATE INDEX IF NOT EXISTS idx_net_config_versions_collected ON net_config_versions(collected_at DESC);

-- Rulepacks
CREATE TABLE IF NOT EXISTS net_rulepacks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    version TEXT NOT NULL,
    description TEXT,
    vendor_scope TEXT[] NOT NULL DEFAULT '{}',
    rules JSONB NOT NULL DEFAULT '[]'::jsonb,
    rule_count INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT FALSE,
    is_builtin BOOLEAN NOT NULL DEFAULT FALSE,
    created_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    activated_at TIMESTAMPTZ
);

-- Lint runs
CREATE TABLE IF NOT EXISTS net_lint_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    target_type TEXT NOT NULL,
    target_id TEXT NOT NULL,
    rulepack_id UUID REFERENCES net_rulepacks(id),
    status TEXT NOT NULL,
    findings JSONB NOT NULL DEFAULT '[]'::jsonb,
    summary JSONB,
    rules_evaluated INTEGER NOT NULL DEFAULT 0,
    rules_passed INTEGER NOT NULL DEFAULT 0,
    rules_failed INTEGER NOT NULL DEFAULT 0,
    rules_skipped INTEGER NOT NULL DEFAULT 0,
    duration_ms INTEGER,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    triggered_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Change requests
CREATE TABLE IF NOT EXISTS net_change_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    intent_type TEXT,
    intent_params JSONB NOT NULL DEFAULT '{}'::jsonb,
    device_scope TEXT[] NOT NULL DEFAULT '{}',
    status TEXT NOT NULL,
    risk_level TEXT NOT NULL,
    required_approvals INTEGER NOT NULL DEFAULT 0,
    lint_blocking BOOLEAN NOT NULL DEFAULT FALSE,
    rollback_plan TEXT,
    pre_check_commands TEXT[] DEFAULT '{}',
    post_check_commands TEXT[] DEFAULT '{}',
    created_by TEXT NOT NULL,
    assigned_to TEXT,
    planned_at TIMESTAMPTZ,
    submitted_at TIMESTAMPTZ,
    approved_at TIMESTAMPTZ,
    deployed_at TIMESTAMPTZ,
    closed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Change sets
CREATE TABLE IF NOT EXISTS net_change_sets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    change_request_id UUID NOT NULL REFERENCES net_change_requests(id) ON DELETE CASCADE,
    device_id UUID NOT NULL REFERENCES net_devices(id) ON DELETE CASCADE,
    running_config TEXT,
    candidate_config TEXT,
    diff_preview TEXT,
    generated_by TEXT,
    lint_run_id UUID REFERENCES net_lint_runs(id),
    lint_status TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Approvals
CREATE TABLE IF NOT EXISTS net_approvals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    change_request_id UUID NOT NULL REFERENCES net_change_requests(id) ON DELETE CASCADE,
    approver_id TEXT NOT NULL,
    decision TEXT NOT NULL,
    comments TEXT,
    waived_findings TEXT[],
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Audit events
CREATE TABLE IF NOT EXISTS net_audit_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    correlation_id TEXT,
    event_type TEXT NOT NULL,
    actor_id TEXT,
    actor_role TEXT,
    resource_type TEXT NOT NULL,
    resource_id TEXT NOT NULL,
    action TEXT NOT NULL,
    details JSONB,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Orchestration runs
CREATE TABLE IF NOT EXISTS net_orchestration_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    change_request_id UUID REFERENCES net_change_requests(id) ON DELETE SET NULL,
    intent TEXT NOT NULL,
    intent_params JSONB NOT NULL DEFAULT '{}'::jsonb,
    scope JSONB NOT NULL DEFAULT '{}'::jsonb,
    status TEXT NOT NULL,
    current_layer TEXT NOT NULL,
    risk_level TEXT,
    required_approvals INTEGER NOT NULL DEFAULT 0,
    received_approvals INTEGER NOT NULL DEFAULT 0,
    has_verify_plan BOOLEAN NOT NULL DEFAULT FALSE,
    has_rollback_plan BOOLEAN NOT NULL DEFAULT FALSE,
    has_critical_findings BOOLEAN NOT NULL DEFAULT FALSE,
    critical_findings_waived BOOLEAN NOT NULL DEFAULT FALSE,
    deploy_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    context_pack JSONB,
    context_pack_hash TEXT,
    context_pack_tokens INTEGER,
    planner_output JSONB,
    expert_output JSONB,
    judge_output JSONB,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by TEXT NOT NULL,
    error_message TEXT,
    error_details JSONB
);

-- Orchestration nodes
CREATE TABLE IF NOT EXISTS net_orchestration_nodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id UUID NOT NULL REFERENCES net_orchestration_runs(id) ON DELETE CASCADE,
    node_type TEXT NOT NULL,
    layer TEXT NOT NULL,
    sequence_num INTEGER NOT NULL DEFAULT 0,
    depends_on TEXT[] NOT NULL DEFAULT '{}',
    status TEXT NOT NULL,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    duration_ms INTEGER,
    input_summary JSONB,
    output_summary JSONB,
    model_used TEXT,
    model_tier TEXT,
    prompt_tokens INTEGER,
    completion_tokens INTEGER,
    llm_latency_ms INTEGER,
    retry_count INTEGER NOT NULL DEFAULT 0,
    error_message TEXT,
    error_code TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_net_orch_nodes_run ON net_orchestration_nodes(run_id);
