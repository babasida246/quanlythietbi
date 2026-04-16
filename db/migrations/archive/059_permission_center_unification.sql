-- ============================================================================
-- Migration 059: Permission Center Unification
-- Goal:
--   1) Provide unified schema facade for classic RBAC + directory ACL
--   2) Migrate static users.role assignments into scoped ACL (GLOBAL, ALLOW)
--   3) Keep old tables intact for backward compatibility
-- ============================================================================

BEGIN;

-- --------------------------------------------------------------------------
-- A. Unified schema facade (read model)
-- --------------------------------------------------------------------------

CREATE OR REPLACE VIEW permission_center_roles AS
SELECT
    'classic'::text AS source,
    r.id,
    r.slug AS role_key,
    r.name,
    r.description,
    r.is_system,
    r.created_at,
    r.updated_at
FROM roles r
UNION ALL
SELECT
    'directory'::text AS source,
    rr.id,
    rr.key AS role_key,
    rr.name,
    rr.description,
    rr.is_system,
    rr.created_at,
    rr.updated_at
FROM rbac_roles rr;

CREATE OR REPLACE VIEW permission_center_permissions AS
SELECT
    'classic'::text AS source,
    p.id,
    p.name AS permission_key,
    p.description,
    p.created_at,
    NULL::timestamptz AS updated_at
FROM permissions p
UNION ALL
SELECT
    'directory'::text AS source,
    p.id,
    p.key AS permission_key,
    p.description,
    p.created_at,
    NULL::timestamptz AS updated_at
FROM rbac_ad_permissions p;

CREATE OR REPLACE VIEW permission_center_role_permissions AS
SELECT
    'classic'::text AS source,
    r.slug AS role_key,
    p.name AS permission_key,
    NULL::timestamptz AS created_at
FROM role_permissions rp
JOIN roles r ON r.id = rp.role_id
JOIN permissions p ON p.id = rp.permission_id
UNION ALL
SELECT
    'directory'::text AS source,
    rr.key AS role_key,
    p.key AS permission_key,
    NULL::timestamptz AS created_at
FROM rbac_role_ad_permissions rp
JOIN rbac_roles rr ON rr.id = rp.role_id
JOIN rbac_ad_permissions p ON p.id = rp.permission_id;

CREATE OR REPLACE VIEW permission_center_assignments AS
SELECT
    'classic'::text AS source,
    'USER'::text AS principal_type,
    ru.id AS principal_rbac_user_id,
    rr.id AS role_id,
    rr.key AS role_key,
    'GLOBAL'::text AS scope_type,
    NULL::uuid AS scope_ou_id,
    NULL::text AS scope_resource,
    'ALLOW'::text AS effect,
    true AS inherit,
    u.updated_at AS created_at
FROM users u
JOIN rbac_users ru ON ru.linked_user_id = u.id
JOIN rbac_roles rr ON rr.key = CASE
    WHEN u.role IN ('admin', 'super_admin') THEN 'full_admin'
    WHEN u.role IN ('it_asset_manager', 'it_manager', 'manager') THEN 'it_admin'
    WHEN u.role IN ('warehouse_keeper', 'warehouse_staff', 'storekeeper') THEN 'warehouse_mgr'
    WHEN u.role = 'technician' THEN 'technician'
    WHEN u.role IN ('requester', 'user', 'helpdesk') THEN 'helpdesk'
    WHEN u.role = 'viewer' THEN 'viewer'
    ELSE NULL
END
WHERE u.role IS NOT NULL
UNION ALL
SELECT
    'directory'::text AS source,
    a.principal_type,
    a.principal_user_id,
    a.role_id,
    rr.key AS role_key,
    a.scope_type,
    a.scope_ou_id,
    a.scope_resource,
    a.effect,
    a.inherit,
    a.created_at
FROM rbac_acl a
JOIN rbac_roles rr ON rr.id = a.role_id
WHERE a.principal_type = 'USER';

-- --------------------------------------------------------------------------
-- B. Data migration: static role -> ACL GLOBAL ALLOW
-- --------------------------------------------------------------------------

WITH mapped AS (
    SELECT
        ru.id AS rbac_user_id,
        rr.id AS role_id
    FROM users u
    JOIN rbac_users ru ON ru.linked_user_id = u.id
    JOIN rbac_roles rr ON rr.key = CASE
        WHEN u.role IN ('admin', 'super_admin') THEN 'full_admin'
        WHEN u.role IN ('it_asset_manager', 'it_manager', 'manager') THEN 'it_admin'
        WHEN u.role IN ('warehouse_keeper', 'warehouse_staff', 'storekeeper') THEN 'warehouse_mgr'
        WHEN u.role = 'technician' THEN 'technician'
        WHEN u.role IN ('requester', 'user', 'helpdesk') THEN 'helpdesk'
        WHEN u.role = 'viewer' THEN 'viewer'
        ELSE NULL
    END
    WHERE u.role IS NOT NULL
)
INSERT INTO rbac_acl (
    principal_type,
    principal_user_id,
    principal_group_id,
    role_id,
    scope_type,
    scope_ou_id,
    scope_resource,
    effect,
    inherit,
    created_by
)
SELECT
    'USER',
    m.rbac_user_id,
    NULL,
    m.role_id,
    'GLOBAL',
    NULL,
    NULL,
    'ALLOW',
    true,
    NULL
FROM mapped m
WHERE NOT EXISTS (
    SELECT 1
    FROM rbac_acl a
    WHERE a.principal_type = 'USER'
      AND a.principal_user_id = m.rbac_user_id
      AND a.role_id = m.role_id
      AND a.scope_type = 'GLOBAL'
      AND a.effect = 'ALLOW'
);

COMMIT;
