-- =====================================================
-- AUDIT MODULE - Database Schema
-- Module: 07-AUDIT (Asset Audit/Inventory Check)
-- =====================================================

-- Ensure organization table exists for audit references
CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 1. Audit Sessions Table
CREATE TABLE IF NOT EXISTS audit_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    audit_code VARCHAR(20) UNIQUE,  -- AUD-YYYYMMDD-XXX (auto-generated via trigger)
    name VARCHAR(200) NOT NULL,
    audit_type VARCHAR(20) NOT NULL CHECK (audit_type IN ('full', 'partial', 'spot_check')),
    scope_description TEXT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE,
    status VARCHAR(20) NOT NULL DEFAULT 'draft' 
        CHECK (status IN ('draft', 'in_progress', 'reviewing', 'completed', 'cancelled')),
    notes TEXT,
    
    -- Progress tracking
    total_items INTEGER DEFAULT 0,
    audited_items INTEGER DEFAULT 0,
    found_items INTEGER DEFAULT 0,
    missing_items INTEGER DEFAULT 0,
    misplaced_items INTEGER DEFAULT 0,
    
    -- Completion info
    completed_at TIMESTAMPTZ,
    completed_by UUID REFERENCES users(id),
    completion_notes TEXT,
    
    -- Cancellation info
    cancelled_at TIMESTAMPTZ,
    cancelled_by UUID REFERENCES users(id),
    cancel_reason TEXT,
    
    -- Multi-tenant support
    organization_id UUID NOT NULL REFERENCES organizations(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID NOT NULL REFERENCES users(id)
);

-- 2. Audit Locations (many-to-many: audit to locations)
CREATE TABLE IF NOT EXISTS audit_locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    audit_id UUID NOT NULL REFERENCES audit_sessions(id) ON DELETE CASCADE,
    location_id UUID NOT NULL REFERENCES locations(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(audit_id, location_id)
);

-- 3. Audit Categories (many-to-many: audit to categories)
CREATE TABLE IF NOT EXISTS audit_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    audit_id UUID NOT NULL REFERENCES audit_sessions(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES asset_categories(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(audit_id, category_id)
);

-- 4. Audit Auditors (many-to-many: audit to users)
CREATE TABLE IF NOT EXISTS audit_auditors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    audit_id UUID NOT NULL REFERENCES audit_sessions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id),
    assigned_location_id UUID REFERENCES locations(id),  -- Optional location assignment
    is_lead BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(audit_id, user_id)
);

-- 5. Audit Items (assets to be audited)
CREATE TABLE IF NOT EXISTS audit_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    audit_id UUID NOT NULL REFERENCES audit_sessions(id) ON DELETE CASCADE,
    asset_id UUID NOT NULL REFERENCES assets(id),
    
    -- Expected state (from system at audit creation)
    expected_location_id UUID REFERENCES locations(id),
    expected_user_id UUID REFERENCES users(id),
    expected_condition VARCHAR(50),
    
    -- Audit result
    audit_status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (audit_status IN ('pending', 'found', 'missing', 'misplaced', 'condition_issue')),
    
    -- Actual state (from audit)
    actual_location_id UUID REFERENCES locations(id),
    actual_user_id UUID REFERENCES users(id),
    actual_condition VARCHAR(50),
    
    -- Audit metadata
    audited_by UUID REFERENCES users(id),
    audited_at TIMESTAMPTZ,
    notes TEXT,
    
    -- Resolution tracking
    resolution_status VARCHAR(20) DEFAULT 'unresolved'
        CHECK (resolution_status IN ('unresolved', 'resolved', 'pending_action', 'ignored')),
    resolution_action TEXT,
    resolved_by UUID REFERENCES users(id),
    resolved_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(audit_id, asset_id)
);

-- 6. Unregistered Assets (found during audit but not in system)
CREATE TABLE IF NOT EXISTS audit_unregistered_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    audit_id UUID NOT NULL REFERENCES audit_sessions(id) ON DELETE CASCADE,
    temporary_id VARCHAR(50) NOT NULL,  -- Temp identifier
    description TEXT NOT NULL,
    serial_number VARCHAR(100),
    location_found_id UUID REFERENCES locations(id),
    location_found_text VARCHAR(200),  -- Free text if location not in system
    condition VARCHAR(50),
    photo_path TEXT,
    
    -- Action tracking
    action VARCHAR(20) NOT NULL DEFAULT 'investigate'
        CHECK (action IN ('register', 'investigate', 'dispose')),
    action_notes TEXT,
    
    -- If registered as new asset
    registered_asset_id UUID REFERENCES assets(id),
    registered_at TIMESTAMPTZ,
    registered_by UUID REFERENCES users(id),
    
    -- Audit metadata
    found_by UUID NOT NULL REFERENCES users(id),
    found_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. Audit History Log
CREATE TABLE IF NOT EXISTS audit_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    audit_id UUID NOT NULL REFERENCES audit_sessions(id) ON DELETE CASCADE,
    action VARCHAR(50) NOT NULL,
    actor_id UUID NOT NULL REFERENCES users(id),
    old_status VARCHAR(20),
    new_status VARCHAR(20),
    details JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================
-- INDEXES
-- =====================================================

-- Audit sessions indexes
CREATE INDEX IF NOT EXISTS idx_audit_sessions_org ON audit_sessions(organization_id);
CREATE INDEX IF NOT EXISTS idx_audit_sessions_status ON audit_sessions(status);
CREATE INDEX IF NOT EXISTS idx_audit_sessions_dates ON audit_sessions(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_audit_sessions_code ON audit_sessions(audit_code);

-- Audit locations indexes
CREATE INDEX IF NOT EXISTS idx_audit_locations_audit ON audit_locations(audit_id);
CREATE INDEX IF NOT EXISTS idx_audit_locations_location ON audit_locations(location_id);

-- Audit categories indexes
CREATE INDEX IF NOT EXISTS idx_audit_categories_audit ON audit_categories(audit_id);

-- Audit auditors indexes
CREATE INDEX IF NOT EXISTS idx_audit_auditors_audit ON audit_auditors(audit_id);
CREATE INDEX IF NOT EXISTS idx_audit_auditors_user ON audit_auditors(user_id);

-- Audit items indexes
CREATE INDEX IF NOT EXISTS idx_audit_items_audit ON audit_items(audit_id);
CREATE INDEX IF NOT EXISTS idx_audit_items_asset ON audit_items(asset_id);
CREATE INDEX IF NOT EXISTS idx_audit_items_status ON audit_items(audit_status);
CREATE INDEX IF NOT EXISTS idx_audit_items_auditor ON audit_items(audited_by);
CREATE INDEX IF NOT EXISTS idx_audit_items_resolution ON audit_items(resolution_status);

-- Unregistered assets indexes
CREATE INDEX IF NOT EXISTS idx_audit_unregistered_audit ON audit_unregistered_assets(audit_id);
CREATE INDEX IF NOT EXISTS idx_audit_unregistered_action ON audit_unregistered_assets(action);

-- History indexes
CREATE INDEX IF NOT EXISTS idx_audit_history_audit ON audit_history(audit_id);
CREATE INDEX IF NOT EXISTS idx_audit_history_time ON audit_history(created_at);

-- =====================================================
-- FUNCTIONS & TRIGGERS
-- =====================================================

-- Function to generate audit code
CREATE OR REPLACE FUNCTION generate_audit_code()
RETURNS TRIGGER AS $$
DECLARE
    date_part VARCHAR(8);
    seq_num INTEGER;
    new_code VARCHAR(20);
BEGIN
    date_part := TO_CHAR(NOW(), 'YYYYMMDD');
    
    SELECT COALESCE(MAX(
        CAST(SUBSTRING(audit_code FROM 14 FOR 3) AS INTEGER)
    ), 0) + 1
    INTO seq_num
    FROM audit_sessions
    WHERE audit_code LIKE 'AUD-' || date_part || '-%';
    
    new_code := 'AUD-' || date_part || '-' || LPAD(seq_num::TEXT, 3, '0');
    NEW.audit_code := new_code;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for auto-generating audit code
DROP TRIGGER IF EXISTS trg_audit_code ON audit_sessions;
CREATE TRIGGER trg_audit_code
    BEFORE INSERT ON audit_sessions
    FOR EACH ROW
    WHEN (NEW.audit_code IS NULL)
    EXECUTE FUNCTION generate_audit_code();

-- Function to update timestamps
CREATE OR REPLACE FUNCTION update_audit_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Timestamp triggers
DROP TRIGGER IF EXISTS trg_audit_sessions_timestamp ON audit_sessions;
CREATE TRIGGER trg_audit_sessions_timestamp
    BEFORE UPDATE ON audit_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_audit_timestamp();

DROP TRIGGER IF EXISTS trg_audit_items_timestamp ON audit_items;
CREATE TRIGGER trg_audit_items_timestamp
    BEFORE UPDATE ON audit_items
    FOR EACH ROW
    EXECUTE FUNCTION update_audit_timestamp();

DROP TRIGGER IF EXISTS trg_audit_unregistered_timestamp ON audit_unregistered_assets;
CREATE TRIGGER trg_audit_unregistered_timestamp
    BEFORE UPDATE ON audit_unregistered_assets
    FOR EACH ROW
    EXECUTE FUNCTION update_audit_timestamp();

-- Function to update audit progress
CREATE OR REPLACE FUNCTION update_audit_progress()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE audit_sessions
    SET 
        audited_items = (
            SELECT COUNT(*) FROM audit_items 
            WHERE audit_id = COALESCE(NEW.audit_id, OLD.audit_id)
            AND audit_status != 'pending'
        ),
        found_items = (
            SELECT COUNT(*) FROM audit_items 
            WHERE audit_id = COALESCE(NEW.audit_id, OLD.audit_id)
            AND audit_status = 'found'
        ),
        missing_items = (
            SELECT COUNT(*) FROM audit_items 
            WHERE audit_id = COALESCE(NEW.audit_id, OLD.audit_id)
            AND audit_status = 'missing'
        ),
        misplaced_items = (
            SELECT COUNT(*) FROM audit_items 
            WHERE audit_id = COALESCE(NEW.audit_id, OLD.audit_id)
            AND audit_status = 'misplaced'
        )
    WHERE id = COALESCE(NEW.audit_id, OLD.audit_id);
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Trigger to update progress on item changes
DROP TRIGGER IF EXISTS trg_audit_progress ON audit_items;
CREATE TRIGGER trg_audit_progress
    AFTER INSERT OR UPDATE OR DELETE ON audit_items
    FOR EACH ROW
    EXECUTE FUNCTION update_audit_progress();

-- =====================================================
-- VIEWS
-- =====================================================

-- View for active audits
CREATE OR REPLACE VIEW v_active_audits AS
SELECT 
    a.id,
    a.audit_code,
    a.name,
    a.audit_type,
    a.scope_description,
    a.start_date,
    a.end_date,
    a.status,
    a.total_items,
    a.audited_items,
    a.found_items,
    a.missing_items,
    a.misplaced_items,
    CASE 
        WHEN a.total_items > 0 
        THEN ROUND((a.audited_items::DECIMAL / a.total_items) * 100, 2)
        ELSE 0 
    END as progress_percent,
    a.organization_id,
    a.created_at,
    u.name as created_by_name,
    (
        SELECT STRING_AGG(l.name, ', ')
        FROM audit_locations al
        JOIN locations l ON al.location_id = l.id
        WHERE al.audit_id = a.id
    ) as locations,
    (
        SELECT COUNT(*) FROM audit_auditors WHERE audit_id = a.id
    ) as auditor_count
FROM audit_sessions a
LEFT JOIN users u ON a.created_by = u.id
WHERE a.status IN ('draft', 'in_progress', 'reviewing');

-- View for audit discrepancies
CREATE OR REPLACE VIEW v_audit_discrepancies AS
SELECT 
    ai.id,
    ai.audit_id,
    a.audit_code,
    ai.asset_id,
    ast.asset_code as asset_tag,
    ast.asset_code as asset_name,
    ai.audit_status,
    ai.expected_location_id,
    el.name as expected_location,
    ai.actual_location_id,
    al.name as actual_location,
    ai.expected_user_id,
    eu.name as expected_user,
    ai.actual_user_id,
    au.name as actual_user,
    ai.expected_condition,
    ai.actual_condition,
    ai.resolution_status,
    ai.resolution_action,
    ai.notes,
    ai.audited_by,
    aud.name as audited_by_name,
    ai.audited_at
FROM audit_items ai
JOIN audit_sessions a ON ai.audit_id = a.id
JOIN assets ast ON ai.asset_id = ast.id
LEFT JOIN locations el ON ai.expected_location_id = el.id
LEFT JOIN locations al ON ai.actual_location_id = al.id
LEFT JOIN users eu ON ai.expected_user_id = eu.id
LEFT JOIN users au ON ai.actual_user_id = au.id
LEFT JOIN users aud ON ai.audited_by = aud.id
WHERE ai.audit_status IN ('missing', 'misplaced', 'condition_issue');

-- View for my assigned audits (for auditors)
CREATE OR REPLACE VIEW v_my_assigned_audits AS
SELECT 
    a.id,
    a.audit_code,
    a.name,
    a.audit_type,
    a.status,
    a.start_date,
    a.end_date,
    a.total_items,
    a.audited_items,
    aa.user_id as auditor_id,
    aa.is_lead,
    aa.assigned_location_id,
    l.name as assigned_location_name,
    CASE 
        WHEN a.total_items > 0 
        THEN ROUND((a.audited_items::DECIMAL / a.total_items) * 100, 2)
        ELSE 0 
    END as progress_percent
FROM audit_sessions a
JOIN audit_auditors aa ON a.id = aa.audit_id
LEFT JOIN locations l ON aa.assigned_location_id = l.id
WHERE a.status IN ('in_progress', 'reviewing');

-- View for audit statistics
CREATE OR REPLACE VIEW v_audit_statistics AS
SELECT 
    organization_id,
    COUNT(*) FILTER (WHERE status = 'completed') as completed_audits,
    COUNT(*) FILTER (WHERE status IN ('in_progress', 'reviewing')) as active_audits,
    COUNT(*) FILTER (WHERE status = 'draft') as draft_audits,
    AVG(
        CASE WHEN status = 'completed' AND total_items > 0 
        THEN (found_items::DECIMAL / total_items) * 100 
        END
    ) as avg_found_rate,
    AVG(
        CASE WHEN status = 'completed' AND total_items > 0 
        THEN (missing_items::DECIMAL / total_items) * 100 
        END
    ) as avg_missing_rate,
    COUNT(*) FILTER (
        WHERE status IN ('in_progress', 'reviewing') 
        AND end_date < CURRENT_DATE
    ) as overdue_audits
FROM audit_sessions
GROUP BY organization_id;

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON TABLE audit_sessions IS 'Asset audit/inventory check sessions';
COMMENT ON TABLE audit_locations IS 'Locations included in an audit session';
COMMENT ON TABLE audit_categories IS 'Asset categories included in an audit session';
COMMENT ON TABLE audit_auditors IS 'Users assigned to perform audit';
COMMENT ON TABLE audit_items IS 'Individual assets being audited with results';
COMMENT ON TABLE audit_unregistered_assets IS 'Assets found during audit that are not in the system';
COMMENT ON TABLE audit_history IS 'Audit trail for audit sessions';

COMMENT ON COLUMN audit_sessions.audit_type IS 'full=entire inventory, partial=specific locations/categories, spot_check=random sample';
COMMENT ON COLUMN audit_items.audit_status IS 'pending=not checked, found=matches system, missing=not found, misplaced=wrong location';
COMMENT ON COLUMN audit_unregistered_assets.action IS 'register=add to system, investigate=check origin, dispose=remove/discard';
