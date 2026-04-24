-- Migration 072: User location access control
-- Grants specific users access to manage assets at specific physical locations.

CREATE TABLE IF NOT EXISTS user_location_access (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    location_id UUID        NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, location_id)
);

CREATE INDEX IF NOT EXISTS idx_user_location_access_user_id     ON user_location_access(user_id);
CREATE INDEX IF NOT EXISTS idx_user_location_access_location_id ON user_location_access(location_id);
