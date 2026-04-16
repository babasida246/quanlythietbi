-- ============================================================================
-- Migration 051: Enterprise RBAC — Active Directory Model
-- OU tree, Group nesting, ACL with scope + inheritance, DENY > ALLOW
-- ============================================================================

BEGIN;

    -- ============================================================================
    -- 1. Organizational Units (OU) — tree structure
    -- ============================================================================
    CREATE TABLE
    IF NOT EXISTS org_units
    (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid
    (),
    name        VARCHAR
    (255) NOT NULL,
    parent_id   UUID REFERENCES org_units
    (id) ON
    DELETE RESTRICT,
    path        TEXT
    NOT NULL DEFAULT '/',          -- materialized path: /root/it/network
    depth       INT  NOT NULL DEFAULT 0,
    description TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW
    (),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW
    (),
    CONSTRAINT uq_org_units_path UNIQUE
    (path)
);

CREATE INDEX
IF NOT EXISTS idx_org_units_parent ON org_units
(parent_id);
CREATE INDEX
IF NOT EXISTS idx_org_units_path   ON org_units
(path);
CREATE INDEX
IF NOT EXISTS idx_org_units_depth  ON org_units
(depth);

-- ============================================================================
-- 2. RBAC Users — link to existing users table via email/id
-- ============================================================================
CREATE TABLE
IF NOT EXISTS rbac_users
(
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid
(),
    username       VARCHAR
(255) NOT NULL UNIQUE,
    display_name   VARCHAR
(255) NOT NULL,
    email          VARCHAR
(255),
    ou_id          UUID NOT NULL REFERENCES org_units
(id) ON
DELETE RESTRICT,
    linked_user_id UUID
REFERENCES users
(id) ON
DELETE
SET NULL
, -- link to app users
    status         VARCHAR
(20) NOT NULL DEFAULT 'active'
                   CHECK
(status IN
('active', 'disabled', 'locked')),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW
(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW
()
);

CREATE INDEX
IF NOT EXISTS idx_rbac_users_ou     ON rbac_users
(ou_id);
CREATE INDEX
IF NOT EXISTS idx_rbac_users_status  ON rbac_users
(status);
CREATE INDEX
IF NOT EXISTS idx_rbac_users_linked  ON rbac_users
(linked_user_id);

-- ============================================================================
-- 3. RBAC Groups — scoped to OU, like AD Security Groups
-- ============================================================================
CREATE TABLE
IF NOT EXISTS rbac_groups
(
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid
(),
    name        VARCHAR
(255) NOT NULL,
    description TEXT,
    ou_id       UUID NOT NULL REFERENCES org_units
(id) ON
DELETE RESTRICT,
    created_at  TIMESTAMPTZ
NOT NULL DEFAULT NOW
(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW
(),
    CONSTRAINT uq_rbac_groups_ou_name UNIQUE
(ou_id, name)
);

CREATE INDEX
IF NOT EXISTS idx_rbac_groups_ou ON rbac_groups
(ou_id);

-- ============================================================================
-- 4. Group Membership — supports USER and GROUP members (nesting)
-- ============================================================================
CREATE TABLE
IF NOT EXISTS rbac_group_members
(
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid
(),
    group_id        UUID NOT NULL REFERENCES rbac_groups
(id) ON
DELETE CASCADE,
    member_type     VARCHAR(10)
NOT NULL CHECK
(member_type IN
('USER', 'GROUP')),
    member_user_id  UUID REFERENCES rbac_users
(id)  ON
DELETE CASCADE,
    member_group_id UUID
REFERENCES rbac_groups
(id) ON
DELETE CASCADE,
    created_at      TIMESTAMPTZ
NOT NULL DEFAULT NOW
(),

    -- Exactly one member reference must be set
    CONSTRAINT chk_member_xor CHECK
(
        (member_type = 'USER'  AND member_user_id  IS NOT NULL AND member_group_id IS NULL) OR
(member_type = 'GROUP' AND member_group_id IS NOT NULL AND member_user_id  IS NULL)
    ),
    -- No duplicate memberships
    CONSTRAINT uq_group_user  UNIQUE
(group_id, member_user_id),
    CONSTRAINT uq_group_group UNIQUE
(group_id, member_group_id)
);

CREATE INDEX
IF NOT EXISTS idx_rbac_gm_group    ON rbac_group_members
(group_id);
CREATE INDEX
IF NOT EXISTS idx_rbac_gm_user     ON rbac_group_members
(member_user_id);
CREATE INDEX
IF NOT EXISTS idx_rbac_gm_nested   ON rbac_group_members
(member_group_id);

-- ============================================================================
-- 5. RBAC Roles — like AD Group Policy Objects
-- ============================================================================
CREATE TABLE
IF NOT EXISTS rbac_roles
(
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid
(),
    key         VARCHAR
(100) NOT NULL UNIQUE,
    name        VARCHAR
(255) NOT NULL,
    description TEXT,
    is_system   BOOLEAN NOT NULL DEFAULT false,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW
(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW
()
);

-- ============================================================================
-- 6. RBAC Permissions — fine-grained permission catalog
-- ============================================================================
CREATE TABLE
IF NOT EXISTS rbac_ad_permissions
(
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid
(),
    key         VARCHAR
(200) NOT NULL UNIQUE,  -- e.g. 'asset.read', 'tool.network_change.execute'
    description TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW
()
);

-- ============================================================================
-- 7. Role → Permission mapping
-- ============================================================================
CREATE TABLE
IF NOT EXISTS rbac_role_ad_permissions
(
    role_id       UUID NOT NULL REFERENCES rbac_roles
(id) ON
DELETE CASCADE,
    permission_id UUID
NOT NULL REFERENCES rbac_ad_permissions
(id) ON
DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

-- ============================================================================
-- 8. ACL: Principal → Role assignments with scope + effect + inheritance
-- ============================================================================
CREATE TABLE
IF NOT EXISTS rbac_acl
(
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid
(),
    -- Principal (user or group)
    principal_type   VARCHAR
(10) NOT NULL CHECK
(principal_type IN
('USER', 'GROUP')),
    principal_user_id  UUID REFERENCES rbac_users
(id)  ON
DELETE CASCADE,
    principal_group_id UUID
REFERENCES rbac_groups
(id) ON
DELETE CASCADE,
    -- Role being assigned
    role_id          UUID
NOT NULL REFERENCES rbac_roles
(id) ON
DELETE CASCADE,
    -- Scope
    scope_type       VARCHAR(10)
NOT NULL DEFAULT 'GLOBAL'
                     CHECK
(scope_type IN
('GLOBAL', 'OU', 'RESOURCE')),
    scope_ou_id      UUID REFERENCES org_units
(id) ON
DELETE CASCADE,
    scope_resource   VARCHAR(500),   -- e.g. 'asset:uuid' or 'tool:network_scan'
    -- Effect
    effect           VARCHAR
(5) NOT NULL DEFAULT 'ALLOW'
                     CHECK
(effect IN
('ALLOW', 'DENY')),
    -- Inheritance: if scope=OU, do children inherit this ACL?
    inherit          BOOLEAN NOT NULL DEFAULT true,
    -- Audit
    created_by       UUID,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW
(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW
(),

    -- Exactly one principal reference
    CONSTRAINT chk_acl_principal_xor CHECK
(
        (principal_type = 'USER'  AND principal_user_id  IS NOT NULL AND principal_group_id IS NULL) OR
(principal_type = 'GROUP' AND principal_group_id IS NOT NULL AND principal_user_id  IS NULL)
    ),
    -- Scope consistency
    CONSTRAINT chk_acl_scope CHECK
(
        (scope_type = 'GLOBAL'   AND scope_ou_id IS NULL) OR
(scope_type = 'OU'       AND scope_ou_id IS NOT NULL) OR
(scope_type = 'RESOURCE' AND scope_resource IS NOT NULL)
    )
);

CREATE INDEX
IF NOT EXISTS idx_rbac_acl_user     ON rbac_acl
(principal_user_id);
CREATE INDEX
IF NOT EXISTS idx_rbac_acl_group    ON rbac_acl
(principal_group_id);
CREATE INDEX
IF NOT EXISTS idx_rbac_acl_role     ON rbac_acl
(role_id);
CREATE INDEX
IF NOT EXISTS idx_rbac_acl_scope_ou ON rbac_acl
(scope_ou_id);
CREATE INDEX
IF NOT EXISTS idx_rbac_acl_effect   ON rbac_acl
(effect);

-- ============================================================================
-- 8b. Add RBAC admin permissions to OLD permissions table (migration 050)
--     so requirePermission() in routes works for non-admin users
-- ============================================================================
INSERT INTO permissions
    (name, resource, action, description)
VALUES
    ('rbac:admin', 'rbac', 'admin', 'Quản trị RBAC (full)'),
    ('rbac:ou:manage', 'rbac', 'ou:manage', 'Quản lý OU'),
    ('rbac:user:manage', 'rbac', 'user:manage', 'Quản lý RBAC users'),
    ('rbac:group:manage', 'rbac', 'group:manage', 'Quản lý RBAC groups')
ON CONFLICT
(name) DO NOTHING;

-- Grant RBAC admin permissions to admin role (-050 system)
INSERT INTO role_permissions
    (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'admin' AND p.name IN ('rbac:admin', 'rbac:ou:manage', 'rbac:user:manage', 'rbac:group:manage')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 9. Seed: Root OU
-- ============================================================================
INSERT INTO org_units
    (id, name, parent_id, path, depth, description)
VALUES
    ('00000000-0000-0000-0000-000000000001', 'Root', NULL, '/', 0, 'Root organizational unit')
ON CONFLICT
(path) DO NOTHING;

-- ============================================================================
-- 10. Seed: AD Permissions (mirrors existing permission catalog + extra)
-- ============================================================================
INSERT INTO rbac_ad_permissions
    (key, description)
VALUES
    -- Assets
    ('asset:read', 'Xem tài sản'),
    ('asset:create', 'Tạo tài sản'),
    ('asset:update', 'Cập nhật tài sản'),
    ('asset:delete', 'Xóa tài sản'),
    ('asset:export', 'Xuất tài sản'),
    ('asset:import', 'Nhập tài sản'),
    ('asset:assign', 'Gán tài sản'),
    -- Categories
    ('category:read', 'Xem danh mục'),
    ('category:manage', 'Quản lý danh mục'),
    -- CMDB
    ('cmdb:read', 'Xem CMDB'),
    ('cmdb:create', 'Tạo CI'),
    ('cmdb:update', 'Cập nhật CI'),
    ('cmdb:delete', 'Xóa CI'),
    -- Warehouse
    ('warehouse:read', 'Xem kho'),
    ('warehouse:create', 'Tạo phiếu kho'),
    ('warehouse:approve', 'Duyệt phiếu kho'),
    -- Inventory
    ('inventory:read', 'Xem kiểm kê'),
    ('inventory:create', 'Tạo kiểm kê'),
    ('inventory:manage', 'Quản lý kiểm kê'),
    -- Maintenance
    ('maintenance:read', 'Xem bảo trì'),
    ('maintenance:create', 'Tạo bảo trì'),
    ('maintenance:manage', 'Quản lý bảo trì'),
    -- Requests
    ('request:read', 'Xem yêu cầu'),
    ('request:create', 'Tạo yêu cầu'),
    ('request:approve', 'Duyệt yêu cầu'),
    -- Reports & Analytics
    ('report:read', 'Xem báo cáo'),
    ('report:export', 'Xuất báo cáo'),
    ('analytics:read', 'Xem phân tích'),
    -- Admin
    ('rbac:admin', 'Quản trị RBAC (full)'),
    ('rbac:ou:manage', 'Quản lý OU'),
    ('rbac:user:manage', 'Quản lý RBAC users'),
    ('rbac:group:manage', 'Quản lý RBAC groups'),
    -- Security
    ('security:read', 'Xem bảo mật'),
    ('security:manage', 'Quản lý bảo mật'),
    -- Documents
    ('document:read', 'Xem tài liệu'),
    ('document:upload', 'Tải tài liệu'),
    ('document:delete', 'Xóa tài liệu'),
    -- Tool-specific (requires RBAC checks for dangerous tools)
    ('tool:network_change:execute', 'Thực thi thay đổi mạng'),
    ('tool:server_restart:execute', 'Thực thi khởi động lại server'),
    ('tool:db_migration:execute', 'Thực thi migration DB')
ON CONFLICT
(key) DO NOTHING;

-- ============================================================================
-- 11. Seed: System Roles
-- ============================================================================
INSERT INTO rbac_roles
    (key, name, description, is_system)
VALUES
    ('full_admin', 'Full Administrator', 'Toàn quyền hệ thống', true),
    ('it_admin', 'IT Administrator', 'Quản trị CNTT — tài sản, CMDB, bảo trì', true),
    ('warehouse_mgr', 'Warehouse Manager', 'Quản lý kho, nhập xuất', true),
    ('technician', 'Technician', 'Kỹ thuật viên — bảo trì, linh kiện', true),
    ('helpdesk', 'Helpdesk', 'Hỗ trợ — tài sản xem, yêu cầu', true),
    ('viewer', 'Viewer', 'Chỉ xem', true),
    ('network_admin', 'Network Administrator', 'Quản trị mạng — thay đổi, giám sát', true)
ON CONFLICT
(key) DO NOTHING;

-- ============================================================================
-- 12. Seed: Role → Permission mappings
-- ============================================================================

-- Full Admin: all permissions
INSERT INTO rbac_role_ad_permissions
    (role_id, permission_id)
SELECT r.id, p.id
FROM rbac_roles r CROSS JOIN rbac_ad_permissions p
WHERE r.key = 'full_admin'
ON CONFLICT DO NOTHING;

-- IT Admin
INSERT INTO rbac_role_ad_permissions
    (role_id, permission_id)
SELECT r.id, p.id
FROM rbac_roles r, rbac_ad_permissions p
WHERE r.key = 'it_admin' AND p.key IN (
    'asset:read', 'asset:create', 'asset:update', 'asset:delete',
    'asset:export', 'asset:import', 'asset:assign',
    'category:read', 'category:manage',
    'cmdb:read', 'cmdb:create', 'cmdb:update', 'cmdb:delete',
    'maintenance:read', 'maintenance:create', 'maintenance:manage',
    'inventory:read', 'inventory:create', 'inventory:manage',
    'report:read', 'report:export', 'analytics:read',
    'document:read', 'document:upload', 'document:delete'
)
ON CONFLICT DO NOTHING;

-- Warehouse Manager
INSERT INTO rbac_role_ad_permissions
    (role_id, permission_id)
SELECT r.id, p.id
FROM rbac_roles r, rbac_ad_permissions p
WHERE r.key = 'warehouse_mgr' AND p.key IN (
    'asset:read', 'warehouse:read', 'warehouse:create', 'warehouse:approve',
    'inventory:read', 'inventory:create', 'inventory:manage',
    'report:read'
)
ON CONFLICT DO NOTHING;

-- Technician
INSERT INTO rbac_role_ad_permissions
    (role_id, permission_id)
SELECT r.id, p.id
FROM rbac_roles r, rbac_ad_permissions p
WHERE r.key = 'technician' AND p.key IN (
    'asset:read', 'asset:update',
    'maintenance:read', 'maintenance:create', 'maintenance:manage',
    'cmdb:read',
    'document:read', 'document:upload'
)
ON CONFLICT DO NOTHING;

-- Helpdesk
INSERT INTO rbac_role_ad_permissions
    (role_id, permission_id)
SELECT r.id, p.id
FROM rbac_roles r, rbac_ad_permissions p
WHERE r.key = 'helpdesk' AND p.key IN (
    'asset:read',
    'request:read', 'request:create',
    'report:read',
    'document:read'
)
ON CONFLICT DO NOTHING;

-- Viewer
INSERT INTO rbac_role_ad_permissions
    (role_id, permission_id)
SELECT r.id, p.id
FROM rbac_roles r, rbac_ad_permissions p
WHERE r.key = 'viewer' AND p.key IN (
    'asset:read', 'cmdb:read', 'warehouse:read', 'inventory:read',
    'maintenance:read', 'request:read', 'report:read',
    'analytics:read', 'document:read', 'security:read'
)
ON CONFLICT DO NOTHING;

-- Network Admin
INSERT INTO rbac_role_ad_permissions
    (role_id, permission_id)
SELECT r.id, p.id
FROM rbac_roles r, rbac_ad_permissions p
WHERE r.key = 'network_admin' AND p.key IN (
    'cmdb:read', 'cmdb:create', 'cmdb:update',
    'asset:read', 'asset:update',
    'tool:network_change:execute',
    'report:read', 'analytics:read'
)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 13. Seed: Demo OU structure (like AD)
-- ============================================================================
INSERT INTO org_units
    (id, name, parent_id, path, depth, description)
VALUES
    ('00000000-0000-0000-0000-000000000002', 'IT', '00000000-0000-0000-0000-000000000001', '/Root/IT', 1, 'Phòng CNTT'),
    ('00000000-0000-0000-0000-000000000003', 'Network', '00000000-0000-0000-0000-000000000002', '/Root/IT/Network', 2, 'Bộ phận Mạng'),
    ('00000000-0000-0000-0000-000000000004', 'Security', '00000000-0000-0000-0000-000000000002', '/Root/IT/Security', 2, 'Bộ phận Bảo mật'),
    ('00000000-0000-0000-0000-000000000005', 'Clinical', '00000000-0000-0000-0000-000000000001', '/Root/Clinical', 1, 'Phòng Khám lâm sàng'),
    ('00000000-0000-0000-0000-000000000006', 'Admin', '00000000-0000-0000-0000-000000000001', '/Root/Admin', 1, 'Phòng Hành chính'),
    ('00000000-0000-0000-0000-000000000007', 'Helpdesk', '00000000-0000-0000-0000-000000000002', '/Root/IT/Helpdesk', 2, 'Bộ phận Helpdesk')
ON CONFLICT
(path) DO NOTHING;

-- ============================================================================
-- 14. Seed: Demo Groups
-- ============================================================================
INSERT INTO rbac_groups
    (id, name, description, ou_id)
VALUES
    ('10000000-0000-0000-0000-000000000001', 'IT-Admins', 'Quản trị viên CNTT', '00000000-0000-0000-0000-000000000002'),
    ('10000000-0000-0000-0000-000000000002', 'Network-Admins', 'Quản trị viên mạng', '00000000-0000-0000-0000-000000000003'),
    ('10000000-0000-0000-0000-000000000003', 'Helpdesk', 'Nhóm hỗ trợ Helpdesk', '00000000-0000-0000-0000-000000000007'),
    ('10000000-0000-0000-0000-000000000004', 'Security-Team', 'Đội bảo mật', '00000000-0000-0000-0000-000000000004'),
    ('10000000-0000-0000-0000-000000000005', 'All-IT-Staff', 'Tất cả nhân viên IT', '00000000-0000-0000-0000-000000000002')
ON CONFLICT DO NOTHING;

-- Group nesting: Network-Admins ∈ All-IT-Staff, Helpdesk ∈ All-IT-Staff
INSERT INTO rbac_group_members
    (group_id, member_type, member_group_id)
VALUES
    ('10000000-0000-0000-0000-000000000005', 'GROUP', '10000000-0000-0000-0000-000000000002'),
    ('10000000-0000-0000-0000-000000000005', 'GROUP', '10000000-0000-0000-0000-000000000003')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 15. Seed: Demo RBAC Users (linked to existing app users if available)
-- ============================================================================
INSERT INTO rbac_users
    (id, username, display_name, email, ou_id, status)
VALUES
    ('20000000-0000-0000-0000-000000000001', 'admin', 'Administrator', 'admin@example.com', '00000000-0000-0000-0000-000000000001', 'active'),
    ('20000000-0000-0000-0000-000000000002', 'net_admin', 'Network Admin', 'netadmin@example.com', '00000000-0000-0000-0000-000000000003', 'active'),
    ('20000000-0000-0000-0000-000000000003', 'helpdesk1', 'Helpdesk Agent 1', 'hd1@example.com', '00000000-0000-0000-0000-000000000007', 'active'),
    ('20000000-0000-0000-0000-000000000004', 'sec_analyst', 'Security Analyst', 'sec@example.com', '00000000-0000-0000-0000-000000000004', 'active'),
    ('20000000-0000-0000-0000-000000000005', 'viewer1', 'Viewer User', 'viewer@example.com', '00000000-0000-0000-0000-000000000005', 'active')
ON CONFLICT DO NOTHING;

-- Add users to groups
INSERT INTO rbac_group_members
    (group_id, member_type, member_user_id)
VALUES
    ('10000000-0000-0000-0000-000000000001', 'USER', '20000000-0000-0000-0000-000000000001'),
    -- admin → IT-Admins
    ('10000000-0000-0000-0000-000000000002', 'USER', '20000000-0000-0000-0000-000000000002'),
    -- net_admin → Network-Admins
    ('10000000-0000-0000-0000-000000000003', 'USER', '20000000-0000-0000-0000-000000000003'),
    -- helpdesk1 → Helpdesk
    ('10000000-0000-0000-0000-000000000004', 'USER', '20000000-0000-0000-0000-000000000004')
-- sec_analyst → Security-Team
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 16. Seed: ACL Assignments (demo policies)
-- ============================================================================

-- IT-Admins → full_admin, GLOBAL scope, ALLOW
INSERT INTO rbac_acl
    (principal_type, principal_group_id, role_id, scope_type, effect, inherit)
VALUES
    ('GROUP', '10000000-0000-0000-0000-000000000001',
        (SELECT id
        FROM rbac_roles
        WHERE key = 'full_admin'),
        'GLOBAL', 'ALLOW', true)
ON CONFLICT DO NOTHING;

-- Network-Admins → network_admin, scope OU=Network (inherit)
INSERT INTO rbac_acl
    (principal_type, principal_group_id, role_id, scope_type, scope_ou_id, effect, inherit)
VALUES
    ('GROUP', '10000000-0000-0000-0000-000000000002',
        (SELECT id
        FROM rbac_roles
        WHERE key = 'network_admin'),
        'OU', '00000000-0000-0000-0000-000000000003', 'ALLOW', true)
ON CONFLICT DO NOTHING;

-- Helpdesk group → helpdesk role, scope OU=IT (inherit)
INSERT INTO rbac_acl
    (principal_type, principal_group_id, role_id, scope_type, scope_ou_id, effect, inherit)
VALUES
    ('GROUP', '10000000-0000-0000-0000-000000000003',
        (SELECT id
        FROM rbac_roles
        WHERE key = 'helpdesk'),
        'OU', '00000000-0000-0000-0000-000000000002', 'ALLOW', true)
ON CONFLICT DO NOTHING;

-- Helpdesk group → DENY asset.write scope OU=IT (prevent helpdesk from writing assets)
-- This demonstrates DENY > ALLOW
INSERT INTO rbac_acl
    (principal_type, principal_group_id, role_id, scope_type, scope_ou_id, effect, inherit)
VALUES
    ('GROUP', '10000000-0000-0000-0000-000000000003',
        (SELECT id
        FROM rbac_roles
        WHERE key = 'it_admin'),
        'OU', '00000000-0000-0000-0000-000000000002', 'DENY', true)
ON CONFLICT DO NOTHING;

-- Viewer user → viewer role GLOBAL
INSERT INTO rbac_acl
    (principal_type, principal_user_id, role_id, scope_type, effect, inherit)
VALUES
    ('USER', '20000000-0000-0000-0000-000000000005',
        (SELECT id
        FROM rbac_roles
        WHERE key = 'viewer'),
        'GLOBAL', 'ALLOW', true)
ON CONFLICT DO NOTHING;

COMMIT;
