-- =============================================================================
-- SEED: MY PAGES (Tài sản của tôi + Yêu cầu của tôi)
--
-- Purpose:
--   1. Map OUs → Organizations so scope:'my_ou' resolves correctly
--   2. Set organization_id on asset_assignments and locations so admin sees
--      assets on "Tài sản của tôi" (CNTT org = d0000000-...-002)
--   3. Seed wf_requests with requester_id = admin so "Yêu cầu của tôi" shows data
--
-- Admin user:  00000000-0000-0000-0000-000000000001  (OU: 30000000-...-002 Phòng CNTT)
-- CNTT org:    d0000000-0000-0000-0000-000000000002
-- KeToan org:  d0000000-0000-0000-0000-000000000003
-- =============================================================================
BEGIN;

-- ============================================================================
-- 1. OU → ORGANIZATION MAPPINGS
--    Links org_units to organizations so resolveUserOrganizationId() works.
--    ou_organization_mappings has a PRIMARY KEY on ou_id (one org per OU).
-- ============================================================================
INSERT INTO ou_organization_mappings (ou_id, organization_id)
VALUES
    -- Root company OU → Công ty TNHH Công nghệ ABC
    ('30000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001'),
    -- Phòng CNTT OU → Phòng Công nghệ thông tin
    ('30000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000002'),
    -- Helpdesk sub-OU → same CNTT org
    ('30000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000002'),
    -- Hạ tầng & Mạng sub-OU → same CNTT org
    ('30000000-0000-0000-0000-000000000004', 'd0000000-0000-0000-0000-000000000002'),
    -- Bảo mật sub-OU → same CNTT org
    ('30000000-0000-0000-0000-000000000005', 'd0000000-0000-0000-0000-000000000002'),
    -- Phòng Kế toán - Tài chính OU → Phòng Kế toán
    ('30000000-0000-0000-0000-000000000006', 'd0000000-0000-0000-0000-000000000003')
ON CONFLICT (ou_id) DO UPDATE
    SET organization_id = EXCLUDED.organization_id,
        updated_at      = NOW();

-- ============================================================================
-- 2. SET ORGANIZATION_ID ON LOCATIONS
--    Tầng 2 - Phòng CNTT  → CNTT org
--    Tầng 3 - Kế toán     → KeToan org
-- ============================================================================
UPDATE locations
SET organization_id = 'd0000000-0000-0000-0000-000000000002'
WHERE id = 'a0000000-0000-0000-0000-000000000003'; -- Tầng 2 - Phòng CNTT

UPDATE locations
SET organization_id = 'd0000000-0000-0000-0000-000000000003'
WHERE id = 'a0000000-0000-0000-0000-000000000004'; -- Tầng 3 - Kế toán

-- ============================================================================
-- 3. SET ORGANIZATION_ID ON ASSET ASSIGNMENTS
--    Assignments for CNTT users (admin, IT Manager, technician) → CNTT org
--    Assignments for accountant users → KeToan org
-- ============================================================================

-- CNTT users: admin (000..001), IT Manager (000..002), Kỹ sư (000..006)
UPDATE asset_assignments
SET organization_id = 'd0000000-0000-0000-0000-000000000002'
WHERE id IN (
    'aa000000-0000-0000-0000-000000000003', -- PC → IT Manager
    'aa000000-0000-0000-0000-000000000004', -- Laptop → Kỹ sư CNTT #1
    'aa000000-0000-0000-0000-000000000005', -- Laptop → IT Manager
    'aa000000-0000-0000-0000-000000000007', -- Laptop → Kỹ sư CNTT #2
    'aa000000-0000-0000-0000-000000000008'  -- Màn hình → Giám đốc (admin)
);

-- Kế toán users: accountant (000..005)
UPDATE asset_assignments
SET organization_id = 'd0000000-0000-0000-0000-000000000003'
WHERE id IN (
    'aa000000-0000-0000-0000-000000000001', -- PC → Kế toán
    'aa000000-0000-0000-0000-000000000002', -- PC → Kế toán
    'aa000000-0000-0000-0000-000000000006', -- Laptop → Kế toán trưởng
    'aa000000-0000-0000-0000-000000000009', -- Màn hình → Kế toán desk 1
    'aa000000-0000-0000-0000-000000000010'  -- Màn hình → Kế toán desk 2
);

-- ============================================================================
-- 4. ADDITIONAL CNTT ASSETS — Đang sửa / Trong kho / Thanh lý
--    Tất cả ở location Tầng 2 - Phòng CNTT (a0000000-...-003)
--    → organization_id = d0000000-...-002 → xuất hiện trong my_ou scope của admin
--    Series UUID: a1000000-0000-0000-0000-0000000000XX  (051-056)
-- ============================================================================
INSERT INTO assets
    (id, asset_code, model_id, serial_no, hostname, location_id, status,
     purchase_date, warranty_end, vendor_id, warehouse_id, spec, notes)
VALUES
    -- in_repair: Tab "Đang sửa"
    ('a1000000-0000-0000-0000-000000000051', 'LT-008',
     'f0000000-0000-0000-0000-000000000011', 'SN-LT008-2022', 'LT-CNTT-003',
     'a0000000-0000-0000-0000-000000000003', 'in_repair',
     '2022-08-15', '2025-08-15', 'b0000000-0000-0000-0000-000000000001',
     'd1000000-0000-0000-0000-000000000004',
     '{"cpu":"i7-1255U","ram":16,"disk":512,"screen":"15.6 FHD"}',
     'Gửi sửa - pin chai, bàn phím kẹt phím'),

    ('a1000000-0000-0000-0000-000000000052', 'MN-009',
     'f0000000-0000-0000-0000-000000000022', 'SN-MN009-2022', NULL,
     'a0000000-0000-0000-0000-000000000003', 'in_repair',
     '2022-06-01', '2025-06-01', 'b0000000-0000-0000-0000-000000000002',
     'd1000000-0000-0000-0000-000000000004',
     '{"size":27,"resolution":"2560x1440","panel_type":"IPS"}',
     'Đang sửa - đèn nền nhấp nháy, chờ thay inverter'),

    -- in_stock: Tab "Trong kho"
    ('a1000000-0000-0000-0000-000000000053', 'LT-009',
     'f0000000-0000-0000-0000-000000000015', 'SN-LT009-2024', NULL,
     'a0000000-0000-0000-0000-000000000003', 'in_stock',
     '2024-01-10', '2027-01-10', 'b0000000-0000-0000-0000-000000000003',
     'd1000000-0000-0000-0000-000000000004',
     '{"cpu":"i7-1365U","ram":16,"disk":512,"screen":"14 FHD+"}',
     'Kho CNTT - dự phòng cấp mới'),

    ('a1000000-0000-0000-0000-000000000054', 'PC-011',
     'f0000000-0000-0000-0000-000000000004', 'SN-PC011-2024', NULL,
     'a0000000-0000-0000-0000-000000000003', 'in_stock',
     '2024-02-20', '2027-02-20', 'b0000000-0000-0000-0000-000000000002',
     'd1000000-0000-0000-0000-000000000004',
     '{"cpu":"i5-13500","ram":16,"disk":512,"os":"Windows 11 Pro"}',
     'Kho CNTT - chờ bàn giao nhân viên mới'),

    -- retired: Tab "Thanh lý"
    ('a1000000-0000-0000-0000-000000000055', 'LT-010',
     'f0000000-0000-0000-0000-000000000018', 'SN-LT010-2019', 'LT-OLD-002',
     'a0000000-0000-0000-0000-000000000003', 'retired',
     '2019-03-01', '2022-03-01', 'b0000000-0000-0000-0000-000000000001',
     'd1000000-0000-0000-0000-000000000004',
     '{"cpu":"i5-8250U","ram":8,"disk":256,"screen":"14 FHD"}',
     'Thanh lý 2024 - hết khấu hao, màn hình nứt'),

    ('a1000000-0000-0000-0000-000000000056', 'PC-012',
     'f0000000-0000-0000-0000-000000000003', 'SN-PC012-2019', 'PC-OLD-002',
     'a0000000-0000-0000-0000-000000000003', 'retired',
     '2019-05-01', '2022-05-01', 'b0000000-0000-0000-0000-000000000002',
     'd1000000-0000-0000-0000-000000000004',
     '{"cpu":"i3-8100","ram":4,"disk":128,"os":"Windows 10 Pro"}',
     'Thanh lý 2024 - mainboard lỗi, không kinh tế sửa chữa')
ON CONFLICT (asset_code) DO UPDATE SET
    status       = EXCLUDED.status,
    location_id  = EXCLUDED.location_id,
    warranty_end = EXCLUDED.warranty_end,
    notes        = EXCLUDED.notes;

-- ============================================================================
-- 5. WF REQUESTS — requester = admin (000..001)
--    Provides data for "Yêu cầu của tôi" page
--    code MUST be UNIQUE across all wf_requests
--    status: draft/submitted/in_review/approved/rejected/cancelled/closed
--    priority: low/normal/high/urgent
--    request_type: asset_request/repair_request/disposal_request/purchase/other
-- ============================================================================
INSERT INTO wf_requests
    (id, code, title, request_type, priority, status, requester_id,
     requester_ou_id, definition_id, current_step_no, payload, submitted_at, closed_at)
VALUES
    ('fe000000-0000-0000-0000-000000000001',
     'MY-2026-001',
     'Yêu cầu cấp laptop mới cho nhân viên mới',
     'asset_request', 'urgent', 'draft',
     '00000000-0000-0000-0000-000000000001',
     '30000000-0000-0000-0000-000000000002',
     NULL, NULL,
     '{"asset_type":"laptop","reason":"Nhân viên mới vào làm","department":"CNTT"}'::jsonb,
     NULL, NULL),

    ('fe000000-0000-0000-0000-000000000002',
     'MY-2026-002',
     'Yêu cầu sửa chữa PC bị lỗi nguồn điện',
     'repair_request', 'high', 'submitted',
     '00000000-0000-0000-0000-000000000001',
     '30000000-0000-0000-0000-000000000002',
     NULL, 1,
     '{"asset_code":"PC-HP-003","issue":"Nguồn không lên","estimated_cost":1500000}'::jsonb,
     '2026-04-01 08:30:00', NULL),

    ('fe000000-0000-0000-0000-000000000003',
     'MY-2026-003',
     'Yêu cầu mua sắm switch mạng 48 cổng',
     'purchase', 'normal', 'in_review',
     '00000000-0000-0000-0000-000000000001',
     '30000000-0000-0000-0000-000000000002',
     NULL, 1,
     '{"vendor":"Cisco","model":"SG350-28","estimated_cost":45000000,"reason":"Mở rộng hạ tầng mạng tầng 2"}'::jsonb,
     '2026-03-20 09:00:00', NULL),

    ('fe000000-0000-0000-0000-000000000004',
     'MY-2026-004',
     'Yêu cầu mua UPS 3kVA cho phòng máy chủ',
     'purchase', 'high', 'approved',
     '00000000-0000-0000-0000-000000000001',
     '30000000-0000-0000-0000-000000000002',
     NULL, 2,
     '{"vendor":"APC","model":"SMT3000","estimated_cost":28000000,"reason":"Phòng máy chủ thiếu UPS dự phòng"}'::jsonb,
     '2026-03-10 10:00:00', NULL),

    ('fe000000-0000-0000-0000-000000000005',
     'MY-2026-005',
     'Yêu cầu cấp thêm màn hình phụ cho workstation thiết kế',
     'asset_request', 'low', 'rejected',
     '00000000-0000-0000-0000-000000000001',
     '30000000-0000-0000-0000-000000000002',
     NULL, 1,
     '{"asset_type":"monitor","reason":"Cần dual screen cho công việc đồ họa","reject_reason":"Ngân sách quý này đã hết"}'::jsonb,
     '2026-02-15 14:00:00', NULL),

    ('fe000000-0000-0000-0000-000000000006',
     'MY-2026-006',
     'Yêu cầu thanh lý máy tính cũ hỏng không sửa được',
     'disposal_request', 'normal', 'closed',
     '00000000-0000-0000-0000-000000000001',
     '30000000-0000-0000-0000-000000000002',
     NULL, NULL,
     '{"asset_codes":["PC-003","PC-007"],"reason":"End of life, beyond repair","salvage_value":0}'::jsonb,
     '2026-01-10 09:00:00', '2026-01-15 16:00:00')
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 5. WF REQUEST LINES — for the requests above
-- ============================================================================
INSERT INTO wf_request_lines
    (id, request_id, line_no, item_type, asset_id, part_id, requested_qty, fulfilled_qty, unit_cost, note, status)
VALUES
    -- Lines for MY-2026-001 (asset_request: 2 laptops)
    ('fe100000-0000-0000-0000-000000000001',
     'fe000000-0000-0000-0000-000000000001',
     1, 'asset', NULL, NULL, 1, 0, 25000000,
     'Laptop Dell Latitude 15 i7, 16GB RAM, 512GB SSD', 'pending'),

    ('fe100000-0000-0000-0000-000000000002',
     'fe000000-0000-0000-0000-000000000001',
     2, 'asset', NULL, NULL, 1, 0, 20000000,
     'Laptop HP EliteBook 840 G9 cho nhân viên mới', 'pending'),

    -- Lines for MY-2026-002 (repair_request: 1 service)
    ('fe100000-0000-0000-0000-000000000003',
     'fe000000-0000-0000-0000-000000000002',
     1, 'service', 'a1000000-0000-0000-0000-000000000004', NULL, 1, 0, 1500000,
     'Thay nguồn ATX 650W cho PC-HP-003', 'pending'),

    -- Lines for MY-2026-003 (purchase: switch mạng)
    ('fe100000-0000-0000-0000-000000000004',
     'fe000000-0000-0000-0000-000000000003',
     1, 'asset', NULL, NULL, 2, 0, 22500000,
     'Cisco SG350-28 - 28-port Gigabit Managed Switch', 'pending'),

    -- Lines for MY-2026-004 (purchase: UPS — already approved)
    ('fe100000-0000-0000-0000-000000000005',
     'fe000000-0000-0000-0000-000000000004',
     1, 'asset', NULL, NULL, 1, 1, 28000000,
     'APC SMT3000 3kVA/2.7kW Smart-UPS', 'fulfilled'),

    -- Lines for MY-2026-006 (disposal — closed)
    ('fe100000-0000-0000-0000-000000000006',
     'fe000000-0000-0000-0000-000000000006',
     1, 'asset', 'a1000000-0000-0000-0000-000000000001', NULL, 1, 1, 0,
     'PC Dell Optiplex — thanh lý', 'fulfilled'),

    ('fe100000-0000-0000-0000-000000000007',
     'fe000000-0000-0000-0000-000000000006',
     2, 'asset', 'a1000000-0000-0000-0000-000000000002', NULL, 1, 1, 0,
     'PC HP Compaq — thanh lý', 'fulfilled')
ON CONFLICT (request_id, line_no) DO NOTHING;

COMMIT;
