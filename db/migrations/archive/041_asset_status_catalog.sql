CREATE TABLE
IF NOT EXISTS asset_status_catalogs
(
    id UUID PRIMARY KEY DEFAULT gen_random_uuid
(),
    name VARCHAR
(120) NOT NULL,
    code VARCHAR
(50) NOT NULL UNIQUE,
    is_terminal BOOLEAN NOT NULL DEFAULT FALSE,
    color VARCHAR
(32),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW
(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW
()
);

CREATE INDEX
IF NOT EXISTS idx_asset_status_catalogs_code ON asset_status_catalogs
(code);
CREATE INDEX
IF NOT EXISTS idx_asset_status_catalogs_name ON asset_status_catalogs
(name);
