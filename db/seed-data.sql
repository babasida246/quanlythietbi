-- ============================================================================
-- seed-data.sql — Dữ liệu nền tảng: Users, CMDB CI Types, Relationship Types
-- Chỉ chứa dữ liệu cho các bảng nền không phụ thuộc asset/warehouse
-- Chạy ĐẦU TIÊN trước seed-assets-management.sql
-- ============================================================================
-- Usage:
--   docker cp db/seed-data.sql qltb-postgres:/tmp/
--   docker exec -i qltb-postgres psql -U postgres -d netopsai_gateway -f /tmp/seed-data.sql

BEGIN;

    -- ============================================================================
    -- 1. ADMIN USERS  (password = "Benhvien@121" cho tất cả)
    -- Hash được tạo bằng: bcryptjs.hash('Benhvien@121', 10)
    -- ============================================================================
    INSERT INTO users
        (id, email, name, username, password_hash, role, is_active, status, created_at, updated_at)
    VALUES
        ('00000000-0000-0000-0000-000000000001', 'admin@example.com', 'Admin Hệ thống', 'admin', '$2b$10$uUd3WfgsTfuV.2rK23paM.v66yLIOKeg5Hrrml4WtO2v/Ep5FEVXu', 'admin', true, 'active', NOW(), NOW()),
        ('00000000-0000-0000-0000-000000000002', 'it.manager@example.com', 'Nguyễn Văn Quản', 'nvquan', '$2b$10$uUd3WfgsTfuV.2rK23paM.v66yLIOKeg5Hrrml4WtO2v/Ep5FEVXu', 'it_asset_manager', true, 'active', NOW(), NOW()),
        ('00000000-0000-0000-0000-000000000003', 'warehouse@example.com', 'Trần Thị Kho', 'ttkho', '$2b$10$uUd3WfgsTfuV.2rK23paM.v66yLIOKeg5Hrrml4WtO2v/Ep5FEVXu', 'warehouse_keeper', true, 'active', NOW(), NOW()),
        ('00000000-0000-0000-0000-000000000004', 'helpdesk@example.com', 'Lê Minh Hỗ trợ', 'lmhotro', '$2b$10$uUd3WfgsTfuV.2rK23paM.v66yLIOKeg5Hrrml4WtO2v/Ep5FEVXu', 'user', true, 'active', NOW(), NOW()),
        ('00000000-0000-0000-0000-000000000005', 'accountant@example.com', 'Phạm Thu Kế toán', 'ptketoan', '$2b$10$uUd3WfgsTfuV.2rK23paM.v66yLIOKeg5Hrrml4WtO2v/Ep5FEVXu', 'accountant', true, 'active', NOW(), NOW())
    ON CONFLICT
    (email) DO
    UPDATE SET
    id = EXCLUDED.id, name = EXCLUDED.name, username = EXCLUDED.username,
    password_hash = EXCLUDED.password_hash, role = EXCLUDED.role,
    is_active = EXCLUDED.is_active, status = EXCLUDED.status;

    -- ============================================================================
    -- 2. CMDB CI TYPES (hạ tầng CNTT thực tế)
    -- Migration 007 đã seed: server, network_device, storage, database, application, service
    -- Bổ sung thêm: virtual_machine, workstation
    -- ============================================================================
    INSERT INTO cmdb_ci_types
        (code, name, description, created_at)
    VALUES
        ('server', 'Máy chủ vật lý', 'Server vật lý rack/tower/blade', NOW()),
        ('virtual_machine', 'Máy ảo (VM)', 'Virtual Machine chạy trên hypervisor', NOW()),
        ('network_device', 'Thiết bị mạng', 'Switch, Router, Access Point, Firewall', NOW()),
        ('storage', 'Hệ thống lưu trữ', 'SAN, NAS, Object Storage', NOW()),
        ('database', 'Cơ sở dữ liệu', 'PostgreSQL, MySQL, SQL Server, Oracle', NOW()),
        ('application', 'Ứng dụng', 'Web app, API, Microservice', NOW()),
        ('service', 'Dịch vụ CNTT', 'Email, VPN, DNS, DHCP, Active Directory', NOW()),
        ('workstation', 'Máy trạm', 'PC/Laptop endpoint người dùng cuối', NOW())
    ON CONFLICT
    (code) DO
    UPDATE SET
    name = EXCLUDED.name, description = EXCLUDED.description;

    -- ============================================================================
    -- 3. CMDB RELATIONSHIP TYPES
    -- Migration 007 đã seed: runs_on, depends_on, connects_to, part_of, managed_by
    -- Bổ sung thêm: backed_up_by
    -- ============================================================================
    INSERT INTO cmdb_relationship_types
        (code, name, reverse_name, created_at)
    VALUES
        ('runs_on', 'Chạy trên', 'Hosts', NOW()),
        ('depends_on', 'Phụ thuộc', 'Supports', NOW()),
        ('connects_to', 'Kết nối đến', 'Kết nối từ', NOW()),
        ('part_of', 'Thuộc về', 'Bao gồm', NOW()),
        ('managed_by', 'Được quản lý bởi', 'Quản lý', NOW()),
        ('backed_up_by', 'Được backup bởi', 'Backup cho', NOW())
    ON CONFLICT
    (code) DO
    UPDATE SET
    name = EXCLUDED.name, reverse_name = EXCLUDED.reverse_name;

    COMMIT;
