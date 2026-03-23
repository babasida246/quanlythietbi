-- ============================================================================
-- Migration 20260322_001: Thêm vai trò root (superadmin bất khả xâm phạm)
--
-- root là vai trò duy nhất không bị ảnh hưởng bởi Policy DENY và không thể
-- bị giới hạn quyền qua PolicyLibrary. Admin có thể bị giới hạn bởi root.
--
-- Tài khoản:  root@system.local / Benhvien@121
-- User UUID:  00000000-0000-0000-0000-000000000000  (nil UUID — sentinel)
-- Role/Policy UUID: ffffffff-ffff-ffff-ffff-ffffffffffff (all-F sentinel)
-- ============================================================================

BEGIN;

-- ── 1. Mở rộng CHECK constraint trên users.role để chứa 'root' ───────────────
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
    CHECK (role IN (
        'root',
        'admin', 'super_admin',
        'it_asset_manager',
        'warehouse_keeper',
        'accountant',
        'technician',
        'requester',
        'user',
        'viewer'
    ));

-- ── 2. Thêm role 'root' vào bảng roles ──────────────────────────────────────
INSERT INTO roles (id, slug, name, description, is_system)
VALUES (
    'ffffffff-ffff-ffff-ffff-ffffffffffff',
    'root',
    'Superadmin',
    'Vai trò siêu quản trị — vượt qua mọi kiểm tra phân quyền kể cả DENY policy. '
    'Có thể cấp/giới hạn quyền cho Admin qua PolicyLibrary.',
    true
)
ON CONFLICT (slug) DO UPDATE SET
    name        = EXCLUDED.name,
    description = EXCLUDED.description,
    is_system   = true,
    updated_at  = NOW();

-- ── 3. Cấp toàn bộ permissions cho root trong role_permissions ───────────────
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r CROSS JOIN permissions p
WHERE r.slug = 'root'
ON CONFLICT DO NOTHING;

-- ── 4. Đồng bộ root vào policies (theo pattern của migration 060) ─────────────
INSERT INTO policies (id, slug, name, description, is_system)
VALUES (
    'ffffffff-ffff-ffff-ffff-ffffffffffff',
    'root',
    'Superadmin',
    'Vai trò siêu quản trị — vượt qua mọi kiểm tra phân quyền kể cả DENY policy.',
    true
)
ON CONFLICT (slug) DO UPDATE SET
    name        = EXCLUDED.name,
    description = EXCLUDED.description,
    is_system   = true,
    updated_at  = NOW();

-- ── 5. Cấp toàn bộ permissions cho root policy trong policy_permissions ────────
INSERT INTO policy_permissions (policy_id, permission_id)
SELECT pol.id, p.id
FROM policies pol CROSS JOIN permissions p
WHERE pol.slug = 'root'
ON CONFLICT DO NOTHING;

-- ── 6. Tạo tài khoản root (bootstrap system account) ─────────────────────────
-- Mật khẩu: Benhvien@121 (bcrypt hash — cùng pattern với các tài khoản khác)
INSERT INTO users
    (id, email, name, username, password_hash, role, is_active, status, created_at, updated_at)
VALUES (
    '00000000-0000-0000-0000-000000000000',
    'root@system.local',
    'Root Superadmin',
    'root',
    '$2b$10$uUd3WfgsTfuV.2rK23paM.v66yLIOKeg5Hrrml4WtO2v/Ep5FEVXu',
    'root',
    true,
    'active',
    NOW(),
    NOW()
)
ON CONFLICT (email) DO UPDATE SET
    id            = EXCLUDED.id,
    name          = EXCLUDED.name,
    username      = EXCLUDED.username,
    password_hash = EXCLUDED.password_hash,
    role          = 'root',
    is_active     = true,
    status        = 'active',
    updated_at    = NOW();

-- ── 7. Tạo policy_assignment ALLOW cho root user ─────────────────────────────
-- policy_assignments không có unique constraint trên (policy_id, principal_type, principal_id)
-- → dùng WHERE NOT EXISTS để đảm bảo idempotent
INSERT INTO policy_assignments
    (policy_id, principal_type, principal_id, scope_type, effect, inherit)
SELECT
    pol.id,
    'USER',
    u.id,
    'GLOBAL',
    'ALLOW',
    true
FROM policies pol, users u
WHERE pol.slug = 'root'
  AND u.email = 'root@system.local'
  AND NOT EXISTS (
    SELECT 1 FROM policy_assignments pa2
    WHERE pa2.policy_id = pol.id
      AND pa2.principal_type = 'USER'
      AND pa2.principal_id = u.id
  );

COMMIT;
