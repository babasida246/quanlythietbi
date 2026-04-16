-- ============================================================================
-- seed-rbac-classic.sql — Classic RBAC: Roles, Permissions, Role-Permission matrix
--
-- Extracted from archived migrations 050_rbac_permissions.sql and
-- 20260322_001_root_role.sql after schema squash (2026-04-07).
--
-- Chạy SAU seed-data.sql (cần bảng users, policies, policy_permissions,
-- policy_assignments đã tồn tại).
-- Idempotent: ON CONFLICT DO UPDATE / DO NOTHING.
-- ============================================================================

-- ── 1. Roles ─────────────────────────────────────────────────────────────────
INSERT INTO roles (slug, name, description, is_system) VALUES
    ('root',             'Superadmin',         'Vai trò siêu quản trị — vượt qua mọi kiểm tra phân quyền kể cả DENY policy.', true),
    ('admin',            'Quản trị viên',      'Toàn quyền hệ thống, quản lý người dùng và cấu hình', true),
    ('it_asset_manager', 'Quản lý CNTT',       'Quản lý toàn bộ tài sản, thiết bị và hạ tầng CNTT', true),
    ('warehouse_keeper', 'Thủ kho',            'Quản lý kho, nhập xuất vật tư, phụ kiện, linh kiện', true),
    ('technician',       'Kỹ thuật viên',      'Sửa chữa, bảo trì thiết bị; quản lý linh kiện thay thế', true),
    ('requester',        'Người dùng',         'Tạo yêu cầu, xem tài sản được giao, mượn trả thiết bị', true),
    ('viewer',           'Chỉ xem',            'Chỉ có quyền xem thông tin, không thể thực hiện thao tác ghi', true)
ON CONFLICT (slug) DO UPDATE SET
    name        = EXCLUDED.name,
    description = EXCLUDED.description,
    is_system   = EXCLUDED.is_system,
    updated_at  = NOW();

-- ── 2. Permissions ────────────────────────────────────────────────────────────
INSERT INTO permissions (name, resource, action, description) VALUES
    -- Tài sản
    ('assets:read',      'assets',      'read',    'Xem danh sách và chi tiết tài sản'),
    ('assets:create',    'assets',      'create',  'Thêm tài sản mới vào hệ thống'),
    ('assets:update',    'assets',      'update',  'Cập nhật thông tin tài sản'),
    ('assets:delete',    'assets',      'delete',  'Xóa tài sản khỏi hệ thống'),
    ('assets:export',    'assets',      'export',  'Xuất danh sách tài sản ra file Excel/PDF'),
    ('assets:import',    'assets',      'import',  'Nhập hàng loạt tài sản từ file'),
    ('assets:assign',    'assets',      'assign',  'Gán tài sản cho nhân viên hoặc phòng ban'),
    -- Danh mục
    ('categories:read',   'categories', 'read',    'Xem danh mục và cấu hình spec'),
    ('categories:manage', 'categories', 'manage',  'Thêm/sửa/xóa danh mục và trường spec'),
    -- CMDB
    ('cmdb:read',    'cmdb', 'read',   'Xem CI và mối quan hệ trong CMDB'),
    ('cmdb:create',  'cmdb', 'create', 'Thêm Configuration Item mới'),
    ('cmdb:update',  'cmdb', 'update', 'Cập nhật CI và thuộc tính'),
    ('cmdb:delete',  'cmdb', 'delete', 'Xóa CI khỏi CMDB'),
    -- Kho hàng
    ('warehouse:read',    'warehouse', 'read',    'Xem tồn kho, lịch sử nhập/xuất'),
    ('warehouse:create',  'warehouse', 'create',  'Tạo phiếu nhập/xuất/điều chuyển kho'),
    ('warehouse:approve', 'warehouse', 'approve', 'Duyệt và hoàn tất phiếu kho'),
    -- Kiểm kê
    ('inventory:read',   'inventory', 'read',   'Xem kết quả và lịch sử kiểm kê'),
    ('inventory:create', 'inventory', 'create', 'Tạo đợt kiểm kê mới'),
    ('inventory:manage', 'inventory', 'manage', 'Quản lý và chốt kết quả kiểm kê'),
    -- License
    ('licenses:read',   'licenses', 'read',   'Xem giấy phép phần mềm và số ghế'),
    ('licenses:manage', 'licenses', 'manage', 'Quản lý giấy phép, gán/thu hồi ghế'),
    -- Phụ kiện
    ('accessories:read',   'accessories', 'read',   'Xem danh sách phụ kiện và tình trạng'),
    ('accessories:manage', 'accessories', 'manage', 'Nhập/xuất/điều chuyển phụ kiện'),
    -- Vật tư tiêu hao
    ('consumables:read',   'consumables', 'read',   'Xem vật tư tiêu hao và tồn kho'),
    ('consumables:manage', 'consumables', 'manage', 'Nhập/cấp phát vật tư tiêu hao'),
    -- Linh kiện
    ('components:read',   'components', 'read',   'Xem linh kiện và lịch sử thay thế'),
    ('components:manage', 'components', 'manage', 'Nhập/lắp/tháo linh kiện thiết bị'),
    -- Mượn/Trả
    ('checkout:read',    'checkout', 'read',    'Xem lịch sử mượn/trả thiết bị'),
    ('checkout:create',  'checkout', 'create',  'Tạo phiếu mượn thiết bị'),
    ('checkout:approve', 'checkout', 'approve', 'Duyệt phiếu mượn và xác nhận trả'),
    -- Yêu cầu
    ('requests:read',    'requests', 'read',    'Xem yêu cầu và trạng thái xử lý'),
    ('requests:create',  'requests', 'create',  'Tạo yêu cầu mua sắm/sửa chữa/điều chuyển'),
    ('requests:approve', 'requests', 'approve', 'Duyệt và xử lý yêu cầu'),
    -- Bảo trì
    ('maintenance:read',   'maintenance', 'read',   'Xem lệnh và lịch sử bảo trì/sửa chữa'),
    ('maintenance:create', 'maintenance', 'create', 'Tạo lệnh bảo trì hoặc phiếu sửa chữa'),
    ('maintenance:manage', 'maintenance', 'manage', 'Cập nhật, hoàn thành lệnh bảo trì'),
    -- Báo cáo / Analytics
    ('reports:read',    'reports',   'read',    'Xem các báo cáo tổng hợp'),
    ('reports:export',  'reports',   'export',  'Xuất báo cáo ra file'),
    ('analytics:read',  'analytics', 'read',    'Xem dashboard và biểu đồ phân tích'),
    -- Khấu hao
    ('depreciation:read',   'depreciation', 'read',   'Xem lịch và kết quả khấu hao'),
    ('depreciation:manage', 'depreciation', 'manage', 'Cấu hình và chạy tính khấu hao'),
    -- Nhãn
    ('labels:read',   'labels', 'read',   'Xem nhãn và mẫu in'),
    ('labels:manage', 'labels', 'manage', 'Tạo/sửa mẫu nhãn, in nhãn'),
    -- Tài liệu
    ('documents:read',   'documents', 'read',   'Xem tài liệu đính kèm'),
    ('documents:upload', 'documents', 'upload', 'Tải tài liệu lên hệ thống'),
    ('documents:delete', 'documents', 'delete', 'Xóa tài liệu'),
    -- Tự động hóa
    ('automation:read',   'automation', 'read',   'Xem quy tắc tự động hóa'),
    ('automation:manage', 'automation', 'manage', 'Tạo/sửa quy tắc tự động hóa'),
    -- Tích hợp
    ('integrations:read',   'integrations', 'read',   'Xem cấu hình tích hợp'),
    ('integrations:manage', 'integrations', 'manage', 'Quản lý kết nối tích hợp bên ngoài'),
    -- Bảo mật
    ('security:read',   'security', 'read',   'Xem nhật ký bảo mật và tuân thủ'),
    ('security:manage', 'security', 'manage', 'Quản lý cấu hình bảo mật'),
    -- Admin
    ('admin:users',    'admin', 'users',    'Quản lý tài khoản và thông tin người dùng'),
    ('admin:roles',    'admin', 'roles',    'Quản lý vai trò và gán quyền'),
    ('admin:settings', 'admin', 'settings', 'Cấu hình thông số hệ thống')
ON CONFLICT (name) DO UPDATE SET
    resource    = EXCLUDED.resource,
    action      = EXCLUDED.action,
    description = EXCLUDED.description;

-- ── 3. Role-Permission matrix ─────────────────────────────────────────────────

-- root + admin: toàn quyền
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.slug IN ('root', 'admin')
ON CONFLICT DO NOTHING;

-- it_asset_manager
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r
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
    'reports:read','reports:export','analytics:read',
    'depreciation:read','depreciation:manage',
    'labels:read','labels:manage',
    'documents:read','documents:upload','documents:delete',
    'automation:read','automation:manage',
    'integrations:read','integrations:manage',
    'security:read'
]) WHERE r.slug = 'it_asset_manager'
ON CONFLICT DO NOTHING;

-- warehouse_keeper
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r
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
]) WHERE r.slug = 'warehouse_keeper'
ON CONFLICT DO NOTHING;

-- technician
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r
JOIN permissions p ON p.name = ANY(ARRAY[
    'assets:read','categories:read','cmdb:read',
    'warehouse:read','inventory:read',
    'accessories:read','consumables:read',
    'components:read','components:manage',
    'checkout:read','checkout:create',
    'requests:read','requests:create',
    'maintenance:read','maintenance:create','maintenance:manage',
    'reports:read','labels:read',
    'documents:read','documents:upload'
]) WHERE r.slug = 'technician'
ON CONFLICT DO NOTHING;

-- requester (user)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r
JOIN permissions p ON p.name = ANY(ARRAY[
    'assets:read','categories:read','licenses:read',
    'checkout:read','checkout:create',
    'requests:read','requests:create',
    'maintenance:read','maintenance:create',
    'reports:read','documents:read'
]) WHERE r.slug = 'requester'
ON CONFLICT DO NOTHING;

-- viewer
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r
JOIN permissions p ON p.name = ANY(ARRAY[
    'assets:read','categories:read','cmdb:read',
    'warehouse:read','inventory:read','licenses:read',
    'accessories:read','consumables:read','components:read',
    'checkout:read','requests:read','maintenance:read',
    'reports:read','analytics:read','depreciation:read',
    'labels:read','security:read','documents:read','automation:read'
]) WHERE r.slug = 'viewer'
ON CONFLICT DO NOTHING;

-- ── 4. Root policy (superadmin policy — từ migration 20260322_001) ────────────
INSERT INTO policies (id, slug, name, description, is_system)
VALUES (
    'ffffffff-ffff-ffff-ffff-ffffffffffff',
    'root', 'Superadmin',
    'Vai trò siêu quản trị — vượt qua mọi kiểm tra phân quyền kể cả DENY policy.',
    true
)
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name, description = EXCLUDED.description,
    is_system = true, updated_at = NOW();

INSERT INTO policy_permissions (policy_id, permission_id)
SELECT pol.id, p.id FROM policies pol CROSS JOIN permissions p
WHERE pol.slug = 'root'
ON CONFLICT DO NOTHING;

-- ── 5. Tài khoản root (bootstrap — từ migration 20260322_001) ────────────────
INSERT INTO users (id, email, name, username, password_hash, role, is_active, status)
VALUES (
    '00000000-0000-0000-0000-000000000000',
    'root@system.local', 'Root Superadmin', 'root',
    '$2b$10$uUd3WfgsTfuV.2rK23paM.v66yLIOKeg5Hrrml4WtO2v/Ep5FEVXu',
    'root', true, 'active'
)
ON CONFLICT (email) DO UPDATE SET
    id = EXCLUDED.id, name = EXCLUDED.name, username = EXCLUDED.username,
    password_hash = EXCLUDED.password_hash, role = 'root',
    is_active = true, status = 'active', updated_at = NOW();

-- Policy assignment ALLOW cho root user
INSERT INTO policy_assignments (policy_id, principal_type, principal_id, scope_type, effect, inherit)
SELECT pol.id, 'USER', u.id, 'GLOBAL', 'ALLOW', true
FROM policies pol, users u
WHERE pol.slug = 'root' AND u.email = 'root@system.local'
  AND NOT EXISTS (
    SELECT 1 FROM policy_assignments pa2
    WHERE pa2.policy_id = pol.id
      AND pa2.principal_type = 'USER'
      AND pa2.principal_id = u.id
  );
