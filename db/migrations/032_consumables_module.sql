-- =====================================================
-- Consumables Module Migration
-- Version: 1.0.0
-- Description: Database schema for consumables management
-- =====================================================

-- ==================== Consumable Categories ====================
CREATE TABLE IF NOT EXISTS consumable_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    parent_id UUID REFERENCES consumable_categories(id) ON DELETE SET NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed default categories
INSERT INTO consumable_categories (code, name, description) VALUES
    ('INK', 'Ink & Toner', 'Printer ink cartridges and toner'),
    ('PAPER', 'Paper Products', 'Printing paper, notebooks, labels'),
    ('CABLE', 'Cables & Connectors', 'Network cables, adapters, connectors'),
    ('BATTERY', 'Batteries', 'Rechargeable and disposable batteries'),
    ('CLEANING', 'Cleaning Supplies', 'Screen cleaners, wipes, compressed air'),
    ('MEDIA', 'Storage Media', 'USB drives, DVDs, memory cards'),
    ('OTHER', 'Other Consumables', 'Miscellaneous consumable items')
ON CONFLICT (code) DO NOTHING;

-- ==================== Consumable Manufacturers ====================
CREATE TABLE IF NOT EXISTS consumable_manufacturers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(200) NOT NULL,
    website VARCHAR(500),
    support_url VARCHAR(500),
    support_phone VARCHAR(50),
    support_email VARCHAR(200),
    notes TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==================== Consumables (Main Table) ====================
CREATE TABLE IF NOT EXISTS consumables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    consumable_code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(200) NOT NULL,
    category_id UUID REFERENCES consumable_categories(id) ON DELETE SET NULL,
    manufacturer_id UUID REFERENCES consumable_manufacturers(id) ON DELETE SET NULL,
    model_number VARCHAR(100),
    part_number VARCHAR(100),
    image_url VARCHAR(500),
    
    -- Unit and quantity
    unit_of_measure VARCHAR(50) NOT NULL DEFAULT 'unit', -- box, roll, piece, meter, etc.
    quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
    min_quantity INTEGER DEFAULT 0 CHECK (min_quantity >= 0),
    
    -- Pricing
    unit_price DECIMAL(15, 2) DEFAULT 0,
    currency VARCHAR(3) DEFAULT 'VND',
    
    -- Procurement
    supplier_id UUID,
    purchase_order VARCHAR(100),
    purchase_date DATE,
    
    -- Location
    location_id UUID,
    location_name VARCHAR(200),
    
    -- Additional info
    notes TEXT,
    organization_id UUID,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'discontinued')),
    
    -- Audit
    created_by VARCHAR(100) NOT NULL,
    updated_by VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==================== Consumable Issues (Xuất kho) ====================
CREATE TABLE IF NOT EXISTS consumable_issues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    consumable_id UUID NOT NULL REFERENCES consumables(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    
    -- Issue type and recipient
    issue_type VARCHAR(20) NOT NULL CHECK (issue_type IN ('user', 'department', 'asset', 'general')),
    issued_to_user_id UUID,
    issued_to_department VARCHAR(200),
    issued_to_asset_id UUID,
    
    -- Issue details
    issue_date TIMESTAMPTZ DEFAULT NOW(),
    issued_by VARCHAR(100) NOT NULL,
    reference_number VARCHAR(100),
    notes TEXT,
    
    -- Audit
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==================== Consumable Receipts (Nhập kho) ====================
CREATE TABLE IF NOT EXISTS consumable_receipts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    consumable_id UUID NOT NULL REFERENCES consumables(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    
    -- Receipt type
    receipt_type VARCHAR(20) DEFAULT 'purchase' CHECK (receipt_type IN ('purchase', 'return', 'transfer', 'adjustment', 'initial')),
    
    -- Procurement info
    purchase_order VARCHAR(100),
    unit_cost DECIMAL(15, 2),
    total_cost DECIMAL(15, 2),
    receipt_date TIMESTAMPTZ DEFAULT NOW(),
    
    -- Supplier info
    supplier_id UUID,
    invoice_number VARCHAR(100),
    
    -- Processing
    received_by VARCHAR(100) NOT NULL,
    notes TEXT,
    
    -- Audit
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==================== Consumable Audit Logs ====================
CREATE TABLE IF NOT EXISTS consumable_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type VARCHAR(50) NOT NULL, -- 'consumable', 'issue', 'receipt'
    entity_id UUID NOT NULL,
    action VARCHAR(50) NOT NULL,
    changes JSONB,
    performed_by VARCHAR(100) NOT NULL,
    performed_at TIMESTAMPTZ DEFAULT NOW(),
    ip_address VARCHAR(45),
    user_agent TEXT,
    notes TEXT
);

-- ==================== Indexes ====================
-- Consumables
CREATE INDEX IF NOT EXISTS idx_consumables_code ON consumables(consumable_code);
CREATE INDEX IF NOT EXISTS idx_consumables_name ON consumables(name);
CREATE INDEX IF NOT EXISTS idx_consumables_category ON consumables(category_id);
CREATE INDEX IF NOT EXISTS idx_consumables_manufacturer ON consumables(manufacturer_id);
CREATE INDEX IF NOT EXISTS idx_consumables_status ON consumables(status);
CREATE INDEX IF NOT EXISTS idx_consumables_quantity ON consumables(quantity);
CREATE INDEX IF NOT EXISTS idx_consumables_low_stock ON consumables(quantity, min_quantity) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_consumables_org ON consumables(organization_id);

-- Issues
CREATE INDEX IF NOT EXISTS idx_consumable_issues_consumable ON consumable_issues(consumable_id);
CREATE INDEX IF NOT EXISTS idx_consumable_issues_date ON consumable_issues(issue_date);
CREATE INDEX IF NOT EXISTS idx_consumable_issues_type ON consumable_issues(issue_type);
CREATE INDEX IF NOT EXISTS idx_consumable_issues_user ON consumable_issues(issued_to_user_id) WHERE issued_to_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_consumable_issues_asset ON consumable_issues(issued_to_asset_id) WHERE issued_to_asset_id IS NOT NULL;

-- Receipts
CREATE INDEX IF NOT EXISTS idx_consumable_receipts_consumable ON consumable_receipts(consumable_id);
CREATE INDEX IF NOT EXISTS idx_consumable_receipts_date ON consumable_receipts(receipt_date);
CREATE INDEX IF NOT EXISTS idx_consumable_receipts_type ON consumable_receipts(receipt_type);

-- Audit logs
CREATE INDEX IF NOT EXISTS idx_consumable_audit_entity ON consumable_audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_consumable_audit_performed ON consumable_audit_logs(performed_at);

-- Categories
CREATE INDEX IF NOT EXISTS idx_consumable_categories_parent ON consumable_categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_consumable_categories_active ON consumable_categories(is_active);

-- ==================== Trigger for updated_at ====================
CREATE OR REPLACE FUNCTION update_consumables_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_consumables_updated_at ON consumables;
CREATE TRIGGER trigger_consumables_updated_at
    BEFORE UPDATE ON consumables
    FOR EACH ROW
    EXECUTE FUNCTION update_consumables_updated_at();

DROP TRIGGER IF EXISTS trigger_consumable_categories_updated_at ON consumable_categories;
CREATE TRIGGER trigger_consumable_categories_updated_at
    BEFORE UPDATE ON consumable_categories
    FOR EACH ROW
    EXECUTE FUNCTION update_consumables_updated_at();

DROP TRIGGER IF EXISTS trigger_consumable_manufacturers_updated_at ON consumable_manufacturers;
CREATE TRIGGER trigger_consumable_manufacturers_updated_at
    BEFORE UPDATE ON consumable_manufacturers
    FOR EACH ROW
    EXECUTE FUNCTION update_consumables_updated_at();

-- ==================== Comments ====================
COMMENT ON TABLE consumables IS 'IT consumable items (ink, paper, cables, batteries, etc.)';
COMMENT ON TABLE consumable_issues IS 'Track consumable items issued to users, departments, or assets';
COMMENT ON TABLE consumable_receipts IS 'Track consumable items received into inventory';
COMMENT ON TABLE consumable_audit_logs IS 'Audit trail for all consumable-related changes';
COMMENT ON TABLE consumable_categories IS 'Categories for organizing consumables';
COMMENT ON TABLE consumable_manufacturers IS 'Manufacturers of consumable items';
