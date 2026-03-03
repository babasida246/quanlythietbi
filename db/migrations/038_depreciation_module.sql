-- Depreciation Module Migration
-- Asset depreciation schedules and entries management

-- =====================================================
-- 1. DEPRECIATION SCHEDULES TABLE
-- =====================================================

CREATE TABLE
IF NOT EXISTS depreciation_schedules
(
    id UUID PRIMARY KEY DEFAULT gen_random_uuid
(),
    asset_id UUID NOT NULL REFERENCES assets
(id) ON
DELETE RESTRICT,
    depreciation_method VARCHAR(30)
NOT NULL DEFAULT 'straight_line',
    original_cost DECIMAL
(18, 2) NOT NULL,
    salvage_value DECIMAL
(18, 2) NOT NULL DEFAULT 0,
    useful_life_years INTEGER NOT NULL,
    useful_life_months INTEGER GENERATED ALWAYS AS
(useful_life_years * 12) STORED,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    monthly_depreciation DECIMAL
(18, 2) NOT NULL,
    accumulated_depreciation DECIMAL
(18, 2) NOT NULL DEFAULT 0,
    book_value DECIMAL
(18, 2) NOT NULL,
    currency VARCHAR
(3) NOT NULL DEFAULT 'VND',
    status VARCHAR
(20) NOT NULL DEFAULT 'active',
    stopped_at DATE,
    stopped_reason TEXT,
    notes TEXT,
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
    
    CONSTRAINT chk_depreciation_method CHECK
(depreciation_method IN
(
        'straight_line', 'declining_balance', 'double_declining', 
        'sum_of_years', 'units_of_production'
    )),
    CONSTRAINT chk_schedule_status CHECK
(status IN
('active', 'fully_depreciated', 'stopped')),
    CONSTRAINT chk_salvage_less_than_cost CHECK
(salvage_value <= original_cost),
    CONSTRAINT chk_positive_cost CHECK
(original_cost > 0),
    CONSTRAINT chk_positive_life CHECK
(useful_life_years > 0),
    CONSTRAINT chk_non_negative_book CHECK
(book_value >= 0),
    CONSTRAINT uk_asset_active_schedule UNIQUE
(asset_id) -- DEP-R01: One active schedule per asset
);

CREATE INDEX
IF NOT EXISTS idx_depreciation_schedules_asset ON depreciation_schedules
(asset_id);
CREATE INDEX
IF NOT EXISTS idx_depreciation_schedules_status ON depreciation_schedules
(status);
CREATE INDEX
IF NOT EXISTS idx_depreciation_schedules_end_date ON depreciation_schedules
(end_date);
CREATE INDEX
IF NOT EXISTS idx_depreciation_schedules_organization ON depreciation_schedules
(organization_id);

COMMENT ON TABLE depreciation_schedules IS 'Depreciation schedules for assets';
COMMENT ON COLUMN depreciation_schedules.book_value IS 'Current book value = original_cost - accumulated_depreciation';

-- =====================================================
-- 2. DEPRECIATION ENTRIES TABLE
-- =====================================================

CREATE TABLE
IF NOT EXISTS depreciation_entries
(
    id UUID PRIMARY KEY DEFAULT gen_random_uuid
(),
    schedule_id UUID NOT NULL REFERENCES depreciation_schedules
(id) ON
DELETE CASCADE,
    asset_id UUID
NOT NULL REFERENCES assets
(id) ON
DELETE RESTRICT,
    period_year INTEGER
NOT NULL,
    period_month INTEGER NOT NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    depreciation_amount DECIMAL
(18, 2) NOT NULL,
    accumulated_after DECIMAL
(18, 2) NOT NULL,
    book_value_after DECIMAL
(18, 2) NOT NULL,
    entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
    is_posted BOOLEAN DEFAULT false,
    posted_at TIMESTAMPTZ,
    posted_by UUID REFERENCES users
(id) ON
DELETE
SET NULL
,
    is_adjustment BOOLEAN DEFAULT false,
    adjustment_reason TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW
(),
    
    CONSTRAINT chk_period_month CHECK
(period_month >= 1 AND period_month <= 12),
    CONSTRAINT chk_non_negative_amount CHECK
(depreciation_amount >= 0),
    CONSTRAINT uk_schedule_period UNIQUE
(schedule_id, period_year, period_month)
);

CREATE INDEX
IF NOT EXISTS idx_depreciation_entries_schedule ON depreciation_entries
(schedule_id);
CREATE INDEX
IF NOT EXISTS idx_depreciation_entries_asset ON depreciation_entries
(asset_id);
CREATE INDEX
IF NOT EXISTS idx_depreciation_entries_period ON depreciation_entries
(period_year, period_month);
CREATE INDEX
IF NOT EXISTS idx_depreciation_entries_posted ON depreciation_entries
(is_posted);
CREATE INDEX
IF NOT EXISTS idx_depreciation_entries_entry_date ON depreciation_entries
(entry_date);

COMMENT ON TABLE depreciation_entries IS 'Monthly depreciation entries/transactions';

-- =====================================================
-- 3. DEPRECIATION RUN LOG TABLE
-- =====================================================

CREATE TABLE
IF NOT EXISTS depreciation_runs
(
    id UUID PRIMARY KEY DEFAULT gen_random_uuid
(),
    run_code VARCHAR
(50) NOT NULL UNIQUE,
    period_year INTEGER NOT NULL,
    period_month INTEGER NOT NULL,
    run_type VARCHAR
(20) NOT NULL DEFAULT 'monthly',  -- monthly, adjustment, closing
    status VARCHAR
(20) NOT NULL DEFAULT 'pending',     -- pending, processing, completed, failed
    entries_created INTEGER DEFAULT 0,
    entries_posted INTEGER DEFAULT 0,
    total_depreciation DECIMAL
(18, 2) DEFAULT 0,
    error_message TEXT,
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
    
    CONSTRAINT chk_run_type CHECK
(run_type IN
('monthly', 'adjustment', 'closing')),
    CONSTRAINT chk_run_status CHECK
(status IN
('pending', 'processing', 'completed', 'failed'))
);

CREATE INDEX
IF NOT EXISTS idx_depreciation_runs_period ON depreciation_runs
(period_year, period_month);
CREATE INDEX
IF NOT EXISTS idx_depreciation_runs_status ON depreciation_runs
(status);
CREATE INDEX
IF NOT EXISTS idx_depreciation_runs_organization ON depreciation_runs
(organization_id);

COMMENT ON TABLE depreciation_runs IS 'Depreciation run history and logs';

-- =====================================================
-- 4. DEPRECIATION SETTINGS TABLE
-- =====================================================

CREATE TABLE
IF NOT EXISTS depreciation_settings
(
    id UUID PRIMARY KEY DEFAULT gen_random_uuid
(),
    setting_key VARCHAR
(100) NOT NULL,
    setting_value TEXT,
    value_type VARCHAR
(20) DEFAULT 'string',
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
    
    CONSTRAINT uk_depreciation_settings_key_org UNIQUE
(setting_key, organization_id)
);

-- Insert default settings
INSERT INTO depreciation_settings
    (setting_key, setting_value, value_type, description)
VALUES
    ('default_method', 'straight_line', 'string', 'Default depreciation method'),
    ('default_useful_life', '3', 'number', 'Default useful life in years'),
    ('auto_run_day', '1', 'number', 'Day of month to auto-run depreciation'),
    ('fiscal_year_start_month', '1', 'number', 'Fiscal year start month (1-12)'),
    ('round_to_nearest', '1', 'number', 'Round depreciation to nearest value'),
    ('warn_ending_months', '6', 'number', 'Warn when depreciation ends in X months')
ON CONFLICT DO NOTHING;

-- =====================================================
-- 5. VIEWS
-- =====================================================

-- Active depreciation schedules with asset info
CREATE OR REPLACE VIEW v_depreciation_schedules AS
SELECT
    ds.*,
    a.asset_code,
    a.asset_code as asset_name,
    ac.name as category_name,
    u.name as created_by_name,
    ROUND((ds.accumulated_depreciation / NULLIF(ds.original_cost - ds.salvage_value, 0)) * 100, 2) as percent_depreciated,
    DATE_PART('month', AGE(ds.end_date, CURRENT_DATE)) + 
        DATE_PART('year', AGE(ds.end_date, CURRENT_DATE)) * 12 as months_remaining,
    CASE 
        WHEN ds.status = 'fully_depreciated' THEN 0
        WHEN ds.end_date <= CURRENT_DATE + INTERVAL '6 months' THEN 1
        ELSE 2
    END as urgency_level
FROM depreciation_schedules ds
    JOIN assets a ON ds.asset_id = a.id
    LEFT JOIN asset_models am ON a.model_id = am.id
    LEFT JOIN asset_categories ac ON am.category_id = ac.id
    LEFT JOIN users u ON ds.created_by = u.id;

-- Pending entries view
CREATE OR REPLACE VIEW v_pending_depreciation_entries AS
SELECT
    de.*,
    ds.depreciation_method,
    a.asset_code,
    a.asset_code as asset_name
FROM depreciation_entries de
    JOIN depreciation_schedules ds ON de.schedule_id = ds.id
    JOIN assets a ON de.asset_id = a.id
WHERE de.is_posted = false
ORDER BY de.period_year, de.period_month, a.asset_code;

-- Depreciation summary by category
CREATE OR REPLACE VIEW v_depreciation_by_category AS
SELECT
    ac.id as category_id,
    ac.name as category_name,
    COUNT(ds.id) as asset_count,
    SUM(ds.original_cost) as total_original_cost,
    SUM(ds.accumulated_depreciation) as total_accumulated,
    SUM(ds.book_value) as total_book_value,
    AVG(ROUND((ds.accumulated_depreciation / NULLIF(ds.original_cost - ds.salvage_value, 0)) * 100, 2)) as avg_percent_depreciated
FROM depreciation_schedules ds
    JOIN assets a ON ds.asset_id = a.id
    JOIN asset_models am ON a.model_id = am.id
    JOIN asset_categories ac ON am.category_id = ac.id
WHERE ds.status = 'active'
GROUP BY ac.id, ac.name;

-- Monthly depreciation summary
CREATE OR REPLACE VIEW v_monthly_depreciation_summary AS
SELECT
    period_year,
    period_month,
    COUNT(*) as entry_count,
    SUM(depreciation_amount) as total_depreciation,
    SUM(CASE WHEN is_posted THEN depreciation_amount ELSE 0 END) as posted_amount,
    SUM(CASE WHEN NOT is_posted THEN depreciation_amount ELSE 0 END) as pending_amount,
    COUNT(CASE WHEN is_posted THEN 1 END) as posted_count,
    COUNT(CASE WHEN NOT is_posted THEN 1 END) as pending_count
FROM depreciation_entries
GROUP BY period_year, period_month
ORDER BY period_year DESC, period_month DESC;

-- =====================================================
-- 6. FUNCTIONS
-- =====================================================

-- Generate run code
CREATE OR REPLACE FUNCTION generate_depreciation_run_code
()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.run_code IS NULL OR NEW.run_code = '' THEN
        NEW.run_code := 'DEP-' || TO_CHAR
    (NOW
    (), 'YYYYMMDD') || '-' || 
                        LPAD
    (NEXTVAL
    ('depreciation_run_code_seq')::TEXT, 4, '0');
END
IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE SEQUENCE
IF NOT EXISTS depreciation_run_code_seq START 1;

-- Calculate straight-line depreciation
CREATE OR REPLACE FUNCTION calculate_straight_line_depreciation
(
    p_original_cost DECIMAL,
    p_salvage_value DECIMAL,
    p_useful_life_months INTEGER
) RETURNS DECIMAL AS $$
BEGIN
    RETURN ROUND((p_original_cost - p_salvage_value) / p_useful_life_months, 2);
END;
$$ LANGUAGE plpgsql;

-- Calculate end date based on start and useful life
CREATE OR REPLACE FUNCTION calculate_depreciation_end_date
(
    p_start_date DATE,
    p_useful_life_years INTEGER
) RETURNS DATE AS $$
BEGIN
    RETURN (p_start_date + (p_useful_life_years * INTERVAL
    '1 year') - INTERVAL '1 day')::DATE;
END;
$$ LANGUAGE plpgsql;

-- Update schedule values after posting entry
CREATE OR REPLACE FUNCTION update_schedule_after_post
()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_posted = true AND OLD.is_posted = false THEN
    UPDATE depreciation_schedules
        SET 
            accumulated_depreciation = NEW.accumulated_after,
            book_value = NEW.book_value_after,
            status = CASE 
                WHEN NEW.book_value_after <= salvage_value THEN 'fully_depreciated'
                ELSE status
            END,
            updated_at = NOW()
        WHERE id = NEW.schedule_id;
END
IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_depreciation_timestamp
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

DROP TRIGGER IF EXISTS trg_depreciation_runs_code
ON depreciation_runs;
CREATE TRIGGER trg_depreciation_runs_code
    BEFORE
INSERT ON
depreciation_runs
FOR
EACH
ROW
EXECUTE FUNCTION generate_depreciation_run_code
();

DROP TRIGGER IF EXISTS trg_depreciation_schedules_timestamp
ON depreciation_schedules;
CREATE TRIGGER trg_depreciation_schedules_timestamp
    BEFORE
UPDATE ON depreciation_schedules
    FOR EACH ROW
EXECUTE FUNCTION update_depreciation_timestamp
();

DROP TRIGGER IF EXISTS trg_depreciation_entry_posted
ON depreciation_entries;
CREATE TRIGGER trg_depreciation_entry_posted
    AFTER
UPDATE ON depreciation_entries
    FOR EACH ROW
WHEN
(NEW.is_posted = true AND OLD.is_posted = false)
EXECUTE FUNCTION update_schedule_after_post
();

-- =====================================================
-- 8. INDEXES FOR REPORTING
-- =====================================================

CREATE INDEX
IF NOT EXISTS idx_entries_period_posted ON depreciation_entries
(period_year, period_month, is_posted);
CREATE INDEX
IF NOT EXISTS idx_schedules_ending_soon ON depreciation_schedules
(end_date) 
    WHERE status = 'active';

COMMENT ON TABLE depreciation_schedules IS 'Depreciation module: Asset depreciation schedules (Sprint 1.4)';
COMMENT ON TABLE depreciation_entries IS 'Depreciation module: Monthly depreciation entries (Sprint 1.4)';
COMMENT ON TABLE depreciation_runs IS 'Depreciation module: Depreciation run logs (Sprint 1.4)';
COMMENT ON TABLE depreciation_settings IS 'Depreciation module: System settings (Sprint 1.4)';
