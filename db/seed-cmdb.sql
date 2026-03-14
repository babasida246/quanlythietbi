-- ============================================================================
-- seed-cmdb.sql — Bổ sung dữ liệu demo cho CMDB/Services
-- Chạy SAU seed-qlts-demo.sql (được gọi từ seed-all.sql)
-- Idempotent: sử dụng ON CONFLICT DO UPDATE/NOTHING
-- Usage: psql -U postgres -d qltb -f /tmp/seed-cmdb.sql
-- ============================================================================
SET client_encoding = 'UTF8';

BEGIN;

-- ============================================================================
-- CMDB SERVICES MỞ RỘNG — thêm 10 dịch vụ CNTT phổ biến
-- ============================================================================
INSERT INTO cmdb_services
    (id, code, name, description, criticality, owner, sla, status)
VALUES
    ('f6000000-0000-0000-0000-000000000010', 'SVC-DNS',
        'Dịch vụ DNS',
        'Máy chủ phân giải tên miền nội bộ và bên ngoài',
        'critical', 'Phòng CNTT',
        '{"uptime":"99.99%","response_time":"30m","resolution_time":"1h"}',
        'active'),

    ('f6000000-0000-0000-0000-000000000011', 'SVC-DHCP',
        'Dịch vụ DHCP',
        'Cấp phát địa chỉ IP động cho toàn bộ thiết bị trong mạng',
        'high', 'Phòng CNTT',
        '{"uptime":"99.9%","response_time":"1h","resolution_time":"2h"}',
        'active'),

    ('f6000000-0000-0000-0000-000000000012', 'SVC-FILESERVER',
        'Dịch vụ File Server',
        'Lưu trữ và chia sẻ tài liệu nội bộ theo phòng ban',
        'high', 'Phòng CNTT',
        '{"uptime":"99.5%","response_time":"4h","resolution_time":"8h"}',
        'active'),

    ('f6000000-0000-0000-0000-000000000013', 'SVC-PRINT',
        'Dịch vụ In ấn',
        'Quản lý máy in và hàng đợi in tập trung',
        'normal', 'Phòng CNTT',
        '{"uptime":"98%","response_time":"8h","resolution_time":"24h"}',
        'active'),

    ('f6000000-0000-0000-0000-000000000014', 'SVC-ANTIVIRUS',
        'Dịch vụ Antivirus',
        'Bảo vệ thiết bị đầu cuối và máy chủ khỏi mã độc',
        'high', 'Phòng An toàn thông tin',
        '{"uptime":"99.9%","response_time":"2h","resolution_time":"4h"}',
        'active'),

    ('f6000000-0000-0000-0000-000000000015', 'SVC-PROXY',
        'Dịch vụ Proxy / Web Filter',
        'Kiểm soát truy cập internet và lọc nội dung',
        'high', 'Phòng An toàn thông tin',
        '{"uptime":"99.9%","response_time":"2h","resolution_time":"4h"}',
        'active'),

    ('f6000000-0000-0000-0000-000000000016', 'SVC-HELPDESK',
        'Hệ thống Helpdesk / Ticketing',
        'Tiếp nhận và xử lý yêu cầu hỗ trợ kỹ thuật',
        'normal', 'Phòng CNTT',
        '{"uptime":"99%","response_time":"8h","resolution_time":"24h"}',
        'active'),

    ('f6000000-0000-0000-0000-000000000017', 'SVC-ERP',
        'Hệ thống ERP',
        'Quản lý nguồn lực doanh nghiệp — tài chính, nhân sự, mua sắm',
        'critical', 'Phòng Kế toán & IT',
        '{"uptime":"99.9%","response_time":"2h","resolution_time":"4h","maintenance_window":"Sun 02:00-05:00"}',
        'active'),

    ('f6000000-0000-0000-0000-000000000018', 'SVC-HIS',
        'Hệ thống Thông tin Bệnh viện (HIS)',
        'Quản lý hồ sơ bệnh nhân, lịch khám và viện phí',
        'critical', 'Phòng CNTT & Khám bệnh',
        '{"uptime":"99.99%","response_time":"1h","resolution_time":"2h","maintenance_window":"Mon 01:00-03:00"}',
        'active'),

    ('f6000000-0000-0000-0000-000000000019', 'SVC-NTP',
        'Dịch vụ NTP',
        'Đồng bộ thời gian cho toàn bộ thiết bị trong hệ thống',
        'high', 'Phòng CNTT',
        '{"uptime":"99.99%","response_time":"30m","resolution_time":"1h"}',
        'active'),

    ('f6000000-0000-0000-0000-000000000020', 'SVC-SIEM',
        'Hệ thống SIEM',
        'Thu thập, phân tích log và phát hiện sự kiện bảo mật',
        'high', 'Phòng An toàn thông tin',
        '{"uptime":"99.9%","response_time":"15m","resolution_time":"2h"}',
        'active')
ON CONFLICT (code) DO UPDATE SET
    name        = EXCLUDED.name,
    description = EXCLUDED.description,
    criticality = EXCLUDED.criticality,
    owner       = EXCLUDED.owner,
    sla         = EXCLUDED.sla,
    status      = EXCLUDED.status;

-- ============================================================================
-- GÁN CI VÀO CÁC DỊCH VỤ MỚI (service_cis)
-- Sử dụng CI IDs đã có trong seed-qlts-demo.sql
-- ============================================================================
INSERT INTO cmdb_service_cis
    (service_id, ci_id, dependency_type)
VALUES
    -- DNS: máy chủ vật lý
    ('f6000000-0000-0000-0000-000000000010', 'f3000000-0000-0000-0000-000000000001', 'primary'),
    -- DHCP: máy chủ vật lý
    ('f6000000-0000-0000-0000-000000000011', 'f3000000-0000-0000-0000-000000000001', 'supporting'),
    -- File Server: VM
    ('f6000000-0000-0000-0000-000000000012', 'f3000000-0000-0000-0000-000000000004', 'primary'),
    -- Antivirus: phụ thuộc DB và Application
    ('f6000000-0000-0000-0000-000000000014', 'f3000000-0000-0000-0000-000000000013', 'primary'),
    -- Proxy: firewall
    ('f6000000-0000-0000-0000-000000000015', 'f3000000-0000-0000-0000-000000000022', 'primary'),
    -- ERP: application + DB
    ('f6000000-0000-0000-0000-000000000017', 'f3000000-0000-0000-0000-000000000015', 'primary'),
    ('f6000000-0000-0000-0000-000000000017', 'f3000000-0000-0000-0000-000000000013', 'supporting'),
    -- HIS: application + DB
    ('f6000000-0000-0000-0000-000000000018', 'f3000000-0000-0000-0000-000000000016', 'primary'),
    ('f6000000-0000-0000-0000-000000000018', 'f3000000-0000-0000-0000-000000000014', 'supporting'),
    -- SIEM: monitoring server
    ('f6000000-0000-0000-0000-000000000020', 'f3000000-0000-0000-0000-000000000019', 'supporting')
ON CONFLICT (service_id, ci_id) DO UPDATE SET
    dependency_type = EXCLUDED.dependency_type;

COMMIT;
