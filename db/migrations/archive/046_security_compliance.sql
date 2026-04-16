-- Migration: 046_security_compliance.sql
-- Feature: Advanced Security & Compliance
-- Description: RBAC, audit logs, compliance reporting

BEGIN;

-- ============================================================================
-- 1. Permissions / RBAC
-- ============================================================================
CREATE TABLE IF NOT EXISTS rbac_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(100) NOT NULL UNIQUE,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    module VARCHAR(50) NOT NULL,
    action VARCHAR(30) NOT NULL CHECK (action IN (
        'create', 'read', 'update', 'delete', 'execute', 'approve', 'export'
    )),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rbac_role_permissions (
    role VARCHAR(50) NOT NULL,
    permission_id UUID NOT NULL REFERENCES rbac_permissions(id) ON DELETE CASCADE,
    granted_by VARCHAR(100),
    granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (role, permission_id)
);

-- ============================================================================
-- 2. Security Audit Log
-- ============================================================================
CREATE TABLE IF NOT EXISTS security_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(100),
    action VARCHAR(50) NOT NULL,
    resource_type VARCHAR(50) NOT NULL,
    resource_id VARCHAR(200),
    ip_address VARCHAR(45),
    user_agent TEXT,
    details JSONB NOT NULL DEFAULT '{}',
    risk_level VARCHAR(20) DEFAULT 'low' CHECK (risk_level IN (
        'info', 'low', 'medium', 'high', 'critical'
    )),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 3. Compliance Frameworks
-- ============================================================================
CREATE TABLE IF NOT EXISTS compliance_frameworks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    version VARCHAR(20),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS compliance_controls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    framework_id UUID NOT NULL REFERENCES compliance_frameworks(id) ON DELETE CASCADE,
    control_code VARCHAR(50) NOT NULL,
    title VARCHAR(300) NOT NULL,
    description TEXT,
    category VARCHAR(100),
    check_type VARCHAR(30) NOT NULL DEFAULT 'manual' CHECK (check_type IN (
        'manual', 'automated', 'semi_automated'
    )),
    check_query TEXT,
    severity VARCHAR(20) DEFAULT 'medium',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS compliance_assessments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    framework_id UUID NOT NULL REFERENCES compliance_frameworks(id) ON DELETE CASCADE,
    assessment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    total_controls INTEGER NOT NULL DEFAULT 0,
    passed_controls INTEGER NOT NULL DEFAULT 0,
    failed_controls INTEGER NOT NULL DEFAULT 0,
    not_applicable INTEGER NOT NULL DEFAULT 0,
    score NUMERIC(5,2) DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'in_progress' CHECK (status IN (
        'in_progress', 'completed', 'reviewed'
    )),
    assessed_by VARCHAR(100),
    results JSONB NOT NULL DEFAULT '[]',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_security_audit_user ON security_audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_security_audit_action ON security_audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_security_audit_created ON security_audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_audit_risk ON security_audit_logs(risk_level);
CREATE INDEX IF NOT EXISTS idx_compliance_controls_fw ON compliance_controls(framework_id);
CREATE INDEX IF NOT EXISTS idx_compliance_assessments_fw ON compliance_assessments(framework_id);
CREATE INDEX IF NOT EXISTS idx_rbac_role_perms_role ON rbac_role_permissions(role);

-- Seed default permissions
INSERT INTO rbac_permissions (code, name, module, action) VALUES
    ('assets.create', 'Create Assets', 'assets', 'create'),
    ('assets.read', 'View Assets', 'assets', 'read'),
    ('assets.update', 'Update Assets', 'assets', 'update'),
    ('assets.delete', 'Delete Assets', 'assets', 'delete'),
    ('assets.export', 'Export Assets', 'assets', 'export'),
    ('workflow.create', 'Create Workflows', 'workflow', 'create'),
    ('workflow.approve', 'Approve Workflows', 'workflow', 'approve'),
    ('cmdb.create', 'Create CI Items', 'cmdb', 'create'),
    ('cmdb.read', 'View CMDB', 'cmdb', 'read'),
    ('cmdb.update', 'Update CI Items', 'cmdb', 'update'),
    ('reports.read', 'View Reports', 'reports', 'read'),
    ('reports.export', 'Export Reports', 'reports', 'export'),
    ('admin.execute', 'Admin Operations', 'admin', 'execute'),
    ('security.read', 'View Security Logs', 'security', 'read'),
    ('compliance.read', 'View Compliance', 'compliance', 'read'),
    ('compliance.execute', 'Run Assessments', 'compliance', 'execute'),
    ('integrations.create', 'Create Integrations', 'integrations', 'create'),
    ('integrations.read', 'View Integrations', 'integrations', 'read')
ON CONFLICT (code) DO NOTHING;

-- Seed default compliance framework
INSERT INTO compliance_frameworks (code, name, description, version) VALUES
    ('ISO27001', 'ISO 27001:2022', 'Information Security Management', '2022'),
    ('SOC2', 'SOC 2 Type II', 'Service Organization Control', 'v2'),
    ('INTERNAL', 'Internal IT Policy', 'Organization IT Asset Policies', '1.0')
ON CONFLICT (code) DO NOTHING;

COMMIT;
