-- Labels Module Migration
-- Asset label templates and print jobs management

-- =====================================================
-- 1. LABEL TEMPLATES TABLE
-- =====================================================

CREATE TABLE
IF NOT EXISTS label_templates
(
    id UUID PRIMARY KEY DEFAULT gen_random_uuid
(),
    template_code VARCHAR
(50) NOT NULL UNIQUE,
    name VARCHAR
(100) NOT NULL,
    description TEXT,
    label_type VARCHAR
(20) NOT NULL DEFAULT 'combined',  -- barcode, qrcode, combined
    size_preset VARCHAR
(20) NOT NULL DEFAULT 'medium',   -- small, medium, large, custom
    width_mm DECIMAL
(10, 2) NOT NULL,
    height_mm DECIMAL
(10, 2) NOT NULL,
    layout JSONB NOT NULL DEFAULT '{}',                  -- JSON layout definition
    fields JSONB NOT NULL DEFAULT '[]',                  -- Array of field IDs to include
    barcode_type VARCHAR
(20) DEFAULT 'code128',          -- code128, code39, qrcode, datamatrix, ean13
    include_logo BOOLEAN DEFAULT false,
    include_company_name BOOLEAN DEFAULT false,
    font_family VARCHAR
(50) DEFAULT 'Arial',
    font_size INTEGER DEFAULT 10,
    is_default BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    organization_id UUID REFERENCES organizations
(id) ON
DELETE CASCADE,
    created_by UUID
REFERENCES users
(id) ON
DELETE
SET NULL
,
    updated_by UUID REFERENCES users
(id) ON
DELETE
SET NULL
,
    created_at TIMESTAMPTZ DEFAULT NOW
(),
    updated_at TIMESTAMPTZ DEFAULT NOW
(),
    
    CONSTRAINT chk_label_type CHECK
(label_type IN
('barcode', 'qrcode', 'combined')),
    CONSTRAINT chk_size_preset CHECK
(size_preset IN
('small', 'medium', 'large', 'custom')),
    CONSTRAINT chk_barcode_type CHECK
(barcode_type IN
('code128', 'code39', 'qrcode', 'datamatrix', 'ean13')),
    CONSTRAINT chk_positive_dimensions CHECK
(width_mm > 0 AND height_mm > 0)
);

CREATE INDEX
IF NOT EXISTS idx_label_templates_organization ON label_templates
(organization_id);
CREATE INDEX
IF NOT EXISTS idx_label_templates_type ON label_templates
(label_type);
CREATE INDEX
IF NOT EXISTS idx_label_templates_active ON label_templates
(is_active);
CREATE INDEX
IF NOT EXISTS idx_label_templates_default ON label_templates
(is_default) WHERE is_default = true;

COMMENT ON TABLE label_templates IS 'Label template definitions for asset labels';
COMMENT ON COLUMN label_templates.layout IS 'JSON defining element positions, sizes, and styles';
COMMENT ON COLUMN label_templates.fields IS 'Array of field IDs: asset_tag, serial, name, barcode, qrcode, etc.';

-- =====================================================
-- 2. PRINT JOBS TABLE
-- =====================================================

CREATE TABLE
IF NOT EXISTS print_jobs
(
    id UUID PRIMARY KEY DEFAULT gen_random_uuid
(),
    job_code VARCHAR
(50) NOT NULL UNIQUE,
    template_id UUID NOT NULL REFERENCES label_templates
(id) ON
DELETE RESTRICT,
    asset_ids JSONB
NOT NULL DEFAULT '[]',               -- Array of asset UUIDs
    asset_count INTEGER NOT NULL DEFAULT 0,
    copies_per_asset INTEGER NOT NULL DEFAULT 1,
    total_labels INTEGER NOT NULL DEFAULT 0,
    printer_name VARCHAR
(100),
    paper_size VARCHAR
(50),
    status VARCHAR
(20) NOT NULL DEFAULT 'queued',        -- queued, processing, completed, failed, cancelled
    error_message TEXT,
    output_type VARCHAR
(20) DEFAULT 'pdf',               -- pdf, direct, preview
    output_url TEXT,                                     -- URL to generated PDF
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    organization_id UUID REFERENCES organizations
(id) ON
DELETE CASCADE,
    created_by UUID
NOT NULL REFERENCES users
(id) ON
DELETE RESTRICT,
    created_at TIMESTAMPTZ
DEFAULT NOW
(),
    updated_at TIMESTAMPTZ DEFAULT NOW
(),
    
    CONSTRAINT chk_job_status CHECK
(status IN
('queued', 'processing', 'completed', 'failed', 'cancelled')),
    CONSTRAINT chk_output_type CHECK
(output_type IN
('pdf', 'direct', 'preview')),
    CONSTRAINT chk_positive_copies CHECK
(copies_per_asset > 0)
);

CREATE INDEX
IF NOT EXISTS idx_print_jobs_template ON print_jobs
(template_id);
CREATE INDEX
IF NOT EXISTS idx_print_jobs_status ON print_jobs
(status);
CREATE INDEX
IF NOT EXISTS idx_print_jobs_organization ON print_jobs
(organization_id);
CREATE INDEX
IF NOT EXISTS idx_print_jobs_created_by ON print_jobs
(created_by);
CREATE INDEX
IF NOT EXISTS idx_print_jobs_created_at ON print_jobs
(created_at DESC);

COMMENT ON TABLE print_jobs IS 'Print job records for label generation';

-- =====================================================
-- 3. PRINT JOB ITEMS TABLE (Individual labels)
-- =====================================================

CREATE TABLE
IF NOT EXISTS print_job_items
(
    id UUID PRIMARY KEY DEFAULT gen_random_uuid
(),
    print_job_id UUID NOT NULL REFERENCES print_jobs
(id) ON
DELETE CASCADE,
    asset_id UUID
NOT NULL REFERENCES assets
(id) ON
DELETE CASCADE,
    copy_number INTEGER
NOT NULL DEFAULT 1,
    status VARCHAR
(20) NOT NULL DEFAULT 'pending',       -- pending, generated, failed
    error_message TEXT,
    label_data JSONB,                                    -- Cached label field values
    created_at TIMESTAMPTZ DEFAULT NOW
()
);

CREATE INDEX
IF NOT EXISTS idx_print_job_items_job ON print_job_items
(print_job_id);
CREATE INDEX
IF NOT EXISTS idx_print_job_items_asset ON print_job_items
(asset_id);
CREATE INDEX
IF NOT EXISTS idx_print_job_items_status ON print_job_items
(status);

COMMENT ON TABLE print_job_items IS 'Individual label items within a print job';

-- =====================================================
-- 4. LABEL SETTINGS TABLE (System/Org settings)
-- =====================================================

CREATE TABLE
IF NOT EXISTS label_settings
(
    id UUID PRIMARY KEY DEFAULT gen_random_uuid
(),
    setting_key VARCHAR
(100) NOT NULL,
    setting_value TEXT,
    value_type VARCHAR
(20) DEFAULT 'string',             -- string, boolean, number, json
    description TEXT,
    organization_id UUID REFERENCES organizations
(id) ON
DELETE CASCADE,
    updated_by UUID
REFERENCES users
(id) ON
DELETE
SET NULL
,
    updated_at TIMESTAMPTZ DEFAULT NOW
(),
    
    CONSTRAINT uk_label_settings_key_org UNIQUE
(setting_key, organization_id)
);

CREATE INDEX
IF NOT EXISTS idx_label_settings_organization ON label_settings
(organization_id);

-- Insert default settings
INSERT INTO label_settings
    (setting_key, setting_value, value_type, description)
VALUES
    ('qr_contains_url', 'true', 'boolean', 'QR code contains asset URL'),
    ('qr_base_url', 'https://itam.company.com/assets/', 'string', 'Base URL for QR code links'),
    ('default_barcode_type', 'code128', 'string', 'Default barcode type for new templates'),
    ('max_batch_size', '500', 'number', 'Maximum number of labels per print job'),
    ('company_name', '', 'string', 'Company name to display on labels'),
    ('company_logo_url', '', 'string', 'URL to company logo image')
ON CONFLICT DO NOTHING;

-- =====================================================
-- 5. VIEWS
-- =====================================================

-- Active templates view
CREATE OR REPLACE VIEW v_active_label_templates AS
SELECT
    lt.*,
    u.name as created_by_name,
    (SELECT COUNT(*)
    FROM print_jobs pj
    WHERE pj.template_id = lt.id) as usage_count
FROM label_templates lt
    LEFT JOIN users u ON lt.created_by = u.id
WHERE lt.is_active = true;

-- Print jobs with details view
CREATE OR REPLACE VIEW v_print_jobs_with_details AS
SELECT
    pj.*,
    lt.name as template_name,
    lt.label_type,
    lt.size_preset,
    u.name as created_by_name,
    u.email as created_by_email,
    EXTRACT(EPOCH FROM (COALESCE(pj.completed_at, NOW()) - pj.created_at)) as duration_seconds
FROM print_jobs pj
    JOIN label_templates lt ON pj.template_id = lt.id
    JOIN users u ON pj.created_by = u.id;

-- Recent print history view
CREATE OR REPLACE VIEW v_recent_print_history AS
SELECT
    pj.id,
    pj.job_code,
    lt.name as template_name,
    pj.asset_count,
    pj.total_labels,
    pj.status,
    u.name as printed_by,
    pj.created_at,
    pj.completed_at
FROM print_jobs pj
    JOIN label_templates lt ON pj.template_id = lt.id
    JOIN users u ON pj.created_by = u.id
ORDER BY pj.created_at DESC;

-- =====================================================
-- 6. FUNCTIONS
-- =====================================================

-- Generate print job code
CREATE OR REPLACE FUNCTION generate_print_job_code
()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.job_code IS NULL OR NEW.job_code = '' THEN
        NEW.job_code := 'PJ-' || TO_CHAR
    (NOW
    (), 'YYYYMMDD') || '-' || 
                        LPAD
    (NEXTVAL
    ('print_job_code_seq')::TEXT, 4, '0');
END
IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create sequence for print job codes
CREATE SEQUENCE
IF NOT EXISTS print_job_code_seq START 1;

-- Generate template code
CREATE OR REPLACE FUNCTION generate_template_code
()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.template_code IS NULL OR NEW.template_code = '' THEN
        NEW.template_code := 'TPL-' || LPAD
    (NEXTVAL
    ('template_code_seq')::TEXT, 4, '0');
END
IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create sequence for template codes
CREATE SEQUENCE
IF NOT EXISTS template_code_seq START 1;

-- Calculate total labels
CREATE OR REPLACE FUNCTION calculate_total_labels
()
RETURNS TRIGGER AS $$
BEGIN
    NEW.total_labels := NEW.asset_count * NEW.copies_per_asset;
RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Ensure only one default template per organization
CREATE OR REPLACE FUNCTION ensure_single_default_template
()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_default = true THEN
    UPDATE label_templates 
        SET is_default = false, updated_at = NOW()
        WHERE id != NEW.id
        AND (organization_id = NEW.organization_id OR (organization_id IS NULL AND NEW.organization_id IS NULL))
        AND is_default = true;
END
IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_labels_timestamp
()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW
();
RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 7. TRIGGERS
-- =====================================================

DROP TRIGGER IF EXISTS trg_label_templates_code
ON label_templates;
CREATE TRIGGER trg_label_templates_code
    BEFORE
INSERT ON
label_templates
FOR
EACH
ROW
EXECUTE FUNCTION generate_template_code
();

DROP TRIGGER IF EXISTS trg_label_templates_timestamp
ON label_templates;
CREATE TRIGGER trg_label_templates_timestamp
    BEFORE
UPDATE ON label_templates
    FOR EACH ROW
EXECUTE FUNCTION update_labels_timestamp
();

DROP TRIGGER IF EXISTS trg_label_templates_default
ON label_templates;
CREATE TRIGGER trg_label_templates_default
    BEFORE
INSERT OR
UPDATE ON label_templates
    FOR EACH ROW
EXECUTE FUNCTION ensure_single_default_template
();

DROP TRIGGER IF EXISTS trg_print_jobs_code
ON print_jobs;
CREATE TRIGGER trg_print_jobs_code
    BEFORE
INSERT ON
print_jobs
FOR
EACH
ROW
EXECUTE FUNCTION generate_print_job_code
();

DROP TRIGGER IF EXISTS trg_print_jobs_timestamp
ON print_jobs;
CREATE TRIGGER trg_print_jobs_timestamp
    BEFORE
UPDATE ON print_jobs
    FOR EACH ROW
EXECUTE FUNCTION update_labels_timestamp
();

DROP TRIGGER IF EXISTS trg_print_jobs_total
ON print_jobs;
CREATE TRIGGER trg_print_jobs_total
    BEFORE
INSERT OR
UPDATE ON print_jobs
    FOR EACH ROW
EXECUTE FUNCTION calculate_total_labels
();

-- =====================================================
-- 8. DEFAULT TEMPLATES
-- =====================================================

INSERT INTO label_templates
    (
    name,
    description,
    label_type,
    size_preset,
    width_mm,
    height_mm,
    layout,
    fields,
    barcode_type,
    is_default,
    is_active
    )
VALUES
    (
        'Standard Barcode Label',
        'Standard barcode label with asset tag and name',
        'barcode',
        'medium',
        60,
        30,
        '{"elements": [{"type": "barcode", "x": 5, "y": 5, "width": 50, "height": 15}, {"type": "text", "field": "asset_tag", "x": 5, "y": 22, "fontSize": 10}, {"type": "text", "field": "name", "x": 5, "y": 27, "fontSize": 8}]}',
        '["asset_tag", "name", "barcode"]',
        'code128',
        true,
        true
),
    (
        'QR Code Label',
        'QR code label with asset details',
        'qrcode',
        'medium',
        50,
        50,
        '{"elements": [{"type": "qrcode", "x": 5, "y": 5, "width": 40, "height": 40}, {"type": "text", "field": "asset_tag", "x": 5, "y": 47, "fontSize": 8}]}',
        '["asset_tag", "qrcode"]',
        'qrcode',
        false,
        true
),
    (
        'Combined Label Large',
        'Large label with barcode, QR code, and full details',
        'combined',
        'large',
        100,
        50,
        '{"elements": [{"type": "barcode", "x": 5, "y": 5, "width": 60, "height": 20}, {"type": "qrcode", "x": 70, "y": 5, "width": 25, "height": 25}, {"type": "text", "field": "asset_tag", "x": 5, "y": 28, "fontSize": 12, "bold": true}, {"type": "text", "field": "name", "x": 5, "y": 36, "fontSize": 10}, {"type": "text", "field": "serial", "x": 5, "y": 43, "fontSize": 8}]}',
        '["asset_tag", "name", "serial", "barcode", "qrcode"]',
        'code128',
        false,
        true
)
ON CONFLICT DO NOTHING;

COMMENT ON TABLE label_templates IS 'Labels module: Template definitions for asset labels (Sprint 1.4)';
COMMENT ON TABLE print_jobs IS 'Labels module: Print job records and history (Sprint 1.4)';
COMMENT ON TABLE print_job_items IS 'Labels module: Individual label items in print jobs (Sprint 1.4)';
COMMENT ON TABLE label_settings IS 'Labels module: System and organization settings (Sprint 1.4)';
