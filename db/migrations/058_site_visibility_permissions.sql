-- ============================================================================
-- Migration 058: Site & Tab Visibility Permissions
-- Khi thêm chức năng mới hoặc site mới, bảng phân quyền tự update.
-- Users mặc định không được cấp quyền (deny-by-default) cho site/tab mới.
-- ============================================================================

-- ============================================================================
-- 1. Insert site:show: permissions for all HIDDEN_SITE_CATALOG entries
-- ============================================================================
INSERT INTO permissions (name, resource, action, description) VALUES
    -- ── Navigation items ──────────────────────────────────────────────────────
    ('site:show:/me/assets',         'site', 'show', 'Hiển thị tab My Assets trong sidebar'),
    ('site:show:/requests',          'site', 'show', 'Hiển thị trang Yêu cầu trong sidebar'),
    ('site:show:/notifications',     'site', 'show', 'Hiển thị trang Thông báo trong sidebar'),
    ('site:show:/assets',            'site', 'show', 'Hiển thị trang Tài sản trong sidebar'),
    ('site:show:/assets/catalogs',   'site', 'show', 'Hiển thị tab Danh mục tài sản'),
    ('site:show:/cmdb',              'site', 'show', 'Hiển thị trang CMDB trong sidebar'),
    ('site:show:/inventory',         'site', 'show', 'Hiển thị trang Kiểm kê trong sidebar'),
    ('site:show:/warehouse/stock',   'site', 'show', 'Hiển thị mục Kho trong sidebar (navigation)'),
    ('site:show:/maintenance',       'site', 'show', 'Hiển thị trang Bảo trì trong sidebar'),
    ('site:show:/reports',           'site', 'show', 'Hiển thị trang Báo cáo trong sidebar'),
    ('site:show:/analytics',         'site', 'show', 'Hiển thị trang Phân tích trong sidebar'),
    ('site:show:/automation',        'site', 'show', 'Hiển thị trang Tự động hóa trong sidebar'),
    ('site:show:/integrations',      'site', 'show', 'Hiển thị trang Tích hợp trong sidebar'),
    ('site:show:/security',          'site', 'show', 'Hiển thị trang Bảo mật trong sidebar'),
    ('site:show:/admin',             'site', 'show', 'Hiển thị trang Quản trị trong sidebar'),
    ('site:show:/settings/theme',    'site', 'show', 'Hiển thị Theme Customizer trong sidebar'),
    ('site:show:/settings/print',    'site', 'show', 'Hiển thị Print Templates trong sidebar'),
    ('site:show:/help',              'site', 'show', 'Hiển thị trang Trợ giúp trong sidebar'),

    -- ── Warehouse sub-tabs ────────────────────────────────────────────────────
    ('site:show:/warehouse',                 'site', 'show', 'Hiển thị tab Tổng quan kho (Warehouse)'),
    ('site:show:/warehouse/warehouses',      'site', 'show', 'Hiển thị tab Quản lý kho'),
    ('site:show:/warehouse/documents',       'site', 'show', 'Hiển thị tab Chứng từ kho'),
    ('site:show:/warehouse/ledger',          'site', 'show', 'Hiển thị tab Sổ kho'),
    ('site:show:/warehouse/parts',           'site', 'show', 'Hiển thị tab Linh kiện/Phụ tùng'),
    ('site:show:/warehouse/reconciliation',  'site', 'show', 'Hiển thị tab Đối soát kho'),
    ('site:show:/warehouse/purchase-plans',  'site', 'show', 'Hiển thị tab Kế hoạch mua hàng'),

    -- ── Automation sub-tabs ───────────────────────────────────────────────────
    ('site:show:/automation/workflows',      'site', 'show', 'Hiển thị tab Quy trình (Workflows)'),
    ('site:show:/automation/rules',          'site', 'show', 'Hiển thị tab Quy tắc tự động (Rules)'),
    ('site:show:/automation/notifications',  'site', 'show', 'Hiển thị tab Thông báo tự động'),
    ('site:show:/automation/tasks',          'site', 'show', 'Hiển thị tab Tác vụ định kỳ (Tasks)')

ON CONFLICT (name) DO NOTHING;

-- ============================================================================
-- 2. Grant site:show: permissions per role (based on existing capability matrix)
-- ============================================================================

-- ── ADMIN: Toàn quyền — tất cả site visibility ──────────────────────────────
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r CROSS JOIN permissions p
WHERE r.slug = 'admin'
  AND p.resource = 'site'
ON CONFLICT DO NOTHING;

-- ── SUPER_ADMIN: Toàn quyền (nếu tồn tại) ──────────────────────────────────
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r CROSS JOIN permissions p
WHERE r.slug = 'super_admin'
  AND p.resource = 'site'
ON CONFLICT DO NOTHING;

-- ── IT_ASSET_MANAGER: Tất cả trừ /admin ─────────────────────────────────────
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
    JOIN permissions p ON p.name = ANY(ARRAY[
    -- Navigation (tất cả trừ /admin)
    'site:show:/me/assets', 'site:show:/requests', 'site:show:/notifications',
    'site:show:/assets', 'site:show:/assets/catalogs', 'site:show:/cmdb',
    'site:show:/inventory', 'site:show:/warehouse/stock', 'site:show:/maintenance',
    'site:show:/reports', 'site:show:/analytics', 'site:show:/automation',
    'site:show:/integrations', 'site:show:/security',
    'site:show:/settings/theme', 'site:show:/settings/print', 'site:show:/help',
    -- Warehouse tabs: toàn bộ
    'site:show:/warehouse', 'site:show:/warehouse/warehouses',
    'site:show:/warehouse/documents', 'site:show:/warehouse/ledger',
    'site:show:/warehouse/parts', 'site:show:/warehouse/reconciliation',
    'site:show:/warehouse/purchase-plans',
    -- Automation tabs: toàn bộ
    'site:show:/automation/workflows', 'site:show:/automation/rules',
    'site:show:/automation/notifications', 'site:show:/automation/tasks'
])
WHERE r.slug = 'it_asset_manager'
ON CONFLICT DO NOTHING;

-- ── WAREHOUSE_KEEPER: Kho + Tài sản + Yêu cầu + Báo cáo ────────────────────
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
    JOIN permissions p ON p.name = ANY(ARRAY[
    -- Navigation
    'site:show:/me/assets', 'site:show:/requests', 'site:show:/notifications',
    'site:show:/assets', 'site:show:/assets/catalogs',
    'site:show:/inventory', 'site:show:/warehouse/stock', 'site:show:/maintenance',
    'site:show:/reports', 'site:show:/settings/theme', 'site:show:/settings/print',
    'site:show:/help',
    -- Warehouse tabs: toàn bộ (core job)
    'site:show:/warehouse', 'site:show:/warehouse/warehouses',
    'site:show:/warehouse/documents', 'site:show:/warehouse/ledger',
    'site:show:/warehouse/parts', 'site:show:/warehouse/reconciliation',
    'site:show:/warehouse/purchase-plans'
    -- Không có: /cmdb, /analytics, /automation, /integrations, /security, /admin
])
WHERE r.slug = 'warehouse_keeper'
ON CONFLICT DO NOTHING;

-- ── TECHNICIAN: Bảo trì + Tài sản + Yêu cầu + Kho (xem) ────────────────────
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
    JOIN permissions p ON p.name = ANY(ARRAY[
    -- Navigation
    'site:show:/me/assets', 'site:show:/requests', 'site:show:/notifications',
    'site:show:/assets', 'site:show:/assets/catalogs', 'site:show:/cmdb',
    'site:show:/inventory', 'site:show:/warehouse/stock', 'site:show:/maintenance',
    'site:show:/reports', 'site:show:/settings/theme', 'site:show:/help',
    -- Warehouse tabs: chỉ tab chính (xem tổng quan và linh kiện)
    'site:show:/warehouse', 'site:show:/warehouse/parts'
    -- Không có: warehouse subtabs khác, /analytics, /automation, /integrations, /security, /admin
])
WHERE r.slug = 'technician'
ON CONFLICT DO NOTHING;

-- ── REQUESTER: Yêu cầu + Tài sản (xem) + Bảo trì + Báo cáo ────────────────
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
    JOIN permissions p ON p.name = ANY(ARRAY[
    -- Navigation (giới hạn)
    'site:show:/me/assets', 'site:show:/requests', 'site:show:/notifications',
    'site:show:/assets', 'site:show:/maintenance', 'site:show:/reports',
    'site:show:/settings/theme', 'site:show:/help'
    -- Không có: /cmdb, /inventory, /warehouse, /analytics, /automation, etc.
])
WHERE r.slug = 'requester'
ON CONFLICT DO NOTHING;

-- 'user' là alias của 'requester'
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
    JOIN permissions p ON p.name = ANY(ARRAY[
    'site:show:/me/assets', 'site:show:/requests', 'site:show:/notifications',
    'site:show:/assets', 'site:show:/maintenance', 'site:show:/reports',
    'site:show:/settings/theme', 'site:show:/help'
])
WHERE r.slug = 'user'
ON CONFLICT DO NOTHING;

-- ── VIEWER: Xem hầu hết, không chỉnh sửa ─────────────────────────────────────
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
    JOIN permissions p ON p.name = ANY(ARRAY[
    -- Navigation
    'site:show:/me/assets', 'site:show:/notifications',
    'site:show:/assets', 'site:show:/assets/catalogs', 'site:show:/cmdb',
    'site:show:/inventory', 'site:show:/warehouse/stock', 'site:show:/maintenance',
    'site:show:/reports', 'site:show:/analytics', 'site:show:/automation',
    'site:show:/security', 'site:show:/settings/theme', 'site:show:/help',
    -- Warehouse tabs: chỉ xem tổng quan
    'site:show:/warehouse',
    -- Automation tabs: chỉ xem tổng quan
    'site:show:/automation/workflows', 'site:show:/automation/rules',
    'site:show:/automation/notifications', 'site:show:/automation/tasks'
    -- Không có: /requests (viewer không tạo yêu cầu), /integrations, /admin
])
WHERE r.slug = 'viewer'
ON CONFLICT DO NOTHING;
