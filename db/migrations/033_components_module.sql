-- =====================================================
-- Migration: 033_components_module.sql
-- Description: Create tables for Components management
-- Dependencies: 007_cmdb_core.sql (for assets, suppliers, locations)
-- =====================================================

-- Enable UUID extension if not exists
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- 1. COMPONENT CATEGORIES
-- =====================================================

CREATE TABLE IF NOT EXISTS component_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    parent_id UUID REFERENCES component_categories(id),
    is_active BOOLEAN DEFAULT true,
    created_by UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_component_categories_code ON component_categories(code);
CREATE INDEX IF NOT EXISTS idx_component_categories_parent ON component_categories(parent_id);

-- =====================================================
-- 2. COMPONENT MANUFACTURERS
-- =====================================================

CREATE TABLE IF NOT EXISTS component_manufacturers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(200) NOT NULL,
    website VARCHAR(500),
    support_url VARCHAR(500),
    support_phone VARCHAR(50),
    support_email VARCHAR(200),
    notes TEXT,
    is_active BOOLEAN DEFAULT true,
    created_by UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_component_manufacturers_code ON component_manufacturers(code);

-- =====================================================
-- 3. COMPONENTS (Main table)
-- =====================================================

CREATE TABLE IF NOT EXISTS components (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Identification
    component_code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(200) NOT NULL,
    model_number VARCHAR(100),
    
    -- Classification
    category_id UUID REFERENCES component_categories(id),
    manufacturer_id UUID REFERENCES component_manufacturers(id),
    
    -- Component Type (ram/ssd/hdd/cpu/gpu/psu/motherboard/network_card/other)
    component_type VARCHAR(50) NOT NULL DEFAULT 'other',
    
    -- Technical Specifications
    specifications TEXT,
    
    -- Image
    image_url VARCHAR(500),
    
    -- Quantity Tracking
    total_quantity INTEGER NOT NULL DEFAULT 0 CHECK (total_quantity >= 0),
    available_quantity INTEGER NOT NULL DEFAULT 0 CHECK (available_quantity >= 0),
    min_quantity INTEGER DEFAULT 0 CHECK (min_quantity >= 0),
    
    -- Pricing
    unit_price DECIMAL(15,2) DEFAULT 0.00 CHECK (unit_price >= 0),
    currency VARCHAR(3) DEFAULT 'VND',
    
    -- Supplier Info
    supplier_id UUID, -- FK to suppliers table
    purchase_order VARCHAR(100),
    purchase_date DATE,
    
    -- Location
    location_id UUID, -- FK to locations table
    location_name VARCHAR(200),
    
    -- Organization
    organization_id UUID,
    
    -- Notes
    notes TEXT,
    
    -- Status
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'discontinued')),
    
    -- Audit
    created_by UUID NOT NULL,
    updated_by UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraint: available cannot exceed total
    CONSTRAINT chk_component_available_qty CHECK (available_quantity <= total_quantity)
);

-- Indexes for components
CREATE INDEX IF NOT EXISTS idx_components_code ON components(component_code);
CREATE INDEX IF NOT EXISTS idx_components_name ON components(name);
CREATE INDEX IF NOT EXISTS idx_components_type ON components(component_type);
CREATE INDEX IF NOT EXISTS idx_components_category ON components(category_id);
CREATE INDEX IF NOT EXISTS idx_components_manufacturer ON components(manufacturer_id);
CREATE INDEX IF NOT EXISTS idx_components_status ON components(status);
CREATE INDEX IF NOT EXISTS idx_components_location ON components(location_id);
CREATE INDEX IF NOT EXISTS idx_components_supplier ON components(supplier_id);
CREATE INDEX IF NOT EXISTS idx_components_organization ON components(organization_id);

-- =====================================================
-- 4. COMPONENT ASSIGNMENTS (Install/Remove to/from Assets)
-- =====================================================

CREATE TABLE IF NOT EXISTS component_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Component Reference
    component_id UUID NOT NULL REFERENCES components(id) ON DELETE RESTRICT,
    
    -- Assignment Details
    quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
    serial_numbers TEXT[], -- Array of serial numbers for tracked components
    
    -- Target Asset
    asset_id UUID NOT NULL, -- FK to assets table
    
    -- Installation Info
    installed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    installed_by UUID NOT NULL,
    installation_notes TEXT,
    
    -- Removal Info (populated when removed)
    removed_at TIMESTAMP WITH TIME ZONE,
    removed_by UUID,
    removal_reason VARCHAR(50), -- upgrade/repair/decommission
    removal_notes TEXT,
    
    -- Post-removal Action
    post_removal_action VARCHAR(20), -- restock/dispose
    
    -- Status
    status VARCHAR(20) DEFAULT 'installed' CHECK (status IN ('installed', 'removed')),
    
    -- Audit
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for assignments
CREATE INDEX IF NOT EXISTS idx_component_assignments_component ON component_assignments(component_id);
CREATE INDEX IF NOT EXISTS idx_component_assignments_asset ON component_assignments(asset_id);
CREATE INDEX IF NOT EXISTS idx_component_assignments_status ON component_assignments(status);
CREATE INDEX IF NOT EXISTS idx_component_assignments_installed_at ON component_assignments(installed_at);
CREATE INDEX IF NOT EXISTS idx_component_assignments_installed_by ON component_assignments(installed_by);

-- =====================================================
-- 5. COMPONENT STOCK RECEIPTS (Inventory additions)
-- =====================================================

CREATE TABLE IF NOT EXISTS component_receipts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Component Reference
    component_id UUID NOT NULL REFERENCES components(id) ON DELETE RESTRICT,
    
    -- Receipt Details
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    serial_numbers TEXT[], -- Array of serial numbers if tracked
    
    -- Receipt Type
    receipt_type VARCHAR(30) NOT NULL DEFAULT 'purchase'
        CHECK (receipt_type IN ('purchase', 'restock', 'transfer', 'adjustment', 'initial')),
    
    -- Source Info
    supplier_id UUID, -- FK to suppliers
    purchase_order VARCHAR(100),
    unit_cost DECIMAL(15,2) CHECK (unit_cost >= 0),
    
    -- Reference
    reference_number VARCHAR(100),
    reference_type VARCHAR(50), -- e.g., 'assignment' for restock
    reference_id UUID, -- e.g., assignment_id for restock
    
    -- Receipt Info
    received_by UUID NOT NULL,
    received_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    notes TEXT,
    
    -- Audit
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for receipts
CREATE INDEX IF NOT EXISTS idx_component_receipts_component ON component_receipts(component_id);
CREATE INDEX IF NOT EXISTS idx_component_receipts_type ON component_receipts(receipt_type);
CREATE INDEX IF NOT EXISTS idx_component_receipts_received_at ON component_receipts(received_at);
CREATE INDEX IF NOT EXISTS idx_component_receipts_received_by ON component_receipts(received_by);
CREATE INDEX IF NOT EXISTS idx_component_receipts_reference ON component_receipts(reference_id);

-- =====================================================
-- 6. COMPONENT AUDIT LOG
-- =====================================================

CREATE TABLE IF NOT EXISTS component_audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Reference
    component_id UUID REFERENCES components(id) ON DELETE SET NULL,
    assignment_id UUID REFERENCES component_assignments(id) ON DELETE SET NULL,
    receipt_id UUID REFERENCES component_receipts(id) ON DELETE SET NULL,
    
    -- Action Info
    action VARCHAR(50) NOT NULL,
    action_type VARCHAR(30) NOT NULL, -- create/update/delete/install/remove/receipt/dispose
    
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
CREATE INDEX IF NOT EXISTS idx_component_audit_component ON component_audit_logs(component_id);
CREATE INDEX IF NOT EXISTS idx_component_audit_assignment ON component_audit_logs(assignment_id);
CREATE INDEX IF NOT EXISTS idx_component_audit_action ON component_audit_logs(action_type);
CREATE INDEX IF NOT EXISTS idx_component_audit_performed_at ON component_audit_logs(performed_at);
CREATE INDEX IF NOT EXISTS idx_component_audit_performed_by ON component_audit_logs(performed_by);

-- =====================================================
-- 7. TRIGGERS FOR UPDATED_AT
-- =====================================================

-- Components updated_at trigger
CREATE OR REPLACE FUNCTION update_components_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_components_updated_at ON components;
CREATE TRIGGER trg_components_updated_at
    BEFORE UPDATE ON components
    FOR EACH ROW
    EXECUTE FUNCTION update_components_updated_at();

-- Component categories updated_at trigger
DROP TRIGGER IF EXISTS trg_component_categories_updated_at ON component_categories;
CREATE TRIGGER trg_component_categories_updated_at
    BEFORE UPDATE ON component_categories
    FOR EACH ROW
    EXECUTE FUNCTION update_components_updated_at();

-- Component manufacturers updated_at trigger
DROP TRIGGER IF EXISTS trg_component_manufacturers_updated_at ON component_manufacturers;
CREATE TRIGGER trg_component_manufacturers_updated_at
    BEFORE UPDATE ON component_manufacturers
    FOR EACH ROW
    EXECUTE FUNCTION update_components_updated_at();

-- Component assignments updated_at trigger
DROP TRIGGER IF EXISTS trg_component_assignments_updated_at ON component_assignments;
CREATE TRIGGER trg_component_assignments_updated_at
    BEFORE UPDATE ON component_assignments
    FOR EACH ROW
    EXECUTE FUNCTION update_components_updated_at();

-- =====================================================
-- 8. SEED DATA - Default Categories
-- =====================================================

INSERT INTO component_categories (id, code, name, description, created_by)
VALUES 
    (uuid_generate_v4(), 'MEMORY', 'Memory', 'RAM modules and memory sticks', '00000000-0000-0000-0000-000000000000'),
    (uuid_generate_v4(), 'STORAGE', 'Storage', 'SSDs, HDDs, and storage devices', '00000000-0000-0000-0000-000000000000'),
    (uuid_generate_v4(), 'PROCESSOR', 'Processors', 'CPUs and processors', '00000000-0000-0000-0000-000000000000'),
    (uuid_generate_v4(), 'GRAPHICS', 'Graphics Cards', 'GPUs and graphics cards', '00000000-0000-0000-0000-000000000000'),
    (uuid_generate_v4(), 'POWER', 'Power Supplies', 'PSUs and power components', '00000000-0000-0000-0000-000000000000'),
    (uuid_generate_v4(), 'NETWORK', 'Network Cards', 'NICs and network adapters', '00000000-0000-0000-0000-000000000000'),
    (uuid_generate_v4(), 'MAINBOARD', 'Motherboards', 'Motherboards and mainboards', '00000000-0000-0000-0000-000000000000'),
    (uuid_generate_v4(), 'OTHER', 'Other Components', 'Miscellaneous components', '00000000-0000-0000-0000-000000000000')
ON CONFLICT (code) DO NOTHING;

-- =====================================================
-- 9. COMMENTS
-- =====================================================

COMMENT ON TABLE components IS 'IT components/parts for upgrades and replacements';
COMMENT ON TABLE component_assignments IS 'Track component installation into assets';
COMMENT ON TABLE component_receipts IS 'Inventory receipts for components';
COMMENT ON TABLE component_categories IS 'Component classification categories';
COMMENT ON TABLE component_manufacturers IS 'Component manufacturers/vendors';
COMMENT ON TABLE component_audit_logs IS 'Audit trail for component operations';

COMMENT ON COLUMN components.component_type IS 'Type: ram/ssd/hdd/cpu/gpu/psu/motherboard/network_card/other';
COMMENT ON COLUMN components.total_quantity IS 'Total quantity including installed and available';
COMMENT ON COLUMN components.available_quantity IS 'Quantity available for installation (not installed in assets)';
COMMENT ON COLUMN component_assignments.post_removal_action IS 'What happens after removal: restock (return to available) or dispose (reduce total)';
COMMENT ON COLUMN component_assignments.serial_numbers IS 'Array of serial numbers for individually tracked components';
