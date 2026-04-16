-- ============================================================================
-- SEED DATA: PC-001 Complete Data
-- Asset: PC-001 (a1000000-0000-0000-0000-000000000001)
-- Dell OptiPlex 7000 — i7-12700, 16GB RAM, 512GB SSD — Kế Toán
-- Covers: repair orders, repair parts, component assignments, documents
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. REPAIR ORDERS  (3 phiếu sửa chữa cho PC-001)
-- ============================================================================
INSERT INTO repair_orders
    (id, asset_id, code, title, severity, status, repair_type,
     technician_name, vendor_id, labor_cost, parts_cost, downtime_minutes,
     diagnosis, resolution, opened_at, closed_at, created_by)
VALUES
    -- Quạt CPU hỏng — đã đóng
    ('a3000000-0000-0000-0000-000000000007',
     'a1000000-0000-0000-0000-000000000001',
     'RO-PC001-2023-01',
     'Quạt CPU PC-001 phát tiếng ồn lớn khi tải cao',
     'medium', 'closed', 'internal',
     'Nguyễn Văn Kỹ Thuật', NULL,
     150000, 380000, 90,
     'Quạt CPU Cooler Master Hyper 212 mòn ổ bi, kêu to khi CPU > 60°C',
     'Thay quạt CPU mới, bôi keo tản nhiệt NT-H1 và vệ sinh case',
     '2023-08-10', '2023-08-11',
     '00000000-0000-0000-0000-000000000006'),

    -- Lỗi HDMI — đã đóng
    ('a3000000-0000-0000-0000-000000000008',
     'a1000000-0000-0000-0000-000000000001',
     'RO-PC001-2024-01',
     'Màn hình không nhận tín hiệu HDMI từ PC-001',
     'high', 'closed', 'internal',
     'Nguyễn Văn Kỹ Thuật', NULL,
     200000, 0, 180,
     'Card đồ họa tích hợp Intel UHD 770 lỗi output HDMI, màn hình Dell 24" không lên hình sau khi cập nhật Windows',
     'Cài lại driver Intel Graphics 31.0.101.4575, cập nhật BIOS lên v1.12.0 → HDMI hoạt động bình thường',
     '2024-01-05', '2024-01-07',
     '00000000-0000-0000-0000-000000000006'),

    -- Nâng cấp SSD — đã hoàn thành sửa chữa, chưa đóng ticket
    ('a3000000-0000-0000-0000-000000000009',
     'a1000000-0000-0000-0000-000000000001',
     'RO-PC001-2025-01',
     'Nâng cấp SSD PC-001: 512GB → Samsung 980 Pro 1TB NVMe',
     'low', 'repaired', 'internal',
     'Nguyễn Văn Kỹ Thuật', NULL,
     100000, 3800000, 60,
     'SSD 512GB đạt >85% dung lượng, người dùng Kế Toán yêu cầu nâng cấp để lưu dữ liệu kế toán năm 2025',
     'Clone dữ liệu từ SSD 512GB sang Samsung 980 Pro 1TB bằng Samsung Data Migration, kiểm tra khởi động thành công',
     '2025-01-20', NULL,
     '00000000-0000-0000-0000-000000000006')
ON CONFLICT (code) DO
    UPDATE SET
        status     = EXCLUDED.status,
        closed_at  = EXCLUDED.closed_at,
        resolution = EXCLUDED.resolution;

-- ============================================================================
-- 2. REPAIR ORDER PARTS  (linh kiện thay thế)
-- ============================================================================
INSERT INTO repair_order_parts
    (id, repair_order_id, part_id, part_name, warehouse_id, action, qty, unit_cost)
VALUES
    -- Thay quạt CPU cho RO-PC001-2023-01
    ('a4000000-0000-0000-0000-000000000004',
     'a3000000-0000-0000-0000-000000000007',
     'c1000000-0000-0000-0000-000000000009',  -- SP-FAN-CPU
     'Quạt tản nhiệt CPU Cooler Master Hyper 212',
     'd1000000-0000-0000-0000-000000000004',
     'replace', 1, 380000),

    -- SSD 1TB cho RO-PC001-2025-01
    ('a4000000-0000-0000-0000-000000000005',
     'a3000000-0000-0000-0000-000000000009',
     'c1000000-0000-0000-0000-000000000006',  -- SP-SSD-1T
     'SSD NVMe 1TB Samsung 980 Pro',
     'd1000000-0000-0000-0000-000000000004',
     'replace', 1, 3800000)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 3. COMPONENT ASSIGNMENTS  (linh kiện lắp vào PC-001)
-- ============================================================================
INSERT INTO component_assignments
    (id, component_id, asset_id, quantity,
     installed_by, installed_at, installation_notes, status)
VALUES
    -- RAM Kingston DDR4 16GB — lắp khi bàn giao máy
    ('b3200000-0000-0000-0000-000000000003',
     'b3000000-0000-0000-0000-000000000001',   -- COMP-RAM-001: Kingston DDR4 16GB 3200
     'a1000000-0000-0000-0000-000000000001',
     1,
     '00000000-0000-0000-0000-000000000006',
     '2023-01-15',
     'Lắp RAM Kingston DDR4 16GB 3200MHz tại thời điểm nhận máy từ kho',
     'installed'),

    -- SSD Samsung 980 Pro 512GB NVMe — lắp sau khi nâng cấp tháng 1/2025
    ('b3200000-0000-0000-0000-000000000004',
     'b3000000-0000-0000-0000-000000000006',   -- COMP-SSD-002: Samsung 980 Pro 512GB NVMe
     'a1000000-0000-0000-0000-000000000001',
     1,
     '00000000-0000-0000-0000-000000000006',
     '2025-01-20',
     'Lắp SSD Samsung 980 Pro 512GB NVMe thay thế cho SSD cũ bị hỏng trong quá trình nâng cấp',
     'installed')
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 4. DOCUMENTS  (tài liệu liên quan đến PC-001)
-- ============================================================================
INSERT INTO documents
    (id, type, title, summary, approval_status, content_type, version, created_by)
VALUES
    ('0d400000-0000-0000-0000-000000000006',
     'guide',
     'Hướng dẫn sử dụng Dell OptiPlex 7000',
     'Tài liệu hướng dẫn vận hành và bảo trì máy tính Dell OptiPlex 7000 dành cho người dùng cuối và kỹ thuật viên IT',
     'approved', 'file', '1',
     '00000000-0000-0000-0000-000000000002'),

    ('0d400000-0000-0000-0000-000000000007',
     'form',
     'Biên bản bàn giao PC-001 cho Phòng Kế Toán',
     'Biên bản bàn giao thiết bị PC-001 (Dell OptiPlex 7000) cho nhân viên kế toán ngày 20/01/2023, có chữ ký xác nhận',
     'approved', 'file', '1',
     '00000000-0000-0000-0000-000000000002')
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 5. DOCUMENT FILES  (file đính kèm)
-- ============================================================================
INSERT INTO document_files
    (id, document_id, storage_key, filename, size_bytes, mime_type)
VALUES
    ('0d500000-0000-0000-0000-000000000004',
     '0d400000-0000-0000-0000-000000000006',
     'docs/guide/dell-optiplex-7000-user-guide.pdf',
     'dell-optiplex-7000-user-guide.pdf',
     2097152, 'application/pdf'),

    ('0d500000-0000-0000-0000-000000000005',
     '0d400000-0000-0000-0000-000000000007',
     'docs/handover/pc-001-handover-ketoan-2023-01-20.pdf',
     'bien-ban-ban-giao-PC-001-keto-2023.pdf',
     143360, 'application/pdf')
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 6. DOCUMENT RELATIONS  (gắn tài liệu với asset PC-001)
-- ============================================================================
INSERT INTO document_relations
    (document_id, relation_type, relation_id)
VALUES
    ('0d400000-0000-0000-0000-000000000006', 'asset', 'a1000000-0000-0000-0000-000000000001'),
    ('0d400000-0000-0000-0000-000000000007', 'asset', 'a1000000-0000-0000-0000-000000000001')
ON CONFLICT (document_id, relation_type, relation_id) DO NOTHING;

COMMIT;
