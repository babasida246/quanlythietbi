-- ============================================================================
-- Migration 050: RBAC — Roles, Permissions, Role-Permission assignments
-- Thiết kế ma trận phân quyền chi tiết cho hệ thống QLTS
-- ============================================================================

-- ============================================================================
-- 1. Bảng roles — Định nghĩa vai trò hệ thống
-- ============================================================================
CREATE TABLE
IF NOT EXISTS roles
(
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4
(),
    slug        TEXT NOT NULL UNIQUE,
    name        TEXT NOT NULL,
    description TEXT,
    is_system   BOOLEAN NOT NULL DEFAULT false,  -- true: không được xóa
    created_at  TIMESTAMPTZ DEFAULT NOW
(),
    updated_at  TIMESTAMPTZ DEFAULT NOW
()
);

-- ============================================================================
-- 2. Bảng permissions — Định nghĩa từng quyền hạn cụ thể
-- Cú pháp: resource:action, ví dụ 'assets:create'
-- ============================================================================
CREATE TABLE
IF NOT EXISTS permissions
(
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4
(),
    name        TEXT NOT NULL UNIQUE,   -- 'assets:create'
    resource    TEXT NOT NULL,          -- 'assets'
    action      TEXT NOT NULL,          -- 'create'
    description TEXT,
    created_at  TIMESTAMPTZ DEFAULT NOW
()
);

CREATE INDEX
IF NOT EXISTS idx_permissions_resource ON permissions
(resource);

-- ============================================================================
-- 3. Bảng role_permissions — Ma trận phân quyền (role → permission)
-- ============================================================================
CREATE TABLE
IF NOT EXISTS role_permissions
(
    role_id       UUID NOT NULL REFERENCES roles
(id) ON
DELETE CASCADE,
    permission_id UUID
NOT NULL REFERENCES permissions
(id) ON
DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

CREATE INDEX
IF NOT EXISTS idx_role_permissions_role ON role_permissions
(role_id);

-- ============================================================================
-- 4. Seed: Các vai trò hệ thống
-- ============================================================================
INSERT INTO roles
    (slug, name, description, is_system)
VALUES
    ('admin', 'Quản trị viên', 'Toàn quyền hệ thống, quản lý người dùng và cấu hình', true),
    ('it_asset_manager', 'Quản lý CNTT', 'Quản lý toàn bộ tài sản, thiết bị và hạ tầng CNTT', true),
    ('warehouse_keeper', 'Thủ kho', 'Quản lý kho, nhập xuất vật tư, phụ kiện, linh kiện', true),
    ('technician', 'Kỹ thuật viên', 'Sửa chữa, bảo trì thiết bị; quản lý linh kiện thay thế', true),
    ('requester', 'Người dùng', 'Tạo yêu cầu, xem tài sản được giao, mượn trả thiết bị', true),
    ('viewer', 'Chỉ xem', 'Chỉ có quyền xem thông tin, không thể thực hiện thao tác ghi', true)
ON CONFLICT
(slug) DO
UPDATE SET
    name        = EXCLUDED.name,
    description = EXCLUDED.description,
    is_system   = EXCLUDED.is_system,
    updated_at  = NOW();

-- ============================================================================
-- 5. Seed: Toàn bộ permissions
-- ============================================================================
INSERT INTO permissions
    (name, resource, action, description)
VALUES
    -- ── Tài sản (Assets) ──────────────────────────────────────────────────
    ('assets:read', 'assets', 'read', 'Xem danh sách và chi tiết tài sản'),
    ('assets:create', 'assets', 'create', 'Thêm tài sản mới vào hệ thống'),
    ('assets:update', 'assets', 'update', 'Cập nhật thông tin tài sản'),
    ('assets:delete', 'assets', 'delete', 'Xóa tài sản khỏi hệ thống'),
    ('assets:export', 'assets', 'export', 'Xuất danh sách tài sản ra file Excel/PDF'),
    ('assets:import', 'assets', 'import', 'Nhập hàng loạt tài sản từ file'),
    ('assets:assign', 'assets', 'assign', 'Gán tài sản cho nhân viên hoặc phòng ban'),

    -- ── Danh mục tài sản (Categories) ────────────────────────────────────
    ('categories:read', 'categories', 'read', 'Xem danh mục và cấu hình spec'),
    ('categories:manage', 'categories', 'manage', 'Thêm/sửa/xóa danh mục và trường spec'),

    -- ── CMDB ──────────────────────────────────────────────────────────────
    ('cmdb:read', 'cmdb', 'read', 'Xem CI và mối quan hệ trong CMDB'),
    ('cmdb:create', 'cmdb', 'create', 'Thêm Configuration Item mới'),
    ('cmdb:update', 'cmdb', 'update', 'Cập nhật CI và thuộc tính'),
    ('cmdb:delete', 'cmdb', 'delete', 'Xóa CI khỏi CMDB'),

    -- ── Kho hàng (Warehouse) ─────────────────────────────────────────────
    ('warehouse:read', 'warehouse', 'read', 'Xem tồn kho, lịch sử nhập/xuất'),
    ('warehouse:create', 'warehouse', 'create', 'Tạo phiếu nhập/xuất/điều chuyển kho'),
    ('warehouse:approve', 'warehouse', 'approve', 'Duyệt và hoàn tất phiếu kho'),

    -- ── Kiểm kê (Inventory/Audit Sessions) ───────────────────────────────
    ('inventory:read', 'inventory', 'read', 'Xem kết quả và lịch sử kiểm kê'),
    ('inventory:create', 'inventory', 'create', 'Tạo đợt kiểm kê mới'),
    ('inventory:manage', 'inventory', 'manage', 'Quản lý và chốt kết quả kiểm kê'),

    -- ── Giấy phép phần mềm (Licenses) ────────────────────────────────────
    ('licenses:read', 'licenses', 'read', 'Xem giấy phép phần mềm và số ghế'),
    ('licenses:manage', 'licenses', 'manage', 'Quản lý giấy phép, gán/thu hồi ghế'),

    -- ── Phụ kiện (Accessories) ────────────────────────────────────────────
    ('accessories:read', 'accessories', 'read', 'Xem danh sách phụ kiện và tình trạng'),
    ('accessories:manage', 'accessories', 'manage', 'Nhập/xuất/điều chuyển phụ kiện'),

    -- ── Vật tư tiêu hao (Consumables) ────────────────────────────────────
    ('consumables:read', 'consumables', 'read', 'Xem vật tư tiêu hao và tồn kho'),
    ('consumables:manage', 'consumables', 'manage', 'Nhập/cấp phát vật tư tiêu hao'),

    -- ── Linh kiện thay thế (Components) ─────────────────────────────────
    ('components:read', 'components', 'read', 'Xem linh kiện và lịch sử thay thế'),
    ('components:manage', 'components', 'manage', 'Nhập/lắp/tháo linh kiện thiết bị'),

    -- ── Mượn/Trả (Checkout) ───────────────────────────────────────────────
    ('checkout:read', 'checkout', 'read', 'Xem lịch sử mượn/trả thiết bị'),
    ('checkout:create', 'checkout', 'create', 'Tạo phiếu mượn thiết bị'),
    ('checkout:approve', 'checkout', 'approve', 'Duyệt phiếu mượn và xác nhận trả'),

    -- ── Yêu cầu (Workflow Requests) ───────────────────────────────────────
    ('requests:read', 'requests', 'read', 'Xem yêu cầu và trạng thái xử lý'),
    ('requests:create', 'requests', 'create', 'Tạo yêu cầu mua sắm/sửa chữa/điều chuyển'),
    ('requests:approve', 'requests', 'approve', 'Duyệt và xử lý yêu cầu'),

    -- ── Sửa chữa/Bảo trì (Maintenance) ───────────────────────────────────
    ('maintenance:read', 'maintenance', 'read', 'Xem lệnh và lịch sử bảo trì/sửa chữa'),
    ('maintenance:create', 'maintenance', 'create', 'Tạo lệnh bảo trì hoặc phiếu sửa chữa'),
    ('maintenance:manage', 'maintenance', 'manage', 'Cập nhật, hoàn thành lệnh bảo trì'),

    -- ── Báo cáo (Reports) ─────────────────────────────────────────────────
    ('reports:read', 'reports', 'read', 'Xem các báo cáo tổng hợp'),
    ('reports:export', 'reports', 'export', 'Xuất báo cáo ra file'),

    -- ── Phân tích (Analytics) ─────────────────────────────────────────────
    ('analytics:read', 'analytics', 'read', 'Xem dashboard và biểu đồ phân tích'),

    -- ── Khấu hao (Depreciation) ───────────────────────────────────────────
    ('depreciation:read', 'depreciation', 'read', 'Xem lịch và kết quả khấu hao'),
    ('depreciation:manage', 'depreciation', 'manage', 'Cấu hình và chạy tính khấu hao'),

    -- ── Nhãn (Labels) ─────────────────────────────────────────────────────
    ('labels:read', 'labels', 'read', 'Xem nhãn và mẫu in'),
    ('labels:manage', 'labels', 'manage', 'Tạo/sửa mẫu nhãn, in nhãn'),

    -- ── Tài liệu (Documents) ─────────────────────────────────────────────
    ('documents:read', 'documents', 'read', 'Xem tài liệu đính kèm'),
    ('documents:upload', 'documents', 'upload', 'Tải tài liệu lên hệ thống'),
    ('documents:delete', 'documents', 'delete', 'Xóa tài liệu'),

    -- ── Tự động hóa (Automation) ──────────────────────────────────────────
    ('automation:read', 'automation', 'read', 'Xem quy tắc tự động hóa'),
    ('automation:manage', 'automation', 'manage', 'Tạo/sửa quy tắc tự động hóa'),

    -- ── Tích hợp (Integrations) ───────────────────────────────────────────
    ('integrations:read', 'integrations', 'read', 'Xem cấu hình tích hợp'),
    ('integrations:manage', 'integrations', 'manage', 'Quản lý kết nối tích hợp bên ngoài'),

    -- ── Bảo mật (Security) ────────────────────────────────────────────────
    ('security:read', 'security', 'read', 'Xem nhật ký bảo mật và tuân thủ'),
    ('security:manage', 'security', 'manage', 'Quản lý cấu hình bảo mật'),

    -- ── Quản trị (Admin) ─────────────────────────────────────────────────
    ('admin:users', 'admin', 'users', 'Quản lý tài khoản và thông tin người dùng'),
    ('admin:roles', 'admin', 'roles', 'Quản lý vai trò và gán quyền'),
    ('admin:settings', 'admin', 'settings', 'Cấu hình thông số hệ thống')

ON CONFLICT
(name) DO
UPDATE SET
    resource    = EXCLUDED.resource,
    action      = EXCLUDED.action,
    description = EXCLUDED.description;

-- ============================================================================
-- 6. Ma trận phân quyền
-- ============================================================================

-- ── ADMIN: Toàn quyền (all permissions) ────────────────────────────────────
INSERT INTO role_permissions
    (role_id, permission_id)
SELECT r.id, p.id
FROM roles r CROSS JOIN permissions p
WHERE r.slug = 'admin'
ON CONFLICT DO NOTHING;

-- ── IT_ASSET_MANAGER ────────────────────────────────────────────────────────
INSERT INTO role_permissions
    (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
    JOIN permissions p ON p.name = ANY(ARRAY[
    -- Tài sản: full (trừ categories:manage thuộc admin)
    'assets:read','assets:create','assets:update','assets:delete',
    'assets:export','assets:import','assets:assign',
    -- Danh mục: full
    'categories:read','categories:manage',
    -- CMDB: full
    'cmdb:read','cmdb:create','cmdb:update','cmdb:delete',
    -- Kho: full
    'warehouse:read','warehouse:create','warehouse:approve',
    -- Kiểm kê: full
    'inventory:read','inventory:create','inventory:manage',
    -- License: full
    'licenses:read','licenses:manage',
    -- Phụ kiện, vật tư, linh kiện: full
    'accessories:read','accessories:manage',
    'consumables:read','consumables:manage',
    'components:read','components:manage',
    -- Mượn trả: full
    'checkout:read','checkout:create','checkout:approve',
    -- Yêu cầu: full
    'requests:read','requests:create','requests:approve',
    -- Bảo trì: full
    'maintenance:read','maintenance:create','maintenance:manage',
    -- Báo cáo + analytics: full
    'reports:read','reports:export',
    'analytics:read',
    -- Khấu hao: full
    'depreciation:read','depreciation:manage',
    -- Nhãn: full
    'labels:read','labels:manage',
    -- Tài liệu: full
    'documents:read','documents:upload','documents:delete',
    -- Tự động hóa + tích hợp
    'automation:read','automation:manage',
    'integrations:read','integrations:manage',
    -- Bảo mật: read
    'security:read'
    -- KHÔNG có: admin:users, admin:roles, admin:settings, security:manage
])
WHERE r.slug = 'it_asset_manager'
ON CONFLICT DO NOTHING;

-- ── WAREHOUSE_KEEPER: Thủ kho ───────────────────────────────────────────────
INSERT INTO role_permissions
    (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
    JOIN permissions p ON p.name = ANY(ARRAY[
    -- Tài sản: xem + tạo + sửa + xuất (không xóa, không import, không assign)
    'assets:read','assets:create','assets:update','assets:export',
    -- Danh mục: chỉ xem
    'categories:read',
    -- Kho: tạo phiếu (không duyệt — duyệt là quyền manager)
    'warehouse:read','warehouse:create',
    -- Kiểm kê: tham gia kiểm kê
    'inventory:read','inventory:create',
    -- Phụ kiện, vật tư, linh kiện: quản lý kho
    'accessories:read','accessories:manage',
    'consumables:read','consumables:manage',
    'components:read','components:manage',
    -- Yêu cầu: xem và tạo
    'requests:read','requests:create',
    -- Kiểm toán: xem + tạo đợt
    'audit:read','audit:create',
    -- Bảo trì: chỉ xem
    'maintenance:read',
    -- Báo cáo: xem + xuất
    'reports:read','reports:export',
    -- Khấu hao: chỉ xem
    'depreciation:read',
    -- Nhãn: xem + in (quản lý nhãn kho)
    'labels:read','labels:manage',
    -- Tài liệu: xem + tải lên
    'documents:read','documents:upload'
])
WHERE r.slug = 'warehouse_keeper'
ON CONFLICT DO NOTHING;

-- ── TECHNICIAN: Kỹ thuật viên ───────────────────────────────────────────────
INSERT INTO role_permissions
    (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
    JOIN permissions p ON p.name = ANY(ARRAY[
    -- Tài sản: chỉ xem
    'assets:read',
    -- Danh mục: chỉ xem
    'categories:read',
    -- CMDB: chỉ xem (cần xem hạ tầng để sửa chữa)
    'cmdb:read',
    -- Kho: chỉ xem
    'warehouse:read',
    -- Kiểm kê: chỉ xem
    'inventory:read',
    -- Phụ kiện: chỉ xem
    'accessories:read',
    -- Vật tư: chỉ xem
    'consumables:read',
    -- Linh kiện: xem và quản lý (thay linh kiện)
    'components:read','components:manage',
    -- Mượn trả: xem và tạo
    'checkout:read','checkout:create',
    -- Yêu cầu: xem và tạo
    'requests:read','requests:create',
    -- Bảo trì: xem + tạo + hoàn thành (core task)
    'maintenance:read','maintenance:create','maintenance:manage',
    -- Báo cáo: chỉ xem
    'reports:read',
    -- Nhãn: chỉ xem
    'labels:read',
    -- Tài liệu: xem + tải lên (tải ảnh sửa chữa, hướng dẫn)
    'documents:read','documents:upload'
])
WHERE r.slug = 'technician'
ON CONFLICT DO NOTHING;

-- ── REQUESTER: Người dùng thông thường ─────────────────────────────────────
INSERT INTO role_permissions
    (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
    JOIN permissions p ON p.name = ANY(ARRAY[
    -- Tài sản: chỉ xem (tài sản được giao)
    'assets:read',
    -- Danh mục: chỉ xem
    'categories:read',
    -- License: chỉ xem
    'licenses:read',
    -- Mượn trả: xem và tạo phiếu mượn
    'checkout:read','checkout:create',
    -- Yêu cầu: xem và tạo (core task của requester)
    'requests:read','requests:create',
    -- Bảo trì: xem + báo hỏng
    'maintenance:read','maintenance:create',
    -- Báo cáo: chỉ xem
    'reports:read',
    -- Tài liệu: chỉ xem
    'documents:read'
])
WHERE r.slug = 'requester'
ON CONFLICT DO NOTHING;

-- ── VIEWER: Chỉ xem ─────────────────────────────────────────────────────────
INSERT INTO role_permissions
    (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
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
    -- KHÔNG có: *:create, *:update, *:delete, *:manage, *:approve, *:export
])
WHERE r.slug = 'viewer'
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 7. Cập nhật CHECK constraint trên users.role để chứa vai trò mới
-- ============================================================================
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
    CHECK (role IN (
        'admin', 'super_admin',
        'it_asset_manager',
        'warehouse_keeper',
        'technician',
        'requester',
        'user',    -- alias cho 'requester' (backward compat)
        'viewer'
    ));

-- ============================================================================
-- NOTE: Không tự động migrate role 'user' → 'requester'
-- Để an toàn, 'user' được xử lý như 'requester' trong application code.
-- Admin có thể đổi thủ công qua trang quản lý người dùng.
-- ============================================================================
