-- =====================================================
-- Migration: 035_requests_module.sql
-- Description: Create tables for Asset Request management with multi-level approval
-- Dependencies: 007_cmdb_core.sql (for assets, users, locations)
-- =====================================================

-- Enable UUID extension if not exists
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- 1. ASSET REQUESTS (Main table)
-- =====================================================

CREATE TABLE IF NOT EXISTS asset_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Request Code (auto-generated: REQ-YYYYMMDD-XXXX)
    request_code VARCHAR(50) NOT NULL UNIQUE,
    
    -- Request Type
    request_type VARCHAR(20) NOT NULL DEFAULT 'new'
        CHECK (request_type IN ('new', 'replacement', 'upgrade', 'return')),
    
    -- Requester Info
    requester_id UUID NOT NULL, -- User making the request
    department_id UUID, -- Requester's department
    
    -- Asset Details
    asset_category_id UUID, -- Requested category (e.g., Laptop, Monitor)
    asset_model_id UUID, -- Specific model if known
    quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
    
    -- For replacement/upgrade/return
    current_asset_id UUID, -- Existing asset being replaced/upgraded/returned
    
    -- Request Info
    justification TEXT NOT NULL, -- REQ-R02: Must be >= 20 characters
    priority VARCHAR(10) NOT NULL DEFAULT 'normal'
        CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    required_date DATE, -- When the asset is needed
    
    -- Status
    status VARCHAR(30) NOT NULL DEFAULT 'draft'
        CHECK (status IN (
            'draft',
            'pending_approval',
            'need_info',
            'approved',
            'rejected',
            'cancelled',
            'fulfilling',
            'completed'
        )),
    
    -- Approval Chain Config (snapshot at request creation)
    approval_chain JSONB, -- Array of {order, approver_role, approver_id}
    total_approval_steps INTEGER DEFAULT 0,
    current_approval_step INTEGER DEFAULT 0,
    
    -- Fulfillment Info (populated when fulfilled)
    fulfilled_by UUID,
    fulfilled_at TIMESTAMP WITH TIME ZONE,
    fulfilled_asset_ids JSONB, -- Array of asset IDs assigned
    
    -- Cancellation/Rejection Info
    cancelled_by UUID,
    cancelled_at TIMESTAMP WITH TIME ZONE,
    cancel_reason TEXT,
    
    rejected_by UUID,
    rejected_at TIMESTAMP WITH TIME ZONE,
    reject_reason TEXT,
    
    -- Submitted timestamp
    submitted_at TIMESTAMP WITH TIME ZONE,
    
    -- Organization
    organization_id UUID,
    
    -- Audit
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID,
    
    -- Constraint: Replacement/upgrade/return must have current_asset_id
    CONSTRAINT chk_replacement_asset CHECK (
        (request_type IN ('replacement', 'upgrade', 'return') AND current_asset_id IS NOT NULL) OR
        (request_type = 'new')
    ),
    
    -- Constraint: Justification minimum length
    CONSTRAINT chk_justification_length CHECK (
        length(trim(justification)) >= 20
    )
);

-- Indexes for requests
CREATE INDEX IF NOT EXISTS idx_asset_requests_code ON asset_requests(request_code);
CREATE INDEX IF NOT EXISTS idx_asset_requests_type ON asset_requests(request_type);
CREATE INDEX IF NOT EXISTS idx_asset_requests_requester ON asset_requests(requester_id);
CREATE INDEX IF NOT EXISTS idx_asset_requests_department ON asset_requests(department_id);
CREATE INDEX IF NOT EXISTS idx_asset_requests_status ON asset_requests(status);
CREATE INDEX IF NOT EXISTS idx_asset_requests_priority ON asset_requests(priority);
CREATE INDEX IF NOT EXISTS idx_asset_requests_category ON asset_requests(asset_category_id);
CREATE INDEX IF NOT EXISTS idx_asset_requests_current_asset ON asset_requests(current_asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_requests_submitted ON asset_requests(submitted_at);
CREATE INDEX IF NOT EXISTS idx_asset_requests_required_date ON asset_requests(required_date);
CREATE INDEX IF NOT EXISTS idx_asset_requests_organization ON asset_requests(organization_id);

-- Partial indexes for common queries
CREATE INDEX IF NOT EXISTS idx_asset_requests_pending ON asset_requests(status) WHERE status = 'pending_approval';
CREATE INDEX IF NOT EXISTS idx_asset_requests_need_info ON asset_requests(status) WHERE status = 'need_info';
CREATE INDEX IF NOT EXISTS idx_asset_requests_approved ON asset_requests(status) WHERE status = 'approved';
CREATE INDEX IF NOT EXISTS idx_asset_requests_fulfilling ON asset_requests(status) WHERE status = 'fulfilling';

-- =====================================================
-- 2. APPROVAL STEPS (Individual approval actions)
-- =====================================================

CREATE TABLE IF NOT EXISTS approval_steps (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Request Reference
    request_id UUID NOT NULL REFERENCES asset_requests(id) ON DELETE CASCADE,
    
    -- Step Order (1, 2, 3...)
    step_order INTEGER NOT NULL CHECK (step_order > 0),
    
    -- Approver Info
    approver_id UUID NOT NULL,
    approver_role VARCHAR(50), -- e.g., 'direct_manager', 'department_head', 'it_department', 'finance'
    
    -- Decision
    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'approved', 'rejected', 'skipped')),
    decision_date TIMESTAMP WITH TIME ZONE,
    comments TEXT,
    
    -- Escalation tracking
    is_escalated BOOLEAN DEFAULT false,
    escalated_from UUID, -- Original approver if escalated
    escalated_at TIMESTAMP WITH TIME ZONE,
    escalation_reason TEXT,
    
    -- Reminder tracking
    reminder_sent_count INTEGER DEFAULT 0,
    last_reminder_sent_at TIMESTAMP WITH TIME ZONE,
    
    -- Audit
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Unique constraint: one step per order per request
    CONSTRAINT uq_request_step_order UNIQUE (request_id, step_order)
);

-- Indexes for approval steps
CREATE INDEX IF NOT EXISTS idx_approval_steps_request ON approval_steps(request_id);
CREATE INDEX IF NOT EXISTS idx_approval_steps_approver ON approval_steps(approver_id);
CREATE INDEX IF NOT EXISTS idx_approval_steps_status ON approval_steps(status);
CREATE INDEX IF NOT EXISTS idx_approval_steps_pending ON approval_steps(status) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_approval_steps_order ON approval_steps(request_id, step_order);

-- =====================================================
-- 3. REQUEST ATTACHMENTS (Files attached to requests)
-- =====================================================

CREATE TABLE IF NOT EXISTS request_attachments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Request Reference
    request_id UUID NOT NULL REFERENCES asset_requests(id) ON DELETE CASCADE,
    
    -- File Info
    file_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_size INTEGER, -- in bytes
    file_type VARCHAR(100), -- MIME type
    
    -- Upload Info
    uploaded_by UUID NOT NULL,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Description
    description TEXT
);

-- Indexes for attachments
CREATE INDEX IF NOT EXISTS idx_request_attachments_request ON request_attachments(request_id);
CREATE INDEX IF NOT EXISTS idx_request_attachments_uploaded_by ON request_attachments(uploaded_by);

-- =====================================================
-- 4. REQUEST COMMENTS (Info requests and responses)
-- =====================================================

CREATE TABLE IF NOT EXISTS request_comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Request Reference
    request_id UUID NOT NULL REFERENCES asset_requests(id) ON DELETE CASCADE,
    
    -- Comment Type
    comment_type VARCHAR(20) NOT NULL DEFAULT 'comment'
        CHECK (comment_type IN ('comment', 'info_request', 'info_response')),
    
    -- Content
    content TEXT NOT NULL,
    
    -- Author
    author_id UUID NOT NULL,
    
    -- For info_request/info_response: link to approval step
    approval_step_id UUID REFERENCES approval_steps(id) ON DELETE SET NULL,
    
    -- For info_response: link to parent info_request
    parent_comment_id UUID REFERENCES request_comments(id) ON DELETE SET NULL,
    
    -- Audit
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for comments
CREATE INDEX IF NOT EXISTS idx_request_comments_request ON request_comments(request_id);
CREATE INDEX IF NOT EXISTS idx_request_comments_author ON request_comments(author_id);
CREATE INDEX IF NOT EXISTS idx_request_comments_type ON request_comments(comment_type);
CREATE INDEX IF NOT EXISTS idx_request_comments_parent ON request_comments(parent_comment_id);

-- =====================================================
-- 5. REQUEST AUDIT LOGS
-- =====================================================

CREATE TABLE IF NOT EXISTS request_audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Request Reference
    request_id UUID NOT NULL REFERENCES asset_requests(id) ON DELETE CASCADE,
    
    -- Event Info
    event_type VARCHAR(50) NOT NULL,
    -- Events: created, submitted, approval_step_completed, approved, rejected,
    --         info_requested, info_provided, cancelled, fulfilling, completed,
    --         escalated, reminder_sent
    
    -- Actor
    actor_id UUID NOT NULL,
    
    -- Details
    old_status VARCHAR(30),
    new_status VARCHAR(30),
    metadata JSONB, -- Additional event-specific data
    
    -- Timestamp
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for audit logs
CREATE INDEX IF NOT EXISTS idx_request_audit_request ON request_audit_logs(request_id);
CREATE INDEX IF NOT EXISTS idx_request_audit_actor ON request_audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_request_audit_event ON request_audit_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_request_audit_created ON request_audit_logs(created_at);

-- =====================================================
-- 6. APPROVAL CHAIN TEMPLATES (Configuration)
-- =====================================================

CREATE TABLE IF NOT EXISTS approval_chain_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Template Name
    name VARCHAR(100) NOT NULL,
    description TEXT,
    
    -- Matching Criteria (all optional, AND logic)
    asset_category_id UUID, -- Apply to specific category
    min_value DECIMAL(18,4), -- Apply if asset value >= min
    max_value DECIMAL(18,4), -- Apply if asset value <= max
    department_id UUID, -- Apply to specific department
    request_type VARCHAR(20), -- Apply to specific request type
    
    -- Priority (higher = more specific, evaluated first)
    priority INTEGER DEFAULT 0,
    
    -- Approval Steps (JSONB array)
    -- [{order: 1, role: 'direct_manager', auto_assign: true}, ...]
    steps JSONB NOT NULL,
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    
    -- Organization
    organization_id UUID,
    
    -- Audit
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID
);

-- Indexes for templates
CREATE INDEX IF NOT EXISTS idx_approval_templates_category ON approval_chain_templates(asset_category_id);
CREATE INDEX IF NOT EXISTS idx_approval_templates_department ON approval_chain_templates(department_id);
CREATE INDEX IF NOT EXISTS idx_approval_templates_type ON approval_chain_templates(request_type);
CREATE INDEX IF NOT EXISTS idx_approval_templates_active ON approval_chain_templates(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_approval_templates_priority ON approval_chain_templates(priority DESC);
CREATE INDEX IF NOT EXISTS idx_approval_templates_organization ON approval_chain_templates(organization_id);

-- =====================================================
-- 7. VIEWS
-- =====================================================

-- View: My Requests (for requester dashboard)
CREATE OR REPLACE VIEW v_my_requests AS
SELECT 
    r.id,
    r.request_code,
    r.request_type,
    r.requester_id,
    r.quantity,
    r.priority,
    r.required_date,
    r.status,
    r.current_approval_step,
    r.total_approval_steps,
    r.submitted_at,
    r.created_at,
    r.updated_at,
    -- Current step info
    cs.approver_id AS current_approver_id,
    cs.approver_role AS current_approver_role,
    -- Counts
    (SELECT COUNT(*) FROM approval_steps WHERE request_id = r.id AND status = 'approved') AS approved_steps,
    (SELECT COUNT(*) FROM request_comments WHERE request_id = r.id) AS comment_count
FROM asset_requests r
LEFT JOIN approval_steps cs ON r.id = cs.request_id AND cs.step_order = r.current_approval_step;

-- View: Approval Queue (for approvers)
CREATE OR REPLACE VIEW v_approval_queue AS
SELECT 
    r.id AS request_id,
    r.request_code,
    r.request_type,
    r.requester_id,
    r.quantity,
    r.priority,
    r.required_date,
    r.status AS request_status,
    r.justification,
    r.submitted_at,
    s.id AS approval_step_id,
    s.step_order,
    s.approver_id,
    s.approver_role,
    s.status AS step_status,
    s.reminder_sent_count,
    s.last_reminder_sent_at,
    -- Days waiting
    EXTRACT(DAY FROM NOW() - COALESCE(s.created_at, r.submitted_at)) AS days_waiting
FROM asset_requests r
JOIN approval_steps s ON r.id = s.request_id
WHERE r.status = 'pending_approval'
  AND s.step_order = r.current_approval_step
  AND s.status = 'pending';

-- View: Requests Ready for Fulfillment
CREATE OR REPLACE VIEW v_requests_to_fulfill AS
SELECT 
    r.id,
    r.request_code,
    r.request_type,
    r.requester_id,
    r.department_id,
    r.asset_category_id,
    r.asset_model_id,
    r.quantity,
    r.priority,
    r.required_date,
    r.status,
    r.current_asset_id,
    r.submitted_at,
    r.created_at,
    -- Days since approval
    EXTRACT(DAY FROM NOW() - 
        (SELECT MAX(decision_date) FROM approval_steps WHERE request_id = r.id AND status = 'approved')
    ) AS days_since_approval
FROM asset_requests r
WHERE r.status IN ('approved', 'fulfilling');

-- View: Request Statistics
CREATE OR REPLACE VIEW v_request_statistics AS
SELECT 
    organization_id,
    COUNT(*) AS total_requests,
    COUNT(*) FILTER (WHERE status = 'draft') AS draft_count,
    COUNT(*) FILTER (WHERE status = 'pending_approval') AS pending_count,
    COUNT(*) FILTER (WHERE status = 'need_info') AS need_info_count,
    COUNT(*) FILTER (WHERE status = 'approved') AS approved_count,
    COUNT(*) FILTER (WHERE status = 'rejected') AS rejected_count,
    COUNT(*) FILTER (WHERE status = 'cancelled') AS cancelled_count,
    COUNT(*) FILTER (WHERE status = 'fulfilling') AS fulfilling_count,
    COUNT(*) FILTER (WHERE status = 'completed') AS completed_count,
    AVG(CASE WHEN status = 'completed' THEN 
        EXTRACT(EPOCH FROM (fulfilled_at - submitted_at)) / 86400 
    END) AS avg_completion_days,
    COUNT(*) FILTER (WHERE priority = 'urgent') AS urgent_count,
    COUNT(*) FILTER (WHERE priority = 'high') AS high_priority_count
FROM asset_requests
GROUP BY organization_id;

-- =====================================================
-- 8. FUNCTIONS
-- =====================================================

-- Function: Generate Request Code
CREATE OR REPLACE FUNCTION generate_request_code()
RETURNS TRIGGER AS $$
DECLARE
    today_date TEXT;
    seq_num INTEGER;
    new_code TEXT;
BEGIN
    -- Format: REQ-YYYYMMDD-XXXX
    today_date := TO_CHAR(NOW(), 'YYYYMMDD');
    
    -- Get next sequence number for today
    SELECT COALESCE(MAX(
        CASE 
            WHEN request_code ~ ('^REQ-' || today_date || '-[0-9]{4}$')
            THEN CAST(SUBSTRING(request_code FROM 14 FOR 4) AS INTEGER)
            ELSE 0
        END
    ), 0) + 1
    INTO seq_num
    FROM asset_requests
    WHERE request_code LIKE 'REQ-' || today_date || '-%';
    
    new_code := 'REQ-' || today_date || '-' || LPAD(seq_num::TEXT, 4, '0');
    
    NEW.request_code := new_code;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for auto-generating request code
DROP TRIGGER IF EXISTS trg_generate_request_code ON asset_requests;
CREATE TRIGGER trg_generate_request_code
    BEFORE INSERT ON asset_requests
    FOR EACH ROW
    WHEN (NEW.request_code IS NULL OR NEW.request_code = '')
    EXECUTE FUNCTION generate_request_code();

-- Function: Update request updated_at
CREATE OR REPLACE FUNCTION update_request_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updating timestamp
DROP TRIGGER IF EXISTS trg_request_updated_at ON asset_requests;
CREATE TRIGGER trg_request_updated_at
    BEFORE UPDATE ON asset_requests
    FOR EACH ROW
    EXECUTE FUNCTION update_request_timestamp();

-- Trigger for approval step timestamp
DROP TRIGGER IF EXISTS trg_approval_step_updated_at ON approval_steps;
CREATE TRIGGER trg_approval_step_updated_at
    BEFORE UPDATE ON approval_steps
    FOR EACH ROW
    EXECUTE FUNCTION update_request_timestamp();

-- =====================================================
-- 9. COMMENTS
-- =====================================================

COMMENT ON TABLE asset_requests IS 'Asset request submissions for new, replacement, upgrade, or return';
COMMENT ON TABLE approval_steps IS 'Individual approval steps in the request approval chain';
COMMENT ON TABLE request_attachments IS 'Files attached to asset requests';
COMMENT ON TABLE request_comments IS 'Comments and info request/response threads';
COMMENT ON TABLE request_audit_logs IS 'Audit trail for all request-related events';
COMMENT ON TABLE approval_chain_templates IS 'Configurable approval chain templates';

COMMENT ON COLUMN asset_requests.request_code IS 'Auto-generated: REQ-YYYYMMDD-XXXX';
COMMENT ON COLUMN asset_requests.approval_chain IS 'Snapshot of approval chain at submission time';
COMMENT ON COLUMN asset_requests.current_approval_step IS 'Current step in approval flow (1-indexed)';
COMMENT ON COLUMN approval_steps.step_order IS 'Order in approval chain (1, 2, 3...)';
COMMENT ON COLUMN approval_steps.is_escalated IS 'Whether this step was escalated from original approver';
