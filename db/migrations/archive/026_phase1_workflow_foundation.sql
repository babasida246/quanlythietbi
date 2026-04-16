-- Simplified Asset Management: Purchase Planning + Input Documents + Inventory Tracking
-- Migration 026: Create workflow and document infrastructure

-- ============================================
-- 1. APPROVALS TABLE (Simple workflow)
-- ============================================
CREATE TABLE IF NOT EXISTS approvals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entity_type VARCHAR(50) NOT NULL, -- 'purchase_plan', 'asset_increase'
    entity_id UUID NOT NULL,
    step_no INTEGER NOT NULL,
    approver_id VARCHAR(255) NOT NULL,
    approver_name VARCHAR(255),
    decision VARCHAR(20), -- 'approved', 'rejected', NULL (pending)
    note TEXT,
    decided_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT approvals_decision_check CHECK (decision IN ('approved', 'rejected')),
    CONSTRAINT approvals_unique_step UNIQUE (entity_type, entity_id, step_no)
);

CREATE INDEX IF NOT EXISTS ix_approvals__entity_type__entity_id__step_no ON approvals(entity_type, entity_id, step_no);
CREATE INDEX IF NOT EXISTS ix_approvals__approver_id__decided_at ON approvals(approver_id, decided_at);

COMMENT ON TABLE approvals IS 'Approval workflow for purchase plans and asset input documents';

-- ============================================
-- 1B. INVENTORY TRACKING (for purchase suggestions)
-- ============================================
-- Add inventory tracking fields to asset_models
ALTER TABLE asset_models ADD COLUMN IF NOT EXISTS min_stock_qty INTEGER DEFAULT 0;
ALTER TABLE asset_models ADD COLUMN IF NOT EXISTS current_stock_qty INTEGER DEFAULT 0;
ALTER TABLE asset_models ADD COLUMN IF NOT EXISTS unit VARCHAR(50) DEFAULT 'pcs';
ALTER TABLE asset_models ADD COLUMN IF NOT EXISTS avg_daily_consumption DECIMAL(10, 2) DEFAULT 0;
ALTER TABLE asset_models ADD COLUMN IF NOT EXISTS avg_weekly_consumption DECIMAL(10, 2) DEFAULT 0;
ALTER TABLE asset_models ADD COLUMN IF NOT EXISTS lead_time_days INTEGER DEFAULT 7;

CREATE INDEX IF NOT EXISTS idx_asset_models_stock ON asset_models(current_stock_qty, min_stock_qty) WHERE current_stock_qty < min_stock_qty;

COMMENT ON COLUMN asset_models.min_stock_qty IS 'Minimum stock quantity to trigger purchase suggestion';
COMMENT ON COLUMN asset_models.current_stock_qty IS 'Current available stock (updated when assets are added/removed)';
COMMENT ON COLUMN asset_models.avg_daily_consumption IS 'Average daily consumption rate';
COMMENT ON COLUMN asset_models.avg_weekly_consumption IS 'Average weekly consumption rate';
COMMENT ON COLUMN asset_models.lead_time_days IS 'Expected delivery time in days';

-- Consumption tracking table
CREATE TABLE IF NOT EXISTS asset_consumption_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    model_id UUID NOT NULL REFERENCES asset_models(id) ON DELETE CASCADE,
    consumption_date DATE NOT NULL,
    quantity INTEGER NOT NULL,
    reason VARCHAR(100), -- 'issued', 'deployed', 'installed', 'lost', 'damaged'
    ref_doc_type VARCHAR(50),
    ref_doc_id UUID,
    note TEXT,
    created_by VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_consumption_logs_model ON asset_consumption_logs(model_id, consumption_date DESC);

COMMENT ON TABLE asset_consumption_logs IS 'Track asset consumption for calculating average usage rates';

-- ============================================
-- 2. PURCHASE PLAN DOCUMENTS
-- ============================================
CREATE TABLE IF NOT EXISTS purchase_plan_docs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    doc_no VARCHAR(50) NOT NULL UNIQUE,
    doc_date DATE NOT NULL,
    fiscal_year INTEGER NOT NULL,
    org_unit_id VARCHAR(100),
    org_unit_name VARCHAR(255),
    title VARCHAR(500) NOT NULL,
    description TEXT,
    total_estimated_cost DECIMAL(18, 2),
    currency VARCHAR(3) DEFAULT 'VND',
    
    -- Workflow status
    status VARCHAR(20) NOT NULL DEFAULT 'draft',
    
    -- Audit fields
    created_by VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    submitted_by VARCHAR(255),
    submitted_at TIMESTAMPTZ,
    approved_by VARCHAR(255),
    approved_at TIMESTAMPTZ,
    posted_by VARCHAR(255),
    posted_at TIMESTAMPTZ,
    cancelled_by VARCHAR(255),
    cancelled_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Attachments
    attachments JSONB DEFAULT '[]'::jsonb,
    metadata JSONB DEFAULT '{}'::jsonb,
    
    CONSTRAINT purchase_plan_docs_status_check CHECK (
        status IN ('draft', 'submitted', 'approved', 'rejected', 'posted', 'cancelled')
    )
);

CREATE INDEX IF NOT EXISTS idx_purchase_plan_docs_status ON purchase_plan_docs(status, doc_date DESC);
CREATE INDEX IF NOT EXISTS idx_purchase_plan_docs_org ON purchase_plan_docs(org_unit_id, fiscal_year);

COMMENT ON TABLE purchase_plan_docs IS 'Purchase plan documents for asset procurement planning';

-- ============================================
-- 3. PURCHASE PLAN LINES
-- ============================================
CREATE TABLE IF NOT EXISTS purchase_plan_lines (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    doc_id UUID NOT NULL REFERENCES purchase_plan_docs(id) ON DELETE CASCADE,
    line_no INTEGER NOT NULL,
    
    model_id UUID REFERENCES asset_models(id),
    category_id UUID REFERENCES asset_categories(id),
    item_description VARCHAR(500) NOT NULL,
    quantity INTEGER NOT NULL,
    unit VARCHAR(50),
    estimated_unit_cost DECIMAL(18, 2),
    estimated_total_cost DECIMAL(18, 2),
    
    -- Purchase suggestion data
    suggestion_reason VARCHAR(100), -- 'low_stock', 'high_consumption', 'manual', 'seasonal'
    current_stock INTEGER,
    min_stock INTEGER,
    avg_consumption DECIMAL(10, 2),
    days_until_stockout INTEGER, -- Calculated: (current_stock - min_stock) / avg_daily_consumption
    
    funding_source VARCHAR(255),
    purpose TEXT,
    expected_delivery_date DATE,
    using_dept VARCHAR(255),
    priority VARCHAR(20) DEFAULT 'medium',
    
    specs JSONB DEFAULT '{}'::jsonb,
    note TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT purchase_plan_lines_qty_check CHECK (quantity > 0),
    CONSTRAINT purchase_plan_lines_priority_check CHECK (priority IN ('high', 'medium', 'low')),
    CONSTRAINT purchase_plan_lines_unique_line UNIQUE (doc_id, line_no)
);

CREATE INDEX IF NOT EXISTS idx_purchase_plan_lines_doc ON purchase_plan_lines(doc_id, line_no);
CREATE INDEX IF NOT EXISTS idx_purchase_plan_lines_model ON purchase_plan_lines(model_id);

COMMENT ON TABLE purchase_plan_lines IS 'Purchase plan line items with auto-suggestion support';

-- ============================================
-- 4. ASSET INCREASE DOCUMENTS (Ghi tăng)
-- ============================================
CREATE TABLE IF NOT EXISTS asset_increase_docs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    doc_no VARCHAR(50) NOT NULL UNIQUE,
    doc_date DATE NOT NULL,
    
    increase_type VARCHAR(50) NOT NULL, -- 'purchase', 'donation', 'transfer_in', 'found', 'reclass'
    org_unit_id VARCHAR(100),
    org_unit_name VARCHAR(255),
    
    vendor_id UUID REFERENCES vendors(id),
    vendor_name VARCHAR(255),
    invoice_no VARCHAR(100),
    invoice_date DATE,
    
    total_cost DECIMAL(18, 2),
    currency VARCHAR(3) DEFAULT 'VND',
    
    -- Workflow status
    status VARCHAR(20) NOT NULL DEFAULT 'draft',
    
    -- Audit fields
    created_by VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    submitted_by VARCHAR(255),
    submitted_at TIMESTAMPTZ,
    approved_by VARCHAR(255),
    approved_at TIMESTAMPTZ,
    posted_by VARCHAR(255),
    posted_at TIMESTAMPTZ,
    cancelled_by VARCHAR(255),
    cancelled_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- References
    purchase_plan_doc_id UUID REFERENCES purchase_plan_docs(id),
    
    note TEXT,
    attachments JSONB DEFAULT '[]'::jsonb,
    metadata JSONB DEFAULT '{}'::jsonb,
    
    CONSTRAINT asset_increase_docs_status_check CHECK (
        status IN ('draft', 'submitted', 'approved', 'rejected', 'posted', 'cancelled')
    ),
    CONSTRAINT asset_increase_docs_type_check CHECK (
        increase_type IN ('purchase', 'donation', 'transfer_in', 'found', 'reclass', 'other')
    )
);

CREATE INDEX IF NOT EXISTS idx_asset_increase_docs_status ON asset_increase_docs(status, doc_date DESC);
CREATE INDEX IF NOT EXISTS idx_asset_increase_docs_vendor ON asset_increase_docs(vendor_id);

COMMENT ON TABLE asset_increase_docs IS 'Asset increase documents (Ghi tăng tài sản)';

-- ============================================
-- 5. ASSET INCREASE LINES
-- ============================================
CREATE TABLE IF NOT EXISTS asset_increase_lines (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    doc_id UUID NOT NULL REFERENCES asset_increase_docs(id) ON DELETE CASCADE,
    line_no INTEGER NOT NULL,
    
    -- Asset info (before posting, these are proposals)
    asset_code VARCHAR(100),
    asset_name VARCHAR(255) NOT NULL,
    category_id UUID REFERENCES asset_categories(id),
    model_id UUID REFERENCES asset_models(id),
    
    serial_number VARCHAR(100),
    quantity INTEGER NOT NULL DEFAULT 1,
    unit VARCHAR(50),
    
    original_cost DECIMAL(18, 2) NOT NULL,
    current_value DECIMAL(18, 2),
    
    location_id UUID REFERENCES locations(id),
    location_name VARCHAR(255),
    custodian_id VARCHAR(100),
    custodian_name VARCHAR(255),
    
    acquisition_date DATE,
    in_service_date DATE,
    warranty_end_date DATE,
    
    specs JSONB DEFAULT '{}'::jsonb,
    note TEXT,
    
    -- After posting, reference to created asset
    asset_id UUID REFERENCES assets(id),
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT asset_increase_lines_qty_check CHECK (quantity > 0),
    CONSTRAINT asset_increase_lines_cost_check CHECK (original_cost >= 0),
    CONSTRAINT asset_increase_lines_unique_line UNIQUE (doc_id, line_no)
);

CREATE INDEX IF NOT EXISTS idx_asset_increase_lines_doc ON asset_increase_lines(doc_id, line_no);
CREATE INDEX IF NOT EXISTS idx_asset_increase_lines_asset ON asset_increase_lines(asset_id);

COMMENT ON TABLE asset_increase_lines IS 'Line items for asset increase documents';

-- ============================================
-- 6. ENHANCE ASSET_EVENTS TABLE
-- ============================================
-- Add ref_doc columns to track which document caused the event
ALTER TABLE asset_events ADD COLUMN IF NOT EXISTS ref_doc_type VARCHAR(50);
ALTER TABLE asset_events ADD COLUMN IF NOT EXISTS ref_doc_id UUID;
ALTER TABLE asset_events ADD COLUMN IF NOT EXISTS old_snapshot JSONB;
ALTER TABLE asset_events ADD COLUMN IF NOT EXISTS new_snapshot JSONB;

CREATE INDEX IF NOT EXISTS idx_asset_events_ref_doc ON asset_events(ref_doc_type, ref_doc_id);

COMMENT ON COLUMN asset_events.ref_doc_type IS 'Document type that caused this event';
COMMENT ON COLUMN asset_events.ref_doc_id IS 'Document ID that caused this event';
COMMENT ON COLUMN asset_events.old_snapshot IS 'Asset state before event';
COMMENT ON COLUMN asset_events.new_snapshot IS 'Asset state after event';

-- ============================================
-- 7. UPDATE ASSETS TABLE
-- ============================================
-- Add document tracking to assets
ALTER TABLE assets ADD COLUMN IF NOT EXISTS source_doc_type VARCHAR(50);
ALTER TABLE assets ADD COLUMN IF NOT EXISTS source_doc_id UUID;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS source_doc_no VARCHAR(50);

CREATE INDEX IF NOT EXISTS idx_assets_source_doc ON assets(source_doc_type, source_doc_id);

COMMENT ON COLUMN assets.source_doc_type IS 'Type of document that created this asset (e.g., asset_increase)';
COMMENT ON COLUMN assets.source_doc_id IS 'ID of the source document';
COMMENT ON COLUMN assets.source_doc_no IS 'Document number for quick reference';
