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

INSERT INTO asset_status_catalogs
    (name, code, is_terminal, color)
SELECT v.name, v.code, v.is_terminal, v.color
FROM (VALUES
        ('In Stock', 'in_stock', FALSE, '#2563eb'),
        ('In Use', 'in_use', FALSE, '#16a34a'),
        ('In Repair', 'in_repair', FALSE, '#f59e0b'),
        ('Retired', 'retired', TRUE, '#6b7280'),
        ('Disposed', 'disposed', TRUE, '#dc2626'),
        ('Lost', 'lost', TRUE, '#7c3aed')
) AS v(name, code, is_terminal, color)
WHERE NOT EXISTS (
    SELECT 1
FROM asset_status_catalogs
WHERE lower(asset_status_catalogs.code) = lower(v.code)
);
