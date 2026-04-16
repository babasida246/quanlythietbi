-- Assets Phase 2/3 schema updates
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Locations path for fast tree queries
ALTER TABLE locations ADD COLUMN IF NOT EXISTS path TEXT;
UPDATE locations SET path = COALESCE(path, '/' || id::text);
ALTER TABLE locations ALTER COLUMN path SET DEFAULT '/';
ALTER TABLE locations ALTER COLUMN path SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_locations_path ON locations(path);

-- Ensure model_id is not null for assets (seed default catalog entries if needed)
DO $$
DECLARE
    default_vendor_id uuid;
    default_category_id uuid;
    default_model_id uuid;
BEGIN
    SELECT id INTO default_vendor_id FROM vendors WHERE name = 'Unknown' LIMIT 1;
    IF default_vendor_id IS NULL THEN
        INSERT INTO vendors (name) VALUES ('Unknown') RETURNING id INTO default_vendor_id;
    END IF;

    SELECT id INTO default_category_id FROM asset_categories WHERE name = 'Uncategorized' LIMIT 1;
    IF default_category_id IS NULL THEN
        INSERT INTO asset_categories (name) VALUES ('Uncategorized') RETURNING id INTO default_category_id;
    END IF;

    SELECT id INTO default_model_id
    FROM asset_models
    WHERE model = 'Unknown'
      AND vendor_id = default_vendor_id
      AND category_id = default_category_id
    LIMIT 1;

    IF default_model_id IS NULL THEN
        INSERT INTO asset_models (category_id, vendor_id, brand, model, spec)
        VALUES (default_category_id, default_vendor_id, 'Unknown', 'Unknown', '{}'::jsonb)
        RETURNING id INTO default_model_id;
    END IF;

    UPDATE assets SET model_id = default_model_id WHERE model_id IS NULL;
END $$;

ALTER TABLE assets ALTER COLUMN model_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_assets_warranty_end ON assets(warranty_end);

-- Enforce assignee_id not null
UPDATE asset_assignments SET assignee_id = COALESCE(assignee_id, 'unknown') WHERE assignee_id IS NULL;
ALTER TABLE asset_assignments ALTER COLUMN assignee_id SET NOT NULL;

-- Attachments
CREATE TABLE IF NOT EXISTS asset_attachments
(
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    file_name TEXT,
    mime_type TEXT,
    storage_key TEXT,
    size_bytes BIGINT,
    version INT NOT NULL,
    uploaded_by TEXT,
    correlation_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_asset_attachments_asset ON asset_attachments(asset_id, created_at DESC);

-- Inventory
CREATE TABLE IF NOT EXISTS inventory_sessions
(
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
    status TEXT NOT NULL CHECK (status IN ('draft','in_progress','closed','canceled')),
    started_at TIMESTAMPTZ,
    closed_at TIMESTAMPTZ,
    created_by TEXT,
    correlation_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_inventory_sessions_status ON inventory_sessions(status);
CREATE INDEX IF NOT EXISTS idx_inventory_sessions_created ON inventory_sessions(created_at DESC);

CREATE TABLE IF NOT EXISTS inventory_items
(
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES inventory_sessions(id) ON DELETE CASCADE,
    asset_id UUID REFERENCES assets(id) ON DELETE SET NULL,
    expected_location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
    scanned_location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
    scanned_at TIMESTAMPTZ,
    status TEXT NOT NULL CHECK (status IN ('found','missing','moved','unknown')),
    note TEXT
);
CREATE INDEX IF NOT EXISTS idx_inventory_items_session ON inventory_items(session_id);

-- Workflow requests
CREATE TABLE IF NOT EXISTS workflow_requests
(
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    request_type TEXT NOT NULL CHECK (request_type IN ('assign','return','move','repair','dispose','issue_stock')),
    asset_id UUID REFERENCES assets(id) ON DELETE SET NULL,
    from_dept TEXT,
    to_dept TEXT,
    requested_by TEXT,
    approved_by TEXT,
    status TEXT NOT NULL CHECK (status IN ('submitted','approved','rejected','in_progress','done','canceled')),
    payload JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    correlation_id TEXT
);
CREATE INDEX IF NOT EXISTS idx_workflow_requests_status ON workflow_requests(status, created_at DESC);

-- Reminders
CREATE TABLE IF NOT EXISTS reminders
(
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reminder_type TEXT NOT NULL CHECK (reminder_type IN ('warranty_expiring','maintenance_due')),
    asset_id UUID REFERENCES assets(id) ON DELETE CASCADE,
    due_at TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending','sent','canceled')),
    channel TEXT NOT NULL DEFAULT 'ui',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    sent_at TIMESTAMPTZ,
    correlation_id TEXT
);
CREATE INDEX IF NOT EXISTS idx_reminders_status ON reminders(status, due_at);
