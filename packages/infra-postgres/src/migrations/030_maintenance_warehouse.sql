-- Maintenance & Warehouse schema
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS warehouses
(
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_warehouses_code ON warehouses(code);
CREATE INDEX IF NOT EXISTS idx_warehouses_location ON warehouses(location_id);

CREATE TABLE IF NOT EXISTS spare_parts
(
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    part_code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    category TEXT,
    uom TEXT DEFAULT 'pcs',
    manufacturer TEXT,
    model TEXT,
    spec JSONB DEFAULT '{}',
    min_level INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_spare_parts_code ON spare_parts(part_code);
CREATE INDEX IF NOT EXISTS idx_spare_parts_name ON spare_parts(name);

CREATE TABLE IF NOT EXISTS spare_part_stock
(
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
    part_id UUID NOT NULL REFERENCES spare_parts(id) ON DELETE CASCADE,
    on_hand INT NOT NULL DEFAULT 0,
    reserved INT NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (warehouse_id, part_id)
);
CREATE INDEX IF NOT EXISTS idx_spare_part_stock_lookup ON spare_part_stock(warehouse_id, part_id);

CREATE TABLE IF NOT EXISTS stock_documents
(
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    doc_type TEXT NOT NULL CHECK (doc_type IN ('receipt','issue','adjust','transfer')),
    code TEXT UNIQUE NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('draft','submitted','approved','posted','canceled')),
    warehouse_id UUID REFERENCES warehouses(id) ON DELETE SET NULL,
    target_warehouse_id UUID REFERENCES warehouses(id) ON DELETE SET NULL,
    doc_date DATE NOT NULL DEFAULT CURRENT_DATE,
    ref_type TEXT,
    ref_id UUID,
    note TEXT,
    created_by TEXT,
    approved_by TEXT,
    correlation_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_stock_documents_status ON stock_documents(status, doc_date DESC);

CREATE TABLE IF NOT EXISTS stock_document_lines
(
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL REFERENCES stock_documents(id) ON DELETE CASCADE,
    part_id UUID NOT NULL REFERENCES spare_parts(id),
    qty INT NOT NULL CHECK (qty > 0),
    unit_cost NUMERIC(12,2),
    serial_no TEXT,
    note TEXT
);
CREATE INDEX IF NOT EXISTS idx_stock_document_lines_doc ON stock_document_lines(document_id);

CREATE TABLE IF NOT EXISTS spare_part_movements
(
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
    part_id UUID NOT NULL REFERENCES spare_parts(id) ON DELETE CASCADE,
    movement_type TEXT NOT NULL CHECK (movement_type IN ('in','out','adjust_in','adjust_out','transfer_in','transfer_out','reserve','release')),
    qty INT NOT NULL CHECK (qty > 0),
    unit_cost NUMERIC(12,2),
    ref_type TEXT,
    ref_id UUID,
    actor_user_id TEXT,
    correlation_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_spare_part_movements_part ON spare_part_movements(part_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_spare_part_movements_warehouse ON spare_part_movements(warehouse_id, created_at DESC);

CREATE TABLE IF NOT EXISTS repair_orders
(
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    code TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    severity TEXT NOT NULL CHECK (severity IN ('low','medium','high','critical')),
    status TEXT NOT NULL CHECK (status IN ('open','diagnosing','waiting_parts','repaired','closed','canceled')),
    opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    closed_at TIMESTAMPTZ,
    diagnosis TEXT,
    resolution TEXT,
    repair_type TEXT NOT NULL CHECK (repair_type IN ('internal','vendor')),
    technician_name TEXT,
    vendor_id UUID REFERENCES vendors(id) ON DELETE SET NULL,
    labor_cost NUMERIC(12,2) DEFAULT 0,
    parts_cost NUMERIC(12,2) DEFAULT 0,
    downtime_minutes INT,
    created_by TEXT,
    correlation_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_repair_orders_asset ON repair_orders(asset_id, opened_at DESC);
CREATE INDEX IF NOT EXISTS idx_repair_orders_status ON repair_orders(status, opened_at DESC);

CREATE TABLE IF NOT EXISTS repair_order_parts
(
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    repair_order_id UUID NOT NULL REFERENCES repair_orders(id) ON DELETE CASCADE,
    part_id UUID REFERENCES spare_parts(id) ON DELETE SET NULL,
    part_name TEXT,
    warehouse_id UUID REFERENCES warehouses(id) ON DELETE SET NULL,
    action TEXT NOT NULL CHECK (action IN ('replace','add','remove','upgrade')),
    qty INT NOT NULL CHECK (qty > 0),
    unit_cost NUMERIC(12,2),
    serial_no TEXT,
    note TEXT,
    stock_document_id UUID REFERENCES stock_documents(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_repair_order_parts_order ON repair_order_parts(repair_order_id, created_at ASC);

CREATE TABLE IF NOT EXISTS attachments
(
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entity_type TEXT NOT NULL CHECK (entity_type IN ('repair_order','stock_document')),
    entity_id UUID NOT NULL,
    file_name TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    storage_key TEXT NOT NULL,
    size_bytes BIGINT,
    version INT NOT NULL DEFAULT 1,
    uploaded_by TEXT,
    correlation_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_attachments_entity ON attachments(entity_type, entity_id, created_at DESC);

CREATE TABLE IF NOT EXISTS ops_events
(
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entity_type TEXT NOT NULL CHECK (entity_type IN ('repair_order','stock_document','spare_part','warehouse')),
    entity_id UUID NOT NULL,
    event_type TEXT NOT NULL,
    payload JSONB DEFAULT '{}',
    actor_user_id TEXT,
    correlation_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ops_events_entity ON ops_events(entity_type, entity_id, created_at DESC);
