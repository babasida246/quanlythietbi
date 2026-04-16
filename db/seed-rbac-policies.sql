-- ============================================================================
-- seed-rbac-policies.sql — Thư viện Policy mặc định
--
-- Mỗi policy tương ứng với một vai trò hệ thống.
-- Policy = template quyền có thể gán cho User / Group / OU.
-- Admin có thể tùy chỉnh từng policy sau khi seed.
--
-- Phụ thuộc: seed-rbac-classic.sql đã chạy (cần bảng roles, permissions có data)
-- Idempotent: ON CONFLICT DO UPDATE / DO NOTHING.
-- ============================================================================

-- ── 1. Policies ───────────────────────────────────────────────────────────────
-- Dùng UUID cố định để idempotent và dễ reference trong seed sau này.

INSERT INTO policies (id, slug, name, description, is_system) VALUES
    -- Superadmin (đã có từ seed-rbac-classic.sql, upsert safe)
    ('ffffffff-ffff-ffff-ffff-ffffffffffff',
     'root', 'Superadmin',
     'Vai trò siêu quản trị — vượt qua mọi kiểm tra phân quyền kể cả DENY policy.',
     true),

    -- Admin
    ('eeeeeeee-0000-0000-0000-000000000001',
     'admin', 'Quản trị viên',
     'Toàn quyền hệ thống: quản lý người dùng, roles, cấu hình và tất cả module.',
     true),

    -- IT Asset Manager
    ('eeeeeeee-0000-0000-0000-000000000002',
     'it_asset_manager', 'Quản lý Tài sản CNTT',
     'Quản lý toàn bộ tài sản, thiết bị, kho, kiểm kê và hạ tầng CNTT. Không có quyền quản trị hệ thống.',
     true),

    -- Warehouse Keeper
    ('eeeeeeee-0000-0000-0000-000000000003',
     'warehouse_keeper', 'Thủ kho',
     'Quản lý kho hàng: nhập xuất vật tư, phụ kiện, linh kiện. Không tạo/xóa tài sản.',
     true),

    -- Technician
    ('eeeeeeee-0000-0000-0000-000000000004',
     'technician', 'Kỹ thuật viên',
     'Thực hiện bảo trì, sửa chữa thiết bị, quản lý linh kiện thay thế.',
     true),

    -- Requester
    ('eeeeeeee-0000-0000-0000-000000000005',
     'requester', 'Người dùng',
     'Tạo yêu cầu, xem tài sản được giao, mượn/trả thiết bị.',
     true),

    -- Viewer
    ('eeeeeeee-0000-0000-0000-000000000006',
     'viewer', 'Chỉ xem',
     'Chỉ có quyền xem thông tin trên toàn hệ thống, không thực hiện thao tác ghi.',
     true)

ON CONFLICT (slug) DO UPDATE SET
    name        = EXCLUDED.name,
    description = EXCLUDED.description,
    is_system   = EXCLUDED.is_system,
    updated_at  = NOW();

-- ── 2. Gán permissions cho từng policy ───────────────────────────────────────

-- root + admin: toàn bộ 55 permissions
INSERT INTO policy_permissions (policy_id, permission_id)
SELECT pol.id, p.id
FROM policies pol CROSS JOIN permissions p
WHERE pol.slug IN ('root', 'admin')
ON CONFLICT DO NOTHING;

-- it_asset_manager
INSERT INTO policy_permissions (policy_id, permission_id)
SELECT pol.id, p.id
FROM policies pol
JOIN permissions p ON p.name = ANY(ARRAY[
    'assets:read','assets:create','assets:update','assets:delete','assets:export','assets:import','assets:assign',
    'categories:read','categories:manage',
    'cmdb:read','cmdb:create','cmdb:update','cmdb:delete',
    'warehouse:read','warehouse:create','warehouse:approve',
    'inventory:read','inventory:create','inventory:manage',
    'licenses:read','licenses:manage',
    'accessories:read','accessories:manage',
    'consumables:read','consumables:manage',
    'components:read','components:manage',
    'checkout:read','checkout:create','checkout:approve',
    'requests:read','requests:create','requests:approve',
    'maintenance:read','maintenance:create','maintenance:manage',
    'reports:read','reports:export',
    'analytics:read',
    'depreciation:read','depreciation:manage',
    'labels:read','labels:manage',
    'documents:read','documents:upload','documents:delete',
    'automation:read','automation:manage',
    'integrations:read','integrations:manage',
    'security:read'
])
WHERE pol.slug = 'it_asset_manager'
ON CONFLICT DO NOTHING;

-- warehouse_keeper
INSERT INTO policy_permissions (policy_id, permission_id)
SELECT pol.id, p.id
FROM policies pol
JOIN permissions p ON p.name = ANY(ARRAY[
    'assets:read','assets:create','assets:update','assets:export',
    'categories:read',
    'warehouse:read','warehouse:create',
    'inventory:read','inventory:create',
    'accessories:read','accessories:manage',
    'consumables:read','consumables:manage',
    'components:read','components:manage',
    'requests:read','requests:create',
    'maintenance:read',
    'reports:read','reports:export',
    'depreciation:read',
    'labels:read','labels:manage',
    'documents:read','documents:upload'
])
WHERE pol.slug = 'warehouse_keeper'
ON CONFLICT DO NOTHING;

-- technician
INSERT INTO policy_permissions (policy_id, permission_id)
SELECT pol.id, p.id
FROM policies pol
JOIN permissions p ON p.name = ANY(ARRAY[
    'assets:read',
    'categories:read',
    'cmdb:read',
    'warehouse:read',
    'inventory:read',
    'accessories:read',
    'consumables:read',
    'components:read','components:manage',
    'checkout:read','checkout:create',
    'requests:read','requests:create',
    'maintenance:read','maintenance:create','maintenance:manage',
    'reports:read',
    'labels:read',
    'documents:read','documents:upload'
])
WHERE pol.slug = 'technician'
ON CONFLICT DO NOTHING;

-- requester
INSERT INTO policy_permissions (policy_id, permission_id)
SELECT pol.id, p.id
FROM policies pol
JOIN permissions p ON p.name = ANY(ARRAY[
    'assets:read',
    'categories:read',
    'licenses:read',
    'checkout:read','checkout:create',
    'requests:read','requests:create',
    'maintenance:read','maintenance:create',
    'reports:read',
    'documents:read'
])
WHERE pol.slug = 'requester'
ON CONFLICT DO NOTHING;

-- viewer
INSERT INTO policy_permissions (policy_id, permission_id)
SELECT pol.id, p.id
FROM policies pol
JOIN permissions p ON p.name = ANY(ARRAY[
    'assets:read',
    'categories:read',
    'cmdb:read',
    'warehouse:read',
    'inventory:read',
    'licenses:read',
    'accessories:read',
    'consumables:read',
    'components:read',
    'checkout:read',
    'requests:read',
    'maintenance:read',
    'reports:read',
    'analytics:read',
    'depreciation:read',
    'labels:read',
    'security:read',
    'documents:read',
    'automation:read'
])
WHERE pol.slug = 'viewer'
ON CONFLICT DO NOTHING;

-- ── 3. Verify ─────────────────────────────────────────────────────────────────
SELECT pol.slug, pol.name, COUNT(pp.permission_id) AS perm_count
FROM policies pol
LEFT JOIN policy_permissions pp ON pp.policy_id = pol.id
GROUP BY pol.slug, pol.name
ORDER BY pol.name;
