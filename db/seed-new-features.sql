-- =============================================================================
-- seed-new-features.sql
-- Dữ liệu seed cho các tính năng mới và chức năng chưa có dữ liệu:
--   1. Organizations hierarchy (OU tree với parent/code/description)
--   2. Spare part stock (tồn kho linh kiện theo kho)
--   3. Stock documents (phiếu nhập/xuất/chuyển kho) + lines
--   4. Depreciation schedules + runs + entries
--   5. Purchase plan docs + lines
--   6. Label templates
--   7. Notifications
--   8. Audit sessions + items
--   9. Inventory sessions bổ sung
--  10. Maintenance tickets bổ sung
-- Phụ thuộc: seed-data.sql, seed-assets-management.sql, seed-assets.sql
-- Idempotent: mọi INSERT dùng ON CONFLICT DO NOTHING / DO UPDATE
-- =============================================================================
SET client_encoding = 'UTF8';

BEGIN;

-- ============================================================================
-- 1. ORGANIZATIONS HIERARCHY (OU tree)
--    Cập nhật 3 org hiện có + thêm 7 phòng ban con
-- ============================================================================

-- Cập nhật công ty gốc
UPDATE organizations SET
    code        = 'ABC-CORP',
    description = 'Công ty TNHH Công nghệ ABC — đơn vị chủ quản toàn bộ hệ thống',
    updated_at  = NOW()
WHERE id = 'd0000000-0000-0000-0000-000000000001';

-- Cập nhật phòng CNTT
UPDATE organizations SET
    parent_id   = 'd0000000-0000-0000-0000-000000000001',
    code        = 'DEPT-IT',
    description = 'Phòng Công nghệ thông tin — quản lý hạ tầng IT toàn công ty',
    updated_at  = NOW()
WHERE id = 'd0000000-0000-0000-0000-000000000002';

-- Cập nhật phòng Kế toán
UPDATE organizations SET
    parent_id   = 'd0000000-0000-0000-0000-000000000001',
    code        = 'DEPT-FIN',
    description = 'Phòng Kế toán - Tài chính — quản lý tài sản và chi phí',
    updated_at  = NOW()
WHERE id = 'd0000000-0000-0000-0000-000000000003';

-- Thêm các phòng ban mới
INSERT INTO organizations (id, name, parent_id, code, description, created_at, updated_at)
VALUES
    ('d0000000-0000-0000-0000-000000000004',
     'Phòng Nhân sự',
     'd0000000-0000-0000-0000-000000000001',
     'DEPT-HR',
     'Phòng Nhân sự — tuyển dụng, đào tạo, lương thưởng',
     NOW(), NOW()),

    ('d0000000-0000-0000-0000-000000000005',
     'Phòng Kinh doanh',
     'd0000000-0000-0000-0000-000000000001',
     'DEPT-SALES',
     'Phòng Kinh doanh — bán hàng và quan hệ khách hàng',
     NOW(), NOW()),

    ('d0000000-0000-0000-0000-000000000006',
     'Phòng Hành chính',
     'd0000000-0000-0000-0000-000000000001',
     'DEPT-ADMIN',
     'Phòng Hành chính — văn phòng phẩm, cơ sở vật chất',
     NOW(), NOW()),

    ('d0000000-0000-0000-0000-000000000007',
     'Ban Giám đốc',
     'd0000000-0000-0000-0000-000000000001',
     'BOD',
     'Ban Giám đốc — lãnh đạo cấp cao',
     NOW(), NOW()),

    ('d0000000-0000-0000-0000-000000000008',
     'Chi nhánh Hà Nội',
     'd0000000-0000-0000-0000-000000000001',
     'BRANCH-HN',
     'Chi nhánh Hà Nội — văn phòng đại diện miền Bắc',
     NOW(), NOW()),

    ('d0000000-0000-0000-0000-000000000009',
     'Nhóm Hạ tầng & Mạng',
     'd0000000-0000-0000-0000-000000000002',
     'TEAM-INFRA',
     'Nhóm quản lý hạ tầng máy chủ, mạng, bảo mật',
     NOW(), NOW()),

    ('d0000000-0000-0000-0000-000000000010',
     'Nhóm Hỗ trợ kỹ thuật',
     'd0000000-0000-0000-0000-000000000002',
     'TEAM-SUPPORT',
     'Nhóm helpdesk và hỗ trợ người dùng cuối',
     NOW(), NOW())

ON CONFLICT (id) DO UPDATE SET
    parent_id   = EXCLUDED.parent_id,
    code        = EXCLUDED.code,
    description = EXCLUDED.description,
    updated_at  = NOW();

-- ============================================================================
-- 2. STOCK SNAPSHOT
--    Rebuild from seeded assets that are currently in warehouse (status=in_stock),
--    so stock codes/models always map back to existing records in assets.
-- ============================================================================

DELETE FROM asset_model_stock;

INSERT INTO asset_model_stock (warehouse_id, model_id, on_hand, reserved, updated_at)
SELECT
    a.warehouse_id,
    a.model_id,
    COUNT(*)::int AS on_hand,
    0            AS reserved,
    NOW()        AS updated_at
FROM assets a
WHERE a.warehouse_id IS NOT NULL
  AND a.status = 'in_stock'
GROUP BY a.warehouse_id, a.model_id
ON CONFLICT (warehouse_id, model_id) DO UPDATE SET
    on_hand    = EXCLUDED.on_hand,
    reserved   = EXCLUDED.reserved,
    updated_at = NOW();

-- ============================================================================
-- 3. STOCK DOCUMENTS (phiếu kho) + LINES
--    4 phiếu nhập, 2 phiếu xuất, 1 phiếu điều chuyển, 1 phiếu điều chỉnh
-- ============================================================================

-- PHIẾU NHẬP NỀN TẢNG (base init — giải thích tồn kho ban đầu của từng kho)
INSERT INTO stock_documents
    (id, doc_type, code, status, warehouse_id, doc_date,
     supplier, note, created_by, posted_at, posted_by, created_at, updated_at)
VALUES
    -- Base WH-DC: HDD 2TB + Nguồn 650W (lắp đặt ban đầu Data Center)
    ('f0000000-0000-0000-0000-000000000002',
     'receipt', 'NK-BASE-DC-2024', 'posted',
     'd1000000-0000-0000-0000-000000000002',
     '2024-01-05',
     'HP Enterprise',
     'Nhập linh kiện ban đầu kho Data Center — HDD server, nguồn dự phòng',
     '00000000-0000-0000-0000-000000000002',
     '2024-01-05 17:00:00+07', '00000000-0000-0000-0000-000000000002',
     '2024-01-05 08:00:00+07', '2024-01-05 17:00:00+07'),

    -- Base WH-HN: Cáp mạng + Brother Toner (trang bị ban đầu chi nhánh HN)
    ('f0000000-0000-0000-0000-000000000003',
     'receipt', 'NK-BASE-HN-2024', 'posted',
     'd1000000-0000-0000-0000-000000000003',
     '2024-06-01',
     'Synnex FPT',
     'Nhập linh kiện ban đầu kho chi nhánh HN — cáp mạng, toner',
     '00000000-0000-0000-0000-000000000002',
     '2024-06-01 16:00:00+07', '00000000-0000-0000-0000-000000000002',
     '2024-06-01 08:30:00+07', '2024-06-01 16:00:00+07'),

    -- Base WH-IT: Quạt CPU + Keo tản nhiệt + Hub USB-C + Sạc laptop (trang bị phòng CNTT)
    ('f0000000-0000-0000-0000-000000000004',
     'receipt', 'NK-BASE-IT-2024', 'posted',
     'd1000000-0000-0000-0000-000000000004',
     '2024-06-15',
     'Ugreen Vietnam',
     'Nhập linh kiện dịch vụ kỹ thuật phòng CNTT — quạt, keo tản nhiệt, hub, sạc',
     '00000000-0000-0000-0000-000000000002',
     '2024-06-15 15:30:00+07', '00000000-0000-0000-0000-000000000002',
     '2024-06-15 08:00:00+07', '2024-06-15 15:30:00+07')

ON CONFLICT (id) DO NOTHING;

-- PHIẾU NHẬP KHO (receipts)
INSERT INTO stock_documents
    (id, doc_type, code, status, warehouse_id, doc_date,
     supplier, note, created_by, posted_at, posted_by, created_at, updated_at)
VALUES
    -- Nhập Q4/2025: RAM + SSD + HDD + Keo tản nhiệt
    ('f1000000-0000-0000-0000-000000000001',
     'receipt', 'NK-2025-0001', 'posted',
     'd1000000-0000-0000-0000-000000000001',
     '2025-10-05',
     'Dell Technologies',
     'Nhập linh kiện quý 4/2025 — RAM, SSD, HDD cho kho chính',
     '00000000-0000-0000-0000-000000000003',
     '2025-10-05 14:00:00+07', '00000000-0000-0000-0000-000000000002',
     '2025-10-05 09:00:00+07', '2025-10-05 14:00:00+07'),

    -- Nhập Q1/2026: Linh kiện thay thế
    ('f1000000-0000-0000-0000-000000000002',
     'receipt', 'NK-2026-0001', 'posted',
     'd1000000-0000-0000-0000-000000000001',
     '2026-01-08',
     'HP Inc.',
     'Nhập linh kiện Q1/2026 — bàn phím, chuột, cáp, toner',
     '00000000-0000-0000-0000-000000000003',
     '2026-01-08 15:30:00+07', '00000000-0000-0000-0000-000000000002',
     '2026-01-08 08:30:00+07', '2026-01-08 15:30:00+07'),

    -- Nhập Data Center: SFP, RAM server
    ('f1000000-0000-0000-0000-000000000003',
     'receipt', 'NK-DC-2026-0001', 'posted',
     'd1000000-0000-0000-0000-000000000002',
     '2026-01-20',
     'Cisco Systems',
     'Nhập linh kiện Data Center — SFP module, RAM server, HDD',
     '00000000-0000-0000-0000-000000000003',
     '2026-01-20 16:00:00+07', '00000000-0000-0000-0000-000000000002',
     '2026-01-20 09:00:00+07', '2026-01-20 16:00:00+07'),

    -- Nhập đang chờ duyệt (tháng 03/2026)
    ('f1000000-0000-0000-0000-000000000004',
     'receipt', 'NK-2026-0002', 'submitted',
     'd1000000-0000-0000-0000-000000000001',
     '2026-03-10',
     'Lenovo',
     'Nhập linh kiện tháng 3/2026 — SSD, PIN UPS, Keo tản nhiệt',
     '00000000-0000-0000-0000-000000000003',
     NULL, NULL,
     '2026-03-10 09:00:00+07', '2026-03-10 10:00:00+07')

ON CONFLICT (id) DO NOTHING;

-- PHIẾU XUẤT KHO (issues)
INSERT INTO stock_documents
    (id, doc_type, code, status, warehouse_id, doc_date,
     note, created_by, posted_at, posted_by, created_at, updated_at)
VALUES
    ('f1000000-0000-0000-0000-000000000011',
     'issue', 'XK-2025-0001', 'posted',
     'd1000000-0000-0000-0000-000000000001',
     '2025-10-15',
     'Xuất linh kiện sửa chữa PC phòng Kế toán — RAM + SSD thay thế',
     '00000000-0000-0000-0000-000000000002',
     '2025-10-15 11:00:00+07', '00000000-0000-0000-0000-000000000002',
     '2025-10-15 09:30:00+07', '2025-10-15 11:00:00+07'),

    ('f1000000-0000-0000-0000-000000000012',
     'issue', 'XK-2026-0001', 'posted',
     'd1000000-0000-0000-0000-000000000001',
     '2026-02-12',
     'Xuất linh kiện cho nhóm hỗ trợ kỹ thuật: quạt CPU, keo tản nhiệt, toner',
     '00000000-0000-0000-0000-000000000002',
     '2026-02-12 14:00:00+07', '00000000-0000-0000-0000-000000000002',
     '2026-02-12 08:00:00+07', '2026-02-12 14:00:00+07')

ON CONFLICT (id) DO NOTHING;

-- PHIẾU ĐIỀU CHUYỂN (transfers)
INSERT INTO stock_documents
    (id, doc_type, code, status, warehouse_id, target_warehouse_id, doc_date,
     note, created_by, posted_at, posted_by, created_at, updated_at)
VALUES
    ('f1000000-0000-0000-0000-000000000021',
     'transfer', 'DC-2026-0001', 'posted',
     'd1000000-0000-0000-0000-000000000001',
     'd1000000-0000-0000-0000-000000000003',
     '2026-01-15',
     'Điều chuyển linh kiện dự phòng từ Kho chính → Chi nhánh Hà Nội',
     '00000000-0000-0000-0000-000000000002',
     '2026-01-15 16:00:00+07', '00000000-0000-0000-0000-000000000002',
     '2026-01-15 09:00:00+07', '2026-01-15 16:00:00+07')

ON CONFLICT (id) DO NOTHING;

-- PHIẾU ĐIỀU CHỈNH (adjustments)
INSERT INTO stock_documents
    (id, doc_type, code, status, warehouse_id, doc_date,
     note, created_by, posted_at, posted_by, created_at, updated_at)
VALUES
    ('f1000000-0000-0000-0000-000000000031',
     'adjust', 'DC-KK-2026-0001', 'posted',
     'd1000000-0000-0000-0000-000000000001',
     '2026-01-31',
     'Điều chỉnh sau kiểm kê tháng 01/2026 — toner thực tế ít hơn hệ thống 2 hộp',
     '00000000-0000-0000-0000-000000000003',
     '2026-01-31 17:00:00+07', '00000000-0000-0000-0000-000000000002',
     '2026-01-31 14:00:00+07', '2026-01-31 17:00:00+07')

ON CONFLICT (id) DO NOTHING;

-- STOCK DOCUMENT LINES

-- Lines cho NK-2025-0001 (nhập Q4/2025)
INSERT INTO stock_document_lines
    (id, document_id, asset_model_id, qty, unit_cost, line_type, note)
VALUES
    ('f2000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000001',
     'f2000000-0000-0000-0000-000000000001', 20, 750000, 'qty', 'RAM DDR4 8GB'),
    ('f2000000-0000-0000-0000-000000000002', 'f1000000-0000-0000-0000-000000000001',
     'f2000000-0000-0000-0000-000000000002', 10, 1450000, 'qty', 'RAM DDR4 16GB'),
    ('f2000000-0000-0000-0000-000000000003', 'f1000000-0000-0000-0000-000000000001',
     'f2000000-0000-0000-0000-000000000004', 15, 1250000, 'qty', 'SSD NVMe 256GB'),
    ('f2000000-0000-0000-0000-000000000004', 'f1000000-0000-0000-0000-000000000001',
     'f2000000-0000-0000-0000-000000000007', 12, 950000,  'qty', 'HDD 1TB SATA'),
    ('f2000000-0000-0000-0000-000000000005', 'f1000000-0000-0000-0000-000000000001',
     'f2000000-0000-0000-0000-000000000009',  6, 250000,  'qty', 'Quạt tản nhiệt CPU'),
    ('f2000000-0000-0000-0000-000000000006', 'f1000000-0000-0000-0000-000000000001',
     'f2000000-0000-0000-0000-000000000027', 20,  85000,  'qty', 'Keo tản nhiệt Arctic MX-4'),

-- Lines cho NK-2026-0001 (nhập Q1/2026)
    ('f2000000-0000-0000-0000-000000000011', 'f1000000-0000-0000-0000-000000000002',
     'f2000000-0000-0000-0000-000000000012', 25, 185000, 'qty', 'Bàn phím USB'),
    ('f2000000-0000-0000-0000-000000000012', 'f1000000-0000-0000-0000-000000000002',
     'f2000000-0000-0000-0000-000000000013', 25, 125000, 'qty', 'Chuột quang USB'),
    ('f2000000-0000-0000-0000-000000000013', 'f1000000-0000-0000-0000-000000000002',
     'f2000000-0000-0000-0000-000000000016', 50,  32000, 'qty', 'Cáp mạng CAT6 3m'),
    ('f2000000-0000-0000-0000-000000000014', 'f1000000-0000-0000-0000-000000000002',
     'f2000000-0000-0000-0000-000000000017', 20,  85000, 'qty', 'Cáp HDMI 2m'),
    ('f2000000-0000-0000-0000-000000000015', 'f1000000-0000-0000-0000-000000000002',
     'f2000000-0000-0000-0000-000000000020',  8, 620000, 'qty', 'HP Toner CF226A'),
    ('f2000000-0000-0000-0000-000000000016', 'f1000000-0000-0000-0000-000000000002',
     'f2000000-0000-0000-0000-000000000021',  6, 580000, 'qty', 'Brother Toner TN-2480'),

-- Lines cho NK-DC-2026-0001 (nhập Data Center)
    ('f2000000-0000-0000-0000-000000000021', 'f1000000-0000-0000-0000-000000000003',
     'f2000000-0000-0000-0000-000000000002',  8, 1450000, 'qty', 'RAM DDR4 16GB cho server'),
    ('f2000000-0000-0000-0000-000000000022', 'f1000000-0000-0000-0000-000000000003',
     'f2000000-0000-0000-0000-000000000003',  4, 2850000, 'qty', 'RAM DDR4 32GB cho server'),
    ('f2000000-0000-0000-0000-000000000023', 'f1000000-0000-0000-0000-000000000003',
     'f2000000-0000-0000-0000-000000000006',  6, 2250000, 'qty', 'SSD NVMe 1TB'),
    ('f2000000-0000-0000-0000-000000000024', 'f1000000-0000-0000-0000-000000000003',
     'f2000000-0000-0000-0000-000000000023',  5, 1850000, 'qty', 'SFP Module 1Gbps'),
    ('f2000000-0000-0000-0000-000000000025', 'f1000000-0000-0000-0000-000000000003',
     'f2000000-0000-0000-0000-000000000024',  4, 3200000, 'qty', 'SFP+ Module 10Gbps'),
    ('f2000000-0000-0000-0000-000000000026', 'f1000000-0000-0000-0000-000000000003',
     'f2000000-0000-0000-0000-000000000025',  6,  350000, 'qty', 'Pin UPS 12V 7Ah'),

-- Lines cho NK-2026-0002 (đang submitted)
    ('f2000000-0000-0000-0000-000000000031', 'f1000000-0000-0000-0000-000000000004',
     'f2000000-0000-0000-0000-000000000005', 10, 2100000, 'qty', 'SSD NVMe 512GB'),
    ('f2000000-0000-0000-0000-000000000032', 'f1000000-0000-0000-0000-000000000004',
     'f2000000-0000-0000-0000-000000000025', 10,  350000, 'qty', 'Pin UPS 12V 7Ah'),
    ('f2000000-0000-0000-0000-000000000033', 'f1000000-0000-0000-0000-000000000004',
     'f2000000-0000-0000-0000-000000000027', 15,   85000, 'qty', 'Keo tản nhiệt'),

-- Lines cho XK-2025-0001 (xuất sửa chữa PC)
    ('f2000000-0000-0000-0000-000000000041', 'f1000000-0000-0000-0000-000000000011',
     'f2000000-0000-0000-0000-000000000001',  2, 750000, 'qty', 'RAM 8GB thay thế PC-KT-001'),
    ('f2000000-0000-0000-0000-000000000042', 'f1000000-0000-0000-0000-000000000011',
     'f2000000-0000-0000-0000-000000000004',  1,1250000, 'qty', 'SSD 256GB thay thế PC-KT-001'),

-- Lines cho XK-2026-0001 (xuất hỗ trợ kỹ thuật)
    ('f2000000-0000-0000-0000-000000000051', 'f1000000-0000-0000-0000-000000000012',
     'f2000000-0000-0000-0000-000000000009',  3, 250000, 'qty', 'Quạt CPU cho bảo trì PC'),
    ('f2000000-0000-0000-0000-000000000052', 'f1000000-0000-0000-0000-000000000012',
     'f2000000-0000-0000-0000-000000000027',  5,  85000, 'qty', 'Keo tản nhiệt'),
    ('f2000000-0000-0000-0000-000000000053', 'f1000000-0000-0000-0000-000000000012',
     'f2000000-0000-0000-0000-000000000020',  2, 620000, 'qty', 'HP Toner CF226A'),

-- Lines cho DC-2026-0001 (điều chuyển Chi nhánh HN)
    ('f2000000-0000-0000-0000-000000000061', 'f1000000-0000-0000-0000-000000000021',
     'f2000000-0000-0000-0000-000000000001',  8, 750000, 'qty', 'RAM 8GB dự phòng HN'),
    ('f2000000-0000-0000-0000-000000000062', 'f1000000-0000-0000-0000-000000000021',
     'f2000000-0000-0000-0000-000000000004',  5,1250000, 'qty', 'SSD 256GB dự phòng HN'),
    ('f2000000-0000-0000-0000-000000000063', 'f1000000-0000-0000-0000-000000000021',
     'f2000000-0000-0000-0000-000000000012', 10, 185000, 'qty', 'Bàn phím dự phòng HN'),
    ('f2000000-0000-0000-0000-000000000064', 'f1000000-0000-0000-0000-000000000021',
     'f2000000-0000-0000-0000-000000000013', 10, 125000, 'qty', 'Chuột dự phòng HN')

ON CONFLICT (id) DO NOTHING;

-- Lines cho DC-KK-2026-0001 (phiếu điều chỉnh — cần adjust_direction)
INSERT INTO stock_document_lines
    (id, document_id, asset_model_id, qty, unit_cost, line_type, adjust_direction, note)
VALUES
    ('f2000000-0000-0000-0000-000000000071', 'f1000000-0000-0000-0000-000000000031',
     'f2000000-0000-0000-0000-000000000020', 2, 620000, 'qty', 'minus',
     'Điều chỉnh giảm: HP Toner thiếu so với sổ sách sau kiểm kê')
ON CONFLICT (id) DO NOTHING;

-- Lines cho NK-BASE-DC-2024 (linh kiện ban đầu kho Data Center)
INSERT INTO stock_document_lines
    (id, document_id, asset_model_id, qty, unit_cost, line_type, note)
VALUES
    ('f0100000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000002',
     'f2000000-0000-0000-0000-000000000008', 4, 1250000, 'qty', 'HDD SATA 2TB — server storage'),
    ('f0100000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-000000000002',
     'f2000000-0000-0000-0000-000000000011', 2, 1750000, 'qty', 'Nguồn 650W Corsair RM650x — dự phòng DC')
ON CONFLICT (id) DO NOTHING;

-- Lines cho NK-BASE-HN-2024 (linh kiện ban đầu chi nhánh HN)
INSERT INTO stock_document_lines
    (id, document_id, asset_model_id, qty, unit_cost, line_type, note)
VALUES
    ('f0100000-0000-0000-0000-000000000003', 'f0000000-0000-0000-0000-000000000003',
     'f2000000-0000-0000-0000-000000000016', 20, 32000, 'qty', 'Cáp mạng CAT6 3m — hạ tầng HN'),
    ('f0100000-0000-0000-0000-000000000004', 'f0000000-0000-0000-0000-000000000003',
     'f2000000-0000-0000-0000-000000000021',  4, 480000, 'qty', 'Brother Toner TN-2480 — máy in HN')
ON CONFLICT (id) DO NOTHING;

-- Lines cho NK-BASE-IT-2024 (linh kiện dịch vụ kỹ thuật phòng CNTT)
INSERT INTO stock_document_lines
    (id, document_id, asset_model_id, qty, unit_cost, line_type, note)
VALUES
    ('f0100000-0000-0000-0000-000000000005', 'f0000000-0000-0000-0000-000000000004',
     'f2000000-0000-0000-0000-000000000009', 4, 250000, 'qty', 'Quạt tản nhiệt CPU — bảo trì máy tính'),
    ('f0100000-0000-0000-0000-000000000006', 'f0000000-0000-0000-0000-000000000004',
     'f2000000-0000-0000-0000-000000000027', 8,  85000, 'qty', 'Keo tản nhiệt Arctic MX-4'),
    ('f0100000-0000-0000-0000-000000000007', 'f0000000-0000-0000-0000-000000000004',
     'f2000000-0000-0000-0000-000000000029', 3, 350000, 'qty', 'Hub USB-C 7in1 Ugreen — kỹ thuật viên'),
    ('f0100000-0000-0000-0000-000000000008', 'f0000000-0000-0000-0000-000000000004',
     'f2000000-0000-0000-0000-000000000032', 5, 720000, 'qty', 'Sạc laptop đa năng Dell 65W Type-C')
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 4. DEPRECIATION SCHEDULES + RUNS + ENTRIES
--    Lịch khấu hao cho 15 tài sản chủ yếu (phương pháp đường thẳng)
-- ============================================================================

-- Depreciation settings already seeded by seed-inventory-audit.sql

-- Depreciation schedules (15 tài sản)
INSERT INTO depreciation_schedules
    (id, asset_id, depreciation_method, original_cost, salvage_value,
     useful_life_years, start_date, end_date,
     monthly_depreciation, accumulated_depreciation, book_value,
     currency, status, organization_id, created_by, updated_by, created_at, updated_at)
VALUES
    -- PC-001 (3 năm, 15M → 500K)
    ('0d100000-0000-0000-0000-000000000001',
     'a1000000-0000-0000-0000-000000000001',
     'straight_line', 15000000, 500000, 3,
     '2023-01-01', '2026-01-01',
     402778, 15000000, 500000, 'VND', 'fully_depreciated',
     'd0000000-0000-0000-0000-000000000001',
     '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002',
     NOW(), NOW()),

    -- PC-002 (3 năm, 15M → 500K, bắt đầu 2023-02)
    ('0d100000-0000-0000-0000-000000000002',
     'a1000000-0000-0000-0000-000000000002',
     'straight_line', 15000000, 500000, 3,
     '2023-02-01', '2026-02-01',
     402778, 14921676, 578324, 'VND', 'active',
     'd0000000-0000-0000-0000-000000000001',
     '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002',
     NOW(), NOW()),

    -- LT-001 Laptop Dell (3 năm, 28M → 1M)
    ('0d100000-0000-0000-0000-000000000003',
     'a1000000-0000-0000-0000-000000000011',
     'straight_line', 28000000, 1000000, 3,
     '2023-01-15', '2026-01-15',
     750000, 28000000, 1000000, 'VND', 'fully_depreciated',
     'd0000000-0000-0000-0000-000000000001',
     '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002',
     NOW(), NOW()),

    -- LT-004 Laptop (3 năm, 26M → 1M)
    ('0d100000-0000-0000-0000-000000000004',
     'a1000000-0000-0000-0000-000000000014',
     'straight_line', 26000000, 1000000, 3,
     '2023-06-01', '2026-06-01',
     694444, 21597228, 4402772, 'VND', 'active',
     'd0000000-0000-0000-0000-000000000001',
     '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002',
     NOW(), NOW()),

    -- NET-CS-001 Core Switch (5 năm, 45M → 1M)
    ('0d100000-0000-0000-0000-000000000005',
     'a1000000-0000-0000-0000-000000000016',
     'straight_line', 45000000, 1000000, 5,
     '2021-05-01', '2026-05-01',
     733333, 42533283, 2466717, 'VND', 'active',
     'd0000000-0000-0000-0000-000000000001',
     '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002',
     NOW(), NOW()),

    -- NET-FW-001 Firewall (5 năm, 55M → 1M)
    ('0d100000-0000-0000-0000-000000000006',
     'a1000000-0000-0000-0000-000000000017',
     'straight_line', 55000000, 1000000, 5,
     '2021-05-01', '2026-05-01',
     900000, 52200000, 2800000, 'VND', 'active',
     'd0000000-0000-0000-0000-000000000001',
     '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002',
     NOW(), NOW()),

    -- STO-NAS-001 NAS (5 năm, 95M → 2M)
    ('0d100000-0000-0000-0000-000000000007',
     'a1000000-0000-0000-0000-000000000020',
     'straight_line', 95000000, 2000000, 5,
     '2021-05-01', '2026-05-01',
     1550000, 89900000, 5100000, 'VND', 'active',
     'd0000000-0000-0000-0000-000000000001',
     '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002',
     NOW(), NOW()),

    -- SRV-001 Server ESX (5 năm, 180M → 5M)
    ('0d100000-0000-0000-0000-000000000008',
     'a1000000-0000-0000-0000-000000000034',
     'straight_line', 180000000, 5000000, 5,
     '2021-01-01', '2026-01-01',
     2916667, 180000000, 5000000, 'VND', 'fully_depreciated',
     'd0000000-0000-0000-0000-000000000001',
     '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002',
     NOW(), NOW()),

    -- SRV-002 Server ESX-02 (5 năm, 165M → 5M)
    ('0d100000-0000-0000-0000-000000000009',
     'a1000000-0000-0000-0000-000000000035',
     'straight_line', 165000000, 5000000, 5,
     '2022-03-01', '2027-03-01',
     2666667, 128000016, 37000000, 'VND', 'active',
     'd0000000-0000-0000-0000-000000000001',
     '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002',
     NOW(), NOW()),

    -- NET-SW-001 Switch Tầng 1 (5 năm, 38M → 1M)
    ('0d100000-0000-0000-0000-000000000010',
     'a1000000-0000-0000-0000-000000000038',
     'straight_line', 38000000, 1000000, 5,
     '2021-01-01', '2026-01-01',
     616667, 38000000, 1000000, 'VND', 'fully_depreciated',
     'd0000000-0000-0000-0000-000000000001',
     '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002',
     NOW(), NOW()),

    -- MN-001 Màn hình (3 năm, 6.5M → 200K)
    ('0d100000-0000-0000-0000-000000000011',
     'a1000000-0000-0000-0000-000000000021',
     'straight_line', 6500000, 200000, 3,
     '2023-01-01', '2026-01-01',
     169444, 6500000, 200000, 'VND', 'fully_depreciated',
     'd0000000-0000-0000-0000-000000000001',
     '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002',
     NOW(), NOW()),

    -- PR-002 Máy in Brother (3 năm, 8.5M → 0)
    ('0d100000-0000-0000-0000-000000000012',
     'a1000000-0000-0000-0000-000000000030',
     'straight_line', 8500000, 0, 3,
     '2022-08-01', '2025-08-01',
     236111, 8500000, 0, 'VND', 'fully_depreciated',
     'd0000000-0000-0000-0000-000000000001',
     '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002',
     NOW(), NOW()),

    -- UPS-001 (5 năm, 22M → 2M)
    ('0d100000-0000-0000-0000-000000000013',
     'a1000000-0000-0000-0000-000000000041',
     'straight_line', 22000000, 2000000, 5,
     '2022-01-01', '2027-01-01',
     333333, 17333316, 4666684, 'VND', 'active',
     'd0000000-0000-0000-0000-000000000001',
     '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002',
     NOW(), NOW()),

    -- SRV-003 File Server (5 năm, 120M → 5M)
    ('0d100000-0000-0000-0000-000000000014',
     'a1000000-0000-0000-0000-000000000036',
     'straight_line', 120000000, 5000000, 5,
     '2022-06-01', '2027-06-01',
     1916667, 66433317, 53566683, 'VND', 'active',
     'd0000000-0000-0000-0000-000000000001',
     '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002',
     NOW(), NOW()),

    -- CAM-001 Camera IP (3 năm, 4.2M → 0)
    ('0d100000-0000-0000-0000-000000000015',
     'a1000000-0000-0000-0000-000000000047',
     'straight_line', 4200000, 0, 3,
     '2023-04-01', '2026-04-01',
     116667, 3616677, 583323, 'VND', 'active',
     'd0000000-0000-0000-0000-000000000001',
     '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002',
     NOW(), NOW())

ON CONFLICT (id) DO NOTHING;

-- Depreciation run tháng 01/2026
INSERT INTO depreciation_runs
    (id, run_code, period_year, period_month, run_type, status,
     entries_created, entries_posted, total_depreciation,
     started_at, completed_at, organization_id, created_by)
VALUES
    ('0d200000-0000-0000-0000-000000000001',
     'DEP-20260131-0001', 2026, 1, 'monthly', 'completed',
     8, 8, 10889003,
     '2026-01-31 07:00:00+07', '2026-01-31 07:10:00+07',
     'd0000000-0000-0000-0000-000000000001',
     '00000000-0000-0000-0000-000000000002'),

    -- Run tháng 02/2026 (chỉ tính, chưa ghi sổ)
    ('0d200000-0000-0000-0000-000000000002',
     'DEP-20260228-0001', 2026, 2, 'monthly', 'pending',
     6, 0, 8160001,
     '2026-02-28 07:00:00+07', NULL,
     'd0000000-0000-0000-0000-000000000001',
     '00000000-0000-0000-0000-000000000002')

ON CONFLICT (id) DO NOTHING;

-- Depreciation entries for 01/2026 and 02/2026 already seeded by seed-inventory-audit.sql and seed-depreciation-2026.sql

-- ============================================================================
-- 5. PURCHASE PLAN DOCS + LINES
--    2 kế hoạch mua sắm: 1 đã duyệt, 1 đang chờ
-- ============================================================================

INSERT INTO purchase_plan_docs
    (id, doc_no, doc_date, fiscal_year,
     org_unit_id, org_unit_name,
     title, description,
     total_estimated_cost, currency, status,
     created_by, created_at,
     approved_by, approved_at, updated_at)
VALUES
    -- Kế hoạch mua laptop Q2/2026
    ('c3000000-0000-0000-0000-000000000001',
     'KH-MUA-2026-001', '2026-01-15', 2026,
     'd0000000-0000-0000-0000-000000000002', 'Phòng Công nghệ thông tin',
     'Kế hoạch mua sắm máy tính xách tay Q2/2026',
     'Mua bổ sung 5 laptop Dell Latitude cho nhân viên mới phòng CNTT và chi nhánh HN. Thay thế 3 máy cũ hết khấu hao.',
     165000000, 'VND', 'approved',
     '00000000-0000-0000-0000-000000000002',
     '2026-01-15 09:00:00+07',
     '00000000-0000-0000-0000-000000000001',
     '2026-01-20 14:00:00+07',
     '2026-01-20 14:00:00+07'),

    -- Kế hoạch nâng cấp hạ tầng Q3/2026
    ('c3000000-0000-0000-0000-000000000002',
     'KH-MUA-2026-002', '2026-02-20', 2026,
     'd0000000-0000-0000-0000-000000000002', 'Phòng Công nghệ thông tin',
     'Nâng cấp hạ tầng mạng và lưu trữ Q3/2026',
     'Nâng cấp switch lõi, bổ sung NAS mới và UPS dự phòng cho Data Center.',
     520000000, 'VND', 'submitted',
     '00000000-0000-0000-0000-000000000002',
     '2026-02-20 10:00:00+07',
     NULL, NULL,
     '2026-02-20 10:00:00+07'),

    -- Kế hoạch mua thiết bị văn phòng
    ('c3000000-0000-0000-0000-000000000003',
     'KH-MUA-2026-003', '2026-03-05', 2026,
     'd0000000-0000-0000-0000-000000000006', 'Phòng Hành chính',
     'Mua sắm thiết bị văn phòng Q2/2026',
     'Mua máy in, màn hình và bàn ghế cho văn phòng mới.',
     85000000, 'VND', 'draft',
     '00000000-0000-0000-0000-000000000002',
     '2026-03-05 08:00:00+07',
     NULL, NULL,
     '2026-03-05 08:00:00+07')

ON CONFLICT (id) DO NOTHING;

-- Purchase plan lines
INSERT INTO purchase_plan_lines
    (id, doc_id, line_no, item_description, quantity,
     estimated_unit_cost, estimated_total_cost, priority, note)
VALUES
    -- Lines kế hoạch laptop
    ('c4000000-0000-0000-0000-000000000001',
     'c3000000-0000-0000-0000-000000000001', 1,
     'Dell Latitude 5540 i7/16GB/512GB — laptop nhân viên mới',
     5, 28000000, 140000000, 'high', 'Laptop cho nhân viên mới'),
    ('c4000000-0000-0000-0000-000000000002',
     'c3000000-0000-0000-0000-000000000001', 2,
     'Màn hình Dell 24" P2422H FHD — kèm laptop',
     5, 5000000, 25000000, 'medium', 'Kèm theo laptop'),

    -- Lines kế hoạch hạ tầng
    ('c4000000-0000-0000-0000-000000000011',
     'c3000000-0000-0000-0000-000000000002', 1,
     'Cisco Catalyst 9300 48P — thay thế switch lõi cũ',
     2, 185000000, 370000000, 'high', 'Thay thế switch lõi cũ'),
    ('c4000000-0000-0000-0000-000000000012',
     'c3000000-0000-0000-0000-000000000002', 2,
     'Synology NAS RS3621xs+ — NAS Data Center mới',
     1, 95000000, 95000000, 'high', 'NAS Data Center mới'),
    ('c4000000-0000-0000-0000-000000000013',
     'c3000000-0000-0000-0000-000000000002', 3,
     'APC Smart-UPS 5000VA — dự phòng điện Data Center',
     1, 55000000, 55000000, 'medium', 'Dự phòng điện Data Center'),

    -- Lines kế hoạch văn phòng
    ('c4000000-0000-0000-0000-000000000021',
     'c3000000-0000-0000-0000-000000000003', 1,
     'Máy in HP LaserJet Pro M404dn — máy in laser văn phòng',
     3, 8500000, 25500000, 'medium', 'Máy in laser văn phòng'),
    ('c4000000-0000-0000-0000-000000000022',
     'c3000000-0000-0000-0000-000000000003', 2,
     'Màn hình 27" 4K Dell U2722D — màn hình cho phòng mới',
     6, 8500000, 51000000, 'medium', 'Màn hình cho phòng mới'),
    ('c4000000-0000-0000-0000-000000000023',
     'c3000000-0000-0000-0000-000000000003', 3,
     'Bàn phím + Chuột không dây Logitech MK850',
     10, 850000, 8500000, 'low', 'Set bàn phím chuột không dây')

ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 6. LABEL TEMPLATES (mẫu nhãn in cho tài sản)
-- ============================================================================

INSERT INTO label_templates
    (id, template_code, name, description, label_type, size_preset,
     width_mm, height_mm,
     layout, fields, barcode_type,
     include_logo, include_company_name,
     font_family, font_size, is_default, is_active,
     organization_id, created_by, created_at, updated_at)
VALUES
    -- Nhãn tài sản chuẩn (50×30mm)
    ('c5000000-0000-0000-0000-000000000001',
     'ASSET-STD-50x30', 'Nhãn tài sản chuẩn (50×30mm)',
     'Nhãn in tiêu chuẩn cho toàn bộ thiết bị IT — gồm mã tài sản, QR code, tên thiết bị',
     'qrcode', 'small', 50, 30,
     '{"orientation":"landscape","margin":2,"sections":["header","qr","body"]}'::jsonb,
     '["asset_code","hostname","category","status","serial_no"]'::jsonb,
     'qrcode', true, true, 'Inter', 8, true, true,
     'd0000000-0000-0000-0000-000000000001',
     '00000000-0000-0000-0000-000000000002',
     NOW(), NOW()),

    -- Nhãn linh kiện kho (38×22mm)
    ('c5000000-0000-0000-0000-000000000002',
     'PART-SMALL-38x22', 'Nhãn linh kiện kho (38×22mm)',
     'Nhãn nhỏ dán vào hộp linh kiện trong kho — mã linh kiện và barcode 128',
     'barcode', 'small', 38, 22,
     '{"orientation":"landscape","margin":1.5,"sections":["barcode","body"]}'::jsonb,
     '["part_code","part_name","quantity","warehouse"]'::jsonb,
     'code128', false, true, 'Inter', 7, false, true,
     'd0000000-0000-0000-0000-000000000001',
     '00000000-0000-0000-0000-000000000002',
     NOW(), NOW()),

    -- Nhãn tài sản lớn (100×50mm)
    ('c5000000-0000-0000-0000-000000000003',
     'ASSET-LRG-100x50', 'Nhãn tài sản lớn (100×50mm)',
     'Nhãn khổ lớn dán server, UPS, tủ mạng — đầy đủ thông tin + QR + barcode',
     'combined', 'large', 100, 50,
     '{"orientation":"landscape","margin":3,"sections":["header","qr","body","footer"]}'::jsonb,
     '["asset_code","hostname","category","model","serial_no","purchase_date","warranty_end","location","status"]'::jsonb,
     'qrcode', true, true, 'Inter', 9, false, true,
     'd0000000-0000-0000-0000-000000000001',
     '00000000-0000-0000-0000-000000000002',
     NOW(), NOW()),

    -- Nhãn phòng ban (60×40mm)
    ('c5000000-0000-0000-0000-000000000004',
     'DEPT-60x40', 'Nhãn gán phòng ban (60×40mm)',
     'Nhãn thể hiện tài sản thuộc phòng ban nào — có mã QR và tên phòng',
     'qrcode', 'medium', 60, 40,
     '{"orientation":"landscape","margin":2,"sections":["header","qr","body"]}'::jsonb,
     '["asset_code","hostname","assigned_to","department","location"]'::jsonb,
     'qrcode', false, true, 'Inter', 8, false, true,
     'd0000000-0000-0000-0000-000000000001',
     '00000000-0000-0000-0000-000000000002',
     NOW(), NOW())

ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 7. NOTIFICATIONS (thông báo hệ thống)
-- ============================================================================

INSERT INTO notifications
    (id, user_id, title, body, channel, status, metadata, created_at)
VALUES
    -- Thông báo bảo hành sắp hết
    ('c7000000-0000-0000-0000-000000000001',
     '00000000-0000-0000-0000-000000000002',
     'Bảo hành sắp hết hạn — LT-004',
     'Laptop Dell Latitude 5530 (LT-004) sẽ hết bảo hành vào ngày 15/06/2026. Hãy liên hệ nhà cung cấp để gia hạn.',
     'in_app', 'sent',
     '{"type":"warranty_expiry","asset_id":"a1000000-0000-0000-0000-000000000014","days_remaining":86}'::jsonb,
     '2026-03-21 08:00:00+07'),

    -- Thông báo tồn kho thấp
    ('c7000000-0000-0000-0000-000000000002',
     '00000000-0000-0000-0000-000000000003',
     'Tồn kho thấp — RAM DDR4 16GB',
     'RAM DDR4 16GB tại Kho chính còn 10 đơn vị, đang tiến gần mức tối thiểu (5). Cân nhắc nhập thêm.',
     'in_app', 'sent',
     '{"type":"low_stock","part_id":"f2000000-0000-0000-0000-000000000002","warehouse_id":"d1000000-0000-0000-0000-000000000001","on_hand":10}'::jsonb,
     '2026-03-20 09:00:00+07'),

    -- Thông báo khấu hao đến hạn ghi sổ
    ('c7000000-0000-0000-0000-000000000003',
     '00000000-0000-0000-0000-000000000002',
     'Bút toán khấu hao T02/2026 chờ ghi sổ',
     '6 bút toán khấu hao tháng 02/2026 đã được tính, tổng giá trị 8.160.001 VNĐ. Vui lòng xem xét và ghi sổ.',
     'in_app', 'sent',
     '{"type":"depreciation_pending","run_id":"0d200000-0000-0000-0000-000000000002","entries_count":6,"total":8160001}'::jsonb,
     '2026-03-01 08:30:00+07'),

    -- Thông báo phiếu kho chờ duyệt
    ('c7000000-0000-0000-0000-000000000004',
     '00000000-0000-0000-0000-000000000002',
     'Phiếu nhập kho NK-2026-0002 chờ phê duyệt',
     'Phiếu nhập kho NK-2026-0002 từ kho thủ (Trần Thị Kho) với tổng giá trị 46.350.000 VNĐ đang chờ bạn phê duyệt.',
     'in_app', 'sent',
     '{"type":"doc_approval","doc_id":"f1000000-0000-0000-0000-000000000004","doc_code":"NK-2026-0002"}'::jsonb,
     '2026-03-10 10:15:00+07'),

    -- Thông báo kiểm kê bắt đầu
    ('c7000000-0000-0000-0000-000000000005',
     '00000000-0000-0000-0000-000000000002',
     'Phiên kiểm kê Q1/2026 đã bắt đầu',
     'Phiên kiểm kê tài sản định kỳ Q1/2026 đã được khởi tạo. Vui lòng phân công kiểm kê viên và bắt đầu thực hiện.',
     'in_app', 'read',
     '{"type":"inventory_start","session_code":"KK-Q1-2026"}'::jsonb,
     '2026-03-15 08:00:00+07'),

    -- Thông báo repair order hoàn thành
    ('c7000000-0000-0000-0000-000000000006',
     '00000000-0000-0000-0000-000000000004',
     'Đơn sửa chữa RO-001 đã hoàn thành',
     'Đơn sửa chữa PC-KT-001 (thay RAM + SSD) đã được đóng. Thiết bị đã sẵn sàng bàn giao lại người dùng.',
     'in_app', 'read',
     '{"type":"repair_completed","repair_id":"r1000000-0000-0000-0000-000000000001"}'::jsonb,
     '2026-02-10 15:30:00+07'),

    -- Thông báo cho warehouse keeper
    ('c7000000-0000-0000-0000-000000000007',
     '00000000-0000-0000-0000-000000000003',
     'Phiếu điều chuyển DC-2026-0001 đã ghi sổ',
     'Phiếu điều chuyển DC-2026-0001 (Kho chính → Chi nhánh HN) đã được ghi sổ thành công. Tồn kho đã được cập nhật.',
     'in_app', 'read',
     '{"type":"transfer_posted","doc_id":"f1000000-0000-0000-0000-000000000021","doc_code":"DC-2026-0001"}'::jsonb,
     '2026-01-15 16:30:00+07')

ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 8. AUDIT SESSIONS + ITEMS (phiên kiểm kê tài sản)
-- ============================================================================

INSERT INTO audit_sessions
    (id, audit_code, name, audit_type, scope_description,
     start_date, end_date, status,
     organization_id, created_by,
     total_items, audited_items, created_at, updated_at)
VALUES
    -- Kiểm kê toàn bộ Q1/2026
    ('c8000000-0000-0000-0000-000000000001',
     'KK-Q1-2026', 'Kiểm kê tài sản toàn công ty Q1/2026',
     'full',
     'Kiểm kê toàn bộ tài sản IT tại trụ sở chính và Data Center. Bao gồm PC, Laptop, Server, Mạng, Màn hình.',
     '2026-03-15', '2026-03-31', 'in_progress',
     'd0000000-0000-0000-0000-000000000001',
     '00000000-0000-0000-0000-000000000002',
     50, 18, NOW(), NOW()),

    -- Kiểm kê chi nhánh HN
    ('c8000000-0000-0000-0000-000000000002',
     'KK-HN-2026-01', 'Kiểm kê tài sản Chi nhánh Hà Nội Q1/2026',
     'partial',
     'Kiểm kê tài sản IT tại Chi nhánh Hà Nội.',
     '2026-03-18', '2026-03-28', 'draft',
     'd0000000-0000-0000-0000-000000000008',
     '00000000-0000-0000-0000-000000000002',
     12, 0, NOW(), NOW()),

    -- Kiểm kê kho linh kiện
    ('c8000000-0000-0000-0000-000000000003',
     'KK-KHO-2026-01', 'Kiểm kê kho linh kiện Q1/2026',
     'spot_check',
     'Đối soát tồn kho linh kiện tại Kho chính và Kho IT phòng CNTT.',
     '2026-01-31', '2026-01-31', 'completed',
     'd0000000-0000-0000-0000-000000000002',
     '00000000-0000-0000-0000-000000000002',
     15, 15, '2026-01-31 08:00:00+07', '2026-01-31 17:00:00+07')

ON CONFLICT (id) DO NOTHING;

-- Audit items (mẫu cho kiểm kê Q1/2026)
INSERT INTO audit_items
    (id, audit_id, asset_id,
     expected_location_id, actual_location_id,
     audit_status, audited_by, audited_at, notes)
VALUES
    ('c9000000-0000-0000-0000-000000000001',
     'c8000000-0000-0000-0000-000000000001',
     'a1000000-0000-0000-0000-000000000001',
     'a0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000004',
     'found', '00000000-0000-0000-0000-000000000006',
     '2026-03-15 09:30:00+07', 'Xác nhận: PC-KT-001 đang sử dụng tại phòng Kế toán'),

    ('c9000000-0000-0000-0000-000000000002',
     'c8000000-0000-0000-0000-000000000001',
     'a1000000-0000-0000-0000-000000000002',
     'a0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000004',
     'found', '00000000-0000-0000-0000-000000000006',
     '2026-03-15 09:45:00+07', 'Xác nhận: PC-KT-002 đang sử dụng tại phòng Kế toán'),

    ('c9000000-0000-0000-0000-000000000003',
     'c8000000-0000-0000-0000-000000000001',
     'a1000000-0000-0000-0000-000000000011',
     'a0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000003',
     'found', '00000000-0000-0000-0000-000000000006',
     '2026-03-15 10:00:00+07', 'Xác nhận: LT-CNTT-001 tại phòng CNTT'),

    ('c9000000-0000-0000-0000-000000000004',
     'c8000000-0000-0000-0000-000000000001',
     'a1000000-0000-0000-0000-000000000016',
     'a0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000006',
     'found', '00000000-0000-0000-0000-000000000006',
     '2026-03-15 14:00:00+07', 'Xác nhận: Core Switch tại Data Center'),

    ('c9000000-0000-0000-0000-000000000005',
     'c8000000-0000-0000-0000-000000000001',
     'a1000000-0000-0000-0000-000000000034',
     'a0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000006',
     'found', '00000000-0000-0000-0000-000000000006',
     '2026-03-15 14:30:00+07', 'Xác nhận: SRV-ESX-01 tại Data Center')

ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 9. INVENTORY SESSIONS bổ sung (phiên kiểm kê kho)
-- ============================================================================

INSERT INTO inventory_sessions
    (id, name, location_id, status,
     started_at, closed_at, created_by)
VALUES
    ('db000000-0000-0000-0000-000000000001',
     'Kiểm kê kho chính Q4/2025',
     NULL, 'closed',
     '2025-12-28 08:00:00+07', '2025-12-28 17:00:00+07',
     '00000000-0000-0000-0000-000000000003'),

    ('db000000-0000-0000-0000-000000000002',
     'Kiểm kê kho Data Center T01/2026',
     NULL, 'closed',
     '2026-01-20 09:00:00+07', '2026-01-20 16:00:00+07',
     '00000000-0000-0000-0000-000000000003'),

    ('db000000-0000-0000-0000-000000000003',
     'Kiểm kê kho chính T03/2026',
     NULL, 'in_progress',
     '2026-03-20 08:00:00+07', NULL,
     '00000000-0000-0000-0000-000000000003')

ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 10. MAINTENANCE TICKETS bổ sung (phiếu bảo trì)
-- ============================================================================

INSERT INTO maintenance_tickets
    (id, title, diagnosis, status, severity,
     asset_id, created_by,
     opened_at, closed_at)
VALUES
    ('dd000000-0000-0000-0000-000000000001',
     'Màn hình MN-003 bị nhiễu màu',
     'Màn hình MN-003 xuất hiện hiện tượng nhiễu màu ở góc trên bên trái, cần kiểm tra và thay thế nếu cần.',
     'open', 'medium',
     'a1000000-0000-0000-0000-000000000023',
     '00000000-0000-0000-0000-000000000004',
     '2026-03-10 09:00:00+07', NULL),

    ('dd000000-0000-0000-0000-000000000002',
     'UPS-002 phát âm thanh bất thường',
     'UPS tại phòng kỹ thuật phát tiếng bíp liên tục. Cần kiểm tra pin và cài đặt ngưỡng cảnh báo.',
     'in_progress', 'high',
     'a1000000-0000-0000-0000-000000000042',
     '00000000-0000-0000-0000-000000000006',
     '2026-03-12 14:00:00+07', NULL),

    ('dd000000-0000-0000-0000-000000000003',
     'Camera CAM-004 mất kết nối',
     'Camera hành lang tầng 4 mất kết nối từ ngày 18/03. Cần kiểm tra cáp mạng và cấu hình PoE switch.',
     'open', 'low',
     'a1000000-0000-0000-0000-000000000050',
     '00000000-0000-0000-0000-000000000004',
     '2026-03-18 11:30:00+07', NULL),

    ('dd000000-0000-0000-0000-000000000004',
     'Bảo trì định kỳ: Vệ sinh PC phòng Kinh doanh',
     'Bảo trì định kỳ 6 tháng — vệ sinh quạt, thay keo tản nhiệt, kiểm tra phần cứng PC phòng Kinh doanh.',
     'closed', 'low',
     'a1000000-0000-0000-0000-000000000001',
     '00000000-0000-0000-0000-000000000002',
     '2026-03-05 08:00:00+07', '2026-03-05 17:00:00+07')

ON CONFLICT (id) DO NOTHING;

COMMIT;
