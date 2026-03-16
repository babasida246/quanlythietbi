-- =============================================================================
-- SEED: AD RBAC RESOURCE REGISTRY KEYS + ROLE MAPPING HELPERS
-- =============================================================================
BEGIN;

-- 1) Ensure AD RBAC roles exist for classic RBAC slug mapping.
INSERT INTO rbac_roles ("key", name, description, is_system)
VALUES
    ('super_admin', 'Super Admin', 'Full access role for AD RBAC', true),
    ('it_asset_manager', 'IT Asset Manager', 'Classic RBAC compatibility role', true),
    ('warehouse_keeper', 'Warehouse Keeper', 'Classic RBAC compatibility role', true),
    ('technician', 'Technician', 'Classic RBAC compatibility role', true),
    ('requester', 'Requester', 'Classic RBAC compatibility role', true),
    ('role:admin', 'Role: Admin', 'Classic RBAC role mapping key', true),
    ('role:super_admin', 'Role: Super Admin', 'Classic RBAC role mapping key', true),
    ('role:it_asset_manager', 'Role: IT Asset Manager', 'Classic RBAC role mapping key', true),
    ('role:warehouse_keeper', 'Role: Warehouse Keeper', 'Classic RBAC role mapping key', true),
    ('role:technician', 'Role: Technician', 'Classic RBAC role mapping key', true),
    ('role:requester', 'Role: Requester', 'Classic RBAC role mapping key', true),
    ('role:user', 'Role: User', 'Classic RBAC role mapping key', true),
    ('role:viewer', 'Role: Viewer', 'Classic RBAC role mapping key', true)
ON CONFLICT ("key") DO NOTHING;

-- 2) Seed route/site/tab directives for Resource Registry and ACL RESOURCE scope.
INSERT INTO rbac_ad_permissions ("key", description)
VALUES
    ('route:allow:/warehouse/*', 'Allow all warehouse routes'),
    ('route:allow:/assets/*', 'Allow all asset routes'),
    ('route:allow:/maintenance/*', 'Allow all maintenance routes'),
    ('route:allow:/reports/*', 'Allow all reports routes'),
    ('route:deny:/warehouse/*', 'Deny all warehouse routes'),
    ('route:deny:/admin/*', 'Deny all admin routes'),
    ('site:hidden:/analytics', 'Hide analytics site in navigation'),
    ('site:hidden:/integrations', 'Hide integrations site in navigation'),
    ('site:hidden:/security', 'Hide security site in navigation'),
    ('tab:hidden:/automation/rules', 'Hide automation rules tab'),
    ('tab:hidden:/automation/notifications', 'Hide automation notifications tab'),
    ('tab:hidden:/automation/tasks', 'Hide automation tasks tab'),
    ('site:show:/analytics', 'Force show analytics site'),
    ('site:show:/integrations', 'Force show integrations site'),
    ('site:show:/security', 'Force show security site')
ON CONFLICT ("key") DO NOTHING;

-- 3) Role -> permission mapping examples for OU grant workflows.
INSERT INTO rbac_role_ad_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM rbac_roles r
JOIN rbac_ad_permissions p ON p."key" IN ('route:allow:/warehouse/*', 'route:allow:/maintenance/*')
WHERE r."key" IN ('warehouse_keeper', 'role:warehouse_keeper')
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO rbac_role_ad_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM rbac_roles r
JOIN rbac_ad_permissions p ON p."key" IN ('route:allow:/assets/*', 'route:allow:/reports/*')
WHERE r."key" IN ('it_asset_manager', 'role:it_asset_manager')
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO rbac_role_ad_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM rbac_roles r
JOIN rbac_ad_permissions p ON p."key" IN ('site:hidden:/integrations', 'site:hidden:/security')
WHERE r."key" IN ('viewer', 'role:viewer')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- 4) OU hierarchy + linked RBAC users/groups for OU grant and inheritance demos.
INSERT INTO org_units (id, name, parent_id, path, depth, description)
VALUES
    ('31000000-0000-0000-0000-000000000001', 'IT Shared Services', '00000000-0000-0000-0000-000000000002', '/Root/IT/SharedServices', 2, 'Parent OU for IT shared operations'),
    ('31000000-0000-0000-0000-000000000002', 'IT Shared Services - Warehouse', '31000000-0000-0000-0000-000000000001', '/Root/IT/SharedServices/Warehouse', 3, 'Child OU for warehouse operations')
ON CONFLICT (path) DO UPDATE
SET name = EXCLUDED.name,
    parent_id = EXCLUDED.parent_id,
    depth = EXCLUDED.depth,
    description = EXCLUDED.description;

INSERT INTO rbac_users (id, username, display_name, email, ou_id, linked_user_id, status)
VALUES
    ('32000000-0000-0000-0000-000000000001', 'admin_main', 'Admin Main', 'admin@example.com', '31000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'active'),
    ('32000000-0000-0000-0000-000000000002', 'it_manager_main', 'IT Manager Main', 'it_manager@example.com', '31000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002', 'active'),
    ('32000000-0000-0000-0000-000000000003', 'requester_main', 'Requester Main', 'user@example.com', '31000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000003', 'active')
ON CONFLICT (username) DO UPDATE
SET display_name = EXCLUDED.display_name,
    email = EXCLUDED.email,
    ou_id = EXCLUDED.ou_id,
    linked_user_id = EXCLUDED.linked_user_id,
    status = EXCLUDED.status;

INSERT INTO rbac_groups (id, name, description, ou_id)
VALUES
    ('33000000-0000-0000-0000-000000000001', 'IT-Shared-Operators', 'Operators at parent OU', '31000000-0000-0000-0000-000000000001'),
    ('33000000-0000-0000-0000-000000000002', 'IT-Shared-Warehouse', 'Warehouse operators in child OU', '31000000-0000-0000-0000-000000000002')
ON CONFLICT (ou_id, name) DO UPDATE
SET description = EXCLUDED.description;

INSERT INTO rbac_group_members (group_id, member_type, member_user_id)
VALUES
    ('33000000-0000-0000-0000-000000000001', 'USER', '32000000-0000-0000-0000-000000000001'),
    ('33000000-0000-0000-0000-000000000001', 'USER', '32000000-0000-0000-0000-000000000002'),
    ('33000000-0000-0000-0000-000000000002', 'USER', '32000000-0000-0000-0000-000000000003')
ON CONFLICT DO NOTHING;

INSERT INTO rbac_group_members (group_id, member_type, member_group_id)
VALUES
    ('33000000-0000-0000-0000-000000000001', 'GROUP', '33000000-0000-0000-0000-000000000002')
ON CONFLICT DO NOTHING;

-- Parent OU grant with inherit=true. Child OU users/groups can leverage this via OU inheritance checks.
INSERT INTO rbac_acl (principal_type, principal_group_id, role_id, scope_type, scope_ou_id, effect, inherit)
SELECT
    'GROUP',
    '33000000-0000-0000-0000-000000000001',
    r.id,
    'OU',
    '31000000-0000-0000-0000-000000000001',
    'ALLOW',
    true
FROM rbac_roles r
WHERE r."key" IN ('warehouse_keeper', 'role:warehouse_keeper')
ON CONFLICT DO NOTHING;

COMMIT;
