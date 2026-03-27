-- =============================================================================
-- 064_fieldkit_backend.sql
-- FieldKit backend persistence (quick checks, playbooks, snapshots, notes,
-- approvals, audit events, snippets)
-- =============================================================================

CREATE TABLE IF NOT EXISTS fieldkit_quick_checks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id TEXT NOT NULL,
    ticket_id TEXT NOT NULL,
    vendor VARCHAR(20) NOT NULL,
    overall_status VARCHAR(10) NOT NULL,
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_fieldkit_quick_checks_vendor CHECK (vendor IN ('cisco', 'mikrotik', 'fortigate', 'generic')),
    CONSTRAINT chk_fieldkit_quick_checks_status CHECK (overall_status IN ('pass', 'warn', 'fail'))
);

CREATE INDEX IF NOT EXISTS idx_fieldkit_quick_checks_device ON fieldkit_quick_checks(device_id);
CREATE INDEX IF NOT EXISTS idx_fieldkit_quick_checks_created_at ON fieldkit_quick_checks(created_at DESC);

CREATE TABLE IF NOT EXISTS fieldkit_playbooks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id TEXT NOT NULL,
    vendor VARCHAR(20) NOT NULL,
    scenario VARCHAR(20) NOT NULL,
    steps JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_fieldkit_playbooks_vendor CHECK (vendor IN ('cisco', 'mikrotik', 'fortigate', 'generic')),
    CONSTRAINT chk_fieldkit_playbooks_scenario CHECK (scenario IN ('loss', 'loop', 'packet-loss', 'slow'))
);

CREATE INDEX IF NOT EXISTS idx_fieldkit_playbooks_device ON fieldkit_playbooks(device_id);
CREATE INDEX IF NOT EXISTS idx_fieldkit_playbooks_created_at ON fieldkit_playbooks(created_at DESC);

CREATE TABLE IF NOT EXISTS fieldkit_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id TEXT NOT NULL,
    quick_check_id UUID REFERENCES fieldkit_quick_checks(id) ON DELETE SET NULL,
    summary TEXT NOT NULL,
    notes TEXT,
    ticket_id TEXT NOT NULL,
    visualizer JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fieldkit_snapshots_device ON fieldkit_snapshots(device_id);
CREATE INDEX IF NOT EXISTS idx_fieldkit_snapshots_created_at ON fieldkit_snapshots(created_at DESC);

CREATE TABLE IF NOT EXISTS fieldkit_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id TEXT NOT NULL,
    author TEXT NOT NULL,
    message TEXT NOT NULL,
    attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
    ticket_id TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fieldkit_notes_device ON fieldkit_notes(device_id);
CREATE INDEX IF NOT EXISTS idx_fieldkit_notes_created_at ON fieldkit_notes(created_at DESC);

CREATE TABLE IF NOT EXISTS fieldkit_approvals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id TEXT NOT NULL,
    requested_by TEXT NOT NULL,
    reason TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    ticket_id TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_fieldkit_approvals_status CHECK (status IN ('pending', 'approved', 'rejected'))
);

CREATE INDEX IF NOT EXISTS idx_fieldkit_approvals_device ON fieldkit_approvals(device_id);
CREATE INDEX IF NOT EXISTS idx_fieldkit_approvals_created_at ON fieldkit_approvals(created_at DESC);

CREATE TABLE IF NOT EXISTS fieldkit_audit_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id TEXT NOT NULL,
    actor TEXT NOT NULL,
    event_type TEXT NOT NULL,
    detail TEXT NOT NULL,
    ticket_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fieldkit_audit_events_device ON fieldkit_audit_events(device_id);
CREATE INDEX IF NOT EXISTS idx_fieldkit_audit_events_created_at ON fieldkit_audit_events(created_at DESC);

CREATE TABLE IF NOT EXISTS fieldkit_snippets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(80) NOT NULL UNIQUE,
    title VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    command TEXT NOT NULL,
    risk VARCHAR(10) NOT NULL,
    vendor VARCHAR(20) NOT NULL,
    tags JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_fieldkit_snippets_risk CHECK (risk IN ('low', 'medium', 'high')),
    CONSTRAINT chk_fieldkit_snippets_vendor CHECK (vendor IN ('cisco', 'mikrotik', 'fortigate', 'generic', 'any'))
);

INSERT INTO fieldkit_snippets (code, title, description, command, risk, vendor, tags)
VALUES
    ('snip-cisco-int-brief', 'Interface brief', 'Quick status of all interfaces', 'show ip interface brief', 'low', 'cisco', '["interfaces"]'::jsonb),
    ('snip-cisco-route', 'Routing table summary', 'Inspect active routes', 'show ip route summary', 'low', 'cisco', '["routing"]'::jsonb),
    ('snip-mt-int', 'MikroTik interface print', 'Show interface link state', '/interface print terse', 'low', 'mikrotik', '["interfaces"]'::jsonb),
    ('snip-high-reload', 'Reload device', 'Reboot immediately', 'reload now', 'high', 'any', '["danger"]'::jsonb)
ON CONFLICT (code) DO NOTHING;
