-- Add asset status catalogs table for assets UI/API catalogs endpoints
CREATE TABLE IF NOT EXISTS asset_status_catalogs
(
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    code TEXT NOT NULL,
    is_terminal BOOLEAN NOT NULL DEFAULT FALSE,
    color TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'asset_status_catalogs_pkey'
          AND conrelid = 'asset_status_catalogs'::regclass
    ) THEN
        ALTER TABLE asset_status_catalogs
            ADD CONSTRAINT asset_status_catalogs_pkey PRIMARY KEY (id);
    END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_asset_status_catalogs_code ON asset_status_catalogs (lower(code));
CREATE UNIQUE INDEX IF NOT EXISTS uq_asset_status_catalogs_name ON asset_status_catalogs (lower(name));
CREATE INDEX IF NOT EXISTS idx_asset_status_catalogs_terminal ON asset_status_catalogs (is_terminal);

INSERT INTO asset_status_catalogs (name, code, is_terminal, color)
VALUES
    ('In stock', 'in_stock', FALSE, '#22c55e'),
    ('In use', 'in_use', FALSE, '#3b82f6'),
    ('In repair', 'in_repair', FALSE, '#f59e0b'),
    ('Retired', 'retired', TRUE, '#64748b'),
    ('Disposed', 'disposed', TRUE, '#ef4444')
ON CONFLICT DO NOTHING;
