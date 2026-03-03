-- =====================================================
-- Migration: 034_checkout_module.sql
-- Description: Create tables for unified Checkout/Checkin management
-- Dependencies: 007_cmdb_core.sql (for assets, users, locations)
-- =====================================================

-- Enable UUID extension if not exists
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- 1. ASSET CHECKOUTS (Main table)
-- =====================================================

CREATE TABLE IF NOT EXISTS asset_checkouts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Checkout Code (auto-generated)
    checkout_code VARCHAR(50) NOT NULL UNIQUE,
    
    -- Asset Reference
    asset_id UUID NOT NULL, -- FK to assets table
    
    -- Checkout Type
    checkout_type VARCHAR(20) NOT NULL DEFAULT 'user'
        CHECK (checkout_type IN ('user', 'location', 'asset')),
    
    -- Target (depends on checkout_type)
    target_user_id UUID, -- For user checkout
    target_location_id UUID, -- For location checkout
    target_asset_id UUID, -- For asset-to-asset checkout (e.g., laptop to dock)
    
    -- Checkout Info
    checkout_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    expected_checkin_date DATE,
    checked_out_by UUID NOT NULL, -- User who performed checkout
    checkout_notes TEXT,
    
    -- Checkin Info (populated when checked in)
    checkin_date TIMESTAMP WITH TIME ZONE,
    checked_in_by UUID,
    checkin_notes TEXT,
    checkin_condition VARCHAR(50), -- good/damaged/needs_maintenance
    next_action VARCHAR(50), -- available/maintenance/retire
    
    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'checked_out'
        CHECK (status IN ('checked_out', 'checked_in')),
    
    -- Overdue tracking
    is_overdue BOOLEAN DEFAULT false,
    overdue_notified_at TIMESTAMP WITH TIME ZONE,
    overdue_notification_count INTEGER DEFAULT 0,
    
    -- Organization
    organization_id UUID,
    
    -- Audit
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraint: At least one target must be set
    CONSTRAINT chk_checkout_target CHECK (
        (checkout_type = 'user' AND target_user_id IS NOT NULL) OR
        (checkout_type = 'location' AND target_location_id IS NOT NULL) OR
        (checkout_type = 'asset' AND target_asset_id IS NOT NULL)
    )
);

-- Indexes for checkouts
CREATE INDEX IF NOT EXISTS idx_asset_checkouts_code ON asset_checkouts(checkout_code);
CREATE INDEX IF NOT EXISTS idx_asset_checkouts_asset ON asset_checkouts(asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_checkouts_status ON asset_checkouts(status);
CREATE INDEX IF NOT EXISTS idx_asset_checkouts_type ON asset_checkouts(checkout_type);
CREATE INDEX IF NOT EXISTS idx_asset_checkouts_user ON asset_checkouts(target_user_id);
CREATE INDEX IF NOT EXISTS idx_asset_checkouts_location ON asset_checkouts(target_location_id);
CREATE INDEX IF NOT EXISTS idx_asset_checkouts_target_asset ON asset_checkouts(target_asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_checkouts_checkout_date ON asset_checkouts(checkout_date);
CREATE INDEX IF NOT EXISTS idx_asset_checkouts_expected_checkin ON asset_checkouts(expected_checkin_date);
CREATE INDEX IF NOT EXISTS idx_asset_checkouts_checked_out_by ON asset_checkouts(checked_out_by);
CREATE INDEX IF NOT EXISTS idx_asset_checkouts_overdue ON asset_checkouts(is_overdue) WHERE is_overdue = true;
CREATE INDEX IF NOT EXISTS idx_asset_checkouts_active ON asset_checkouts(status) WHERE status = 'checked_out';
CREATE INDEX IF NOT EXISTS idx_asset_checkouts_organization ON asset_checkouts(organization_id);

-- =====================================================
-- 2. CHECKOUT EXTENSIONS (Extend return date)
-- =====================================================

CREATE TABLE IF NOT EXISTS checkout_extensions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Checkout Reference
    checkout_id UUID NOT NULL REFERENCES asset_checkouts(id) ON DELETE CASCADE,
    
    -- Extension Details
    previous_expected_date DATE NOT NULL,
    new_expected_date DATE NOT NULL,
    extension_reason TEXT,
    
    -- Who extended
    extended_by UUID NOT NULL,
    extended_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Notes
    notes TEXT
);

-- Indexes for extensions
CREATE INDEX IF NOT EXISTS idx_checkout_extensions_checkout ON checkout_extensions(checkout_id);
CREATE INDEX IF NOT EXISTS idx_checkout_extensions_extended_at ON checkout_extensions(extended_at);
CREATE INDEX IF NOT EXISTS idx_checkout_extensions_extended_by ON checkout_extensions(extended_by);

-- =====================================================
-- 3. CHECKOUT TRANSFERS (Transfer from user A to B)
-- =====================================================

CREATE TABLE IF NOT EXISTS checkout_transfers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Original Checkout (closed after transfer)
    original_checkout_id UUID NOT NULL REFERENCES asset_checkouts(id),
    
    -- New Checkout (created for new user)
    new_checkout_id UUID NOT NULL REFERENCES asset_checkouts(id),
    
    -- Transfer Details
    from_user_id UUID NOT NULL,
    to_user_id UUID NOT NULL,
    transfer_reason TEXT,
    
    -- Who transferred
    transferred_by UUID NOT NULL,
    transferred_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Notes
    notes TEXT
);

-- Indexes for transfers
CREATE INDEX IF NOT EXISTS idx_checkout_transfers_original ON checkout_transfers(original_checkout_id);
CREATE INDEX IF NOT EXISTS idx_checkout_transfers_new ON checkout_transfers(new_checkout_id);
CREATE INDEX IF NOT EXISTS idx_checkout_transfers_from ON checkout_transfers(from_user_id);
CREATE INDEX IF NOT EXISTS idx_checkout_transfers_to ON checkout_transfers(to_user_id);
CREATE INDEX IF NOT EXISTS idx_checkout_transfers_transferred_at ON checkout_transfers(transferred_at);

-- =====================================================
-- 4. CHECKOUT AUDIT LOG
-- =====================================================

CREATE TABLE IF NOT EXISTS checkout_audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- References
    checkout_id UUID REFERENCES asset_checkouts(id) ON DELETE SET NULL,
    asset_id UUID,
    
    -- Action Info
    action VARCHAR(50) NOT NULL,
    action_type VARCHAR(30) NOT NULL, -- checkout/checkin/extend/transfer/overdue_reminder
    
    -- Details
    old_values JSONB,
    new_values JSONB,
    
    -- User Info
    performed_by UUID NOT NULL,
    performed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Additional Context
    ip_address INET,
    user_agent TEXT,
    notes TEXT
);

-- Indexes for audit logs
CREATE INDEX IF NOT EXISTS idx_checkout_audit_checkout ON checkout_audit_logs(checkout_id);
CREATE INDEX IF NOT EXISTS idx_checkout_audit_asset ON checkout_audit_logs(asset_id);
CREATE INDEX IF NOT EXISTS idx_checkout_audit_action_type ON checkout_audit_logs(action_type);
CREATE INDEX IF NOT EXISTS idx_checkout_audit_performed_at ON checkout_audit_logs(performed_at);
CREATE INDEX IF NOT EXISTS idx_checkout_audit_performed_by ON checkout_audit_logs(performed_by);

-- =====================================================
-- 5. CHECKOUT CODE SEQUENCE
-- =====================================================

CREATE SEQUENCE IF NOT EXISTS checkout_code_seq START 1000;

-- Function to generate checkout code
CREATE OR REPLACE FUNCTION generate_checkout_code()
RETURNS TEXT AS $$
BEGIN
    RETURN 'CHK-' || LPAD(nextval('checkout_code_seq')::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 6. TRIGGERS
-- =====================================================

-- Updated_at trigger for checkouts
CREATE OR REPLACE FUNCTION update_checkout_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_asset_checkouts_updated_at ON asset_checkouts;
CREATE TRIGGER trg_asset_checkouts_updated_at
    BEFORE UPDATE ON asset_checkouts
    FOR EACH ROW
    EXECUTE FUNCTION update_checkout_updated_at();

-- Auto-generate checkout code
CREATE OR REPLACE FUNCTION auto_generate_checkout_code()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.checkout_code IS NULL OR NEW.checkout_code = '' THEN
        NEW.checkout_code = generate_checkout_code();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_auto_checkout_code ON asset_checkouts;
CREATE TRIGGER trg_auto_checkout_code
    BEFORE INSERT ON asset_checkouts
    FOR EACH ROW
    EXECUTE FUNCTION auto_generate_checkout_code();

-- Update overdue status function
CREATE OR REPLACE FUNCTION update_checkout_overdue_status()
RETURNS void AS $$
BEGIN
    UPDATE asset_checkouts
    SET is_overdue = true
    WHERE status = 'checked_out'
    AND expected_checkin_date IS NOT NULL
    AND expected_checkin_date < CURRENT_DATE
    AND is_overdue = false;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 7. VIEWS
-- =====================================================

DROP VIEW IF EXISTS v_active_checkouts;
DROP VIEW IF EXISTS v_overdue_checkouts;
DROP VIEW IF EXISTS v_user_checkout_history;

-- Active checkouts view with status indicators
CREATE OR REPLACE VIEW v_active_checkouts AS
SELECT 
    c.id,
    c.checkout_code,
    c.asset_id,
    c.checkout_type,
    c.target_user_id,
    c.target_location_id,
    c.target_asset_id,
    c.checkout_date,
    c.expected_checkin_date,
    c.checked_out_by,
    c.checkout_notes,
    c.is_overdue,
    c.organization_id,
    c.created_at,
    CASE 
        WHEN c.expected_checkin_date IS NULL THEN 'indefinite'
        WHEN c.expected_checkin_date < CURRENT_DATE THEN 'overdue'
        WHEN c.expected_checkin_date <= CURRENT_DATE + INTERVAL '3 days' THEN 'due_soon'
        ELSE 'on_track'
    END as checkout_status,
    CASE 
        WHEN c.expected_checkin_date IS NULL THEN NULL
        ELSE c.expected_checkin_date - CURRENT_DATE
    END as days_until_due
FROM asset_checkouts c
WHERE c.status = 'checked_out';

-- Overdue checkouts view
CREATE OR REPLACE VIEW v_overdue_checkouts AS
SELECT 
    c.*,
    CURRENT_DATE - c.expected_checkin_date as days_overdue
FROM asset_checkouts c
WHERE c.status = 'checked_out'
AND c.expected_checkin_date < CURRENT_DATE;

-- User checkout history view
CREATE OR REPLACE VIEW v_user_checkout_history AS
SELECT 
    c.id,
    c.checkout_code,
    c.asset_id,
    c.target_user_id as user_id,
    c.checkout_date,
    c.expected_checkin_date,
    c.checkin_date,
    c.status,
    c.checkout_notes,
    c.checkin_notes,
    CASE 
        WHEN c.checkin_date IS NOT NULL AND c.expected_checkin_date IS NOT NULL 
        THEN c.checkin_date::DATE - c.expected_checkin_date
        ELSE NULL
    END as days_late
FROM asset_checkouts c
WHERE c.checkout_type = 'user'
ORDER BY c.checkout_date DESC;

-- =====================================================
-- 8. COMMENTS
-- =====================================================

COMMENT ON TABLE asset_checkouts IS 'Track asset checkout/checkin for users, locations, or other assets';
COMMENT ON TABLE checkout_extensions IS 'Track extensions to checkout expected return dates';
COMMENT ON TABLE checkout_transfers IS 'Track asset transfers between users';
COMMENT ON TABLE checkout_audit_logs IS 'Audit trail for checkout operations';

COMMENT ON COLUMN asset_checkouts.checkout_type IS 'Type: user (to person), location (to room/building), asset (to another asset like docking station)';
COMMENT ON COLUMN asset_checkouts.is_overdue IS 'True when expected_checkin_date has passed and still checked out';
COMMENT ON COLUMN asset_checkouts.checkin_condition IS 'Condition on return: good/damaged/needs_maintenance';
COMMENT ON COLUMN asset_checkouts.next_action IS 'What to do after checkin: available/maintenance/retire';

COMMENT ON VIEW v_active_checkouts IS 'Active checkouts with status indicators (overdue/due_soon/on_track)';
COMMENT ON VIEW v_overdue_checkouts IS 'Checkouts that are past their expected return date';
COMMENT ON VIEW v_user_checkout_history IS 'Checkout history for users with late return tracking';
