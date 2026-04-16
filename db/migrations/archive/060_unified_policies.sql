-- ============================================================================
-- Migration 060: Unified Policy System
-- Goal: Replace Classic Role (roles table) + AD ACL (rbac_acl) with a single
--       "policy" concept that can be assigned to USER / GROUP / OU at any scope.
--
-- New tables:
--   policies            — named permission set (replaces roles + rbac_roles)
--   policy_permissions  — policy → permission mapping (replaces role_permissions)
--   policy_assignments  — who gets what policy, where, with ALLOW/DENY
--
-- Old tables are kept intact for backward compat (users.role, rbac_acl, etc.)
-- ============================================================================

BEGIN;

-- ── 1. policies ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS policies (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    slug        VARCHAR(100) UNIQUE NOT NULL,
    name        VARCHAR(255) NOT NULL,
    description TEXT,
    is_system   BOOLEAN NOT NULL DEFAULT false,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_policies_slug ON policies (slug);

-- ── 2. policy_permissions ────────────────────────────────────────────────────
-- Links policies to permission keys in the classic `permissions` table.
-- Using the same `permissions` table ensures one source of truth for keys.
CREATE TABLE IF NOT EXISTS policy_permissions (
    policy_id     UUID NOT NULL REFERENCES policies(id) ON DELETE CASCADE,
    permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (policy_id, permission_id)
);

-- ── 3. policy_assignments ────────────────────────────────────────────────────
-- Who (principal) gets which policy, at what scope, with ALLOW or DENY.
-- principal_type:
--   'USER'  → principal_id = users.id  (system user)
--   'GROUP' → principal_id = rbac_groups.id
--   'OU'    → principal_id = org_units.id  (entire OU inherits)
-- scope_type:
--   'GLOBAL'   → applies everywhere (like classic users.role)
--   'OU'       → applies within scope_ou_id (+ sub-OUs if inherit=true)
--   'RESOURCE' → applies to a specific resource key
CREATE TABLE IF NOT EXISTS policy_assignments (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    policy_id       UUID NOT NULL REFERENCES policies(id) ON DELETE CASCADE,
    -- Principal
    principal_type  VARCHAR(10) NOT NULL CHECK (principal_type IN ('USER','GROUP','OU')),
    principal_id    UUID        NOT NULL,
    -- Scope
    scope_type      VARCHAR(10) NOT NULL DEFAULT 'GLOBAL'
                    CHECK (scope_type IN ('GLOBAL','OU','RESOURCE')),
    scope_ou_id     UUID        REFERENCES org_units(id) ON DELETE SET NULL,
    scope_resource  TEXT,
    -- Effect
    effect          VARCHAR(5)  NOT NULL DEFAULT 'ALLOW' CHECK (effect IN ('ALLOW','DENY')),
    inherit         BOOLEAN     NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pa_policy      ON policy_assignments (policy_id);
CREATE INDEX IF NOT EXISTS idx_pa_principal   ON policy_assignments (principal_type, principal_id);
CREATE INDEX IF NOT EXISTS idx_pa_scope_ou    ON policy_assignments (scope_ou_id) WHERE scope_ou_id IS NOT NULL;

-- ── 4. Data migration: roles → policies ──────────────────────────────────────
INSERT INTO policies (id, slug, name, description, is_system, created_at, updated_at)
SELECT id, slug, name, description, is_system, created_at, updated_at
FROM   roles
ON CONFLICT (slug) DO NOTHING;

-- ── 5. Data migration: role_permissions → policy_permissions ─────────────────
INSERT INTO policy_permissions (policy_id, permission_id)
SELECT rp.role_id, rp.permission_id
FROM   role_permissions rp
WHERE  EXISTS (SELECT 1 FROM policies p WHERE p.id = rp.role_id)
  AND  EXISTS (SELECT 1 FROM permissions pm WHERE pm.id = rp.permission_id)
ON CONFLICT DO NOTHING;

-- ── 6. Data migration: users.role → policy_assignments (GLOBAL ALLOW) ────────
-- Every active user with a non-null role gets a GLOBAL ALLOW assignment
-- so their current access is preserved in the new system.
INSERT INTO policy_assignments (policy_id, principal_type, principal_id, scope_type, effect, inherit)
SELECT
    p.id   AS policy_id,
    'USER' AS principal_type,
    u.id   AS principal_id,
    'GLOBAL',
    'ALLOW',
    true
FROM   users u
JOIN   policies p ON p.slug = u.role
WHERE  u.role IS NOT NULL
  AND  u.is_active = true
ON CONFLICT DO NOTHING;

COMMIT;
