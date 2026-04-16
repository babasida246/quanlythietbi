-- =====================================================
-- Migration: 031_accessories_module.sql
-- Description: Create tables for Accessories management
-- Dependencies: 007_cmdb_core.sql (for suppliers reference)
-- =====================================================

-- Enable UUID extension if not exists
CREATE EXTENSION
IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- 1. ACCESSORY CATEGORIES
-- =====================================================

CREATE TABLE
IF NOT EXISTS accessory_categories
(
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4
(),
    code VARCHAR
(50) NOT NULL UNIQUE,
    name VARCHAR
(200) NOT NULL,
    description TEXT,
    parent_id UUID REFERENCES accessory_categories
(id),
    is_active BOOLEAN DEFAULT true,
    created_by UUID NOT NULL,
    created_at TIMESTAMP
WITH TIME ZONE DEFAULT NOW
(),
    updated_at TIMESTAMP
WITH TIME ZONE DEFAULT NOW
()
);

CREATE INDEX
IF NOT EXISTS idx_accessory_categories_code ON accessory_categories
(code);
CREATE INDEX
IF NOT EXISTS idx_accessory_categories_parent ON accessory_categories
(parent_id);

-- =====================================================
-- 2. ACCESSORY MANUFACTURERS
-- =====================================================

CREATE TABLE
IF NOT EXISTS accessory_manufacturers
(
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4
(),
    code VARCHAR
(50) NOT NULL UNIQUE,
    name VARCHAR
(200) NOT NULL,
    website VARCHAR
(500),
    support_url VARCHAR
(500),
    support_phone VARCHAR
(50),
    support_email VARCHAR
(200),
    notes TEXT,
    is_active BOOLEAN DEFAULT true,
    created_by UUID NOT NULL,
    created_at TIMESTAMP
WITH TIME ZONE DEFAULT NOW
(),
    updated_at TIMESTAMP
WITH TIME ZONE DEFAULT NOW
()
);

CREATE INDEX
IF NOT EXISTS idx_accessory_manufacturers_code ON accessory_manufacturers
(code);

-- =====================================================
-- 3. ACCESSORIES (Main table)
-- =====================================================

CREATE TABLE
IF NOT EXISTS accessories
(
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4
(),
    
    -- Identification
    accessory_code VARCHAR
(50) NOT NULL UNIQUE,
    name VARCHAR
(200) NOT NULL,
    model_number VARCHAR
(100),
    
    -- Classification
    category_id UUID REFERENCES accessory_categories
(id),
    manufacturer_id UUID REFERENCES accessory_manufacturers
(id),
    
    -- Image
    image_url VARCHAR
(1000),
    
    -- Quantity management
    total_quantity INTEGER NOT NULL DEFAULT 0 CHECK
(total_quantity >= 0),
    available_quantity INTEGER NOT NULL DEFAULT 0 CHECK
(available_quantity >= 0),
    min_quantity INTEGER DEFAULT 0 CHECK
(min_quantity >= 0),
    
    -- Pricing
    unit_price DECIMAL
(18, 2) DEFAULT 0,
    currency VARCHAR
(10) DEFAULT 'VND',
    
    -- Procurement
    supplier_id UUID REFERENCES suppliers
(id),
    purchase_order VARCHAR
(100),
    purchase_date DATE,
    
    -- Location
    location_id UUID,  -- FK to locations table if exists
    location_name VARCHAR
(200),
    
    -- Notes
    notes TEXT,
    
    -- Organization
    organization_id UUID,
    
    -- Status
    status VARCHAR
(20) DEFAULT 'active' CHECK
(status IN
('active', 'inactive', 'discontinued')),
    
    -- Audit
    created_by UUID NOT NULL,
    updated_by UUID NOT NULL,
    created_at TIMESTAMP
WITH TIME ZONE DEFAULT NOW
(),
    updated_at TIMESTAMP
WITH TIME ZONE DEFAULT NOW
(),
    
    -- Constraint: available cannot exceed total
    CONSTRAINT chk_available_lte_total CHECK
(available_quantity <= total_quantity)
);

-- Indexes
CREATE INDEX
IF NOT EXISTS idx_accessories_code ON accessories
(accessory_code);
CREATE INDEX
IF NOT EXISTS idx_accessories_name ON accessories
(name);
CREATE INDEX
IF NOT EXISTS idx_accessories_category ON accessories
(category_id);
CREATE INDEX
IF NOT EXISTS idx_accessories_manufacturer ON accessories
(manufacturer_id);
CREATE INDEX
IF NOT EXISTS idx_accessories_supplier ON accessories
(supplier_id);
CREATE INDEX
IF NOT EXISTS idx_accessories_status ON accessories
(status);
CREATE INDEX
IF NOT EXISTS idx_accessories_org ON accessories
(organization_id);
CREATE INDEX
IF NOT EXISTS idx_accessories_available ON accessories
(available_quantity);
CREATE INDEX
IF NOT EXISTS idx_accessories_low_stock ON accessories
(available_quantity, min_quantity) 
    WHERE available_quantity <= min_quantity;

-- =====================================================
-- 4. ACCESSORY CHECKOUTS
-- =====================================================

CREATE TABLE
IF NOT EXISTS accessory_checkouts
(
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4
(),
    
    -- Which accessory
    accessory_id UUID NOT NULL REFERENCES accessories
(id) ON
DELETE CASCADE,
    
    -- Quantity checked out
    quantity INTEGER
NOT NULL CHECK
(quantity > 0),
    quantity_returned INTEGER DEFAULT 0 CHECK
(quantity_returned >= 0),
    
    -- Assignment type
    assignment_type VARCHAR
(20) NOT NULL CHECK
(assignment_type IN
('user', 'asset')),
    
    -- Assigned to
    assigned_user_id UUID,
    assigned_asset_id UUID,
    
    -- Dates
    checkout_date TIMESTAMP
WITH TIME ZONE NOT NULL DEFAULT NOW
(),
    expected_checkin_date DATE,
    actual_checkin_date TIMESTAMP
WITH TIME ZONE,
    
    -- Who performed checkout
    checked_out_by UUID NOT NULL,
    checked_in_by UUID,
    
    -- Notes
    checkout_notes TEXT,
    checkin_notes TEXT,
    
    -- Status
    status VARCHAR
(20) DEFAULT 'checked_out' CHECK
(status IN
('checked_out', 'partially_returned', 'returned')),
    
    -- Audit
    created_at TIMESTAMP
WITH TIME ZONE DEFAULT NOW
(),
    updated_at TIMESTAMP
WITH TIME ZONE DEFAULT NOW
(),
    
    -- Constraints
    CONSTRAINT chk_assignment_target CHECK
(
        (assignment_type = 'user' AND assigned_user_id IS NOT NULL) OR
(assignment_type = 'asset' AND assigned_asset_id IS NOT NULL)
    ),
    CONSTRAINT chk_returned_lte_quantity CHECK
(quantity_returned <= quantity)
);

-- Indexes
CREATE INDEX
IF NOT EXISTS idx_accessory_checkouts_accessory ON accessory_checkouts
(accessory_id);
CREATE INDEX
IF NOT EXISTS idx_accessory_checkouts_user ON accessory_checkouts
(assigned_user_id);
CREATE INDEX
IF NOT EXISTS idx_accessory_checkouts_asset ON accessory_checkouts
(assigned_asset_id);
CREATE INDEX
IF NOT EXISTS idx_accessory_checkouts_status ON accessory_checkouts
(status);
CREATE INDEX
IF NOT EXISTS idx_accessory_checkouts_date ON accessory_checkouts
(checkout_date);
CREATE INDEX
IF NOT EXISTS idx_accessory_checkouts_expected ON accessory_checkouts
(expected_checkin_date) 
    WHERE status IN
('checked_out', 'partially_returned');
CREATE INDEX
IF NOT EXISTS idx_accessory_checkouts_overdue ON accessory_checkouts
(expected_checkin_date) 
    WHERE status IN
('checked_out', 'partially_returned');

-- =====================================================
-- 5. ACCESSORY STOCK ADJUSTMENTS
-- =====================================================

CREATE TABLE
IF NOT EXISTS accessory_stock_adjustments
(
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4
(),
    
    accessory_id UUID NOT NULL REFERENCES accessories
(id) ON
DELETE CASCADE,
    
    -- Adjustment details
    adjustment_type VARCHAR(30)
NOT NULL CHECK
(adjustment_type IN
(
        'purchase', 'return_to_supplier', 'lost', 'damaged', 
        'inventory_adjustment', 'initial_stock', 'transfer_in', 'transfer_out'
    )),
    
    -- Quantity change (positive for in, negative for out)
    quantity_change INTEGER NOT NULL,
    
    -- Before/After quantities
    quantity_before INTEGER NOT NULL,
    quantity_after INTEGER NOT NULL,
    
    -- Reference info
    reference_type VARCHAR
(50),  -- e.g., 'purchase_order', 'inventory_count'
    reference_id UUID,
    reference_number VARCHAR
(100),
    
    -- Notes
    reason TEXT,
    notes TEXT,
    
    -- Audit
    performed_by UUID NOT NULL,
    performed_at TIMESTAMP
WITH TIME ZONE DEFAULT NOW
()
);

CREATE INDEX
IF NOT EXISTS idx_stock_adjustments_accessory ON accessory_stock_adjustments
(accessory_id);
CREATE INDEX
IF NOT EXISTS idx_stock_adjustments_type ON accessory_stock_adjustments
(adjustment_type);
CREATE INDEX
IF NOT EXISTS idx_stock_adjustments_date ON accessory_stock_adjustments
(performed_at);

-- =====================================================
-- 6. ACCESSORY AUDIT LOG
-- =====================================================

CREATE TABLE
IF NOT EXISTS accessory_audit_logs
(
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4
(),
    
    accessory_id UUID NOT NULL REFERENCES accessories
(id) ON
DELETE CASCADE,
    
    -- Action
    action VARCHAR(50)
NOT NULL,  -- created, updated, checkout, checkin, stock_adjusted
    
    -- Change details
    field_name VARCHAR
(100),
    old_value JSONB,
    new_value JSONB,
    
    -- Context
    checkout_id UUID REFERENCES accessory_checkouts
(id),
    adjustment_id UUID REFERENCES accessory_stock_adjustments
(id),
    
    notes TEXT,
    
    -- Audit
    performed_by UUID NOT NULL,
    performed_at TIMESTAMP
WITH TIME ZONE DEFAULT NOW
()
);

CREATE INDEX
IF NOT EXISTS idx_accessory_audit_accessory ON accessory_audit_logs
(accessory_id);
CREATE INDEX
IF NOT EXISTS idx_accessory_audit_action ON accessory_audit_logs
(action);
CREATE INDEX
IF NOT EXISTS idx_accessory_audit_date ON accessory_audit_logs
(performed_at);

-- =====================================================
-- 8. FUNCTIONS
-- =====================================================

-- Function to get stock status
CREATE OR REPLACE FUNCTION get_accessory_stock_status
(p_accessory_id UUID)
RETURNS VARCHAR
(20) AS $$
DECLARE
    v_available INTEGER;
    v_min_qty INTEGER;
BEGIN
    SELECT available_quantity, min_quantity
    INTO v_available
    , v_min_qty
    FROM accessories 
    WHERE id = p_accessory_id;

IF v_available = 0 THEN
RETURN 'out_of_stock';
ELSIF v_available <= COALESCE
(v_min_qty, 0) THEN
RETURN 'low_stock';
ELSE
RETURN 'in_stock';
END
IF;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 9. VIEWS
-- =====================================================

-- View for accessory with stock info
CREATE OR REPLACE VIEW v_accessories_with_stock AS
SELECT
    a.*,
    c.name as category_name,
    m.name as manufacturer_name,
    s.name as supplier_name,
    (a.total_quantity - a.available_quantity) as checked_out_quantity,
    get_accessory_stock_status(a.id) as stock_status,
    CASE 
        WHEN a.available_quantity = 0 THEN 'out_of_stock'
        WHEN a.available_quantity <= COALESCE(a.min_quantity, 0) THEN 'low_stock'
        ELSE 'in_stock'
    END as stock_badge
FROM accessories a
    LEFT JOIN accessory_categories c ON a.category_id = c.id
    LEFT JOIN accessory_manufacturers m ON a.manufacturer_id = m.id
    LEFT JOIN suppliers s ON a.supplier_id = s.id;

-- View for active checkouts
DROP VIEW IF EXISTS v_accessory_active_checkouts;
CREATE OR REPLACE VIEW v_accessory_active_checkouts AS
SELECT
    co.*,
    a.name as accessory_name,
    a.accessory_code,
    (co.quantity - co.quantity_returned) as remaining_quantity,
    CASE 
        WHEN co.expected_checkin_date < CURRENT_DATE THEN true
        ELSE false
    END as is_overdue
FROM accessory_checkouts co
    JOIN accessories a ON co.accessory_id = a.id
WHERE co.status IN ('checked_out', 'partially_returned');

-- =====================================================
-- GRANT PERMISSIONS (adjust as needed)
-- =====================================================

-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO gateway_api;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO gateway_api;
