-- =============================================================================
-- SEED: AD RBAC — OU tree, users, groups, roles, permissions, policy assignments
-- Depends on: seed-data.sql (users table populated with UUIDs 00000000-...-001..008)
--
-- UUID map:
--   rbac_users migration-seeded  : 20000000-0000-0000-0000-00000000000X
--   rbac_users new (seed only)   : 32000000-0000-0000-0000-00000000000X
--   org_units (OU tree)          : 30000000-0000-0000-0000-00000000000X
--   rbac_groups                  : 33000000-0000-0000-0000-00000000000X
-- =============================================================================
BEGIN;

-- =============================================================================
-- 1. RBAC ROLES (AD model) — mirror classic roles for ACL/policy mapping
-- =============================================================================
INSERT INTO rbac_roles ("key", name, description, is_system)
VALUES
    ('super_admin',         'Super Admin',        'Toàn quyền hệ thống',         true),
    ('admin',               'Admin',              'Quản trị hệ thống',            true),
    ('it_asset_manager',    'IT Asset Manager',   'Quản lý tài sản IT',           true),
    ('warehouse_keeper',    'Warehouse Keeper',   'Thủ kho',                      true),
    ('technician',          'Technician',         'Kỹ thuật viên',                true),
    ('requester',           'Requester',          'Người yêu cầu',                true),
    ('user',                'User',               'Người dùng thông thường',      true),
    ('viewer',              'Viewer',             'Chỉ xem',                      true),
    ('role:admin',              'Role: Admin',              'Mapping key', true),
    ('role:super_admin',        'Role: Super Admin',        'Mapping key', true),
    ('role:it_asset_manager',   'Role: IT Asset Manager',   'Mapping key', true),
    ('role:warehouse_keeper',   'Role: Warehouse Keeper',   'Mapping key', true),
    ('role:technician',         'Role: Technician',         'Mapping key', true),
    ('role:requester',          'Role: Requester',          'Mapping key', true),
    ('role:user',               'Role: User',               'Mapping key', true),
    ('role:viewer',             'Role: Viewer',             'Mapping key', true)
ON CONFLICT ("key") DO NOTHING;

-- =============================================================================
-- 2. AD PERMISSIONS — route/site/tab directives
-- =============================================================================
INSERT INTO rbac_ad_permissions ("key", description)
VALUES
    ('route:allow:/warehouse/*',             'Cho phép tất cả route kho'),
    ('route:allow:/assets/*',                'Cho phép tất cả route tài sản'),
    ('route:allow:/maintenance/*',           'Cho phép tất cả route bảo trì'),
    ('route:allow:/reports/*',               'Cho phép tất cả route báo cáo'),
    ('route:allow:/admin/*',                 'Cho phép tất cả route quản trị'),
    ('route:deny:/warehouse/*',              'Từ chối tất cả route kho'),
    ('route:deny:/admin/*',                  'Từ chối tất cả route quản trị'),
    ('site:hidden:/analytics',               'Ẩn Analytics trên sidebar'),
    ('site:hidden:/integrations',            'Ẩn Integrations trên sidebar'),
    ('site:hidden:/security',                'Ẩn Security trên sidebar'),
    ('site:hidden:/automation',              'Ẩn Automation trên sidebar'),
    ('site:show:/analytics',                 'Hiển thị bắt buộc Analytics'),
    ('site:show:/integrations',              'Hiển thị bắt buộc Integrations'),
    ('site:show:/security',                  'Hiển thị bắt buộc Security'),
    ('tab:hidden:/automation/rules',         'Ẩn tab Automation Rules'),
    ('tab:hidden:/automation/notifications', 'Ẩn tab Automation Notifications'),
    ('tab:hidden:/automation/tasks',         'Ẩn tab Automation Tasks')
ON CONFLICT ("key") DO NOTHING;

-- =============================================================================
-- 3. ROLE → PERMISSION MAPPING
-- =============================================================================
INSERT INTO rbac_role_ad_permissions (role_id, permission_id)
SELECT r.id, p.id FROM rbac_roles r
JOIN rbac_ad_permissions p ON p."key" IN ('route:allow:/warehouse/*', 'route:allow:/maintenance/*')
WHERE r."key" IN ('warehouse_keeper', 'role:warehouse_keeper')
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO rbac_role_ad_permissions (role_id, permission_id)
SELECT r.id, p.id FROM rbac_roles r
JOIN rbac_ad_permissions p ON p."key" IN ('route:allow:/assets/*', 'route:allow:/reports/*')
WHERE r."key" IN ('it_asset_manager', 'role:it_asset_manager')
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO rbac_role_ad_permissions (role_id, permission_id)
SELECT r.id, p.id FROM rbac_roles r
JOIN rbac_ad_permissions p ON p."key" IN (
    'site:hidden:/analytics', 'site:hidden:/integrations',
    'site:hidden:/security',  'site:hidden:/automation'
)
WHERE r."key" IN ('viewer', 'role:viewer')
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO rbac_role_ad_permissions (role_id, permission_id)
SELECT r.id, p.id FROM rbac_roles r
JOIN rbac_ad_permissions p ON p."key" = 'route:allow:/admin/*'
WHERE r."key" IN ('admin', 'role:admin', 'super_admin', 'role:super_admin')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- =============================================================================
-- 4. OU TREE — Công ty TNHH Công nghệ ABC
--
-- /Root                              30000000-...-001  depth 0
-- /Root/CNTT                         30000000-...-002  depth 1
-- /Root/CNTT/Helpdesk                30000000-...-003  depth 2
-- /Root/CNTT/Ha-tang                 30000000-...-004  depth 2
-- /Root/CNTT/Bao-mat                 30000000-...-005  depth 2
-- /Root/Ke-toan                      30000000-...-006  depth 1
-- /Root/Nhan-su                      30000000-...-007  depth 1
-- /Root/Kho                          30000000-...-008  depth 1
-- /Root/Van-hanh                     30000000-...-009  depth 1
-- =============================================================================

-- Root
INSERT INTO org_units (id, name, parent_id, path, depth, description)
VALUES (
    '30000000-0000-0000-0000-000000000001',
    'Công ty TNHH Công nghệ ABC',
    NULL, '/Root', 0,
    'Tổ chức gốc của công ty'
)
ON CONFLICT (path) DO UPDATE
SET name = EXCLUDED.name, parent_id = EXCLUDED.parent_id,
    depth = EXCLUDED.depth, description = EXCLUDED.description;

-- Depth 1: phòng ban
INSERT INTO org_units (id, name, parent_id, path, depth, description)
VALUES
    ('30000000-0000-0000-0000-000000000002', 'Phòng Công nghệ thông tin',
     '30000000-0000-0000-0000-000000000001', '/Root/CNTT', 1,
     'Quản lý hạ tầng IT, tài sản thiết bị, bảo mật hệ thống'),
    ('30000000-0000-0000-0000-000000000006', 'Phòng Kế toán - Tài chính',
     '30000000-0000-0000-0000-000000000001', '/Root/Ke-toan', 1,
     'Kế toán, tài chính, ngân sách, khấu hao'),
    ('30000000-0000-0000-0000-000000000007', 'Phòng Nhân sự',
     '30000000-0000-0000-0000-000000000001', '/Root/Nhan-su', 1,
     'Quản lý nhân sự, tuyển dụng, đào tạo'),
    ('30000000-0000-0000-0000-000000000008', 'Phòng Kho',
     '30000000-0000-0000-0000-000000000001', '/Root/Kho', 1,
     'Quản lý kho hàng, nhập xuất tồn, vật tư'),
    ('30000000-0000-0000-0000-000000000009', 'Phòng Vận hành',
     '30000000-0000-0000-0000-000000000001', '/Root/Van-hanh', 1,
     'Vận hành hệ thống, điều phối, yêu cầu nội bộ')
ON CONFLICT (path) DO UPDATE
SET name = EXCLUDED.name, parent_id = EXCLUDED.parent_id,
    depth = EXCLUDED.depth, description = EXCLUDED.description;

-- Depth 2: đơn vị con của CNTT
INSERT INTO org_units (id, name, parent_id, path, depth, description)
VALUES
    ('30000000-0000-0000-0000-000000000003', 'Helpdesk & Hỗ trợ',
     '30000000-0000-0000-0000-000000000002', '/Root/CNTT/Helpdesk', 2,
     'Tiếp nhận yêu cầu, hỗ trợ người dùng cuối'),
    ('30000000-0000-0000-0000-000000000004', 'Hạ tầng & Mạng',
     '30000000-0000-0000-0000-000000000002', '/Root/CNTT/Ha-tang', 2,
     'Máy chủ, mạng, server, thiết bị hạ tầng'),
    ('30000000-0000-0000-0000-000000000005', 'Bảo mật & An toàn thông tin',
     '30000000-0000-0000-0000-000000000002', '/Root/CNTT/Bao-mat', 2,
     'Security, compliance, audit, kiểm soát truy cập')
ON CONFLICT (path) DO UPDATE
SET name = EXCLUDED.name, parent_id = EXCLUDED.parent_id,
    depth = EXCLUDED.depth, description = EXCLUDED.description;

-- =============================================================================
-- 5. RBAC USERS — link tất cả 8 tài khoản hệ thống vào OU
--
-- 8 users (UPSERT) — idempotent, không phụ thuộc migration 051 seed data
-- =============================================================================

-- UPSERT tất cả 8 rbac_users (5 hệ thống + 3 mới)
INSERT INTO rbac_users (id, username, display_name, email, ou_id, linked_user_id, status)
VALUES
    ('20000000-0000-0000-0000-000000000001', 'admin',       'Admin Hệ thống',
     'admin@example.com',
     '30000000-0000-0000-0000-000000000002',
     '00000000-0000-0000-0000-000000000001', 'active'),
    ('20000000-0000-0000-0000-000000000002', 'it_manager',  'Nguyễn Văn Quản',
     'it.manager@example.com',
     '30000000-0000-0000-0000-000000000002',
     '00000000-0000-0000-0000-000000000002', 'active'),
    ('20000000-0000-0000-0000-000000000003', 'helpdesk',    'Lê Minh Hỗ trợ',
     'helpdesk@example.com',
     '30000000-0000-0000-0000-000000000003',
     '00000000-0000-0000-0000-000000000004', 'active'),
    ('20000000-0000-0000-0000-000000000004', 'technician',  'Phạm Đức Minh',
     'technician@example.com',
     '30000000-0000-0000-0000-000000000004',
     '00000000-0000-0000-0000-000000000006', 'active'),
    ('20000000-0000-0000-0000-000000000005', 'viewer',      'Đặng Quốc Việt',
     'viewer@example.com',
     '30000000-0000-0000-0000-000000000007',
     '00000000-0000-0000-0000-000000000008', 'active'),
    ('32000000-0000-0000-0000-000000000001', 'warehouse',   'Trần Thị Kho',
     'warehouse@example.com',
     '30000000-0000-0000-0000-000000000008',
     '00000000-0000-0000-0000-000000000003', 'active'),
    ('32000000-0000-0000-0000-000000000002', 'accountant',  'Phạm Thu Kế toán',
     'accountant@example.com',
     '30000000-0000-0000-0000-000000000006',
     '00000000-0000-0000-0000-000000000005', 'active'),
    ('32000000-0000-0000-0000-000000000003', 'requester',   'Hoàng Thị Yến',
     'requester@example.com',
     '30000000-0000-0000-0000-000000000009',
     '00000000-0000-0000-0000-000000000007', 'active')
ON CONFLICT (id) DO UPDATE
SET username       = EXCLUDED.username,
    display_name   = EXCLUDED.display_name,
    email          = EXCLUDED.email,
    ou_id          = EXCLUDED.ou_id,
    linked_user_id = EXCLUDED.linked_user_id,
    status         = EXCLUDED.status;

-- =============================================================================
-- 6. RBAC GROUPS
-- =============================================================================
INSERT INTO rbac_groups (id, name, description, ou_id)
VALUES
    ('33000000-0000-0000-0000-000000000001', 'IT-Admins',
     'Quản trị viên CNTT — toàn quyền tài sản và cấu hình',
     '30000000-0000-0000-0000-000000000002'),
    ('33000000-0000-0000-0000-000000000002', 'IT-Helpdesk',
     'Nhân viên Helpdesk — hỗ trợ người dùng và xử lý ticket',
     '30000000-0000-0000-0000-000000000003'),
    ('33000000-0000-0000-0000-000000000003', 'IT-Infrastructure',
     'Nhóm hạ tầng — quản lý server, mạng, thiết bị mạng',
     '30000000-0000-0000-0000-000000000004'),
    ('33000000-0000-0000-0000-000000000004', 'Warehouse-Operators',
     'Nhân viên kho — nhập xuất phiếu, quản lý tồn kho',
     '30000000-0000-0000-0000-000000000008'),
    ('33000000-0000-0000-0000-000000000005', 'Finance-Team',
     'Nhóm Kế toán — xem báo cáo tài chính, khấu hao',
     '30000000-0000-0000-0000-000000000006'),
    ('33000000-0000-0000-0000-000000000006', 'All-Requesters',
     'Tất cả người dùng có quyền tạo yêu cầu',
     '30000000-0000-0000-0000-000000000001')
ON CONFLICT (id) DO UPDATE
SET name        = EXCLUDED.name,
    description = EXCLUDED.description,
    ou_id       = EXCLUDED.ou_id;

-- =============================================================================
-- 7. GROUP MEMBERS (users)
-- =============================================================================
INSERT INTO rbac_group_members (group_id, member_type, member_user_id)
VALUES
    -- IT-Admins: admin + it_manager
    ('33000000-0000-0000-0000-000000000001', 'USER', '20000000-0000-0000-0000-000000000001'),
    ('33000000-0000-0000-0000-000000000001', 'USER', '20000000-0000-0000-0000-000000000002'),
    -- IT-Helpdesk: helpdesk
    ('33000000-0000-0000-0000-000000000002', 'USER', '20000000-0000-0000-0000-000000000003'),
    -- IT-Infrastructure: technician
    ('33000000-0000-0000-0000-000000000003', 'USER', '20000000-0000-0000-0000-000000000004'),
    -- Warehouse-Operators: warehouse
    ('33000000-0000-0000-0000-000000000004', 'USER', '32000000-0000-0000-0000-000000000001'),
    -- Finance-Team: accountant
    ('33000000-0000-0000-0000-000000000005', 'USER', '32000000-0000-0000-0000-000000000002'),
    -- All-Requesters: requester + helpdesk
    ('33000000-0000-0000-0000-000000000006', 'USER', '32000000-0000-0000-0000-000000000003'),
    ('33000000-0000-0000-0000-000000000006', 'USER', '20000000-0000-0000-0000-000000000003')
ON CONFLICT DO NOTHING;

-- IT-Helpdesk và IT-Infrastructure là sub-group của IT-Admins (kế thừa policy)
INSERT INTO rbac_group_members (group_id, member_type, member_group_id)
VALUES
    ('33000000-0000-0000-0000-000000000001', 'GROUP', '33000000-0000-0000-0000-000000000002'),
    ('33000000-0000-0000-0000-000000000001', 'GROUP', '33000000-0000-0000-0000-000000000003')
ON CONFLICT DO NOTHING;

-- =============================================================================
-- 8. ACL — gán role cho group theo scope
-- =============================================================================
-- IT-Admins: it_asset_manager scope GLOBAL
INSERT INTO rbac_acl (principal_type, principal_group_id, role_id, scope_type, effect, inherit)
SELECT 'GROUP', '33000000-0000-0000-0000-000000000001', r.id, 'GLOBAL', 'ALLOW', true
FROM rbac_roles r WHERE r."key" IN ('it_asset_manager', 'role:it_asset_manager')
ON CONFLICT DO NOTHING;

-- Warehouse-Operators: warehouse_keeper scope OU Kho
INSERT INTO rbac_acl (principal_type, principal_group_id, role_id, scope_type, scope_ou_id, effect, inherit)
SELECT 'GROUP', '33000000-0000-0000-0000-000000000004', r.id,
       'OU', '30000000-0000-0000-0000-000000000008', 'ALLOW', true
FROM rbac_roles r WHERE r."key" IN ('warehouse_keeper', 'role:warehouse_keeper')
ON CONFLICT DO NOTHING;

-- viewer (user cá nhân): scope GLOBAL ALLOW viewer role
INSERT INTO rbac_acl (principal_type, principal_user_id, role_id, scope_type, effect, inherit)
SELECT 'USER', '20000000-0000-0000-0000-000000000005', r.id, 'GLOBAL', 'ALLOW', false
FROM rbac_roles r WHERE r."key" IN ('viewer', 'role:viewer')
ON CONFLICT DO NOTHING;

-- =============================================================================
-- 9. POLICY ASSIGNMENTS — gán unified policy cho OU (kế thừa xuống sub-OU)
-- =============================================================================
-- Policy it_asset_manager → OU CNTT
INSERT INTO policy_assignments (policy_id, principal_type, principal_id, scope_type, effect, inherit)
SELECT p.id, 'OU', '30000000-0000-0000-0000-000000000002', 'GLOBAL', 'ALLOW', true
FROM policies p WHERE p.slug = 'it_asset_manager'
ON CONFLICT DO NOTHING;

-- Policy warehouse_keeper → OU Kho
INSERT INTO policy_assignments (policy_id, principal_type, principal_id, scope_type, effect, inherit)
SELECT p.id, 'OU', '30000000-0000-0000-0000-000000000008', 'GLOBAL', 'ALLOW', true
FROM policies p WHERE p.slug = 'warehouse_keeper'
ON CONFLICT DO NOTHING;

-- Policy viewer → OU Nhân sự
INSERT INTO policy_assignments (policy_id, principal_type, principal_id, scope_type, effect, inherit)
SELECT p.id, 'OU', '30000000-0000-0000-0000-000000000007', 'GLOBAL', 'ALLOW', true
FROM policies p WHERE p.slug = 'viewer'
ON CONFLICT DO NOTHING;

COMMIT;
