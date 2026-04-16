-- ============================================================================
-- Migration 061: Complete AD + Classic Permission Namespace Unification
--
-- Goal: One permission namespace, one role/policy model, one assignment table.
--   1. Add AD-only permission keys to canonical `permissions` table
--   2. Migrate rbac_roles → policies  (new AD roles; merge overlapping ones)
--   3. Migrate rbac_role_ad_permissions → policy_permissions  (via alias map)
--   4. Migrate rbac_acl → policy_assignments  (USER + GROUP)
--
-- After this migration PermissionCenterService can drop the directory source.
-- Old tables (rbac_roles, rbac_acl, rbac_ad_permissions, rbac_role_ad_permissions)
-- are kept intact for backward compat with AdRbacPanel / structural management.
-- ============================================================================

BEGIN;

-- --------------------------------------------------------------------------
-- Step 1: Add AD-only permissions that have no classic equivalent
-- --------------------------------------------------------------------------
INSERT INTO permissions (name, resource, action, description)
VALUES
    ('tool:network_change:execute', 'tool', 'network_change:execute', 'Thực thi thay đổi mạng'),
    ('tool:server_restart:execute', 'tool', 'server_restart:execute', 'Thực thi khởi động lại server'),
    ('tool:db_migration:execute',   'tool', 'db_migration:execute',   'Thực thi migration DB')
ON CONFLICT (name) DO NOTHING;

-- --------------------------------------------------------------------------
-- Step 2: Migrate rbac_roles → policies
-- Skip roles that already exist in policies (technician, viewer were migrated
-- from classic roles in 060); insert only net-new AD roles.
-- --------------------------------------------------------------------------
INSERT INTO policies (id, slug, name, description, is_system, created_at, updated_at)
SELECT rr.id, rr.key, rr.name, rr.description, rr.is_system, rr.created_at, rr.updated_at
FROM   rbac_roles rr
WHERE  NOT EXISTS (SELECT 1 FROM policies p WHERE p.slug = rr.key)
ON CONFLICT (slug) DO NOTHING;

-- --------------------------------------------------------------------------
-- Step 3: Migrate rbac_role_ad_permissions → policy_permissions
-- Use an alias table to map AD singular keys → canonical classic plural keys.
-- AD route/site/tab directive keys have no alias entry and are silently skipped.
-- --------------------------------------------------------------------------
CREATE TEMP TABLE IF NOT EXISTS _ad_perm_alias (
    ad_key       TEXT PRIMARY KEY,
    canonical_key TEXT NOT NULL
);

INSERT INTO _ad_perm_alias (ad_key, canonical_key) VALUES
    -- Singular (AD) → Plural (Classic) aliases
    ('asset:read',          'assets:read'),
    ('asset:create',        'assets:create'),
    ('asset:update',        'assets:update'),
    ('asset:delete',        'assets:delete'),
    ('asset:export',        'assets:export'),
    ('asset:import',        'assets:import'),
    ('asset:assign',        'assets:assign'),
    ('category:read',       'categories:read'),
    ('category:manage',     'categories:manage'),
    ('request:read',        'requests:read'),
    ('request:create',      'requests:create'),
    ('request:approve',     'requests:approve'),
    ('report:read',         'reports:read'),
    ('report:export',       'reports:export'),
    ('document:read',       'documents:read'),
    ('document:upload',     'documents:upload'),
    ('document:delete',     'documents:delete'),
    -- Identical keys in both systems
    ('cmdb:read',           'cmdb:read'),
    ('cmdb:create',         'cmdb:create'),
    ('cmdb:update',         'cmdb:update'),
    ('cmdb:delete',         'cmdb:delete'),
    ('warehouse:read',      'warehouse:read'),
    ('warehouse:create',    'warehouse:create'),
    ('warehouse:approve',   'warehouse:approve'),
    ('inventory:read',      'inventory:read'),
    ('inventory:create',    'inventory:create'),
    ('inventory:manage',    'inventory:manage'),
    ('maintenance:read',    'maintenance:read'),
    ('maintenance:create',  'maintenance:create'),
    ('maintenance:manage',  'maintenance:manage'),
    ('analytics:read',      'analytics:read'),
    ('security:read',       'security:read'),
    ('security:manage',     'security:manage'),
    ('rbac:admin',          'rbac:admin'),
    ('rbac:ou:manage',      'rbac:ou:manage'),
    ('rbac:user:manage',    'rbac:user:manage'),
    ('rbac:group:manage',   'rbac:group:manage'),
    -- AD-only → new canonical keys added in Step 1
    ('tool:network_change:execute', 'tool:network_change:execute'),
    ('tool:server_restart:execute', 'tool:server_restart:execute'),
    ('tool:db_migration:execute',   'tool:db_migration:execute')
ON CONFLICT (ad_key) DO NOTHING;

INSERT INTO policy_permissions (policy_id, permission_id)
SELECT
    pol.id AS policy_id,
    pm.id  AS permission_id
FROM   rbac_role_ad_permissions rrap
JOIN   rbac_roles        rr  ON rr.id   = rrap.role_id
JOIN   rbac_ad_permissions adp ON adp.id = rrap.permission_id
JOIN   _ad_perm_alias    apa ON apa.ad_key       = adp.key
JOIN   permissions       pm  ON pm.name           = apa.canonical_key
JOIN   policies          pol ON pol.slug           = rr.key
ON CONFLICT DO NOTHING;

-- --------------------------------------------------------------------------
-- Step 4a: Migrate rbac_acl USER assignments → policy_assignments
-- rbac_acl.principal_user_id is rbac_users.id; resolve to users.id via linked_user_id
-- --------------------------------------------------------------------------
INSERT INTO policy_assignments
    (policy_id, principal_type, principal_id,
     scope_type, scope_ou_id, scope_resource, effect, inherit)
SELECT
    pol.id            AS policy_id,
    'USER'            AS principal_type,
    ru.linked_user_id AS principal_id,
    a.scope_type,
    a.scope_ou_id,
    a.scope_resource,
    a.effect,
    a.inherit
FROM   rbac_acl   a
JOIN   rbac_roles rr  ON rr.id   = a.role_id
JOIN   policies   pol ON pol.slug = rr.key
JOIN   rbac_users ru  ON ru.id   = a.principal_user_id
WHERE  a.principal_type    = 'USER'
  AND  ru.linked_user_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- --------------------------------------------------------------------------
-- Step 4b: Migrate rbac_acl GROUP assignments → policy_assignments
-- principal_group_id is rbac_groups.id — same UUID used in policy_assignments
-- --------------------------------------------------------------------------
INSERT INTO policy_assignments
    (policy_id, principal_type, principal_id,
     scope_type, scope_ou_id, scope_resource, effect, inherit)
SELECT
    pol.id               AS policy_id,
    'GROUP'              AS principal_type,
    a.principal_group_id AS principal_id,
    a.scope_type,
    a.scope_ou_id,
    a.scope_resource,
    a.effect,
    a.inherit
FROM   rbac_acl   a
JOIN   rbac_roles rr  ON rr.id   = a.role_id
JOIN   policies   pol ON pol.slug = rr.key
WHERE  a.principal_type    = 'GROUP'
  AND  a.principal_group_id IS NOT NULL
ON CONFLICT DO NOTHING;

COMMIT;
