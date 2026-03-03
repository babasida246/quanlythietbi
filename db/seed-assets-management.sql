-- ============================================================================
-- seed-assets-management.sql — Dữ liệu quản lý tài sản CNTT thực tế
-- Bao gồm: Vendors, Suppliers, Locations, Categories, Models, Assets,
--   Assignments, Events, Maintenance, Workflows, Reminders, Inventory,
--   Warehouses, Spare Parts, Stock Documents, Repair Orders,
--   Licenses, Accessories, Consumables, Components
-- Chạy SAU seed-data.sql
-- ============================================================================

BEGIN;

    -- ============================================================================
    -- 1. NHÀ CUNG CẤP (Vendors) — Các hãng CNTT thực tế tại Việt Nam
    -- ============================================================================
    INSERT INTO vendors
        (id, name, tax_code, phone, email, address, created_at)
    VALUES
        ('aa100000-0000-0000-0000-000000000001', 'Dell Technologies', '0312345678', '1900-545-455', 'sales-vn@dell.com', 'Tầng 15, Vincom Center, 72 Lê Thánh Tôn, Q.1, TP.HCM', NOW()),
        ('aa100000-0000-0000-0000-000000000002', 'HP Inc.', '0312345679', '(028) 3825-8228', 'sales-vn@hp.com', 'Tầng 12, Saigon Centre, 65 Lê Lợi, Q.1, TP.HCM', NOW()),
        ('aa100000-0000-0000-0000-000000000003', 'Lenovo Vietnam', '0312345680', '(028) 3910-6789', 'sales-vn@lenovo.com', 'Tầng 8, Bitexco Tower, Q.1, TP.HCM', NOW()),
        ('aa100000-0000-0000-0000-000000000004', 'Cisco Systems Vietnam', '0312345681', '(028) 3520-6800', 'sales-vn@cisco.com', 'Tầng 20, Landmark 81, Vinhomes Central Park, Q. Bình Thạnh', NOW()),
        ('aa100000-0000-0000-0000-000000000005', 'Fortinet Vietnam', '0312345682', '(028) 3636-9900', 'sales-vn@fortinet.com', 'Tầng 10, Lim Tower, 9-11 Tôn Đức Thắng, Q.1, TP.HCM', NOW()),
        ('aa100000-0000-0000-0000-000000000006', 'ASUS Vietnam', '0312345683', '1800-599-927', 'sales-vn@asus.com', 'Tầng 5, E-Town Central, 11 Đoàn Văn Bơ, Q.4, TP.HCM', NOW()),
        ('aa100000-0000-0000-0000-000000000007', 'Synology Inc.', '0312345684', '(028) 3745-0088', 'sales-vn@synology.com', 'Đại lý FPT, 261-263 Khánh Hội, Q.4, TP.HCM', NOW()),
        ('aa100000-0000-0000-0000-000000000008', 'APC by Schneider Electric', '0312345685', '(028) 3511-5555', 'sales-vn@apc.com', 'Tầng 9, Mapletree Business Centre, Q.7, TP.HCM', NOW())
    ON CONFLICT
    (id) DO
    UPDATE SET
    name = EXCLUDED.name, tax_code = EXCLUDED.tax_code, phone = EXCLUDED.phone,
    email = EXCLUDED.email, address = EXCLUDED.address;

    -- ============================================================================
    -- 2. NHÀ CUNG CẤP / ĐẠI LÝ (Suppliers – dùng cho Licenses)
    -- ============================================================================
    INSERT INTO suppliers
        (id, code, name, contact_name, contact_email, contact_phone, address, website, is_active, created_at)
    VALUES
        ('ab100000-0000-0000-0000-000000000001', 'SUP-FPT', 'FPT Information System', 'Nguyễn Hữu Phúc', 'phuc.nh@fpt.com.vn', '(028) 7300-7300', '10 Phạm Văn Bạch, Q. Tân Bình, TP.HCM', 'https://fis.fpt.com.vn', true, NOW()),
        ('ab100000-0000-0000-0000-000000000002', 'SUP-CMC', 'CMC Telecom', 'Trần Minh Tuấn', 'tuan.tm@cmc.com.vn', '(024) 3568-3456', '11 Duy Tân, Q. Cầu Giấy, Hà Nội', 'https://cmctelecom.vn', true, NOW()),
        ('ab100000-0000-0000-0000-000000000003', 'SUP-VDCS', 'Viettel IDC', 'Hoàng Đức Anh', 'anh.hd@viettel.com.vn', '(024) 6256-8911', '01 Giang Văn Minh, Ba Đình, Hà Nội', 'https://viettelidc.com.vn', true, NOW()),
        ('ab100000-0000-0000-0000-000000000004', 'SUP-MSFT', 'Microsoft Vietnam', 'Lê Quốc Bảo', 'bao.lq@microsoft.com', '(028) 3821-0234', 'Deutsches Haus, Lê Duẩn, Q.1, TP.HCM', 'https://microsoft.com/vi-vn', true, NOW())
    ON CONFLICT
    (id) DO
    UPDATE SET
    code = EXCLUDED.code, name = EXCLUDED.name, contact_name = EXCLUDED.contact_name,
    contact_email = EXCLUDED.contact_email, contact_phone = EXCLUDED.contact_phone,
    address = EXCLUDED.address, website = EXCLUDED.website, is_active = EXCLUDED.is_active;

    -- ============================================================================
    -- 3. VỊ TRÍ (Locations) — Bệnh viện / Trụ sở CNTT thực tế
    -- ============================================================================
    INSERT INTO locations
        (id, name, parent_id, path, created_at)
    VALUES
        ('cc100000-0000-0000-0000-000000000001', 'Trụ sở chính', NULL, '/tru-so-chinh', NOW()),
        ('cc100000-0000-0000-0000-000000000002', 'Tầng 1 - Tiếp nhận', 'cc100000-0000-0000-0000-000000000001', '/tru-so-chinh/tang-1', NOW()),
        ('cc100000-0000-0000-0000-000000000003', 'Tầng 2 - Phòng Kế toán', 'cc100000-0000-0000-0000-000000000001', '/tru-so-chinh/tang-2', NOW()),
        ('cc100000-0000-0000-0000-000000000004', 'Tầng 3 - Phòng CNTT', 'cc100000-0000-0000-0000-000000000001', '/tru-so-chinh/tang-3', NOW()),
        ('cc100000-0000-0000-0000-000000000005', 'Phòng Server (DC)', 'cc100000-0000-0000-0000-000000000004', '/tru-so-chinh/tang-3/phong-server', NOW()),
        ('cc100000-0000-0000-0000-000000000006', 'Chi nhánh 1', NULL, '/chi-nhanh-1', NOW()),
        ('cc100000-0000-0000-0000-000000000007', 'Tầng 1 - CN1', 'cc100000-0000-0000-0000-000000000006', '/chi-nhanh-1/tang-1', NOW()),
        ('cc100000-0000-0000-0000-000000000008', 'Kho vật tư CNTT', 'cc100000-0000-0000-0000-000000000004', '/tru-so-chinh/tang-3/kho-vat-tu', NOW())
    ON CONFLICT
    (id) DO
    UPDATE SET
    name = EXCLUDED.name, parent_id = EXCLUDED.parent_id, path = EXCLUDED.path;

    -- ============================================================================
    -- 4. DANH MỤC TÀI SẢN (Asset Categories)
    -- ============================================================================
    INSERT INTO asset_categories
        (id, name, created_at)
    VALUES
        ('bb100000-0000-0000-0000-000000000001', 'Laptop', NOW()),
        ('bb100000-0000-0000-0000-000000000002', 'Máy tính để bàn', NOW()),
        ('bb100000-0000-0000-0000-000000000003', 'Máy chủ (Server)', NOW()),
        ('bb100000-0000-0000-0000-000000000004', 'Thiết bị mạng', NOW()),
        ('bb100000-0000-0000-0000-000000000005', 'Màn hình', NOW()),
        ('bb100000-0000-0000-0000-000000000006', 'Máy in', NOW()),
        ('bb100000-0000-0000-0000-000000000007', 'UPS / Lưu điện', NOW()),
        ('bb100000-0000-0000-0000-000000000008', 'Thiết bị lưu trữ', NOW())
    ON CONFLICT
    (id) DO
    UPDATE SET name = EXCLUDED.name;

    -- ============================================================================
    -- 5. MẪU THIẾT BỊ (Asset Models) — Sản phẩm thực tế
    -- ============================================================================
    INSERT INTO asset_models
        (id, category_id, vendor_id, brand, model, spec, min_stock_qty, current_stock_qty, avg_daily_consumption, lead_time_days, created_at)
    VALUES
        -- Laptop
        ('dd100000-0000-0000-0000-000000000001', 'bb100000-0000-0000-0000-000000000001', 'aa100000-0000-0000-0000-000000000001', 'Dell', 'Latitude 5540',
            '{"cpu":"Intel Core i7-1365U","ram":"16 GB DDR5","storage":"512 GB NVMe SSD","display":"15.6 inch FHD IPS","os":"Windows 11 Pro","battery":"54 Wh"}'
    ::jsonb,
     5, 3, 0.3, 14, NOW
    ()),
    ('dd100000-0000-0000-0000-000000000002', 'bb100000-0000-0000-0000-000000000001', 'aa100000-0000-0000-0000-000000000002', 'HP',      'EliteBook 840 G10',
     '{"cpu":"Intel Core i5-1345U","ram":"16 GB DDR5","storage":"256 GB NVMe SSD","display":"14 inch WUXGA","os":"Windows 11 Pro","battery":"51 Wh"}'::jsonb,
     5, 2, 0.2, 14, NOW
    ()),
    ('dd100000-0000-0000-0000-000000000003', 'bb100000-0000-0000-0000-000000000001', 'aa100000-0000-0000-0000-000000000003', 'Lenovo',  'ThinkPad T14s Gen 4',
     '{"cpu":"AMD Ryzen 7 PRO 7840U","ram":"16 GB LPDDR5x","storage":"512 GB NVMe SSD","display":"14 inch 2.8K OLED","os":"Windows 11 Pro","battery":"52.5 Wh"}'::jsonb,
     3, 1, 0.15, 21, NOW
    ()),
    -- Máy tính để bàn
    ('dd100000-0000-0000-0000-000000000004', 'bb100000-0000-0000-0000-000000000002', 'aa100000-0000-0000-0000-000000000001', 'Dell',    'OptiPlex 7010 SFF',
     '{"cpu":"Intel Core i5-13500","ram":"8 GB DDR4","storage":"256 GB NVMe SSD","os":"Windows 11 Pro","form_factor":"Small Form Factor"}'::jsonb,
     8, 5, 0.4, 10, NOW
    ()),
    ('dd100000-0000-0000-0000-000000000005', 'bb100000-0000-0000-0000-000000000002', 'aa100000-0000-0000-0000-000000000002', 'HP',      'ProDesk 400 G9 SFF',
     '{"cpu":"Intel Core i5-13500","ram":"8 GB DDR4","storage":"256 GB NVMe SSD","os":"Windows 11 Pro","form_factor":"Small Form Factor"}'::jsonb,
     8, 4, 0.35, 10, NOW
    ()),
    -- Server
    ('dd100000-0000-0000-0000-000000000006', 'bb100000-0000-0000-0000-000000000003', 'aa100000-0000-0000-0000-000000000001', 'Dell',    'PowerEdge R750xs',
     '{"cpu":"2x Intel Xeon Silver 4314","ram":"64 GB DDR4 ECC","storage":"4x 1.92 TB SAS SSD","raid":"PERC H755","psu":"2x 800W","form_factor":"2U Rack"}'::jsonb,
     2, 1, 0.05, 30, NOW
    ()),
    ('dd100000-0000-0000-0000-000000000007', 'bb100000-0000-0000-0000-000000000003', 'aa100000-0000-0000-0000-000000000002', 'HP',      'ProLiant DL380 Gen10 Plus',
     '{"cpu":"2x Intel Xeon Silver 4310","ram":"128 GB DDR4 ECC","storage":"8x 2.4 TB SAS 10K","raid":"Smart Array P408i-a","psu":"2x 800W","form_factor":"2U Rack"}'::jsonb,
     2, 1, 0.03, 30, NOW
    ()),
    -- Thiết bị mạng
    ('dd100000-0000-0000-0000-000000000008', 'bb100000-0000-0000-0000-000000000004', 'aa100000-0000-0000-0000-000000000004', 'Cisco',   'Catalyst 9200L-48P-4G',
     '{"ports":"48x GE PoE+","uplink":"4x 1G SFP","poe_budget":"370W","switching_capacity":"176 Gbps","management":"DNA Center"}'::jsonb,
     2, 2, 0.05, 21, NOW
    ()),
    ('dd100000-0000-0000-0000-000000000009', 'bb100000-0000-0000-0000-000000000004', 'aa100000-0000-0000-0000-000000000005', 'Fortinet','FortiGate 100F',
     '{"throughput":"20 Gbps","ips_throughput":"2.6 Gbps","vpn_throughput":"11.5 Gbps","interfaces":"2x 10GE SFP+, 16x GE","utm":"IPS/AV/Web Filter"}'::jsonb,
     1, 1, 0.02, 21, NOW
    ()),
    ('dd100000-0000-0000-0000-000000000010', 'bb100000-0000-0000-0000-000000000004', 'aa100000-0000-0000-0000-000000000004', 'Cisco',   'ISR 4331',
     '{"throughput":"100 Mbps - 300 Mbps","wan":"3x GE","modules":"2x NIM","features":"SD-WAN, Voice, Security"}'::jsonb,
     1, 0, 0.01, 30, NOW
    ()),
    -- Màn hình
    ('dd100000-0000-0000-0000-000000000011', 'bb100000-0000-0000-0000-000000000005', 'aa100000-0000-0000-0000-000000000001', 'Dell',    'P2423D (24 inch QHD)',
     '{"size":"24 inch","resolution":"2560x1440 QHD","panel":"IPS","ports":"HDMI, DP, USB-C","pivot":"Có"}'::jsonb,
     10, 6, 0.5, 7, NOW
    ()),
    ('dd100000-0000-0000-0000-000000000012', 'bb100000-0000-0000-0000-000000000005', 'aa100000-0000-0000-0000-000000000003', 'Lenovo',  'ThinkVision T24i-30 (24 inch FHD)',
     '{"size":"23.8 inch","resolution":"1920x1080 FHD","panel":"IPS","ports":"HDMI, DP, VGA, USB Hub","pivot":"Có"}'::jsonb,
     10, 8, 0.4, 7, NOW
    ()),
    -- Máy in
    ('dd100000-0000-0000-0000-000000000013', 'bb100000-0000-0000-0000-000000000006', 'aa100000-0000-0000-0000-000000000002', 'HP',      'LaserJet Pro MFP M428fdw',
     '{"type":"Laser đen trắng đa năng","speed":"38 trang/phút","duplex":"Tự động","scan":"ADF 50 tờ","connectivity":"Wi-Fi, Ethernet, USB"}'::jsonb,
     3, 2, 0.1, 14, NOW
    ()),
    -- UPS
    ('dd100000-0000-0000-0000-000000000014', 'bb100000-0000-0000-0000-000000000007', 'aa100000-0000-0000-0000-000000000008', 'APC',     'Smart-UPS 3000VA (SMT3000RMI2U)',
     '{"capacity":"3000 VA / 2700 W","topology":"Line-Interactive","form_factor":"2U Rack","runtime_half_load":"18 phút","outlets":"8x IEC C13, 1x IEC C19"}'::jsonb,
     2, 2, 0.02, 14, NOW
    ()),
    -- Thiết bị lưu trữ (NAS)
    ('dd100000-0000-0000-0000-000000000015', 'bb100000-0000-0000-0000-000000000008', 'aa100000-0000-0000-0000-000000000007', 'Synology','RS1221+ (8-bay NAS)',
     '{"cpu":"AMD Ryzen V1500B","ram":"4 GB DDR4 ECC (max 32 GB)","bays":"8x 3.5\" HDD/SSD","network":"4x 1GbE","m2_cache":"2x M.2 NVMe","raid":"SHR, RAID 0/1/5/6/10"}'::jsonb,
     1, 1, 0.01, 21, NOW
    ())
ON CONFLICT
    (id) DO
    UPDATE SET
    category_id = EXCLUDED.category_id, vendor_id = EXCLUDED.vendor_id,
    brand = EXCLUDED.brand, model = EXCLUDED.model, spec = EXCLUDED.spec,
    min_stock_qty = EXCLUDED.min_stock_qty, current_stock_qty = EXCLUDED.current_stock_qty,
    avg_daily_consumption = EXCLUDED.avg_daily_consumption, lead_time_days = EXCLUDED.lead_time_days;

    -- ============================================================================
    -- 6. TÀI SẢN (Assets) — 20 thiết bị thực tế đa dạng trạng thái
    -- ============================================================================
    INSERT INTO assets
        (
        id, asset_code, model_id, serial_no, mac_address, mgmt_ip, hostname, vlan_id,
        switch_name, switch_port, location_id, status, purchase_date, warranty_end,
        vendor_id, notes, created_at, updated_at
        )
    VALUES
        -- Laptop Dell đang sử dụng
        ('ee100000-0000-0000-0000-000000000001', 'LAP-DELL-001', 'dd100000-0000-0000-0000-000000000001', 'DL5540-VN240101', '00:25:96:FF:AA:01', NULL, 'lap-nhansu-001', 20, 'sw-tang2-01', 'Gi1/0/5', 'cc100000-0000-0000-0000-000000000003', 'in_use', '2024-01-15', '2027-01-15', 'aa100000-0000-0000-0000-000000000001', 'Laptop nhân sự phòng Kế toán', NOW(), NOW()),
        ('ee100000-0000-0000-0000-000000000002', 'LAP-DELL-002', 'dd100000-0000-0000-0000-000000000001', 'DL5540-VN240102', '00:25:96:FF:AA:02', NULL, 'lap-nhansu-002', 20, 'sw-tang2-01', 'Gi1/0/6', 'cc100000-0000-0000-0000-000000000003', 'in_use', '2024-01-15', '2027-01-15', 'aa100000-0000-0000-0000-000000000001', 'Laptop nhân sự phòng Kế toán', NOW(), NOW()),
        -- Laptop HP đang sử dụng
        ('ee100000-0000-0000-0000-000000000003', 'LAP-HP-001', 'dd100000-0000-0000-0000-000000000002', 'HP840G10-VN240201', '10:6F:D9:88:00:03', NULL, 'lap-it-001', 30, 'sw-tang3-01', 'Gi1/0/10', 'cc100000-0000-0000-0000-000000000004', 'in_use', '2024-02-01', '2027-02-01', 'aa100000-0000-0000-0000-000000000002', 'Laptop kỹ thuật viên CNTT', NOW(), NOW()),
        ('ee100000-0000-0000-0000-000000000004', 'LAP-HP-002', 'dd100000-0000-0000-0000-000000000002', 'HP840G10-VN240202', '10:6F:D9:88:00:04', NULL, 'lap-it-002', 30, 'sw-tang3-01', 'Gi1/0/11', 'cc100000-0000-0000-0000-000000000004', 'in_use', '2024-02-01', '2027-02-01', 'aa100000-0000-0000-0000-000000000002', 'Laptop quản lý CNTT', NOW(), NOW()),
        -- Laptop Lenovo đang sử dụng
        ('ee100000-0000-0000-0000-000000000005', 'LAP-LNV-001', 'dd100000-0000-0000-0000-000000000003', 'LNV-T14S4-VN2403', '54:E1:AD:00:00:05', NULL, 'lap-gd-001', 10, 'sw-tang1-01', 'Gi1/0/2', 'cc100000-0000-0000-0000-000000000002', 'in_use', '2024-03-10', '2027-03-10', 'aa100000-0000-0000-0000-000000000003', 'Laptop Ban Giám đốc', NOW(), NOW()),
        -- Laptop dự phòng
        ('ee100000-0000-0000-0000-000000000006', 'LAP-DELL-003', 'dd100000-0000-0000-0000-000000000001', 'DL5540-VN240103', '00:25:96:FF:AA:06', NULL, NULL, NULL, NULL, NULL, 'cc100000-0000-0000-0000-000000000008', 'in_stock', '2024-06-01', '2027-06-01', 'aa100000-0000-0000-0000-000000000001', 'Dự phòng trong kho', NOW(), NOW()),
        ('ee100000-0000-0000-0000-000000000007', 'LAP-HP-003', 'dd100000-0000-0000-0000-000000000002', 'HP840G10-VN240203', '10:6F:D9:88:00:07', NULL, NULL, NULL, NULL, NULL, 'cc100000-0000-0000-0000-000000000008', 'in_stock', '2024-06-01', '2027-06-01', 'aa100000-0000-0000-0000-000000000002', 'Dự phòng trong kho', NOW(), NOW()),
        -- Desktop đang sử dụng
        ('ee100000-0000-0000-0000-000000000008', 'DT-DELL-001', 'dd100000-0000-0000-0000-000000000004', 'DL7010-VN240301', 'D4:5D:64:00:00:08', NULL, 'dt-tiepnhan-001', 20, 'sw-tang1-01', 'Gi1/0/20', 'cc100000-0000-0000-0000-000000000002', 'in_use', '2024-03-01', '2027-03-01', 'aa100000-0000-0000-0000-000000000001', 'Desktop quầy tiếp nhận 1', NOW(), NOW()),
        ('ee100000-0000-0000-0000-000000000009', 'DT-DELL-002', 'dd100000-0000-0000-0000-000000000004', 'DL7010-VN240302', 'D4:5D:64:00:00:09', NULL, 'dt-tiepnhan-002', 20, 'sw-tang1-01', 'Gi1/0/21', 'cc100000-0000-0000-0000-000000000002', 'in_use', '2024-03-01', '2027-03-01', 'aa100000-0000-0000-0000-000000000001', 'Desktop quầy tiếp nhận 2', NOW(), NOW()),
        ('ee100000-0000-0000-0000-000000000010', 'DT-HP-001', 'dd100000-0000-0000-0000-000000000005', 'HP400G9-VN240401', '2C:41:38:00:00:10', NULL, 'dt-ketoan-001', 20, 'sw-tang2-01', 'Gi1/0/15', 'cc100000-0000-0000-0000-000000000003', 'in_use', '2024-04-01', '2027-04-01', 'aa100000-0000-0000-0000-000000000002', 'Desktop kế toán viên', NOW(), NOW()),
        -- Server đang chạy
        ('ee100000-0000-0000-0000-000000000011', 'SRV-DELL-001', 'dd100000-0000-0000-0000-000000000006', 'DR750-VN230101', '24:6E:96:00:00:11', '10.10.0.11', 'srv-app-01', 100, 'sw-dc-01', 'Gi1/0/45', 'cc100000-0000-0000-0000-000000000005', 'in_use', '2023-01-15', '2026-01-15', 'aa100000-0000-0000-0000-000000000001', 'App Server (ERP, HRM)', NOW(), NOW()),
        ('ee100000-0000-0000-0000-000000000012', 'SRV-HP-001', 'dd100000-0000-0000-0000-000000000007', 'DL380G10P-VN23', '24:6E:96:00:00:12', '10.10.0.12', 'srv-db-01', 100, 'sw-dc-01', 'Gi1/0/46', 'cc100000-0000-0000-0000-000000000005', 'in_use', '2023-01-15', '2026-01-15', 'aa100000-0000-0000-0000-000000000002', 'Database Server (PostgreSQL)', NOW(), NOW()),
        -- Server dự phòng
        ('ee100000-0000-0000-0000-000000000013', 'SRV-DELL-002', 'dd100000-0000-0000-0000-000000000006', 'DR750-VN240501', '24:6E:96:00:00:13', '10.10.0.13', 'srv-spare-01', 100, 'sw-dc-01', 'Gi1/0/47', 'cc100000-0000-0000-0000-000000000005', 'in_stock', '2024-05-01', '2027-05-01', 'aa100000-0000-0000-0000-000000000001', 'Server dự phòng DR', NOW(), NOW()),
        -- Thiết bị mạng
        ('ee100000-0000-0000-0000-000000000014', 'SW-CSC-001', 'dd100000-0000-0000-0000-000000000008', 'C9200L-VN2301', 'B0:AA:77:00:00:14', '10.10.1.1', 'sw-tang1-01', 1, NULL, NULL, 'cc100000-0000-0000-0000-000000000002', 'in_use', '2023-06-01', '2028-06-01', 'aa100000-0000-0000-0000-000000000004', 'Core switch tầng 1', NOW(), NOW()),
        ('ee100000-0000-0000-0000-000000000015', 'SW-CSC-002', 'dd100000-0000-0000-0000-000000000008', 'C9200L-VN2302', 'B0:AA:77:00:00:15', '10.10.1.2', 'sw-tang2-01', 1, NULL, NULL, 'cc100000-0000-0000-0000-000000000003', 'in_use', '2023-06-01', '2028-06-01', 'aa100000-0000-0000-0000-000000000004', 'Core switch tầng 2', NOW(), NOW()),
        ('ee100000-0000-0000-0000-000000000016', 'FW-FTN-001', 'dd100000-0000-0000-0000-000000000009', 'FG100F-VN2301', '00:09:0F:20:00:16', '10.10.1.254', 'fw-edge-01', 1, NULL, NULL, 'cc100000-0000-0000-0000-000000000005', 'in_use', '2023-06-01', '2026-06-01', 'aa100000-0000-0000-0000-000000000005', 'Firewall biên WAN', NOW(), NOW()),
        -- Firewall đang sửa
        ('ee100000-0000-0000-0000-000000000017', 'FW-FTN-002', 'dd100000-0000-0000-0000-000000000009', 'FG100F-VN2302', '00:09:0F:20:00:17', NULL, 'fw-spare-02', NULL, NULL, NULL, 'cc100000-0000-0000-0000-000000000005', 'in_repair', '2023-06-01', '2026-06-01', 'aa100000-0000-0000-0000-000000000005', 'Đang RMA tại hãng Fortinet', NOW(), NOW()),
        -- Laptop đã thanh lý
        ('ee100000-0000-0000-0000-000000000018', 'LAP-DELL-OLD', 'dd100000-0000-0000-0000-000000000001', 'DL5530-VN2101', '00:25:96:FF:EE:18', NULL, NULL, NULL, NULL, NULL, NULL, 'retired', '2021-03-01', '2024-03-01', 'aa100000-0000-0000-0000-000000000001', 'Hết bảo hành, đã thanh lý', NOW(), NOW()),
        -- Laptop bị mất
        ('ee100000-0000-0000-0000-000000000019', 'LAP-HP-LOST', 'dd100000-0000-0000-0000-000000000002', 'HP840G9-VN2202', '10:6F:D9:88:EE:19', NULL, NULL, NULL, NULL, NULL, NULL, 'lost', '2022-05-01', '2025-05-01', 'aa100000-0000-0000-0000-000000000002', 'Mất tại sự kiện ngoài', NOW(), NOW()),
        -- UPS
        ('ee100000-0000-0000-0000-000000000020', 'UPS-APC-001', 'dd100000-0000-0000-0000-000000000014', 'APC-SMT3000-01', NULL, NULL, 'ups-dc-01', NULL, NULL, NULL, 'cc100000-0000-0000-0000-000000000005', 'in_use', '2023-01-15', '2026-01-15', 'aa100000-0000-0000-0000-000000000008', 'UPS cho rack server chính', NOW(), NOW())
    ON CONFLICT
    (id) DO
    UPDATE SET
    asset_code = EXCLUDED.asset_code, model_id = EXCLUDED.model_id, serial_no = EXCLUDED.serial_no,
    mac_address = EXCLUDED.mac_address, mgmt_ip = EXCLUDED.mgmt_ip, hostname = EXCLUDED.hostname,
    vlan_id = EXCLUDED.vlan_id, switch_name = EXCLUDED.switch_name, switch_port = EXCLUDED.switch_port,
    location_id = EXCLUDED.location_id, status = EXCLUDED.status, purchase_date = EXCLUDED.purchase_date,
    warranty_end = EXCLUDED.warranty_end, vendor_id = EXCLUDED.vendor_id, notes = EXCLUDED.notes, updated_at = NOW();

    -- ============================================================================
    -- 7. GÁN TÀI SẢN (Asset Assignments)
    -- ============================================================================
    INSERT INTO asset_assignments
        (id, asset_id, assignee_type, assignee_id, assignee_name, assigned_at, returned_at, note)
    VALUES
        ('ff100000-0000-0000-0000-000000000001', 'ee100000-0000-0000-0000-000000000001', 'person', 'NV-KT-001', 'Trần Thị Hương (Kế toán trưởng)', NOW() - INTERVAL
    '180 days', NULL, 'Cấp laptop cho KT trưởng'),
    ('ff100000-0000-0000-0000-000000000002', 'ee100000-0000-0000-0000-000000000002', 'person',     'NV-KT-002', 'Lê Văn Bình (Kế toán viên)',          NOW
    () - INTERVAL '180 days', NULL, 'Cấp laptop cho kế toán viên'),
    ('ff100000-0000-0000-0000-000000000003', 'ee100000-0000-0000-0000-000000000003', 'person',     'NV-IT-001', 'Phạm Đức Mạnh (Kỹ thuật viên CNTT)', NOW
    () - INTERVAL '150 days', NULL, 'Cấp laptop cho KTTV'),
    ('ff100000-0000-0000-0000-000000000004', 'ee100000-0000-0000-0000-000000000004', 'person',     'NV-IT-002', 'Nguyễn Văn Quản (Trưởng phòng CNTT)', NOW
    () - INTERVAL '150 days', NULL, 'Cấp laptop cho TP CNTT'),
    ('ff100000-0000-0000-0000-000000000005', 'ee100000-0000-0000-0000-000000000005', 'person',     'NV-GD-001', 'Hoàng Minh Đức (Phó Giám đốc)',       NOW
    () - INTERVAL '120 days', NULL, 'Cấp laptop cho BGĐ'),
    ('ff100000-0000-0000-0000-000000000006', 'ee100000-0000-0000-0000-000000000011', 'system',     'SYS-ERP',   'ERP & HRM Cluster',                   NOW
    () - INTERVAL '400 days', NULL, 'Server ứng dụng chính'),
    ('ff100000-0000-0000-0000-000000000007', 'ee100000-0000-0000-0000-000000000012', 'system',     'SYS-DB',    'Database Cluster (PostgreSQL)',        NOW
    () - INTERVAL '400 days', NULL, 'Server cơ sở dữ liệu')
ON CONFLICT
    (id) DO
    UPDATE SET
    asset_id = EXCLUDED.asset_id, assignee_type = EXCLUDED.assignee_type,
    assignee_id = EXCLUDED.assignee_id, assignee_name = EXCLUDED.assignee_name,
    assigned_at = EXCLUDED.assigned_at, returned_at = EXCLUDED.returned_at, note = EXCLUDED.note;

    -- ============================================================================
    -- 8. SỰ KIỆN TÀI SẢN (Asset Events)
    -- ============================================================================
    INSERT INTO asset_events
        (id, asset_id, event_type, payload, actor_user_id, correlation_id, created_at)
    VALUES
        ('aa200000-0000-0000-0000-000000000001', 'ee100000-0000-0000-0000-000000000001', 'asset_assigned', '{"assigneeId":"NV-KT-001","assigneeName":"Trần Thị Hương"}'
    ::jsonb,  'seed-admin', 'seed-v2', NOW
    () - INTERVAL '180 days'),
    ('aa200000-0000-0000-0000-000000000002', 'ee100000-0000-0000-0000-000000000003', 'asset_assigned',  '{"assigneeId":"NV-IT-001","assigneeName":"Phạm Đức Mạnh"}'::jsonb,  'seed-admin', 'seed-v2', NOW
    () - INTERVAL '150 days'),
    ('aa200000-0000-0000-0000-000000000003', 'ee100000-0000-0000-0000-000000000017', 'status_changed',  '{"from":"in_use","to":"in_repair","reason":"Lỗi module WAN"}'::jsonb,'seed-admin', 'seed-v2', NOW
    () - INTERVAL '14 days'),
    ('aa200000-0000-0000-0000-000000000004', 'ee100000-0000-0000-0000-000000000018', 'status_changed',  '{"from":"in_use","to":"retired","reason":"Hết bảo hành, hết khấu hao"}'::jsonb, 'seed-admin', 'seed-v2', NOW
    () - INTERVAL '60 days'),
    ('aa200000-0000-0000-0000-000000000005', 'ee100000-0000-0000-0000-000000000019', 'status_changed',  '{"from":"in_use","to":"lost","reason":"Mất tại hội thảo"}'::jsonb,   'seed-admin', 'seed-v2', NOW
    () - INTERVAL '30 days')
ON CONFLICT
    (id) DO
    UPDATE SET
    asset_id = EXCLUDED.asset_id, event_type = EXCLUDED.event_type, payload = EXCLUDED.payload,
    actor_user_id = EXCLUDED.actor_user_id, correlation_id = EXCLUDED.correlation_id, created_at = EXCLUDED.created_at;

    -- ============================================================================
    -- 9. YÊU CẦU BẢO TRÌ (Maintenance Tickets)
    -- ============================================================================
    INSERT INTO maintenance_tickets
        (id, asset_id, title, severity, status, opened_at, closed_at, diagnosis, resolution, created_by, correlation_id)
    VALUES
        ('bb200000-0000-0000-0000-000000000001', 'ee100000-0000-0000-0000-000000000017', 'Lỗi module WAN trên FortiGate FW-FTN-002', 'high', 'open', NOW() - INTERVAL
    '14 days', NULL,                         'Module WAN mất kết nối, LED báo lỗi đỏ', NULL, 'nvquan', 'seed-v2'),
    ('bb200000-0000-0000-0000-000000000002', 'ee100000-0000-0000-0000-000000000003', 'Thay bàn phím laptop HP EliteBook LAP-HP-001',  'low',    'closed', NOW
    () - INTERVAL '45 days', NOW
    () - INTERVAL '40 days', 'Phím Enter và Space liệt',                'Đã thay bàn phím mới, test OK', 'lmhotro', 'seed-v2'),
    ('bb200000-0000-0000-0000-000000000003', 'ee100000-0000-0000-0000-000000000020', 'UPS cảnh báo ắc quy yếu',                      'medium', 'open',   NOW
    () - INTERVAL '5 days',  NULL,                         'UPS cảnh báo Replace Battery',            NULL, 'nvquan', 'seed-v2')
ON CONFLICT
    (id) DO
    UPDATE SET
    asset_id = EXCLUDED.asset_id, title = EXCLUDED.title, severity = EXCLUDED.severity,
    status = EXCLUDED.status, opened_at = EXCLUDED.opened_at, closed_at = EXCLUDED.closed_at,
    diagnosis = EXCLUDED.diagnosis, resolution = EXCLUDED.resolution, created_by = EXCLUDED.created_by;

    -- ============================================================================
    -- 10. YÊU CẦU LUỒNG CÔNG VIỆC (Workflow Requests)
    -- ============================================================================
    INSERT INTO workflow_requests
        (id, request_type, asset_id, from_dept, to_dept, requested_by, approved_by, status, payload, created_at, updated_at, correlation_id)
    VALUES
        ('cc200000-0000-0000-0000-000000000001', 'assign', 'ee100000-0000-0000-0000-000000000006', 'Kho CNTT', 'Phòng Nhân sự', 'lmhotro', NULL, 'submitted', '{"reason":"Nhân viên mới onboarding tháng 3"}'
    ::jsonb,   NOW
    () - INTERVAL '1 day',  NOW
    () - INTERVAL '1 day',  'seed-v2'),
    ('cc200000-0000-0000-0000-000000000002', 'repair',  'ee100000-0000-0000-0000-000000000017', 'Phòng CNTT',     'Trung tâm BT',    'nvquan',   'nvquan',  'in_progress', '{"ticketRef":"bb200000-0000-0000-0000-000000000001"}'::jsonb, NOW
    () - INTERVAL '14 days', NOW
    () - INTERVAL '13 days','seed-v2'),
    ('cc200000-0000-0000-0000-000000000003', 'dispose', 'ee100000-0000-0000-0000-000000000018', 'Phòng CNTT',     'Phòng Kế toán',   'nvquan',   'ptketoan','approved',    '{"reason":"Hết khấu hao, HĐ thanh lý #TL-2024-005"}'::jsonb, NOW
    () - INTERVAL '30 days', NOW
    () - INTERVAL '28 days','seed-v2')
ON CONFLICT
    (id) DO
    UPDATE SET
    request_type = EXCLUDED.request_type, asset_id = EXCLUDED.asset_id, from_dept = EXCLUDED.from_dept,
    to_dept = EXCLUDED.to_dept, requested_by = EXCLUDED.requested_by, approved_by = EXCLUDED.approved_by,
    status = EXCLUDED.status, payload = EXCLUDED.payload, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;

    -- ============================================================================
    -- 11. NHẮC NHỞ (Reminders)
    -- ============================================================================
    INSERT INTO reminders
        (id, reminder_type, asset_id, due_at, status, channel, created_at, sent_at, correlation_id)
    VALUES
        ('dd200000-0000-0000-0000-000000000001', 'warranty_expiring', 'ee100000-0000-0000-0000-000000000011', NOW() + INTERVAL
    '30 days',  'pending', 'ui',    NOW
    () - INTERVAL '2 days', NULL,                        'seed-v2'),
    ('dd200000-0000-0000-0000-000000000002', 'warranty_expiring', 'ee100000-0000-0000-0000-000000000012', NOW
    () + INTERVAL '30 days',  'pending', 'ui',    NOW
    () - INTERVAL '2 days', NULL,                        'seed-v2'),
    ('dd200000-0000-0000-0000-000000000003', 'maintenance_due',   'ee100000-0000-0000-0000-000000000020', NOW
    () + INTERVAL '7 days',   'pending', 'email', NOW
    () - INTERVAL '1 day',  NULL,                        'seed-v2'),
    ('dd200000-0000-0000-0000-000000000004', 'maintenance_due',   'ee100000-0000-0000-0000-000000000016', NOW
    () - INTERVAL '10 days',  'sent',    'email', NOW
    () - INTERVAL '15 days',NOW
    () - INTERVAL '10 days', 'seed-v2')
ON CONFLICT
    (id) DO
    UPDATE SET
    reminder_type = EXCLUDED.reminder_type, asset_id = EXCLUDED.asset_id, due_at = EXCLUDED.due_at,
    status = EXCLUDED.status, channel = EXCLUDED.channel, created_at = EXCLUDED.created_at,
    sent_at = EXCLUDED.sent_at, correlation_id = EXCLUDED.correlation_id;

    -- ============================================================================
    -- 12. KIỂM KÊ (Inventory Sessions)
    -- ============================================================================
    INSERT INTO inventory_sessions
        (id, name, location_id, status, started_at, closed_at, created_by, correlation_id, created_at)
    VALUES
        ('ee200000-0000-0000-0000-000000000001', 'KK-Q1-2025-DC', 'cc100000-0000-0000-0000-000000000005', 'in_progress', NOW() - INTERVAL
    '2 days', NULL, 'nvquan', 'seed-v2', NOW
    () - INTERVAL '2 days')
ON CONFLICT
    (id) DO
    UPDATE SET
    name = EXCLUDED.name, location_id = EXCLUDED.location_id, status = EXCLUDED.status,
    started_at = EXCLUDED.started_at, created_by = EXCLUDED.created_by;

    INSERT INTO inventory_items
        (id, session_id, asset_id, expected_location_id, scanned_location_id, scanned_at, status, note)
    VALUES
        ('ff200000-0000-0000-0000-000000000001', 'ee200000-0000-0000-0000-000000000001', 'ee100000-0000-0000-0000-000000000011', 'cc100000-0000-0000-0000-000000000005', 'cc100000-0000-0000-0000-000000000005', NOW() - INTERVAL
    '2 days', 'found',   'Rack A1, U20-21'),
    ('ff200000-0000-0000-0000-000000000002', 'ee200000-0000-0000-0000-000000000001', 'ee100000-0000-0000-0000-000000000012', 'cc100000-0000-0000-0000-000000000005', 'cc100000-0000-0000-0000-000000000005', NOW
    () - INTERVAL '2 days', 'found',   'Rack A1, U22-23'),
    ('ff200000-0000-0000-0000-000000000003', 'ee200000-0000-0000-0000-000000000001', 'ee100000-0000-0000-0000-000000000017', 'cc100000-0000-0000-0000-000000000005', NULL,                                  NULL,                       'missing', 'Đang gửi RMA tại Fortinet')
ON CONFLICT
    (id) DO
    UPDATE SET
    session_id = EXCLUDED.session_id, asset_id = EXCLUDED.asset_id,
    expected_location_id = EXCLUDED.expected_location_id, scanned_location_id = EXCLUDED.scanned_location_id,
    scanned_at = EXCLUDED.scanned_at, status = EXCLUDED.status, note = EXCLUDED.note;

    -- ============================================================================
    -- 13. KHO VẬT TƯ (Warehouses)
    -- ============================================================================
    INSERT INTO warehouses
        (id, code, name, location_id, created_at)
    VALUES
        ('a0100000-0000-0000-0000-000000000001', 'WH-CNTT', 'Kho vật tư CNTT chính', 'cc100000-0000-0000-0000-000000000008', NOW()),
        ('a0100000-0000-0000-0000-000000000002', 'WH-DC', 'Kho phòng Server (DC)', 'cc100000-0000-0000-0000-000000000005', NOW()),
        ('a0100000-0000-0000-0000-000000000003', 'WH-CN1', 'Kho chi nhánh 1', 'cc100000-0000-0000-0000-000000000007', NOW())
    ON CONFLICT
    (id) DO
    UPDATE SET
    code = EXCLUDED.code, name = EXCLUDED.name, location_id = EXCLUDED.location_id;

    -- ============================================================================
    -- 14. VẬT TƯ / LINH KIỆN (Spare Parts) — Vật tư CNTT thực tế
    -- ============================================================================
    INSERT INTO spare_parts
        (id, part_code, name, category, uom, manufacturer, model, spec, min_level, created_at)
    VALUES
        -- RAM
        ('b0100000-0000-0000-0000-000000000001', 'RAM-DDR4-8', 'RAM DDR4 8GB 3200MHz SODIMM', 'RAM', 'thanh', 'Kingston', 'KVR32S22S8/8', '{"type":"DDR4","capacity":"8 GB","speed":"3200 MHz","form":"SODIMM"}'
    ::jsonb,  10, NOW
    ()),
    ('b0100000-0000-0000-0000-000000000002', 'RAM-DDR4-16',   'RAM DDR4 16GB 3200MHz SODIMM',    'RAM',     'thanh', 'Samsung',   'M471A2K43EB1-CWE', '{"type":"DDR4","capacity":"16 GB","speed":"3200 MHz","form":"SODIMM"}'::jsonb, 8,  NOW
    ()),
    ('b0100000-0000-0000-0000-000000000003', 'RAM-DDR5-16',   'RAM DDR5 16GB 4800MHz SODIMM',    'RAM',     'thanh', 'Kingston',  'KVR48S40BS8-16',   '{"type":"DDR5","capacity":"16 GB","speed":"4800 MHz","form":"SODIMM"}'::jsonb, 5,  NOW
    ()),
    ('b0100000-0000-0000-0000-000000000004', 'RAM-ECC-32',    'RAM DDR4 32GB ECC RDIMM 3200MHz', 'RAM',     'thanh', 'Samsung',   'M393A4K40EB3-CWE', '{"type":"DDR4 ECC","capacity":"32 GB","speed":"3200 MHz","form":"RDIMM"}'::jsonb, 4, NOW
    ()),
    -- Ổ cứng SSD
    ('b0100000-0000-0000-0000-000000000005', 'SSD-256-NVME',  'SSD NVMe 256GB M.2 2280',         'Ổ cứng', 'cái',   'Samsung',   '980 PRO 256GB',    '{"type":"NVMe M.2","capacity":"256 GB","read":"6400 MB/s","write":"2700 MB/s"}'::jsonb, 8, NOW
    ()),
    ('b0100000-0000-0000-0000-000000000006', 'SSD-512-NVME',  'SSD NVMe 512GB M.2 2280',         'Ổ cứng', 'cái',   'Samsung',   '980 PRO 512GB',    '{"type":"NVMe M.2","capacity":"512 GB","read":"7000 MB/s","write":"5000 MB/s"}'::jsonb, 6, NOW
    ()),
    ('b0100000-0000-0000-0000-000000000007', 'SSD-1TB-NVME',  'SSD NVMe 1TB M.2 2280',           'Ổ cứng', 'cái',   'Samsung',   '980 PRO 1TB',      '{"type":"NVMe M.2","capacity":"1 TB","read":"7000 MB/s","write":"5000 MB/s"}'::jsonb,  3, NOW
    ()),
    ('b0100000-0000-0000-0000-000000000008', 'HDD-2TB-SAS',   'HDD SAS 2.4TB 10K RPM 2.5"',     'Ổ cứng', 'cái',   'Seagate',   'ST2400MM0129',     '{"type":"SAS 12Gbps","capacity":"2.4 TB","rpm":"10000","form":"2.5 inch"}'::jsonb, 4, NOW
    ()),
    -- Pin laptop
    ('b0100000-0000-0000-0000-000000000009', 'BAT-DELL-54',   'Pin laptop Dell 54Wh (Latitude)',  'Pin',     'cái',   'Dell',      'M4GWP 54Wh',      '{"capacity":"54 Wh","cells":"4-cell","compatible":"Latitude 5530/5540"}'::jsonb, 5, NOW
    ()),
    ('b0100000-0000-0000-0000-000000000010', 'BAT-HP-51',     'Pin laptop HP 51Wh (EliteBook)',   'Pin',     'cái',   'HP',        'CC03XL 51Wh',     '{"capacity":"51 Wh","cells":"3-cell","compatible":"EliteBook 840/850 G7-G10"}'::jsonb, 5, NOW
    ()),
    -- Bàn phím
    ('b0100000-0000-0000-0000-000000000011', 'KB-DELL-LAT',   'Bàn phím thay thế Dell Latitude', 'Bàn phím','cái',  'Dell',      '0M4GWP',           '{"layout":"US","backlit":"Có","compatible":"Latitude 5530/5540"}'::jsonb, 3, NOW
    ()),
    ('b0100000-0000-0000-0000-000000000012', 'KB-HP-EB',      'Bàn phím thay thế HP EliteBook',  'Bàn phím','cái',  'HP',        'L14378-001',       '{"layout":"US","backlit":"Có","compatible":"EliteBook 840 G7-G10"}'::jsonb, 3, NOW
    ()),
    -- Adapter / Sạc
    ('b0100000-0000-0000-0000-000000000013', 'ADP-DELL-65W',  'Sạc Dell 65W USB-C',              'Sạc',     'cái',   'Dell',      'HA65NM190',        '{"power":"65W","connector":"USB-C","compatible":"Latitude/XPS"}'::jsonb, 5, NOW
    ()),
    ('b0100000-0000-0000-0000-000000000014', 'ADP-HP-65W',    'Sạc HP 65W USB-C',                'Sạc',     'cái',   'HP',        'L04540-002',       '{"power":"65W","connector":"USB-C","compatible":"EliteBook/ProBook"}'::jsonb, 5, NOW
    ()),
    -- Cáp mạng
    ('b0100000-0000-0000-0000-000000000015', 'CAB-CAT6-3M',   'Cáp mạng Cat6 UTP 3m',            'Cáp',     'sợi',   'AMP',       'Cat6 UTP 3m',      '{"category":"Cat6","length":"3m","type":"UTP","connector":"RJ45"}'::jsonb, 50, NOW
    ()),
    ('b0100000-0000-0000-0000-000000000016', 'CAB-CAT6-5M',   'Cáp mạng Cat6 UTP 5m',            'Cáp',     'sợi',   'AMP',       'Cat6 UTP 5m',      '{"category":"Cat6","length":"5m","type":"UTP","connector":"RJ45"}'::jsonb, 30, NOW
    ()),
    ('b0100000-0000-0000-0000-000000000017', 'CAB-FIBER-LC',  'Cáp quang LC-LC Duplex OM3 3m',   'Cáp',     'sợi',   'Panduit',   'LC-LC OM3 3m',     '{"fiber_type":"OM3 Multimode","connector":"LC-LC Duplex","length":"3m"}'::jsonb, 10, NOW
    ()),
    -- Module SFP
    ('b0100000-0000-0000-0000-000000000018', 'SFP-1G-SX',     'Module SFP 1G SX (LC)',            'Module',  'cái',   'Cisco',     'GLC-SX-MMD',       '{"speed":"1 Gbps","wavelength":"850nm","distance":"550m","connector":"LC"}'::jsonb, 5, NOW
    ()),
    ('b0100000-0000-0000-0000-000000000019', 'SFP-10G-SR',    'Module SFP+ 10G SR (LC)',          'Module',  'cái',   'Cisco',     'SFP-10G-SR',       '{"speed":"10 Gbps","wavelength":"850nm","distance":"300m","connector":"LC"}'::jsonb, 4, NOW
    ()),
    -- Mực in
    ('b0100000-0000-0000-0000-000000000020', 'TONER-HP-59A',  'Hộp mực HP 59A (CF259A)',          'Mực in',  'hộp',   'HP',        'CF259A',           '{"yield":"3000 trang","color":"Đen","compatible":"LaserJet Pro M404/M428"}'::jsonb, 6, NOW
    ()),
    -- Ắc quy UPS
    ('b0100000-0000-0000-0000-000000000021', 'BAT-UPS-APC',   'Ắc quy thay thế APC RBC43',       'Ắc quy',  'bộ',   'APC',       'RBC43',            '{"voltage":"48V","compatible":"Smart-UPS 2200/3000 RM"}'::jsonb, 2, NOW
    ())
ON CONFLICT
    (id) DO
    UPDATE SET
    part_code = EXCLUDED.part_code, name = EXCLUDED.name, category = EXCLUDED.category,
    uom = EXCLUDED.uom, manufacturer = EXCLUDED.manufacturer, model = EXCLUDED.model,
    spec = EXCLUDED.spec, min_level = EXCLUDED.min_level;

    -- ============================================================================
    -- 15. TỒN KHO BAN ĐẦU (Spare Part Stock)
    -- ============================================================================
    INSERT INTO spare_part_stock
        (id, warehouse_id, part_id, on_hand, reserved, updated_at)
    VALUES
        -- Kho CNTT chính (WH-CNTT)
        ('d0100000-0000-0000-0000-000000000001', 'a0100000-0000-0000-0000-000000000001', 'b0100000-0000-0000-0000-000000000001', 12, 0, NOW()),
        -- RAM DDR4 8GB
        ('d0100000-0000-0000-0000-000000000002', 'a0100000-0000-0000-0000-000000000001', 'b0100000-0000-0000-0000-000000000002', 8, 0, NOW()),
        -- RAM DDR4 16GB
        ('d0100000-0000-0000-0000-000000000003', 'a0100000-0000-0000-0000-000000000001', 'b0100000-0000-0000-0000-000000000003', 4, 0, NOW()),
        -- RAM DDR5 16GB (dưới min)
        ('d0100000-0000-0000-0000-000000000004', 'a0100000-0000-0000-0000-000000000001', 'b0100000-0000-0000-0000-000000000005', 10, 0, NOW()),
        -- SSD 256GB
        ('d0100000-0000-0000-0000-000000000005', 'a0100000-0000-0000-0000-000000000001', 'b0100000-0000-0000-0000-000000000006', 5, 0, NOW()),
        -- SSD 512GB (dưới min)
        ('d0100000-0000-0000-0000-000000000006', 'a0100000-0000-0000-0000-000000000001', 'b0100000-0000-0000-0000-000000000007', 2, 0, NOW()),
        -- SSD 1TB (dưới min)
        ('d0100000-0000-0000-0000-000000000007', 'a0100000-0000-0000-0000-000000000001', 'b0100000-0000-0000-0000-000000000009', 6, 0, NOW()),
        -- Pin Dell
        ('d0100000-0000-0000-0000-000000000008', 'a0100000-0000-0000-0000-000000000001', 'b0100000-0000-0000-0000-000000000010', 3, 0, NOW()),
        -- Pin HP (dưới min)
        ('d0100000-0000-0000-0000-000000000009', 'a0100000-0000-0000-0000-000000000001', 'b0100000-0000-0000-0000-000000000011', 4, 0, NOW()),
        -- KB Dell
        ('d0100000-0000-0000-0000-000000000010', 'a0100000-0000-0000-0000-000000000001', 'b0100000-0000-0000-0000-000000000012', 2, 0, NOW()),
        -- KB HP (dưới min)
        ('d0100000-0000-0000-0000-000000000011', 'a0100000-0000-0000-0000-000000000001', 'b0100000-0000-0000-0000-000000000013', 7, 0, NOW()),
        -- Sạc Dell
        ('d0100000-0000-0000-0000-000000000012', 'a0100000-0000-0000-0000-000000000001', 'b0100000-0000-0000-0000-000000000014', 4, 0, NOW()),
        -- Sạc HP (dưới min)
        ('d0100000-0000-0000-0000-000000000013', 'a0100000-0000-0000-0000-000000000001', 'b0100000-0000-0000-0000-000000000015', 80, 0, NOW()),
        -- Cáp Cat6 3m
        ('d0100000-0000-0000-0000-000000000014', 'a0100000-0000-0000-0000-000000000001', 'b0100000-0000-0000-0000-000000000016', 40, 0, NOW()),
        -- Cáp Cat6 5m
        ('d0100000-0000-0000-0000-000000000015', 'a0100000-0000-0000-0000-000000000001', 'b0100000-0000-0000-0000-000000000020', 8, 0, NOW()),
        -- Mực HP 59A
        ('d0100000-0000-0000-0000-000000000016', 'a0100000-0000-0000-0000-000000000001', 'b0100000-0000-0000-0000-000000000021', 1, 0, NOW()),
        -- Ắc quy UPS (dưới min)
        -- Kho DC (WH-DC)
        ('d0100000-0000-0000-0000-000000000017', 'a0100000-0000-0000-0000-000000000002', 'b0100000-0000-0000-0000-000000000004', 4, 0, NOW()),
        -- RAM ECC 32GB
        ('d0100000-0000-0000-0000-000000000018', 'a0100000-0000-0000-0000-000000000002', 'b0100000-0000-0000-0000-000000000008', 6, 0, NOW()),
        -- HDD SAS 2.4TB
        ('d0100000-0000-0000-0000-000000000019', 'a0100000-0000-0000-0000-000000000002', 'b0100000-0000-0000-0000-000000000017', 12, 0, NOW()),
        -- Cáp quang LC
        ('d0100000-0000-0000-0000-000000000020', 'a0100000-0000-0000-0000-000000000002', 'b0100000-0000-0000-0000-000000000018', 6, 0, NOW()),
        -- SFP 1G
        ('d0100000-0000-0000-0000-000000000021', 'a0100000-0000-0000-0000-000000000002', 'b0100000-0000-0000-0000-000000000019', 3, 0, NOW()),
        -- SFP+ 10G (dưới min)
        -- Kho chi nhánh 1 (WH-CN1)
        ('d0100000-0000-0000-0000-000000000022', 'a0100000-0000-0000-0000-000000000003', 'b0100000-0000-0000-0000-000000000001', 4, 0, NOW()),
        -- RAM DDR4 8GB
        ('d0100000-0000-0000-0000-000000000023', 'a0100000-0000-0000-0000-000000000003', 'b0100000-0000-0000-0000-000000000005', 3, 0, NOW()),
        -- SSD 256GB
        ('d0100000-0000-0000-0000-000000000024', 'a0100000-0000-0000-0000-000000000003', 'b0100000-0000-0000-0000-000000000015', 20, 0, NOW())
    -- Cáp Cat6 3m
    ON CONFLICT
    (id) DO
    UPDATE SET
    warehouse_id = EXCLUDED.warehouse_id, part_id = EXCLUDED.part_id,
    on_hand = EXCLUDED.on_hand, reserved = EXCLUDED.reserved, updated_at = NOW();

    -- ============================================================================
    -- 16. CHỨNG TỪ KHO (Stock Documents) — Mẫu các trạng thái
    -- ============================================================================
    INSERT INTO stock_documents
        (id, doc_type, code, status, warehouse_id, target_warehouse_id, doc_date, note, created_by, approved_by, correlation_id, created_at, updated_at)
    VALUES
        -- Phiếu nhập đã ghi sổ
        ('e0100000-0000-0000-0000-000000000001', 'receipt', 'PN-2025-0001', 'posted', 'a0100000-0000-0000-0000-000000000001', NULL, '2025-01-10', 'Nhập bổ sung RAM, SSD từ FPT IS', 'nvquan', 'nvquan', 'seed-v2', NOW() - INTERVAL
    '50 days', NOW
    () - INTERVAL '48 days'),
    -- Phiếu xuất đã ghi sổ
    ('e0100000-0000-0000-0000-000000000002', 'issue',    'PX-2025-0001', 'posted',    'a0100000-0000-0000-0000-000000000001', NULL,                                  '2025-01-20', 'Xuất vật tư sửa laptop LAP-HP-001',        'ttkho',   'nvquan',  'seed-v2', NOW
    () - INTERVAL '40 days', NOW
    () - INTERVAL '38 days'),
    -- Phiếu chuyển kho (nháp)
    ('e0100000-0000-0000-0000-000000000003', 'transfer', 'CK-2025-0001', 'draft',     'a0100000-0000-0000-0000-000000000001', 'a0100000-0000-0000-0000-000000000003', '2025-02-15', 'Chuyển vật tư sang chi nhánh 1',            'ttkho',   NULL,      'seed-v2', NOW
    () - INTERVAL '10 days', NOW
    () - INTERVAL '10 days'),
    -- Phiếu điều chỉnh (trình duyệt)
    ('e0100000-0000-0000-0000-000000000004', 'adjust',   'DC-2025-0001', 'submitted', 'a0100000-0000-0000-0000-000000000001', NULL,                                  '2025-02-20', 'Điều chỉnh sau kiểm kê Q1',                'ttkho',   NULL,      'seed-v2', NOW
    () - INTERVAL '5 days',  NOW
    () - INTERVAL '5 days'),
    -- Phiếu nhập đã duyệt
    ('e0100000-0000-0000-0000-000000000005', 'receipt',  'PN-2025-0002', 'approved',  'a0100000-0000-0000-0000-000000000002', NULL,                                  '2025-02-22', 'Nhập HDD SAS và SFP cho DC',               'nvquan',  'nvquan',  'seed-v2', NOW
    () - INTERVAL '3 days',  NOW
    () - INTERVAL '2 days')
ON CONFLICT
    (id) DO
    UPDATE SET
    doc_type = EXCLUDED.doc_type, code = EXCLUDED.code, status = EXCLUDED.status,
    warehouse_id = EXCLUDED.warehouse_id, target_warehouse_id = EXCLUDED.target_warehouse_id,
    doc_date = EXCLUDED.doc_date, note = EXCLUDED.note, created_by = EXCLUDED.created_by,
    approved_by = EXCLUDED.approved_by, correlation_id = EXCLUDED.correlation_id, updated_at = NOW();

    -- Dòng chi tiết phiếu nhập PN-2025-0001
    INSERT INTO stock_document_lines
        (id, document_id, part_id, qty, unit_cost, note)
    VALUES
        ('e0200000-0000-0000-0000-000000000001', 'e0100000-0000-0000-0000-000000000001', 'b0100000-0000-0000-0000-000000000001', 20, 180000, 'RAM DDR4 8GB Kingston'),
        ('e0200000-0000-0000-0000-000000000002', 'e0100000-0000-0000-0000-000000000001', 'b0100000-0000-0000-0000-000000000002', 10, 420000, 'RAM DDR4 16GB Samsung'),
        ('e0200000-0000-0000-0000-000000000003', 'e0100000-0000-0000-0000-000000000001', 'b0100000-0000-0000-0000-000000000005', 15, 650000, 'SSD NVMe 256GB Samsung'),
        ('e0200000-0000-0000-0000-000000000004', 'e0100000-0000-0000-0000-000000000001', 'b0100000-0000-0000-0000-000000000006', 8, 1200000, 'SSD NVMe 512GB Samsung')
    ON CONFLICT
    (id) DO
    UPDATE SET
    document_id = EXCLUDED.document_id, part_id = EXCLUDED.part_id,
    qty = EXCLUDED.qty, unit_cost = EXCLUDED.unit_cost, note = EXCLUDED.note;

    -- Dòng chi tiết phiếu xuất PX-2025-0001
    INSERT INTO stock_document_lines
        (id, document_id, part_id, qty, unit_cost, note)
    VALUES
        ('e0200000-0000-0000-0000-000000000005', 'e0100000-0000-0000-0000-000000000002', 'b0100000-0000-0000-0000-000000000012', 1, 350000, 'Bàn phím thay thế cho LAP-HP-001')
    ON CONFLICT
    (id) DO
    UPDATE SET
    document_id = EXCLUDED.document_id, part_id = EXCLUDED.part_id,
    qty = EXCLUDED.qty, unit_cost = EXCLUDED.unit_cost, note = EXCLUDED.note;

    -- Dòng chi tiết phiếu chuyển CK-2025-0001
    INSERT INTO stock_document_lines
        (id, document_id, part_id, qty, unit_cost, note)
    VALUES
        ('e0200000-0000-0000-0000-000000000006', 'e0100000-0000-0000-0000-000000000003', 'b0100000-0000-0000-0000-000000000001', 5, 180000, 'RAM DDR4 8GB cho CN1'),
        ('e0200000-0000-0000-0000-000000000007', 'e0100000-0000-0000-0000-000000000003', 'b0100000-0000-0000-0000-000000000015', 20, 15000, 'Cáp Cat6 3m cho CN1')
    ON CONFLICT
    (id) DO
    UPDATE SET
    document_id = EXCLUDED.document_id, part_id = EXCLUDED.part_id,
    qty = EXCLUDED.qty, unit_cost = EXCLUDED.unit_cost, note = EXCLUDED.note;

    -- Dòng chi tiết phiếu điều chỉnh DC-2025-0001
    INSERT INTO stock_document_lines
        (id, document_id, part_id, qty, unit_cost, note, adjust_direction)
    VALUES
        ('e0200000-0000-0000-0000-000000000008', 'e0100000-0000-0000-0000-000000000004', 'b0100000-0000-0000-0000-000000000015', 5, 15000, 'Phát hiện dư sau kiểm kê', 'plus'),
        ('e0200000-0000-0000-0000-000000000009', 'e0100000-0000-0000-0000-000000000004', 'b0100000-0000-0000-0000-000000000020', 2, 450000, 'Phát hiện thiếu mực in', 'minus')
    ON CONFLICT
    (id) DO
    UPDATE SET
    document_id = EXCLUDED.document_id, part_id = EXCLUDED.part_id,
    qty = EXCLUDED.qty, unit_cost = EXCLUDED.unit_cost, note = EXCLUDED.note, adjust_direction = EXCLUDED.adjust_direction;

    -- Dòng chi tiết phiếu nhập DC PN-2025-0002
    INSERT INTO stock_document_lines
        (id, document_id, part_id, qty, unit_cost, note)
    VALUES
        ('e0200000-0000-0000-0000-000000000010', 'e0100000-0000-0000-0000-000000000005', 'b0100000-0000-0000-0000-000000000008', 4, 3500000, 'HDD SAS 2.4TB Seagate'),
        ('e0200000-0000-0000-0000-000000000011', 'e0100000-0000-0000-0000-000000000005', 'b0100000-0000-0000-0000-000000000019', 4, 2800000, 'SFP+ 10G SR Cisco')
    ON CONFLICT
    (id) DO
    UPDATE SET
    document_id = EXCLUDED.document_id, part_id = EXCLUDED.part_id,
    qty = EXCLUDED.qty, unit_cost = EXCLUDED.unit_cost, note = EXCLUDED.note;

    -- ============================================================================
    -- 17. LỆNH SỬA CHỮA (Repair Orders)
    -- ============================================================================
    INSERT INTO repair_orders
        (id, asset_id, code, title, description, severity, status, opened_at, closed_at, diagnosis, resolution, repair_type, technician_name, vendor_id, labor_cost, parts_cost, downtime_minutes, created_by, correlation_id, created_at, updated_at)
    VALUES
        ('f0100000-0000-0000-0000-000000000001', 'ee100000-0000-0000-0000-000000000017', 'RO-2025-0001', 'RMA Firewall FW-FTN-002 — Lỗi module WAN',
            'FortiGate FW-FTN-002 bị lỗi module WAN, LED báo đỏ, không nhận cổng 10G SFP+. Cần gửi RMA về hãng Fortinet.',
            'high', 'waiting_parts', NOW() - INTERVAL
    '14 days', NULL,
     'Module 10G SFP+ slot 1 hỏng IC driver', NULL,
     'vendor', NULL, 'aa100000-0000-0000-0000-000000000005',
     0, 0, 20160, 'nvquan', 'seed-v2', NOW
    () - INTERVAL '14 days', NOW
    () - INTERVAL '10 days'),

    ('f0100000-0000-0000-0000-000000000002', 'ee100000-0000-0000-0000-000000000003', 'RO-2025-0002', 'Thay bàn phím laptop HP EliteBook LAP-HP-001',
     'Bàn phím laptop HP bị liệt phím Enter và Space. Kỹ thuật viên thay bàn phím từ kho vật tư.',
     'low', 'closed', NOW
    () - INTERVAL '45 days', NOW
    () - INTERVAL '40 days',
     'Phím Enter và Space liệt do rơi nước', 'Thay bàn phím mới KB-HP-EB, test OK toàn bộ phím',
     'internal', 'Phạm Đức Mạnh', NULL,
     0, 350000, 120, 'lmhotro', 'seed-v2', NOW
    () - INTERVAL '45 days', NOW
    () - INTERVAL '40 days'),

    ('f0100000-0000-0000-0000-000000000003', 'ee100000-0000-0000-0000-000000000020', 'RO-2025-0003', 'Thay ắc quy UPS APC Smart-UPS 3000VA',
     'UPS APC cảnh báo Replace Battery. Cần thay bộ ắc quy RBC43.',
     'medium', 'diagnosing', NOW
    () - INTERVAL '5 days', NULL,
     'Ắc quy đã dùng quá 3 năm, dung lượng còn 40%', NULL,
     'internal', 'Phạm Đức Mạnh', NULL,
     0, 0, 0, 'nvquan', 'seed-v2', NOW
    () - INTERVAL '5 days', NOW
    () - INTERVAL '3 days')
ON CONFLICT
    (id) DO
    UPDATE SET
    asset_id = EXCLUDED.asset_id, code = EXCLUDED.code, title = EXCLUDED.title,
    description = EXCLUDED.description, severity = EXCLUDED.severity, status = EXCLUDED.status,
    opened_at = EXCLUDED.opened_at, closed_at = EXCLUDED.closed_at, diagnosis = EXCLUDED.diagnosis,
    resolution = EXCLUDED.resolution, repair_type = EXCLUDED.repair_type,
    technician_name = EXCLUDED.technician_name, vendor_id = EXCLUDED.vendor_id,
    labor_cost = EXCLUDED.labor_cost, parts_cost = EXCLUDED.parts_cost,
    downtime_minutes = EXCLUDED.downtime_minutes, created_by = EXCLUDED.created_by, updated_at = NOW();

    -- Vật tư đã dùng cho sửa chữa
    INSERT INTO repair_order_parts
        (id, repair_order_id, part_id, part_name, warehouse_id, action, qty, unit_cost, note, stock_document_id, created_at)
    VALUES
        ('f0200000-0000-0000-0000-000000000001', 'f0100000-0000-0000-0000-000000000002', 'b0100000-0000-0000-0000-000000000012', 'Bàn phím HP EliteBook', 'a0100000-0000-0000-0000-000000000001', 'replace', 1, 350000, 'Thay bàn phím bị liệt phím', 'e0100000-0000-0000-0000-000000000002', NOW() - INTERVAL
    '42 days')
ON CONFLICT
    (id) DO
    UPDATE SET
    repair_order_id = EXCLUDED.repair_order_id, part_id = EXCLUDED.part_id,
    part_name = EXCLUDED.part_name, warehouse_id = EXCLUDED.warehouse_id,
    action = EXCLUDED.action, qty = EXCLUDED.qty, unit_cost = EXCLUDED.unit_cost, note = EXCLUDED.note;

    -- ============================================================================
    -- 18. GIẤY PHÉP PHẦN MỀM (Licenses) — Giấy phép CNTT thực tế
    -- ============================================================================
    INSERT INTO licenses
        (id, license_code, software_name, license_type, status, supplier_id, category_id, seat_count, unit_price, currency, product_key, purchase_date, expiry_date, notes, created_by, updated_by, created_at, updated_at)
    VALUES
        ('a7100000-0000-0000-0000-000000000001', 'LIC-M365-BP', 'Microsoft 365 Business Premium',
            'per_user', 'active',
            'ab100000-0000-0000-0000-000000000004',
            (SELECT id
            FROM license_categories
            WHERE name='Cloud Services'
    LIMIT 1),
     50, 2700000, 'VND', 'M365-BP-XXXX-XXXX-2024',    '2024-07-01', '2025-07-01',
     'Gói M365 Business Premium cho toàn bộ nhân viên (35/50 seats đang dùng)', 'nvquan', 'nvquan', NOW
    (), NOW
    ()),
    ('a7100000-0000-0000-0000-000000000002', 'LIC-WIN-11P',   'Windows 11 Pro OEM',
     'per_device',  'active',
     'ab100000-0000-0000-0000-000000000001',
    (SELECT id
    FROM license_categories
    WHERE name='Operating System'
    LIMIT 1),
     30, 3000000, 'VND', NULL,                       '2024-01-15', NULL,
     'License Windows 11 Pro OEM cho máy Dell/HP mới (18/30 seats đang dùng)', 'nvquan', 'nvquan', NOW
    (), NOW
    ()),
    ('a7100000-0000-0000-0000-000000000003', 'LIC-VSPH-ENT',  'VMware vSphere Enterprise Plus',
     'per_device',  'active',
     'ab100000-0000-0000-0000-000000000002',
    (SELECT id
    FROM license_categories
    WHERE name='Other'
    LIMIT 1),
     2, 60000000, 'VND', 'VSPH-ENT-XXXX-2023',       '2023-01-15', '2026-01-15',
     'License VMware vSphere cho 2 host server', 'nvquan', 'nvquan', NOW
    (), NOW
    ()),
    ('a7100000-0000-0000-0000-000000000004', 'LIC-FORTI-UTM', 'FortiGate UTM Bundle (FortiCare)',
     'per_device',  'active',
     'ab100000-0000-0000-0000-000000000001',
    (SELECT id
    FROM license_categories
    WHERE name='Security'
    LIMIT 1),
     2, 40000000, 'VND', 'FC-FG100F-XXXX-2023',      '2023-06-01', '2026-06-01',
     'Bản quyền UTM cho 2 FortiGate 100F (IPS/AV/Web Filter)', 'nvquan', 'nvquan', NOW
    (), NOW
    ()),
    ('a7100000-0000-0000-0000-000000000005', 'LIC-ACROBAT',   'Adobe Acrobat Pro DC (Team)',
     'per_seat',    'active',
     'ab100000-0000-0000-0000-000000000001',
    (SELECT id
    FROM license_categories
    WHERE name='Office Suite'
    LIMIT 1),
     5, 4500000, 'VND', 'ACRO-TEAM-XXXX-2024',      '2024-03-01', '2025-03-01',
     'Adobe Acrobat Pro DC cho phòng Kế toán (3/5 seats đang dùng)', 'nvquan', 'nvquan', NOW
    (), NOW
    ()),
    ('a7100000-0000-0000-0000-000000000006', 'LIC-KASPER-EP', 'Kaspersky Endpoint Security',
     'per_device',  'active',
     'ab100000-0000-0000-0000-000000000002',
    (SELECT id
    FROM license_categories
    WHERE name='Security'
    LIMIT 1),
     40, 800000, 'VND', 'KES-EP-XXXX-2024',         '2024-06-01', '2025-06-01',
     'Antivirus cho toàn bộ endpoint (25/40 seats đang dùng)', 'nvquan', 'nvquan', NOW
    (), NOW
    ())
ON CONFLICT
    (id) DO
    UPDATE SET
    license_code = EXCLUDED.license_code, software_name = EXCLUDED.software_name,
    license_type = EXCLUDED.license_type, status = EXCLUDED.status,
    supplier_id = EXCLUDED.supplier_id, seat_count = EXCLUDED.seat_count,
    unit_price = EXCLUDED.unit_price, product_key = EXCLUDED.product_key,
    purchase_date = EXCLUDED.purchase_date, expiry_date = EXCLUDED.expiry_date,
    notes = EXCLUDED.notes, updated_at = NOW();

    -- ============================================================================
    -- 19. PHỤ KIỆN (Accessories) — Phụ kiện CNTT thực tế
    -- ============================================================================
    INSERT INTO accessories
        (id, accessory_code, name, category_id, manufacturer_id, model_number, total_quantity, available_quantity, min_quantity, unit_price, purchase_date, notes, status, created_by, updated_by, created_at, updated_at)
    VALUES
        ('a8100000-0000-0000-0000-000000000001', 'ACC-MOUSE-LG01', 'Chuột không dây Logitech M240',
            (SELECT id
            FROM accessory_categories
            WHERE code='ACC-MOUSE'
    LIMIT 1),
    (SELECT id
    FROM accessory_manufacturers
    WHERE code='MFR-LOGITECH'
    LIMIT 1),
     'M240', 30, 18, 5, 350000, '2024-06-01', 'Chuột wireless Silent cho văn phòng', 'active', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', NOW
    (), NOW
    ()),
    ('a8100000-0000-0000-0000-000000000002', 'ACC-KB-LG01',     'Bàn phím không dây Logitech K380',
    (SELECT id
    FROM accessory_categories
    WHERE code='ACC-KEYBOARD'
    LIMIT 1),
    (SELECT id
    FROM accessory_manufacturers
    WHERE code='MFR-LOGITECH'
    LIMIT 1),
     'K380', 25, 15, 5, 550000, '2024-06-01', 'Bàn phím Bluetooth đa thiết bị', 'active', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', NOW
    (), NOW
    ()),
    ('a8100000-0000-0000-0000-000000000003', 'ACC-HDST-JB01',   'Tai nghe Jabra Evolve2 40',
    (SELECT id
    FROM accessory_categories
    WHERE code='ACC-HEADSET'
    LIMIT 1),
    (SELECT id
    FROM accessory_manufacturers
    WHERE code='MFR-LOGITECH'
    LIMIT 1),
     'Evolve2 40', 15, 8, 3, 1800000, '2024-06-01', 'Tai nghe UC cho họp online', 'active', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', NOW
    (), NOW
    ()),
    ('a8100000-0000-0000-0000-000000000004', 'ACC-DOCK-DELL01', 'Dell Thunderbolt Dock WD22TB4',
    (SELECT id
    FROM accessory_categories
    WHERE code='ACC-DOCK'
    LIMIT 1),
    (SELECT id
    FROM accessory_manufacturers
    WHERE code='MFR-DELL'
    LIMIT 1),
     'WD22TB4', 10, 5, 2, 5500000, '2024-03-01', 'Dock Thunderbolt 4 cho Latitude', 'active', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', NOW
    (), NOW
    ()),
    ('a8100000-0000-0000-0000-000000000005', 'ACC-WEBCAM-LG01', 'Webcam Logitech C920 HD Pro',
    (SELECT id
    FROM accessory_categories
    WHERE code='ACC-WEBCAM'
    LIMIT 1),
    (SELECT id
    FROM accessory_manufacturers
    WHERE code='MFR-LOGITECH'
    LIMIT 1),
     'C920', 12, 7, 3, 1200000, '2024-06-01', 'Webcam FHD cho phòng họp', 'active', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', NOW
    (), NOW
    ())
ON CONFLICT
    (id) DO
    UPDATE SET
    accessory_code = EXCLUDED.accessory_code, name = EXCLUDED.name,
    total_quantity = EXCLUDED.total_quantity, available_quantity = EXCLUDED.available_quantity,
    min_quantity = EXCLUDED.min_quantity, unit_price = EXCLUDED.unit_price, notes = EXCLUDED.notes, updated_at = NOW();

    -- ============================================================================
    -- 20. VẬT TƯ TIÊU HAO (Consumables) — Mực in, giấy
    -- ============================================================================
    -- Seed consumable manufacturers (none in migration)
    INSERT INTO consumable_manufacturers
        (id, code, name, website, is_active, created_at)
    VALUES
        ('a9f00000-0000-0000-0000-000000000001', 'HP', 'HP Inc.', 'https://www.hp.com', true, NOW()),
        ('a9f00000-0000-0000-0000-000000000002', 'DOUBLEA', 'Double A', 'https://www.doubleapaper.com', true, NOW()),
        ('a9f00000-0000-0000-0000-000000000003', 'GENERIC', 'Nhà sản xuất khác', NULL, true, NOW()),
        ('a9f00000-0000-0000-0000-000000000004', 'ENERGZR', 'Energizer', 'https://www.energizer.com', true, NOW())
    ON CONFLICT
    (code) DO NOTHING;

INSERT INTO consumables
    (id, consumable_code, name, category_id, manufacturer_id, model_number, quantity, min_quantity, unit_price, purchase_date, notes, status, created_by, updated_by, created_at, updated_at)
VALUES
    ('a9100000-0000-0000-0000-000000000001', 'CON-TONER-59A', 'Hộp mực HP 59A (CF259A) — Laser đen',
        (SELECT id
        FROM consumable_categories
        WHERE code='INK'
LIMIT 1),
(SELECT id
FROM consumable_manufacturers
WHERE code='HP'
LIMIT 1),
     'CF259A', 12, 5, 450000, '2024-09-01', 'Mực cho HP LaserJet Pro M428', 'active', 'nvquan', 'nvquan', NOW
(), NOW
()),
('a9100000-0000-0000-0000-000000000002', 'CON-PAPER-A4',    'Giấy A4 Double A 70gsm (500 tờ/ram)',
(SELECT id
FROM consumable_categories
WHERE code='PAPER'
LIMIT 1),
(SELECT id
FROM consumable_manufacturers
WHERE code='DOUBLEA'
LIMIT 1),
     'A4-70', 120, 50, 62000, '2024-09-01', 'Giấy in văn phòng A4', 'active', 'nvquan', 'nvquan', NOW
(), NOW
()),
('a9100000-0000-0000-0000-000000000003', 'CON-CABLE-HDMI',  'Cáp HDMI 2.0 (1.5m)',
(SELECT id
FROM consumable_categories
WHERE code='CABLE'
LIMIT 1),
(SELECT id
FROM consumable_manufacturers
WHERE code='GENERIC'
LIMIT 1),
     'HDMI-2.0-1.5M', 28, 10, 80000, '2024-06-01', 'Cáp HDMI cho màn hình văn phòng', 'active', 'nvquan', 'nvquan', NOW
(), NOW
()),
('a9100000-0000-0000-0000-000000000004', 'CON-BAT-AA',      'Pin AA Energizer Industrial (hộp 20 viên)',
(SELECT id
FROM consumable_categories
WHERE code='BATTERY'
LIMIT 1),
(SELECT id
FROM consumable_manufacturers
WHERE code='ENERGZR'
LIMIT 1),
     'EN91', 6, 3, 140000, '2024-09-01', 'Pin cho chuột wireless, remote', 'active', 'nvquan', 'nvquan', NOW
(), NOW
())
ON CONFLICT
(id) DO
UPDATE SET
    consumable_code = EXCLUDED.consumable_code, name = EXCLUDED.name,
    quantity = EXCLUDED.quantity,
    min_quantity = EXCLUDED.min_quantity, unit_price = EXCLUDED.unit_price, notes = EXCLUDED.notes, updated_at = NOW();

-- ============================================================================
-- 21. LINH KIỆN NỘI BỘ (Components) — RAM/SSD đã lắp vào máy
-- ============================================================================
-- Seed component manufacturers (none in migration)
INSERT INTO component_manufacturers
    (id, code, name, website, is_active, created_by, created_at)
VALUES
    ('acf00000-0000-0000-0000-000000000001', 'SAMSUNG', 'Samsung', 'https://semiconductor.samsung.com', true, '00000000-0000-0000-0000-000000000001', NOW()),
    ('acf00000-0000-0000-0000-000000000002', 'INTEL', 'Intel', 'https://www.intel.com', true, '00000000-0000-0000-0000-000000000001', NOW()),
    ('acf00000-0000-0000-0000-000000000003', 'KINGSTON', 'Kingston', 'https://www.kingston.com', true, '00000000-0000-0000-0000-000000000001', NOW()),
    ('acf00000-0000-0000-0000-000000000004', 'SEAGATE', 'Seagate', 'https://www.seagate.com', true, '00000000-0000-0000-0000-000000000001', NOW())
ON CONFLICT
(code) DO NOTHING;

INSERT INTO components
    (id, component_code, name, category_id, manufacturer_id, model_number, component_type, total_quantity, available_quantity, min_quantity, unit_price, purchase_date, notes, status, created_by, updated_by, created_at, updated_at)
VALUES
    ('ac100000-0000-0000-0000-000000000001', 'CMP-RAM-DDR5-01', 'RAM DDR5 16GB 4800MHz SODIMM',
        (SELECT id
        FROM component_categories
        WHERE code='MEMORY'
LIMIT 1),
(SELECT id
FROM component_manufacturers
WHERE code='SAMSUNG'
LIMIT 1),
     'M474A2K43EB1-CWE', 'ram', 10, 4, 2, 850000, '2024-03-01', 'Chip Samsung OEM', 'active',
     '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', NOW
(), NOW
()),
('ac100000-0000-0000-0000-000000000002', 'CMP-SSD-512-01',  'SSD NVMe 512GB M.2',
(SELECT id
FROM component_categories
WHERE code='STORAGE'
LIMIT 1),
(SELECT id
FROM component_manufacturers
WHERE code='SAMSUNG'
LIMIT 1),
     '980 PRO 512GB', 'ssd', 8, 3, 2, 1200000, '2024-03-01', 'SSD Samsung 980 PRO', 'active',
     '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', NOW
(), NOW
()),
('ac100000-0000-0000-0000-000000000003', 'CMP-NIC-PCIE-01', 'Card mạng Intel X710-DA2 10G SFP+',
(SELECT id
FROM component_categories
WHERE code='NETWORK'
LIMIT 1),
(SELECT id
FROM component_manufacturers
WHERE code='INTEL'
LIMIT 1),
     'X710-DA2', 'network_card', 4, 2, 1, 4500000, '2024-01-15', 'Card mạng 10G SFP+ cho server', 'active',
     '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', NOW
(), NOW
())
ON CONFLICT
(id) DO
UPDATE SET
    component_code = EXCLUDED.component_code, name = EXCLUDED.name,
    total_quantity = EXCLUDED.total_quantity, available_quantity = EXCLUDED.available_quantity,
    min_quantity = EXCLUDED.min_quantity, unit_price = EXCLUDED.unit_price, notes = EXCLUDED.notes, updated_at = NOW();

-- Lắp component vào asset
INSERT INTO component_assignments
    (id, component_id, asset_id, installed_by, installed_at, status, installation_notes, created_at, updated_at)
VALUES
    ('ac200000-0000-0000-0000-000000000001', 'ac100000-0000-0000-0000-000000000001', 'ee100000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000002', NOW() - INTERVAL
'120 days', 'installed', 'Nâng cấp RAM cho laptop BGĐ', NOW
() - INTERVAL '120 days', NOW
() - INTERVAL '120 days'),
('ac200000-0000-0000-0000-000000000002', 'ac100000-0000-0000-0000-000000000002', 'ee100000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000002', NOW
() - INTERVAL '90 days',  'installed', 'Nâng cấp SSD cho laptop KTTV', NOW
() - INTERVAL '90 days', NOW
() - INTERVAL '90 days')
ON CONFLICT
(id) DO
UPDATE SET
    component_id = EXCLUDED.component_id, asset_id = EXCLUDED.asset_id,
    installed_by = EXCLUDED.installed_by, status = EXCLUDED.status, installation_notes = EXCLUDED.installation_notes;

    -- ============================================================================
    -- 22. TỔ CHỨC (Organizations) — Bắt buộc cho Audit, Depreciation, Labels
    -- ============================================================================
    INSERT INTO organizations (id, name, created_at)
    VALUES
        ('c0100000-0000-0000-0000-000000000001', 'Bệnh viện Đa khoa Trung ương', NOW()),
        ('c0100000-0000-0000-0000-000000000002', 'Chi nhánh Phòng khám Đa khoa 1', NOW())
    ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

    -- ============================================================================
    -- 23. CMDB — CI Types
    -- ============================================================================
    -- Remove migration-seeded duplicates (007_cmdb_core inserts with auto UUIDs)
    DELETE FROM cmdb_ci_types WHERE code IN ('server','storage','database')
      AND id NOT IN ('c1100000-0000-0000-0000-000000000001','c1100000-0000-0000-0000-000000000006','c1100000-0000-0000-0000-000000000008');

    INSERT INTO cmdb_ci_types (id, code, name, description, created_at)
    VALUES
        ('c1100000-0000-0000-0000-000000000001', 'server',    'Máy chủ',           'Máy chủ vật lý hoặc ảo hóa', NOW()),
        ('c1100000-0000-0000-0000-000000000002', 'switch',    'Switch mạng',       'Thiết bị chuyển mạch L2/L3', NOW()),
        ('c1100000-0000-0000-0000-000000000003', 'router',    'Router',            'Thiết bị định tuyến', NOW()),
        ('c1100000-0000-0000-0000-000000000004', 'firewall',  'Tường lửa',         'Thiết bị bảo mật mạng', NOW()),
        ('c1100000-0000-0000-0000-000000000005', 'ap',        'Access Point',      'Điểm truy cập WiFi', NOW()),
        ('c1100000-0000-0000-0000-000000000006', 'storage',   'Thiết bị lưu trữ',  'SAN/NAS storage', NOW()),
        ('c1100000-0000-0000-0000-000000000007', 'vm',        'Máy ảo',            'Virtual Machine', NOW()),
        ('c1100000-0000-0000-0000-000000000008', 'database',  'Cơ sở dữ liệu',    'Database instance', NOW())
    ON CONFLICT (id) DO UPDATE SET
        code = EXCLUDED.code, name = EXCLUDED.name, description = EXCLUDED.description;

    -- ============================================================================
    -- 24. CMDB — Configuration Items (CIs)
    -- ============================================================================
    INSERT INTO cmdb_cis
        (id, type_id, asset_id, location_id, name, ci_code, status, environment, owner_team, notes, metadata, created_at, updated_at)
    VALUES
        -- Servers
        ('c1200000-0000-0000-0000-000000000001', 'c1100000-0000-0000-0000-000000000001',
         'ee100000-0000-0000-0000-000000000011', 'cc100000-0000-0000-0000-000000000005',
         'SRV-ERP-01', 'CI-SRV-001', 'active', 'prod', 'Phòng CNTT',
         'Máy chủ chạy hệ thống ERP chính', '{"os":"VMware ESXi 8.0","vcpu":16,"ram_gb":128}'::jsonb, NOW(), NOW()),
        ('c1200000-0000-0000-0000-000000000002', 'c1100000-0000-0000-0000-000000000001',
         'ee100000-0000-0000-0000-000000000012', 'cc100000-0000-0000-0000-000000000005',
         'SRV-DB-01', 'CI-SRV-002', 'active', 'prod', 'Phòng CNTT',
         'Máy chủ cơ sở dữ liệu Oracle', '{"os":"RHEL 9","vcpu":32,"ram_gb":256}'::jsonb, NOW(), NOW()),
        ('c1200000-0000-0000-0000-000000000003', 'c1100000-0000-0000-0000-000000000001',
         'ee100000-0000-0000-0000-000000000013', 'cc100000-0000-0000-0000-000000000005',
         'SRV-BACKUP-01', 'CI-SRV-003', 'active', 'prod', 'Phòng CNTT',
         'Máy chủ backup Veeam', '{"os":"Windows Server 2022","vcpu":8,"ram_gb":64}'::jsonb, NOW(), NOW()),
        -- Network
        ('c1200000-0000-0000-0000-000000000004', 'c1100000-0000-0000-0000-000000000002',
         'ee100000-0000-0000-0000-000000000014', 'cc100000-0000-0000-0000-000000000002',
         'SW-CORE-T1', 'CI-SW-001', 'active', 'prod', 'Phòng CNTT',
         'Core switch tầng 1', '{"model":"Catalyst 9200L-48P","ports":48,"poe":true}'::jsonb, NOW(), NOW()),
        ('c1200000-0000-0000-0000-000000000005', 'c1100000-0000-0000-0000-000000000002',
         'ee100000-0000-0000-0000-000000000015', 'cc100000-0000-0000-0000-000000000003',
         'SW-CORE-T2', 'CI-SW-002', 'active', 'prod', 'Phòng CNTT',
         'Core switch tầng 2', '{"model":"Catalyst 9200L-48P","ports":48,"poe":true}'::jsonb, NOW(), NOW()),
        -- Firewall
        ('c1200000-0000-0000-0000-000000000006', 'c1100000-0000-0000-0000-000000000004',
         'ee100000-0000-0000-0000-000000000016', 'cc100000-0000-0000-0000-000000000005',
         'FW-EDGE-01', 'CI-FW-001', 'active', 'prod', 'Phòng CNTT',
         'FortiGate tường lửa chính', '{"model":"FortiGate 100F","throughput":"20Gbps"}'::jsonb, NOW(), NOW()),
        ('c1200000-0000-0000-0000-000000000007', 'c1100000-0000-0000-0000-000000000004',
         'ee100000-0000-0000-0000-000000000017', 'cc100000-0000-0000-0000-000000000005',
         'FW-EDGE-02', 'CI-FW-002', 'maintenance', 'prod', 'Phòng CNTT',
         'FortiGate dự phòng — đang sửa chữa', '{"model":"FortiGate 100F","throughput":"20Gbps"}'::jsonb, NOW(), NOW()),
        -- Storage
        ('c1200000-0000-0000-0000-000000000008', 'c1100000-0000-0000-0000-000000000006',
         NULL, 'cc100000-0000-0000-0000-000000000005',
         'NAS-PRIMARY', 'CI-NAS-001', 'active', 'prod', 'Phòng CNTT',
         'Synology NAS chính — backup & file share', '{"model":"RS1221+","capacity_tb":32,"raid":"RAID6"}'::jsonb, NOW(), NOW()),
        -- VMs
        ('c1200000-0000-0000-0000-000000000009', 'c1100000-0000-0000-0000-000000000007',
         NULL, 'cc100000-0000-0000-0000-000000000005',
         'VM-WEB-01', 'CI-VM-001', 'active', 'prod', 'Phòng CNTT',
         'VM chạy web server nội bộ', '{"host":"SRV-ERP-01","vcpu":4,"ram_gb":8,"os":"Ubuntu 22.04"}'::jsonb, NOW(), NOW()),
        ('c1200000-0000-0000-0000-000000000010', 'c1100000-0000-0000-0000-000000000007',
         NULL, 'cc100000-0000-0000-0000-000000000005',
         'VM-MAIL-01', 'CI-VM-002', 'active', 'prod', 'Phòng CNTT',
         'VM chạy mail server', '{"host":"SRV-ERP-01","vcpu":4,"ram_gb":16,"os":"Windows Server 2022"}'::jsonb, NOW(), NOW())
    ON CONFLICT (id) DO UPDATE SET
        type_id = EXCLUDED.type_id, asset_id = EXCLUDED.asset_id, location_id = EXCLUDED.location_id,
        name = EXCLUDED.name, ci_code = EXCLUDED.ci_code, status = EXCLUDED.status,
        environment = EXCLUDED.environment, owner_team = EXCLUDED.owner_team,
        notes = EXCLUDED.notes, metadata = EXCLUDED.metadata, updated_at = NOW();

    -- ============================================================================
    -- 25. CMDB — Relationship Types
    -- ============================================================================
    -- Remove migration/seed-data.sql duplicates (007_cmdb_core + seed-data.sql insert with auto UUIDs)
    DELETE FROM cmdb_relationship_types WHERE code IN ('runs_on','depends_on','managed_by','backed_up_by')
      AND id NOT IN ('c1300000-0000-0000-0000-000000000001','c1300000-0000-0000-0000-000000000002','c1300000-0000-0000-0000-000000000005','c1300000-0000-0000-0000-000000000004');

    INSERT INTO cmdb_relationship_types (id, code, name, reverse_name, created_at)
    VALUES
        ('c1300000-0000-0000-0000-000000000001', 'runs_on',      'Chạy trên',         'Chứa',               NOW()),
        ('c1300000-0000-0000-0000-000000000002', 'depends_on',   'Phụ thuộc vào',     'Được phụ thuộc bởi', NOW()),
        ('c1300000-0000-0000-0000-000000000003', 'connected_to', 'Kết nối đến',       'Được kết nối từ',    NOW()),
        ('c1300000-0000-0000-0000-000000000004', 'backed_up_by', 'Được backup bởi',   'Backup cho',         NOW()),
        ('c1300000-0000-0000-0000-000000000005', 'managed_by',   'Được quản lý bởi',  'Quản lý',            NOW())
    ON CONFLICT (id) DO UPDATE SET
        code = EXCLUDED.code, name = EXCLUDED.name, reverse_name = EXCLUDED.reverse_name;

    -- ============================================================================
    -- 26. CMDB — Relationships (CI ↔ CI)
    -- ============================================================================
    INSERT INTO cmdb_relationships (id, type_id, from_ci_id, to_ci_id, metadata, created_at)
    VALUES
        -- VMs run on servers
        ('c1400000-0000-0000-0000-000000000001', 'c1300000-0000-0000-0000-000000000001',
         'c1200000-0000-0000-0000-000000000009', 'c1200000-0000-0000-0000-000000000001', '{}'::jsonb, NOW()),
        ('c1400000-0000-0000-0000-000000000002', 'c1300000-0000-0000-0000-000000000001',
         'c1200000-0000-0000-0000-000000000010', 'c1200000-0000-0000-0000-000000000001', '{}'::jsonb, NOW()),
        -- Servers depend on firewall
        ('c1400000-0000-0000-0000-000000000003', 'c1300000-0000-0000-0000-000000000002',
         'c1200000-0000-0000-0000-000000000001', 'c1200000-0000-0000-0000-000000000006', '{}'::jsonb, NOW()),
        ('c1400000-0000-0000-0000-000000000004', 'c1300000-0000-0000-0000-000000000002',
         'c1200000-0000-0000-0000-000000000002', 'c1200000-0000-0000-0000-000000000006', '{}'::jsonb, NOW()),
        -- Servers connected to switches
        ('c1400000-0000-0000-0000-000000000005', 'c1300000-0000-0000-0000-000000000003',
         'c1200000-0000-0000-0000-000000000001', 'c1200000-0000-0000-0000-000000000004', '{}'::jsonb, NOW()),
        ('c1400000-0000-0000-0000-000000000006', 'c1300000-0000-0000-0000-000000000003',
         'c1200000-0000-0000-0000-000000000002', 'c1200000-0000-0000-0000-000000000005', '{}'::jsonb, NOW()),
        -- Servers backed up by NAS
        ('c1400000-0000-0000-0000-000000000007', 'c1300000-0000-0000-0000-000000000004',
         'c1200000-0000-0000-0000-000000000001', 'c1200000-0000-0000-0000-000000000008', '{}'::jsonb, NOW()),
        ('c1400000-0000-0000-0000-000000000008', 'c1300000-0000-0000-0000-000000000004',
         'c1200000-0000-0000-0000-000000000002', 'c1200000-0000-0000-0000-000000000008', '{}'::jsonb, NOW()),
        -- Firewall managed by FW-EDGE-02 (HA pair)
        ('c1400000-0000-0000-0000-000000000009', 'c1300000-0000-0000-0000-000000000003',
         'c1200000-0000-0000-0000-000000000006', 'c1200000-0000-0000-0000-000000000007', '{}'::jsonb, NOW())
    ON CONFLICT (id) DO UPDATE SET
        type_id = EXCLUDED.type_id, from_ci_id = EXCLUDED.from_ci_id,
        to_ci_id = EXCLUDED.to_ci_id, metadata = EXCLUDED.metadata;

    -- ============================================================================
    -- 27. CMDB — Services
    -- ============================================================================
    INSERT INTO cmdb_services (id, code, name, description, criticality, owner, status, metadata, created_at, updated_at)
    VALUES
        ('c1500000-0000-0000-0000-000000000001', 'SVC-ERP',  'Hệ thống ERP',
         'Hệ thống quản lý tổng thể bệnh viện (HIS/LIS/RIS/PACS)', 'critical', 'Phòng CNTT',
         'active', '{"sla_uptime":"99.9%","rpo":"1h","rto":"4h"}'::jsonb, NOW(), NOW()),
        ('c1500000-0000-0000-0000-000000000002', 'SVC-EMAIL', 'Hệ thống Email',
         'Email nội bộ Exchange / M365', 'high', 'Phòng CNTT',
         'active', '{"sla_uptime":"99.5%","users":200}'::jsonb, NOW(), NOW()),
        ('c1500000-0000-0000-0000-000000000003', 'SVC-INET',  'Kết nối Internet',
         'Đường truyền Internet chính và dự phòng', 'critical', 'Phòng CNTT',
         'active', '{"bandwidth":"500Mbps","isp":"Viettel + VnPT"}'::jsonb, NOW(), NOW()),
        ('c1500000-0000-0000-0000-000000000004', 'SVC-BACKUP', 'Sao lưu dữ liệu',
         'Hệ thống backup Veeam + NAS', 'high', 'Phòng CNTT',
         'active', '{"schedule":"daily","retention":"30d"}'::jsonb, NOW(), NOW())
    ON CONFLICT (id) DO UPDATE SET
        code = EXCLUDED.code, name = EXCLUDED.name, description = EXCLUDED.description,
        criticality = EXCLUDED.criticality, owner = EXCLUDED.owner, status = EXCLUDED.status,
        metadata = EXCLUDED.metadata, updated_at = NOW();

    -- ============================================================================
    -- 28. CMDB — Service ↔ CI mapping
    -- ============================================================================
    INSERT INTO cmdb_service_cis (id, service_id, ci_id, dependency_type, created_at)
    VALUES
        -- ERP service depends on SRV-ERP-01, SRV-DB-01, FW-EDGE-01, NAS, SW
        ('c1600000-0000-0000-0000-000000000001', 'c1500000-0000-0000-0000-000000000001', 'c1200000-0000-0000-0000-000000000001', 'runs_on', NOW()),
        ('c1600000-0000-0000-0000-000000000002', 'c1500000-0000-0000-0000-000000000001', 'c1200000-0000-0000-0000-000000000002', 'uses', NOW()),
        ('c1600000-0000-0000-0000-000000000003', 'c1500000-0000-0000-0000-000000000001', 'c1200000-0000-0000-0000-000000000006', 'uses', NOW()),
        -- Email service
        ('c1600000-0000-0000-0000-000000000004', 'c1500000-0000-0000-0000-000000000002', 'c1200000-0000-0000-0000-000000000010', 'runs_on', NOW()),
        ('c1600000-0000-0000-0000-000000000005', 'c1500000-0000-0000-0000-000000000002', 'c1200000-0000-0000-0000-000000000006', 'uses', NOW()),
        -- Internet service
        ('c1600000-0000-0000-0000-000000000006', 'c1500000-0000-0000-0000-000000000003', 'c1200000-0000-0000-0000-000000000006', 'runs_on', NOW()),
        ('c1600000-0000-0000-0000-000000000007', 'c1500000-0000-0000-0000-000000000003', 'c1200000-0000-0000-0000-000000000004', 'uses', NOW()),
        -- Backup service
        ('c1600000-0000-0000-0000-000000000008', 'c1500000-0000-0000-0000-000000000004', 'c1200000-0000-0000-0000-000000000003', 'runs_on', NOW()),
        ('c1600000-0000-0000-0000-000000000009', 'c1500000-0000-0000-0000-000000000004', 'c1200000-0000-0000-0000-000000000008', 'uses', NOW())
    ON CONFLICT (id) DO UPDATE SET
        service_id = EXCLUDED.service_id, ci_id = EXCLUDED.ci_id, dependency_type = EXCLUDED.dependency_type;

    -- ============================================================================
    -- 29. KẾ HOẠCH MUA SẮM (Purchase Plan Docs + Lines)
    -- ============================================================================
    INSERT INTO purchase_plan_docs
        (id, doc_no, doc_date, fiscal_year, org_unit_id, org_unit_name, title, description,
         total_estimated_cost, currency, status, created_by, created_at, submitted_by, submitted_at,
         approved_by, approved_at, updated_at)
    VALUES
        ('c2100000-0000-0000-0000-000000000001', 'KH-2025-001', '2025-01-10', 2025,
         'CNTT', 'Phòng Công nghệ thông tin',
         'Kế hoạch mua laptop & desktop Q1/2025',
         'Bổ sung laptop cho nhân viên mới và thay thế máy cũ',
         450000000, 'VND', 'approved', 'nvquan', NOW() - INTERVAL '30 days',
         'nvquan', NOW() - INTERVAL '28 days',
         'admin', NOW() - INTERVAL '25 days',
         NOW() - INTERVAL '25 days'),
        ('c2100000-0000-0000-0000-000000000002', 'KH-2025-002', '2025-02-15', 2025,
         'CNTT', 'Phòng Công nghệ thông tin',
         'Kế hoạch mua thiết bị mạng Q2/2025',
         'Nâng cấp hạ tầng mạng LAN/WLAN',
         280000000, 'VND', 'submitted', 'nvquan', NOW() - INTERVAL '15 days',
         'nvquan', NOW() - INTERVAL '13 days',
         NULL, NULL,
         NOW() - INTERVAL '13 days'),
        ('c2100000-0000-0000-0000-000000000003', 'KH-2025-003', '2025-03-01', 2025,
         'CNTT', 'Phòng Công nghệ thông tin',
         'Kế hoạch mua vật tư dự phòng Q1/2025',
         'Bổ sung RAM, SSD, pin laptop dự phòng trong kho',
         85000000, 'VND', 'draft', 'ttkho', NOW() - INTERVAL '5 days',
         NULL, NULL, NULL, NULL,
         NOW() - INTERVAL '5 days')
    ON CONFLICT (id) DO UPDATE SET
        doc_no = EXCLUDED.doc_no, doc_date = EXCLUDED.doc_date, fiscal_year = EXCLUDED.fiscal_year,
        title = EXCLUDED.title, description = EXCLUDED.description,
        total_estimated_cost = EXCLUDED.total_estimated_cost, status = EXCLUDED.status, updated_at = NOW();

    INSERT INTO purchase_plan_lines
        (id, doc_id, line_no, model_id, category_id, item_description, quantity, unit,
         estimated_unit_cost, estimated_total_cost, suggestion_reason, priority, purpose, note, created_at)
    VALUES
        -- KH-2025-001 lines
        ('c2200000-0000-0000-0000-000000000001', 'c2100000-0000-0000-0000-000000000001', 1,
         'dd100000-0000-0000-0000-000000000001', 'bb100000-0000-0000-0000-000000000001',
         'Dell Latitude 5540 — Laptop cho nhân viên', 5, 'chiếc',
         28000000, 140000000, 'low_stock', 'high', 'Cấp cho nhân viên mới Q1', NULL, NOW()),
        ('c2200000-0000-0000-0000-000000000002', 'c2100000-0000-0000-0000-000000000001', 2,
         'dd100000-0000-0000-0000-000000000002', 'bb100000-0000-0000-0000-000000000001',
         'HP EliteBook 840 G10 — Laptop cao cấp cho quản lý', 3, 'chiếc',
         32000000, 96000000, 'manual', 'medium', 'Thay thế laptop cũ BGĐ', NULL, NOW()),
        ('c2200000-0000-0000-0000-000000000003', 'c2100000-0000-0000-0000-000000000001', 3,
         'dd100000-0000-0000-0000-000000000004', 'bb100000-0000-0000-0000-000000000002',
         'Dell OptiPlex 7010 SFF — Desktop lễ tân', 8, 'chiếc',
         18000000, 144000000, 'high_consumption', 'medium', 'Trang bị quầy tiếp nhận', NULL, NOW()),
        ('c2200000-0000-0000-0000-000000000004', 'c2100000-0000-0000-0000-000000000001', 4,
         'dd100000-0000-0000-0000-000000000011', 'bb100000-0000-0000-0000-000000000005',
         'Dell P2423D 24" QHD — Màn hình kép', 10, 'chiếc',
         7000000, 70000000, 'manual', 'low', 'Màn hình thứ 2 cho kế toán/CNTT', NULL, NOW()),
        -- KH-2025-002 lines
        ('c2200000-0000-0000-0000-000000000005', 'c2100000-0000-0000-0000-000000000002', 1,
         'dd100000-0000-0000-0000-000000000008', 'bb100000-0000-0000-0000-000000000004',
         'Cisco Catalyst 9200L-48P — Switch PoE', 4, 'chiếc',
         45000000, 180000000, 'manual', 'high', 'Nâng cấp switch tầng 3-6', NULL, NOW()),
        ('c2200000-0000-0000-0000-000000000006', 'c2100000-0000-0000-0000-000000000002', 2,
         NULL, 'bb100000-0000-0000-0000-000000000004',
         'UniFi U6 Pro WiFi 6 Access Point', 10, 'chiếc',
         5000000, 50000000, 'manual', 'high', 'Phủ sóng WiFi các tầng', NULL, NOW()),
        ('c2200000-0000-0000-0000-000000000007', 'c2100000-0000-0000-0000-000000000002', 3,
         NULL, 'bb100000-0000-0000-0000-000000000004',
         'Cáp quang LC-LC OM3 + Module SFP+ 10G', 20, 'bộ',
         2500000, 50000000, 'manual', 'medium', 'Kết nối uplink 10G giữa các tầng', NULL, NOW()),
        -- KH-2025-003 lines
        ('c2200000-0000-0000-0000-000000000008', 'c2100000-0000-0000-0000-000000000003', 1,
         NULL, NULL,
         'RAM DDR5 16GB 4800MHz cho laptop', 10, 'thanh',
         1500000, 15000000, 'low_stock', 'high', 'Dự phòng nâng cấp máy', NULL, NOW()),
        ('c2200000-0000-0000-0000-000000000009', 'c2100000-0000-0000-0000-000000000003', 2,
         NULL, NULL,
         'SSD NVMe 512GB', 10, 'chiếc',
         2000000, 20000000, 'low_stock', 'high', 'Dự phòng thay thế nhanh', NULL, NOW()),
        ('c2200000-0000-0000-0000-000000000010', 'c2100000-0000-0000-0000-000000000003', 3,
         NULL, NULL,
         'Pin laptop Dell 54Wh + HP 51Wh', 20, 'viên',
         2500000, 50000000, 'seasonal', 'medium', 'Pin thay thế — hao mòn cao mùa nóng', NULL, NOW())
    ON CONFLICT (id) DO UPDATE SET
        doc_id = EXCLUDED.doc_id, line_no = EXCLUDED.line_no, item_description = EXCLUDED.item_description,
        quantity = EXCLUDED.quantity, estimated_unit_cost = EXCLUDED.estimated_unit_cost,
        estimated_total_cost = EXCLUDED.estimated_total_cost, priority = EXCLUDED.priority;

    -- ============================================================================
    -- 30. CHỨNG TỪ TĂNG TÀI SẢN (Asset Increase Docs + Lines)
    -- ============================================================================
    INSERT INTO asset_increase_docs
        (id, doc_no, doc_date, increase_type, org_unit_id, org_unit_name,
         vendor_id, vendor_name, invoice_no, invoice_date,
         total_cost, currency, status, created_by, created_at,
         submitted_by, submitted_at, approved_by, approved_at,
         posted_by, posted_at, purchase_plan_doc_id, note, updated_at)
    VALUES
        ('c3100000-0000-0000-0000-000000000001', 'TS-2025-001', '2025-02-10', 'purchase',
         'CNTT', 'Phòng Công nghệ thông tin',
         'aa100000-0000-0000-0000-000000000001', 'Dell Technologies', 'INV-DELL-20250210', '2025-02-08',
         168000000, 'VND', 'posted', 'nvquan', NOW() - INTERVAL '20 days',
         'nvquan', NOW() - INTERVAL '18 days', 'admin', NOW() - INTERVAL '16 days',
         'ttkho', NOW() - INTERVAL '14 days',
         'c2100000-0000-0000-0000-000000000001', 'Mua laptop từ KH-2025-001', NOW() - INTERVAL '14 days'),
        ('c3100000-0000-0000-0000-000000000002', 'TS-2025-002', '2025-03-01', 'donation',
         'CNTT', 'Phòng Công nghệ thông tin',
         NULL, NULL, NULL, NULL,
         0, 'VND', 'approved', 'ttkho', NOW() - INTERVAL '10 days',
         'ttkho', NOW() - INTERVAL '8 days', 'admin', NOW() - INTERVAL '6 days',
         NULL, NULL,
         NULL, 'Tiếp nhận tài sản tài trợ từ đối tác', NOW() - INTERVAL '6 days'),
        ('c3100000-0000-0000-0000-000000000003', 'TS-2025-003', '2025-03-15', 'purchase',
         'CNTT', 'Phòng Công nghệ thông tin',
         'aa100000-0000-0000-0000-000000000002', 'HP Inc.', 'INV-HP-20250314', '2025-03-14',
         96000000, 'VND', 'submitted', 'nvquan', NOW() - INTERVAL '3 days',
         'nvquan', NOW() - INTERVAL '2 days', NULL, NULL,
         NULL, NULL,
         'c2100000-0000-0000-0000-000000000001', 'Mua laptop HP từ KH-2025-001', NOW() - INTERVAL '2 days')
    ON CONFLICT (id) DO UPDATE SET
        doc_no = EXCLUDED.doc_no, doc_date = EXCLUDED.doc_date, increase_type = EXCLUDED.increase_type,
        total_cost = EXCLUDED.total_cost, status = EXCLUDED.status, note = EXCLUDED.note, updated_at = NOW();

    INSERT INTO asset_increase_lines
        (id, doc_id, line_no, asset_code, asset_name, category_id, model_id,
         serial_number, quantity, unit, original_cost, current_value,
         location_id, location_name, custodian_id, custodian_name,
         acquisition_date, in_service_date, warranty_end_date, note, created_at)
    VALUES
        -- TS-2025-001 (Dell laptop purchase — posted)
        ('c3200000-0000-0000-0000-000000000001', 'c3100000-0000-0000-0000-000000000001', 1,
         'LAP-DELL-004', 'Dell Latitude 5540 #4', 'bb100000-0000-0000-0000-000000000001', 'dd100000-0000-0000-0000-000000000001',
         'SN-DELL-2025-A001', 1, 'chiếc', 28000000, 28000000,
         'cc100000-0000-0000-0000-000000000003', 'Tầng 2 - Phòng Kế toán',
         'NV-KT-003', 'Nguyễn Thị Mai', '2025-02-10', '2025-02-12', '2028-02-10',
         'Cấp cho nhân viên kế toán mới', NOW()),
        ('c3200000-0000-0000-0000-000000000002', 'c3100000-0000-0000-0000-000000000001', 2,
         'LAP-DELL-005', 'Dell Latitude 5540 #5', 'bb100000-0000-0000-0000-000000000001', 'dd100000-0000-0000-0000-000000000001',
         'SN-DELL-2025-A002', 1, 'chiếc', 28000000, 28000000,
         'cc100000-0000-0000-0000-000000000004', 'Tầng 3 - Phòng CNTT',
         'NV-IT-003', 'Vũ Đình Nam', '2025-02-10', '2025-02-12', '2028-02-10',
         'Cấp cho kỹ thuật viên mới', NOW()),
        ('c3200000-0000-0000-0000-000000000003', 'c3100000-0000-0000-0000-000000000001', 3,
         'LAP-DELL-006', 'Dell Latitude 5540 #6', 'bb100000-0000-0000-0000-000000000001', 'dd100000-0000-0000-0000-000000000001',
         'SN-DELL-2025-A003', 1, 'chiếc', 28000000, 28000000,
         'cc100000-0000-0000-0000-000000000008', 'Kho vật tư CNTT',
         NULL, NULL, '2025-02-10', NULL, '2028-02-10',
         'Dự phòng trong kho', NOW()),
        ('c3200000-0000-0000-0000-000000000004', 'c3100000-0000-0000-0000-000000000001', 4,
         'DT-DELL-003', 'Dell OptiPlex 7010 SFF #3', 'bb100000-0000-0000-0000-000000000002', 'dd100000-0000-0000-0000-000000000004',
         'SN-OPT-2025-B001', 1, 'chiếc', 18000000, 18000000,
         'cc100000-0000-0000-0000-000000000002', 'Tầng 1 - Tiếp nhận',
         'NV-GD-002', 'Trần Thu Hiền', '2025-02-10', '2025-02-14', '2028-02-10',
         'Desktop quầy tiếp nhận', NOW()),
        ('c3200000-0000-0000-0000-000000000005', 'c3100000-0000-0000-0000-000000000001', 5,
         'MON-DELL-003', 'Dell P2423D 24" QHD #3', 'bb100000-0000-0000-0000-000000000005', 'dd100000-0000-0000-0000-000000000011',
         'SN-MON-2025-C001', 2, 'chiếc', 7000000, 14000000,
         'cc100000-0000-0000-0000-000000000003', 'Tầng 2 - Phòng Kế toán',
         NULL, NULL, '2025-02-10', '2025-02-14', '2028-02-10',
         'Màn hình kép cho kế toán', NOW()),
        ('c3200000-0000-0000-0000-000000000006', 'c3100000-0000-0000-0000-000000000001', 6,
         'MON-DELL-004', 'Dell P2423D 24" QHD #4', 'bb100000-0000-0000-0000-000000000005', 'dd100000-0000-0000-0000-000000000011',
         'SN-MON-2025-C002', 2, 'chiếc', 7000000, 14000000,
         'cc100000-0000-0000-0000-000000000004', 'Tầng 3 - Phòng CNTT',
         NULL, NULL, '2025-02-10', '2025-02-14', '2028-02-10',
         'Màn hình kép cho kỹ thuật viên', NOW())
    ON CONFLICT (id) DO UPDATE SET
        doc_id = EXCLUDED.doc_id, line_no = EXCLUDED.line_no, asset_code = EXCLUDED.asset_code,
        asset_name = EXCLUDED.asset_name, original_cost = EXCLUDED.original_cost,
        current_value = EXCLUDED.current_value, note = EXCLUDED.note;

    -- ============================================================================
    -- 31. PHÊ DUYỆT (Approvals — cho Purchase Plans & Asset Increases)
    -- ============================================================================
    INSERT INTO approvals
        (id, entity_type, entity_id, step_no, approver_id, approver_name, decision, note, decided_at, created_at)
    VALUES
        -- KH-2025-001: approved
        ('c4100000-0000-0000-0000-000000000001', 'purchase_plan', 'c2100000-0000-0000-0000-000000000001', 1,
         'nvquan', 'Nguyễn Văn Quản', 'approved', 'Đã xác nhận nhu cầu mua sắm Q1',
         NOW() - INTERVAL '27 days', NOW() - INTERVAL '28 days'),
        ('c4100000-0000-0000-0000-000000000002', 'purchase_plan', 'c2100000-0000-0000-0000-000000000001', 2,
         'admin', 'Admin Hệ thống', 'approved', 'Duyệt kế hoạch mua sắm — đủ ngân sách',
         NOW() - INTERVAL '25 days', NOW() - INTERVAL '27 days'),
        -- KH-2025-002: pending step 2
        ('c4100000-0000-0000-0000-000000000003', 'purchase_plan', 'c2100000-0000-0000-0000-000000000002', 1,
         'nvquan', 'Nguyễn Văn Quản', 'approved', 'Xác nhận nâng cấp mạng cần thiết',
         NOW() - INTERVAL '12 days', NOW() - INTERVAL '13 days'),
        ('c4100000-0000-0000-0000-000000000004', 'purchase_plan', 'c2100000-0000-0000-0000-000000000002', 2,
         'admin', 'Admin Hệ thống', NULL, NULL,
         NULL, NOW() - INTERVAL '12 days'),
        -- TS-2025-001: approved
        ('c4100000-0000-0000-0000-000000000005', 'asset_increase', 'c3100000-0000-0000-0000-000000000001', 1,
         'nvquan', 'Nguyễn Văn Quản', 'approved', 'Xác nhận nhận hàng Dell',
         NOW() - INTERVAL '17 days', NOW() - INTERVAL '18 days'),
        ('c4100000-0000-0000-0000-000000000006', 'asset_increase', 'c3100000-0000-0000-0000-000000000001', 2,
         'admin', 'Admin Hệ thống', 'approved', 'Duyệt tăng tài sản theo KH-2025-001',
         NOW() - INTERVAL '16 days', NOW() - INTERVAL '17 days'),
        -- TS-2025-002: approved
        ('c4100000-0000-0000-0000-000000000007', 'asset_increase', 'c3100000-0000-0000-0000-000000000002', 1,
         'ttkho', 'Trần Thị Kho', 'approved', 'Xác nhận tiếp nhận tài trợ',
         NOW() - INTERVAL '7 days', NOW() - INTERVAL '8 days'),
        ('c4100000-0000-0000-0000-000000000008', 'asset_increase', 'c3100000-0000-0000-0000-000000000002', 2,
         'admin', 'Admin Hệ thống', 'approved', 'Duyệt ghi nhận tài sản tài trợ',
         NOW() - INTERVAL '6 days', NOW() - INTERVAL '7 days')
    ON CONFLICT (id) DO UPDATE SET
        entity_type = EXCLUDED.entity_type, entity_id = EXCLUDED.entity_id,
        approver_id = EXCLUDED.approver_id, decision = EXCLUDED.decision,
        note = EXCLUDED.note, decided_at = EXCLUDED.decided_at;

    -- ============================================================================
    -- 32. WORKFLOW V2 — Definitions
    -- ============================================================================
    INSERT INTO wf_definitions (id, key, name, request_type, version, is_active, created_at, updated_at)
    VALUES
        ('c5100000-0000-0000-0000-000000000001', 'asset-request',      'Yêu cầu cấp phát tài sản',     'asset_request',    1, true, NOW(), NOW()),
        ('c5100000-0000-0000-0000-000000000002', 'repair-request',     'Yêu cầu sửa chữa / bảo trì',  'repair_request',   1, true, NOW(), NOW()),
        ('c5100000-0000-0000-0000-000000000003', 'disposal-request',   'Yêu cầu thanh lý tài sản',     'disposal_request', 1, true, NOW(), NOW())
    ON CONFLICT (id) DO UPDATE SET
        key = EXCLUDED.key, name = EXCLUDED.name, request_type = EXCLUDED.request_type,
        is_active = EXCLUDED.is_active, updated_at = NOW();

    -- ============================================================================
    -- 33. WORKFLOW V2 — Steps
    -- ============================================================================
    INSERT INTO wf_steps (id, definition_id, step_no, name, approver_rule, on_approve, on_reject, sla_hours)
    VALUES
        -- Asset Request: Trưởng phòng → IT Manager → Kho
        ('c5200000-0000-0000-0000-000000000001', 'c5100000-0000-0000-0000-000000000001', 1,
         'Trưởng phòng duyệt',
         '{"type":"ou_head"}'::jsonb,
         '{"next_step":2}'::jsonb,
         '{"cancel":true}'::jsonb,
         48),
        ('c5200000-0000-0000-0000-000000000002', 'c5100000-0000-0000-0000-000000000001', 2,
         'IT Manager phê duyệt',
         '{"type":"role","value":"it_asset_manager"}'::jsonb,
         '{"next_step":3}'::jsonb,
         '{"cancel":true}'::jsonb,
         48),
        ('c5200000-0000-0000-0000-000000000003', 'c5100000-0000-0000-0000-000000000001', 3,
         'Thủ kho xuất tài sản',
         '{"type":"role","value":"warehouse_keeper"}'::jsonb,
         '{"close":true}'::jsonb,
         '{"revert_step":2}'::jsonb,
         24),
        -- Repair Request: IT Manager → Kỹ thuật viên
        ('c5200000-0000-0000-0000-000000000004', 'c5100000-0000-0000-0000-000000000002', 1,
         'IT Manager phê duyệt sửa chữa',
         '{"type":"role","value":"it_asset_manager"}'::jsonb,
         '{"next_step":2}'::jsonb,
         '{"cancel":true}'::jsonb,
         24),
        ('c5200000-0000-0000-0000-000000000005', 'c5100000-0000-0000-0000-000000000002', 2,
         'Kỹ thuật viên thực hiện',
         '{"type":"role","value":"user"}'::jsonb,
         '{"close":true}'::jsonb,
         '{"cancel":true}'::jsonb,
         72),
        -- Disposal Request: IT Manager → Kế toán → Ban Giám đốc
        ('c5200000-0000-0000-0000-000000000006', 'c5100000-0000-0000-0000-000000000003', 1,
         'IT Manager đề xuất thanh lý',
         '{"type":"role","value":"it_asset_manager"}'::jsonb,
         '{"next_step":2}'::jsonb,
         '{"cancel":true}'::jsonb,
         48),
        ('c5200000-0000-0000-0000-000000000007', 'c5100000-0000-0000-0000-000000000003', 2,
         'Kế toán xác nhận giá trị',
         '{"type":"role","value":"accountant"}'::jsonb,
         '{"next_step":3}'::jsonb,
         '{"revert_step":1}'::jsonb,
         48),
        ('c5200000-0000-0000-0000-000000000008', 'c5100000-0000-0000-0000-000000000003', 3,
         'Ban Giám đốc phê duyệt',
         '{"type":"role","value":"admin"}'::jsonb,
         '{"close":true}'::jsonb,
         '{"cancel":true}'::jsonb,
         72)
    ON CONFLICT (id) DO UPDATE SET
        definition_id = EXCLUDED.definition_id, step_no = EXCLUDED.step_no,
        name = EXCLUDED.name, approver_rule = EXCLUDED.approver_rule,
        on_approve = EXCLUDED.on_approve, on_reject = EXCLUDED.on_reject,
        sla_hours = EXCLUDED.sla_hours;

    -- ============================================================================
    -- 34. WORKFLOW V2 — Requests
    -- ============================================================================
    INSERT INTO wf_requests
        (id, code, title, request_type, priority, status,
         requester_id, requester_ou_id, definition_id, current_step_no,
         due_at, payload, submitted_at, closed_at, created_at, updated_at)
    VALUES
        ('c5300000-0000-0000-0000-000000000001', 'WF-2025-001',
         'Xin cấp 2 laptop Dell cho nhân viên mới phòng Kế toán', 'asset_request', 'high', 'approved',
         '00000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000006',
         'c5100000-0000-0000-0000-000000000001', 3,
         NOW() + INTERVAL '7 days',
         '{"reason":"Nhân viên mới Q1/2025, cần laptop làm việc","dept":"Kế toán"}'::jsonb,
         NOW() - INTERVAL '10 days', NULL, NOW() - INTERVAL '12 days', NOW() - INTERVAL '3 days'),
        ('c5300000-0000-0000-0000-000000000002', 'WF-2025-002',
         'Yêu cầu sửa laptop HP EliteBook — lỗi bàn phím', 'repair_request', 'normal', 'in_review',
         '00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000007',
         'c5100000-0000-0000-0000-000000000002', 1,
         NOW() + INTERVAL '5 days',
         '{"asset_code":"LAP-HP-001","symptom":"Bàn phím không gõ được phím Enter và Space"}'::jsonb,
         NOW() - INTERVAL '5 days', NULL, NOW() - INTERVAL '6 days', NOW() - INTERVAL '5 days'),
        ('c5300000-0000-0000-0000-000000000003', 'WF-2025-003',
         'Đề xuất thanh lý laptop Dell cũ — LAP-DELL-OLD', 'disposal_request', 'low', 'submitted',
         '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002',
         'c5100000-0000-0000-0000-000000000003', 1,
         NOW() + INTERVAL '30 days',
         '{"asset_code":"LAP-DELL-OLD","reason":"Đã retired, hết hạn bảo hành, không sửa được","book_value":0}'::jsonb,
         NOW() - INTERVAL '2 days', NULL, NOW() - INTERVAL '3 days', NOW() - INTERVAL '2 days'),
        ('c5300000-0000-0000-0000-000000000004', 'WF-2025-004',
         'Xin cấp phát màn hình + chuột cho phòng Kế toán', 'asset_request', 'normal', 'draft',
         '00000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000006',
         'c5100000-0000-0000-0000-000000000001', NULL,
         NULL,
         '{"reason":"Cần màn hình phụ cho báo cáo cuối tháng","dept":"Kế toán"}'::jsonb,
         NULL, NULL, NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day'),
        ('c5300000-0000-0000-0000-000000000005', 'WF-2025-005',
         'Yêu cầu thay pin UPS tại DC', 'repair_request', 'urgent', 'closed',
         '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002',
         'c5100000-0000-0000-0000-000000000002', 2,
         NOW() - INTERVAL '5 days',
         '{"asset_code":"UPS-APC-001","symptom":"Cảnh báo ắc quy yếu — runtime < 5 phút"}'::jsonb,
         NOW() - INTERVAL '15 days', NOW() - INTERVAL '3 days', NOW() - INTERVAL '16 days', NOW() - INTERVAL '3 days'),
        -- WF-2026-001: Admin xin cấp bộ máy bàn (shows in Admin "Yêu cầu của tôi" + Inbox)
        ('c5300000-0000-0000-0000-000000000006', 'WF-2026-001',
         'Xin cấp phát 1 bộ máy tính để bàn cho phòng IT', 'asset_request', 'normal', 'in_review',
         '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002',
         'c5100000-0000-0000-0000-000000000001', 1,
         NOW() + INTERVAL '14 days',
         '{"reason":"Bổ sung máy tính cho nhân viên IT mới onboarding","dept":"CNTT"}'::jsonb,
         NOW() - INTERVAL '1 day', NULL, NOW() - INTERVAL '2 days', NOW() - INTERVAL '1 day')
    ON CONFLICT (id) DO UPDATE SET
        code = EXCLUDED.code, title = EXCLUDED.title, request_type = EXCLUDED.request_type,
        priority = EXCLUDED.priority, status = EXCLUDED.status, current_step_no = EXCLUDED.current_step_no,
        payload = EXCLUDED.payload, updated_at = NOW();

    -- ============================================================================
    -- 35. WORKFLOW V2 — Approvals
    -- ============================================================================
    INSERT INTO wf_approvals
        (id, request_id, step_id, step_no, assignee_user_id, status, comment, decision_at, decision_by, created_at, updated_at)
    VALUES
        -- WF-2025-001: step 1 approved, step 2 approved, step 3 pending
        ('c5400000-0000-0000-0000-000000000001', 'c5300000-0000-0000-0000-000000000001', 'c5200000-0000-0000-0000-000000000001', 1,
         '00000000-0000-0000-0000-000000000001', 'approved', 'Đồng ý cấp laptop cho NV mới',
         NOW() - INTERVAL '9 days', '00000000-0000-0000-0000-000000000001', NOW() - INTERVAL '10 days', NOW() - INTERVAL '9 days'),
        ('c5400000-0000-0000-0000-000000000002', 'c5300000-0000-0000-0000-000000000001', 'c5200000-0000-0000-0000-000000000002', 2,
         '00000000-0000-0000-0000-000000000002', 'approved', 'IT xác nhận có hàng trong kho',
         NOW() - INTERVAL '7 days', '00000000-0000-0000-0000-000000000002', NOW() - INTERVAL '9 days', NOW() - INTERVAL '7 days'),
        ('c5400000-0000-0000-0000-000000000003', 'c5300000-0000-0000-0000-000000000001', 'c5200000-0000-0000-0000-000000000003', 3,
         '00000000-0000-0000-0000-000000000003', 'pending', NULL,
         NULL, NULL, NOW() - INTERVAL '7 days', NOW() - INTERVAL '7 days'),
        -- WF-2025-002: step 1 pending
        ('c5400000-0000-0000-0000-000000000004', 'c5300000-0000-0000-0000-000000000002', 'c5200000-0000-0000-0000-000000000004', 1,
         '00000000-0000-0000-0000-000000000002', 'pending', NULL,
         NULL, NULL, NOW() - INTERVAL '5 days', NOW() - INTERVAL '5 days'),
        -- WF-2025-005: step 1 approved, step 2 approved (closed)
        ('c5400000-0000-0000-0000-000000000005', 'c5300000-0000-0000-0000-000000000005', 'c5200000-0000-0000-0000-000000000004', 1,
         '00000000-0000-0000-0000-000000000002', 'approved', 'Khẩn cấp — ảnh hưởng DC',
         NOW() - INTERVAL '14 days', '00000000-0000-0000-0000-000000000002', NOW() - INTERVAL '15 days', NOW() - INTERVAL '14 days'),
        ('c5400000-0000-0000-0000-000000000006', 'c5300000-0000-0000-0000-000000000005', 'c5200000-0000-0000-0000-000000000005', 2,
         '00000000-0000-0000-0000-000000000004', 'approved', 'Đã thay pin UPS thành công',
         NOW() - INTERVAL '3 days', '00000000-0000-0000-0000-000000000004', NOW() - INTERVAL '14 days', NOW() - INTERVAL '3 days'),
        -- Admin pending: WF-2025-003 disposal request cần IT Manager duyệt bước 1 (shows in Admin "Hộp phê duyệt")
        ('c5400000-0000-0000-0000-000000000007', 'c5300000-0000-0000-0000-000000000003', 'c5200000-0000-0000-0000-000000000006', 1,
         '00000000-0000-0000-0000-000000000001', 'pending', NULL,
         NULL, NULL, NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days'),
        -- Trưởng phòng duyệt WF-2026-001 của Admin (step 1 — assigned to nvquan)
        ('c5400000-0000-0000-0000-000000000008', 'c5300000-0000-0000-0000-000000000006', 'c5200000-0000-0000-0000-000000000001', 1,
         '00000000-0000-0000-0000-000000000002', 'pending', NULL,
         NULL, NULL, NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day')
    ON CONFLICT (id) DO UPDATE SET
        request_id = EXCLUDED.request_id, step_id = EXCLUDED.step_id, step_no = EXCLUDED.step_no,
        status = EXCLUDED.status, comment = EXCLUDED.comment, decision_at = EXCLUDED.decision_at,
        decision_by = EXCLUDED.decision_by, updated_at = NOW();

    -- ============================================================================
    -- 36. WORKFLOW V2 — Request Lines
    -- ============================================================================
    INSERT INTO wf_request_lines
        (id, request_id, line_no, item_type, asset_id, part_id,
         requested_qty, fulfilled_qty, unit_cost, note, metadata, status, created_at, updated_at)
    VALUES
        -- WF-2025-001: Xin 2 laptop Dell + 2 chuột
        ('c5500000-0000-0000-0000-000000000001', 'c5300000-0000-0000-0000-000000000001', 1,
         'asset', 'ee100000-0000-0000-0000-000000000006', NULL,
         1, 0, 28000000, 'Laptop Dell Latitude dự phòng trong kho', '{}'::jsonb, 'pending', NOW(), NOW()),
        ('c5500000-0000-0000-0000-000000000002', 'c5300000-0000-0000-0000-000000000001', 2,
         'asset', 'ee100000-0000-0000-0000-000000000007', NULL,
         1, 0, 25000000, 'Laptop HP EliteBook dự phòng trong kho', '{}'::jsonb, 'pending', NOW(), NOW()),
        ('c5500000-0000-0000-0000-000000000003', 'c5300000-0000-0000-0000-000000000001', 3,
         'part', NULL, 'b0100000-0000-0000-0000-000000000015',
         2, 0, 50000, 'Cáp mạng Cat6 3m', '{}'::jsonb, 'pending', NOW(), NOW()),
        -- WF-2025-002: Sửa laptop — cần bàn phím HP thay thế
        ('c5500000-0000-0000-0000-000000000004', 'c5300000-0000-0000-0000-000000000002', 1,
         'part', NULL, 'b0100000-0000-0000-0000-000000000012',
         1, 0, 850000, 'Bàn phím HP EliteBook thay thế', '{}'::jsonb, 'pending', NOW(), NOW()),
        -- WF-2025-004: Xin màn hình + chuột (draft)
        ('c5500000-0000-0000-0000-000000000005', 'c5300000-0000-0000-0000-000000000004', 1,
         'asset', NULL, NULL,
         2, 0, 7000000, 'Màn hình Dell P2423D cho kế toán', '{"model":"dd100000-0000-0000-0000-000000000011"}'::jsonb, 'pending', NOW(), NOW()),
        ('c5500000-0000-0000-0000-000000000006', 'c5300000-0000-0000-0000-000000000004', 2,
         'part', NULL, NULL,
         2, 0, 350000, 'Chuột Logitech M240', '{"accessory":"a8100000-0000-0000-0000-000000000001"}'::jsonb, 'pending', NOW(), NOW()),
        -- WF-2025-005: Thay pin UPS (closed — fulfilled)
        ('c5500000-0000-0000-0000-000000000007', 'c5300000-0000-0000-0000-000000000005', 1,
         'part', NULL, 'b0100000-0000-0000-0000-000000000021',
         2, 2, 3500000, 'Ắc quy APC RBC43 thay thế', '{}'::jsonb, 'fulfilled', NOW(), NOW())
    ON CONFLICT (id) DO UPDATE SET
        request_id = EXCLUDED.request_id, line_no = EXCLUDED.line_no, item_type = EXCLUDED.item_type,
        requested_qty = EXCLUDED.requested_qty, fulfilled_qty = EXCLUDED.fulfilled_qty,
        status = EXCLUDED.status, note = EXCLUDED.note, updated_at = NOW();

    -- ============================================================================
    -- 37. CHO MƯỢN TÀI SẢN (Asset Checkouts)
    -- ============================================================================
    INSERT INTO asset_checkouts
        (id, checkout_code, asset_id, checkout_type, target_user_id,
         target_location_id, checkout_date, expected_checkin_date,
         checked_out_by, checkout_notes, checkin_date, checked_in_by,
         checkin_notes, checkin_condition, status, organization_id, created_at, updated_at)
    VALUES
        -- Laptop cho mượn tạm — đã trả
        ('c6100000-0000-0000-0000-000000000001', 'CO-2025-001',
         'ee100000-0000-0000-0000-000000000006', 'user',
         '00000000-0000-0000-0000-000000000005', NULL,
         NOW() - INTERVAL '20 days', (NOW() - INTERVAL '10 days')::date,
         '00000000-0000-0000-0000-000000000003', 'Cho mượn laptop dự phòng — máy chính đang sửa',
         NOW() - INTERVAL '12 days', '00000000-0000-0000-0000-000000000003',
         'Đã trả — máy chính sửa xong', 'good', 'checked_in',
         'c0100000-0000-0000-0000-000000000001', NOW() - INTERVAL '20 days', NOW() - INTERVAL '12 days'),
        -- Laptop cho mượn — đang mượn
        ('c6100000-0000-0000-0000-000000000002', 'CO-2025-002',
         'ee100000-0000-0000-0000-000000000007', 'user',
         '00000000-0000-0000-0000-000000000004', NULL,
         NOW() - INTERVAL '5 days', (NOW() + INTERVAL '9 days')::date,
         '00000000-0000-0000-0000-000000000003', 'Cho mượn laptop HP đi công tác chi nhánh',
         NULL, NULL, NULL, NULL, 'checked_out',
         'c0100000-0000-0000-0000-000000000001', NOW() - INTERVAL '5 days', NOW() - INTERVAL '5 days'),
        -- Switch cho mượn sang chi nhánh
        ('c6100000-0000-0000-0000-000000000003', 'CO-2025-003',
         'ee100000-0000-0000-0000-000000000014', 'location',
         NULL, 'cc100000-0000-0000-0000-000000000007',
         NOW() - INTERVAL '15 days', (NOW() + INTERVAL '15 days')::date,
         '00000000-0000-0000-0000-000000000002', 'Chuyển tạm switch sang chi nhánh 1 — đợi hàng mới',
         NULL, NULL, NULL, NULL, 'checked_out',
         'c0100000-0000-0000-0000-000000000001', NOW() - INTERVAL '15 days', NOW() - INTERVAL '15 days')
    ON CONFLICT (id) DO UPDATE SET
        checkout_code = EXCLUDED.checkout_code, asset_id = EXCLUDED.asset_id,
        checkout_type = EXCLUDED.checkout_type, status = EXCLUDED.status,
        checkout_notes = EXCLUDED.checkout_notes, updated_at = NOW();

    -- ============================================================================
    -- 38. KHẤU HAO TÀI SẢN (Depreciation Schedules)
    -- ============================================================================
    INSERT INTO depreciation_schedules
        (id, asset_id, depreciation_method, original_cost, salvage_value,
         useful_life_years, start_date, end_date,
         monthly_depreciation, accumulated_depreciation, book_value,
         currency, status, notes, organization_id,
         created_by, updated_by, created_at, updated_at)
    VALUES
        -- Server Dell — 5 năm, straight line
        ('c7100000-0000-0000-0000-000000000001', 'ee100000-0000-0000-0000-000000000011',
         'straight_line', 120000000, 12000000, 5,
         '2024-01-01', '2028-12-31',
         1800000, 27000000, 93000000,
         'VND', 'active', 'Khấu hao SRV-DELL-001 — ERP chính',
         'c0100000-0000-0000-0000-000000000001',
         '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', NOW(), NOW()),
        -- Server HP — 5 năm
        ('c7100000-0000-0000-0000-000000000002', 'ee100000-0000-0000-0000-000000000012',
         'straight_line', 150000000, 15000000, 5,
         '2024-01-01', '2028-12-31',
         2250000, 33750000, 116250000,
         'VND', 'active', 'Khấu hao SRV-HP-001 — DB Server',
         'c0100000-0000-0000-0000-000000000001',
         '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', NOW(), NOW()),
        -- Laptop Dell (retired) — fully depreciated
        ('c7100000-0000-0000-0000-000000000003', 'ee100000-0000-0000-0000-000000000018',
         'straight_line', 25000000, 2500000, 3,
         '2021-06-01', '2024-05-31',
         625000, 22500000, 2500000,
         'VND', 'fully_depreciated', 'LAP-DELL-OLD — đã thanh lý',
         'c0100000-0000-0000-0000-000000000001',
         '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', NOW(), NOW()),
        -- UPS APC — 8 năm
        ('c7100000-0000-0000-0000-000000000004', 'ee100000-0000-0000-0000-000000000020',
         'straight_line', 45000000, 4500000, 8,
         '2023-06-01', '2031-05-31',
         421875, 8859375, 36140625,
         'VND', 'active', 'UPS-APC-001 — DC',
         'c0100000-0000-0000-0000-000000000001',
         '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', NOW(), NOW()),
        -- FortiGate firewall — 5 năm
        ('c7100000-0000-0000-0000-000000000005', 'ee100000-0000-0000-0000-000000000016',
         'straight_line', 85000000, 8500000, 5,
         '2024-03-01', '2029-02-28',
         1275000, 16575000, 68425000,
         'VND', 'active', 'FW-FTN-001 — tường lửa chính',
         'c0100000-0000-0000-0000-000000000001',
         '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', NOW(), NOW())
    ON CONFLICT (id) DO UPDATE SET
        depreciation_method = EXCLUDED.depreciation_method,
        accumulated_depreciation = EXCLUDED.accumulated_depreciation,
        book_value = EXCLUDED.book_value, status = EXCLUDED.status,
        notes = EXCLUDED.notes, updated_at = NOW();

    -- ============================================================================
    -- 39. NHÃN / LABEL (Templates + Settings)
    -- ============================================================================
    INSERT INTO label_templates
        (id, template_code, name, description, label_type, size_preset,
         width_mm, height_mm, layout, fields, barcode_type,
         include_logo, include_company_name, font_family, font_size,
         is_default, is_active, organization_id,
         created_by, updated_by, created_at, updated_at)
    VALUES
        ('c8100000-0000-0000-0000-000000000001', 'TPL-STD-ASSET', 'Nhãn tài sản chuẩn',
         'Mẫu nhãn tài sản CNTT tiêu chuẩn — barcode + QR', 'combined', 'medium',
         50, 25,
         '{"columns":2,"orientation":"landscape"}'::jsonb,
         '["asset_code","asset_name","category","location","purchase_date"]'::jsonb,
         'code128', true, true, 'Arial', 9,
         true, true, 'c0100000-0000-0000-0000-000000000001',
         '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', NOW(), NOW()),
        ('c8100000-0000-0000-0000-000000000002', 'TPL-QR-SMALL', 'Nhãn QR nhỏ',
         'Mẫu nhãn QR code nhỏ gọn — dán lên thiết bị nhỏ', 'qrcode', 'small',
         30, 20,
         '{"columns":1,"orientation":"portrait"}'::jsonb,
         '["asset_code","qr_code"]'::jsonb,
         'qrcode', false, false, 'Arial', 8,
         false, true, 'c0100000-0000-0000-0000-000000000001',
         '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', NOW(), NOW()),
        ('c8100000-0000-0000-0000-000000000003', 'TPL-BARCODE-LG', 'Nhãn barcode lớn',
         'Mẫu nhãn barcode lớn — dán lên server / UPS', 'barcode', 'large',
         70, 30,
         '{"columns":1,"orientation":"landscape"}'::jsonb,
         '["asset_code","asset_name","serial_number","location","barcode"]'::jsonb,
         'code128', true, true, 'Arial', 11,
         false, true, 'c0100000-0000-0000-0000-000000000001',
         '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', NOW(), NOW())
    ON CONFLICT (id) DO UPDATE SET
        template_code = EXCLUDED.template_code, name = EXCLUDED.name,
        description = EXCLUDED.description, label_type = EXCLUDED.label_type,
        is_default = EXCLUDED.is_default, is_active = EXCLUDED.is_active, updated_at = NOW();

    INSERT INTO label_settings
        (id, setting_key, setting_value, value_type, description,
         organization_id, updated_by, updated_at)
    VALUES
        ('c8200000-0000-0000-0000-000000000001', 'default_template', 'c8100000-0000-0000-0000-000000000001',
         'uuid', 'Template mặc định khi in nhãn',
         'c0100000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', NOW()),
        ('c8200000-0000-0000-0000-000000000002', 'company_name', 'Bệnh viện Đa khoa Trung ương',
         'string', 'Tên đơn vị hiển thị trên nhãn',
         'c0100000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', NOW()),
        ('c8200000-0000-0000-0000-000000000003', 'print_copies', '2',
         'number', 'Số bản in mặc định',
         'c0100000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', NOW()),
        ('c8200000-0000-0000-0000-000000000004', 'auto_print_on_receipt', 'true',
         'boolean', 'Tự động in nhãn khi nhập kho',
         'c0100000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', NOW())
    ON CONFLICT (id) DO UPDATE SET
        setting_key = EXCLUDED.setting_key, setting_value = EXCLUDED.setting_value,
        description = EXCLUDED.description, updated_at = NOW();

    -- ============================================================================
    -- 40. TÀI LIỆU (Documents + Files)
    -- ============================================================================
    INSERT INTO documents
        (id, parent_id, type, title, summary, content_type,
         markdown, visibility, approval_status,
         version, tags, created_by, updated_by, created_at, updated_at)
    VALUES
        ('c9100000-0000-0000-0000-000000000001', NULL, 'policy',
         'Quy trình quản lý tài sản CNTT',
         'Quy trình cấp phát, thu hồi, thanh lý tài sản công nghệ thông tin',
         'markdown',
         E'# Quy trình quản lý tài sản CNTT\n\n## 1. Mục đích\nQuy định trình tự cấp phát, theo dõi, bảo trì và thanh lý tài sản CNTT.\n\n## 2. Phạm vi\nÁp dụng cho toàn bộ thiết bị CNTT thuộc sở hữu đơn vị.\n\n## 3. Quy trình\n1. Nhân viên tạo yêu cầu trên hệ thống\n2. Trưởng phòng phê duyệt\n3. IT Manager kiểm tra tồn kho\n4. Thủ kho xuất tài sản\n5. Nhân viên nhận và ký xác nhận',
         'public', 'approved', '2.0',
         ARRAY['quy-trinh','tai-san','cntt'], '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', NOW(), NOW()),
        ('c9100000-0000-0000-0000-000000000002', NULL, 'manual',
         'Hướng dẫn sử dụng hệ thống QLTS',
         'Tài liệu hướng dẫn thao tác chi tiết các chức năng quản lý tài sản',
         'markdown',
         E'# Hướng dẫn sử dụng hệ thống QLTS\n\n## Đăng nhập\nTruy cập hệ thống qua trình duyệt.\n\n## Quản lý tài sản\n- Danh sách tài sản: Menu **Tài sản** > **Danh sách**\n- Thêm mới: Nhấn **+ Thêm tài sản**\n- Chi tiết: Nhấn vào mã tài sản',
         'team', 'approved', '1.0',
         ARRAY['huong-dan','su-dung'], '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002', NOW(), NOW()),
        ('c9100000-0000-0000-0000-000000000003', NULL, 'template',
         'Biên bản bàn giao tài sản',
         'Mẫu biên bản bàn giao khi cấp phát / thu hồi tài sản',
         'file',
         NULL,
         'team', 'approved', '1.0',
         ARRAY['bien-ban','ban-giao','mau'], '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', NOW(), NOW()),
        ('c9100000-0000-0000-0000-000000000004', 'c9100000-0000-0000-0000-000000000001', 'policy',
         'Phụ lục: Quy định thanh lý tài sản',
         'Chi tiết quy trình thanh lý tài sản CNTT hết hạn sử dụng',
         'markdown',
         E'# Phụ lục: Quy định thanh lý tài sản\n\n## Điều kiện thanh lý\n- Tài sản đã hết khấu hao\n- Hỏng không thể sửa chữa\n- Lỗi thời công nghệ\n\n## Quy trình\n1. IT Manager lập đề xuất\n2. Kế toán xác định giá trị còn lại\n3. Ban Giám đốc phê duyệt\n4. Hội đồng thanh lý thực hiện',
         'public', 'draft', '1.0',
         ARRAY['thanh-ly','quy-dinh'], '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002', NOW(), NOW())
    ON CONFLICT (id) DO UPDATE SET
        type = EXCLUDED.type, title = EXCLUDED.title, summary = EXCLUDED.summary,
        content_type = EXCLUDED.content_type, markdown = EXCLUDED.markdown,
        visibility = EXCLUDED.visibility, approval_status = EXCLUDED.approval_status,
        version = EXCLUDED.version, tags = EXCLUDED.tags, updated_at = NOW();

    INSERT INTO document_files (id, document_id, storage_key, filename, sha256, size_bytes, mime_type, created_at)
    VALUES
        ('c9200000-0000-0000-0000-000000000001', 'c9100000-0000-0000-0000-000000000003',
         'documents/templates/ban-giao-tai-san-v1.docx',
         'Biên bản bàn giao tài sản v1.docx',
         'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
         45056, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', NOW()),
        ('c9200000-0000-0000-0000-000000000002', 'c9100000-0000-0000-0000-000000000003',
         'documents/templates/ban-giao-tai-san-v1.pdf',
         'Biên bản bàn giao tài sản v1.pdf',
         'a1b2c3d4e5f678901234567890abcdef1234567890abcdef1234567890abcdef',
         128000, 'application/pdf', NOW())
    ON CONFLICT (id) DO UPDATE SET
        document_id = EXCLUDED.document_id, storage_key = EXCLUDED.storage_key,
        filename = EXCLUDED.filename;

    -- ============================================================================
    -- 41. KIỂM KÊ / AUDIT SESSIONS
    -- ============================================================================
    INSERT INTO audit_sessions
        (id, audit_code, name, audit_type, scope_description,
         start_date, end_date, status, notes,
         total_items, audited_items, found_items, missing_items, misplaced_items,
         organization_id, created_at, updated_at, created_by)
    VALUES
        ('ca100000-0000-0000-0000-000000000001', 'AUD-2025-001',
         'Kiểm kê tài sản CNTT Q1/2025 — Phòng Server',
         'partial', 'Kiểm kê tất cả server, switch, firewall, UPS trong phòng DC',
         '2025-01-15', '2025-01-17', 'completed',
         'Kiểm kê hoàn tất — phát hiện 1 thiết bị mất (FW-FTN-002 đang sửa chữa)',
         8, 8, 7, 1, 0,
         'c0100000-0000-0000-0000-000000000001', NOW(), NOW(), '00000000-0000-0000-0000-000000000002'),
        ('ca100000-0000-0000-0000-000000000002', 'AUD-2025-002',
         'Kiểm kê laptop / desktop toàn đơn vị Q1/2025',
         'full', 'Kiểm kê tất cả laptop, desktop, màn hình tại tất cả tầng và chi nhánh',
         '2025-02-01', NULL, 'in_progress',
         'Đang tiến hành — hoàn tất tầng 1-2, còn tầng 3 và chi nhánh',
         12, 8, 7, 0, 1,
         'c0100000-0000-0000-0000-000000000001', NOW(), NOW(), '00000000-0000-0000-0000-000000000002'),
        ('ca100000-0000-0000-0000-000000000003', 'AUD-2025-003',
         'Spot check kho vật tư Q1/2025',
         'spot_check', 'Kiểm tra ngẫu nhiên tồn kho spare parts tại kho CNTT chính',
         '2025-03-01', '2025-03-01', 'completed',
         'Spot check OK — tồn kho khớp hệ thống',
         5, 5, 5, 0, 0,
         'c0100000-0000-0000-0000-000000000001', NOW(), NOW(), '00000000-0000-0000-0000-000000000003')
    ON CONFLICT (id) DO UPDATE SET
        audit_code = EXCLUDED.audit_code, name = EXCLUDED.name, audit_type = EXCLUDED.audit_type,
        status = EXCLUDED.status, notes = EXCLUDED.notes,
        total_items = EXCLUDED.total_items, audited_items = EXCLUDED.audited_items,
        found_items = EXCLUDED.found_items, missing_items = EXCLUDED.missing_items, updated_at = NOW();

    -- ============================================================================
    -- 42. BÁO CÁO & CẢNH BÁO (Report Definitions + Alert Rules)
    -- ============================================================================
    INSERT INTO report_definitions
        (id, report_code, name, description, report_type, data_source, fields,
         default_filters, is_scheduled, schedule_cron, schedule_format,
         is_builtin, is_active, organization_id, created_by, created_at, updated_at)
    VALUES
        ('cb100000-0000-0000-0000-000000000001', 'RPT-INV-MONTHLY',
         'Báo cáo tồn kho hàng tháng',
         'Tổng hợp tồn kho spare parts theo warehouse, cảnh báo dưới mức tối thiểu',
         'tabular', 'spare_parts',
         '["part_code","part_name","warehouse","current_stock","min_stock"]'::jsonb,
         '{"groupBy":"warehouse","includeBelow":"min_stock"}'::jsonb,
         true, '0 8 1 * *', 'excel',
         false, true, 'c0100000-0000-0000-0000-000000000001',
         '00000000-0000-0000-0000-000000000002', NOW(), NOW()),
        ('cb100000-0000-0000-0000-000000000002', 'RPT-ASSET-DEPT',
         'Báo cáo tài sản theo phòng ban',
         'Thống kê số lượng và giá trị tài sản CNTT theo location / phòng ban',
         'tabular', 'assets',
         '["asset_code","asset_name","category","location","original_cost","status"]'::jsonb,
         '{"groupBy":"location","valueField":"original_cost"}'::jsonb,
         true, '0 8 * * MON', 'excel',
         false, true, 'c0100000-0000-0000-0000-000000000001',
         '00000000-0000-0000-0000-000000000002', NOW(), NOW()),
        ('cb100000-0000-0000-0000-000000000003', 'RPT-DEPR-QUARTERLY',
         'Báo cáo khấu hao quý',
         'Tổng hợp giá trị khấu hao lũy kế và giá trị còn lại theo quý',
         'scheduled', 'depreciation_schedules',
         '["asset_code","original_cost","accumulated_depreciation","book_value","status"]'::jsonb,
         '{"period":"quarterly","groupBy":"category"}'::jsonb,
         true, '0 8 1 1,4,7,10 *', 'excel',
         false, true, 'c0100000-0000-0000-0000-000000000001',
         '00000000-0000-0000-0000-000000000001', NOW(), NOW())
    ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name, description = EXCLUDED.description,
        report_type = EXCLUDED.report_type, is_active = EXCLUDED.is_active, updated_at = NOW();

    INSERT INTO alert_rules
        (id, rule_code, name, description, rule_type,
         condition_field, condition_operator, condition_value,
         severity, channel, frequency, cooldown_hours,
         recipients, is_builtin, is_active,
         organization_id, created_by, created_at, updated_at)
    VALUES
        ('cb200000-0000-0000-0000-000000000001', 'ALR-STOCK-LOW',
         'Cảnh báo tồn kho thấp',
         'Gửi cảnh báo khi spare part dưới mức tồn kho tối thiểu',
         'stock', 'current_stock', 'lt', '{"threshold":"min_stock"}'::jsonb,
         'warning', 'both', 'daily', 24,
         '["00000000-0000-0000-0000-000000000002"]'::jsonb,
         false, true, 'c0100000-0000-0000-0000-000000000001',
         '00000000-0000-0000-0000-000000000002', NOW(), NOW()),
        ('cb200000-0000-0000-0000-000000000002', 'ALR-WARRANTY-EXP',
         'Cảnh báo bảo hành sắp hết',
         'Thông báo trước 30 ngày khi tài sản sắp hết bảo hành',
         'warranty', 'warranty_end', 'lte', '{"days_from_now":30}'::jsonb,
         'info', 'both', 'weekly', 168,
         '["00000000-0000-0000-0000-000000000002"]'::jsonb,
         false, true, 'c0100000-0000-0000-0000-000000000001',
         '00000000-0000-0000-0000-000000000002', NOW(), NOW()),
        ('cb200000-0000-0000-0000-000000000003', 'ALR-CHECKOUT-OVERDUE',
         'Cảnh báo tài sản quá hạn trả',
         'Gửi email khi checkout quá hạn chưa check-in',
         'checkout', 'expected_checkin_date', 'lt', '{"value":"now","escalate_after_days":3}'::jsonb,
         'critical', 'both', 'daily', 8,
         '["00000000-0000-0000-0000-000000000002"]'::jsonb,
         false, true, 'c0100000-0000-0000-0000-000000000001',
         '00000000-0000-0000-0000-000000000002', NOW(), NOW()),
        ('cb200000-0000-0000-0000-000000000004', 'ALR-MAINT-DUE',
         'Cảnh báo bảo trì định kỳ',
         'Nhắc lịch bảo trì theo chu kỳ đã cài đặt',
         'custom', 'next_maintenance_date', 'lte', '{"days_from_now":7}'::jsonb,
         'warning', 'in_app', 'weekly', 168,
         '["00000000-0000-0000-0000-000000000002"]'::jsonb,
         false, true, 'c0100000-0000-0000-0000-000000000001',
         '00000000-0000-0000-0000-000000000002', NOW(), NOW())
    ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name, description = EXCLUDED.description,
        severity = EXCLUDED.severity, is_active = EXCLUDED.is_active, updated_at = NOW();

    -- ============================================================================
    -- 43. DASHBOARD WIDGETS
    -- ============================================================================
    INSERT INTO dashboard_widgets
        (id, widget_code, name, description, widget_type,
         data_source, data_config, default_size,
         is_builtin, is_active,
         organization_id, created_by, created_at, updated_at)
    VALUES
        ('cb300000-0000-0000-0000-000000000001', 'WDG-ASSET-OVERVIEW',
         'Tổng quan tài sản', 'Tổng số tài sản theo trạng thái',
         'stat_card', 'assets',
         '{"metric":"total_assets","breakdown":"status"}'::jsonb, 'small',
         true, true, 'c0100000-0000-0000-0000-000000000001',
         '00000000-0000-0000-0000-000000000001', NOW(), NOW()),
        ('cb300000-0000-0000-0000-000000000002', 'WDG-ASSET-BY-CAT',
         'Phân bố tài sản theo loại', 'Biểu đồ tròn phân bổ tài sản theo danh mục',
         'pie_chart', 'assets',
         '{"metric":"asset_count","groupBy":"category"}'::jsonb, 'medium',
         true, true, 'c0100000-0000-0000-0000-000000000001',
         '00000000-0000-0000-0000-000000000001', NOW(), NOW()),
        ('cb300000-0000-0000-0000-000000000003', 'WDG-STOCK-LEVEL',
         'Tồn kho spare parts', 'Biểu đồ cột tồn kho theo warehouse',
         'bar_chart', 'spare_parts',
         '{"metric":"stock_level","groupBy":"warehouse","highlight":"below_min"}'::jsonb, 'large',
         true, true, 'c0100000-0000-0000-0000-000000000001',
         '00000000-0000-0000-0000-000000000001', NOW(), NOW()),
        ('cb300000-0000-0000-0000-000000000004', 'WDG-WF-PENDING',
         'Yêu cầu đang chờ xử lý', 'Bảng danh sách yêu cầu đang chờ',
         'table', 'wf_requests',
         '{"filter":"status=in_review|submitted","columns":["code","title","requester","created_at"]}'::jsonb, 'large',
         true, true, 'c0100000-0000-0000-0000-000000000001',
         '00000000-0000-0000-0000-000000000001', NOW(), NOW()),
        ('cb300000-0000-0000-0000-000000000005', 'WDG-DEPR-ACCUM',
         'Giá trị khấu hao lũy kế', 'Biểu đồ đường khấu hao 12 tháng gần nhất',
         'line_chart', 'depreciation_schedules',
         '{"metric":"depreciation","period":"monthly","last_n":12}'::jsonb, 'large',
         true, true, 'c0100000-0000-0000-0000-000000000001',
         '00000000-0000-0000-0000-000000000001', NOW(), NOW()),
        ('cb300000-0000-0000-0000-000000000006', 'WDG-RECENT-ACTIVITY',
         'Hoạt động gần đây', 'Danh sách hoạt động gần nhất',
         'list', 'asset_events',
         '{"source":"asset_events","limit":10}'::jsonb, 'medium',
         true, true, 'c0100000-0000-0000-0000-000000000001',
         '00000000-0000-0000-0000-000000000001', NOW(), NOW())
    ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name, widget_type = EXCLUDED.widget_type,
        data_config = EXCLUDED.data_config, default_size = EXCLUDED.default_size, updated_at = NOW();

COMMIT;
