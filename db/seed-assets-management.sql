-- ============================================================================
-- seed-assets-management.sql
-- Du lieu danh muc (Catalog-only): Categories, Models, Spec Definitions,
--   Warehouses, Spare Parts, License/Accessory/Consumable/Component Catalogs
-- CHI co du lieu danh muc, KHONG co du lieu giao dich (assets, tickets, etc.)
-- Tao >100 dong de test phan trang (pagination)
-- Chay SAU seed-data.sql
-- ============================================================================
SET client_encoding = 'UTF8';

BEGIN;

    -- ============================================================================
    -- 0. CLEANUP: Xoa du lieu giao dich truoc, giu lai danh muc
    -- ============================================================================
    -- Workflow & Requests (old table)
    DELETE FROM workflow_requests WHERE true;
    -- WF module
    DELETE FROM wf_attachments WHERE true;
    DELETE FROM wf_events WHERE true;
    DELETE FROM wf_approvals WHERE true;
    DELETE FROM wf_request_lines WHERE true;
    DELETE FROM wf_requests WHERE true;

    -- Stock & Warehouse transactions
    DELETE FROM stock_document_lines WHERE true;
    DELETE FROM stock_documents WHERE true;
    DELETE FROM spare_part_movements WHERE true;
    DELETE FROM spare_part_stock WHERE true;

    -- Maintenance
    DELETE FROM repair_order_parts WHERE true;
    DELETE FROM repair_orders WHERE true;
    DELETE FROM maintenance_tickets WHERE true;

    -- Asset transactions
    DELETE FROM asset_events WHERE true;
    DELETE FROM asset_assignments WHERE true;

    -- QLTS documents
    DELETE FROM asset_increase_lines WHERE true;
    DELETE FROM asset_increase_docs WHERE true;
    DELETE FROM purchase_plan_lines WHERE true;
    DELETE FROM purchase_plan_docs WHERE true;
    DELETE FROM approvals WHERE true;

    -- Accessories, Consumables, Components (items + transactions)
    DELETE FROM accessory_checkouts WHERE true;
    DELETE FROM accessory_audit_logs WHERE true;
    DELETE FROM accessory_stock_adjustments WHERE true;
    DELETE FROM accessories WHERE true;
    DELETE FROM consumable_issues WHERE true;
    DELETE FROM consumable_receipts WHERE true;
    DELETE FROM consumable_audit_logs WHERE true;
    DELETE FROM consumables WHERE true;
    DELETE FROM component_assignments WHERE true;
    DELETE FROM component_audit_logs WHERE true;
    DELETE FROM component_receipts WHERE true;
    DELETE FROM components WHERE true;

    -- Licenses (items)
    DELETE FROM license_audit_logs WHERE true;
    DELETE FROM license_seats WHERE true;
    DELETE FROM licenses WHERE true;

    -- Checkouts
    DELETE FROM asset_checkouts WHERE true;

    -- Reports & misc
    DELETE FROM depreciation_schedules WHERE true;
    DELETE FROM label_settings WHERE true;
    DELETE FROM label_templates WHERE true;
    DELETE FROM documents WHERE true;
    DELETE FROM audit_auditors WHERE true;
    DELETE FROM audit_categories WHERE true;
    DELETE FROM audit_locations WHERE true;
    DELETE FROM audit_sessions WHERE true;
    DELETE FROM report_definitions WHERE true;
    DELETE FROM alert_rules WHERE true;
    DELETE FROM dashboard_widgets WHERE true;
    DELETE FROM workflow_automation_rules WHERE true;
    DELETE FROM notification_rules WHERE true;
    DELETE FROM notifications WHERE true;
    DELETE FROM scheduled_tasks WHERE true;
    DELETE FROM reminders WHERE true;
    DELETE FROM inventory_sessions WHERE true;

    -- Assets (after all FKs cleared)
    DELETE FROM assets WHERE true;

    -- Cleanup old catalog data (will re-seed with expanded data)
    DELETE FROM accessory_categories WHERE true;
    DELETE FROM accessory_manufacturers WHERE true;
    DELETE FROM consumable_categories WHERE true;
    DELETE FROM consumable_manufacturers WHERE true;
    DELETE FROM component_categories WHERE true;
    DELETE FROM component_manufacturers WHERE true;
    DELETE FROM license_categories WHERE true;
    DELETE FROM asset_category_spec_definitions WHERE true;
    DELETE FROM asset_category_spec_versions WHERE true;
    DELETE FROM asset_models WHERE true;
    DELETE FROM spare_parts WHERE true;
    DELETE FROM asset_categories WHERE true;

    -- ============================================================================
    -- 1. ASSET CATEGORIES  (20 danh muc)
    -- ============================================================================
    INSERT INTO asset_categories
        (id, name)
    VALUES
        ('e0000000-0000-0000-0000-000000000001', E'M\u00E1y t\u00EDnh \u0111\u1EC3 b\u00E0n'),
    ('e0000000-0000-0000-0000-000000000002', E'M\u00E1y t\u00EDnh x\u00E1ch tay'),
    ('e0000000-0000-0000-0000-000000000003', E'M\u00E0n h\u00ECnh'),
    ('e0000000-0000-0000-0000-000000000004', E'M\u00E1y in'),
    ('e0000000-0000-0000-0000-000000000005', E'Thi\u1EBFt b\u1ECB m\u1EA1ng'),
    ('e0000000-0000-0000-0000-000000000006', E'M\u00E1y ch\u1EE7'),
    ('e0000000-0000-0000-0000-000000000007', E'L\u01B0u tr\u1EEF (NAS/SAN)'),
    ('e0000000-0000-0000-0000-000000000008', E'Ph\u1EE5 ki\u1EC7n'),
    ('e0000000-0000-0000-0000-000000000009', E'Ph\u1EA7n m\u1EC1m / Licence'),
    ('e0000000-0000-0000-0000-000000000010', E'M\u00E1y scan'),
    ('e0000000-0000-0000-0000-000000000011', E'M\u00E1y chi\u1EBFu (Projector)'),
    ('e0000000-0000-0000-0000-000000000012', E'\u0110i\u1EC7n tho\u1EA1i IP'),
    ('e0000000-0000-0000-0000-000000000013', E'Camera an ninh'),
    ('e0000000-0000-0000-0000-000000000014', E'B\u1ED9 l\u01B0u \u0111i\u1EC7n (UPS)'),
    ('e0000000-0000-0000-0000-000000000015', E'Thi\u1EBFt b\u1ECB h\u1ED9i ngh\u1ECB'),
    ('e0000000-0000-0000-0000-000000000016', E'Tablet'),
    ('e0000000-0000-0000-0000-000000000017', E'\u0110i\u1EC7n tho\u1EA1i di \u0111\u1ED9ng'),
    ('e0000000-0000-0000-0000-000000000018', E'Thi\u1EBFt b\u1ECB \u0111o l\u01B0\u1EDDng'),
    ('e0000000-0000-0000-0000-000000000019', E'M\u00E1y photocopy'),
    ('e0000000-0000-0000-0000-000000000020', E'Thi\u1EBFt b\u1ECB y t\u1EBF')
ON CONFLICT
    (id) DO
    UPDATE SET name = EXCLUDED.name;

    -- ============================================================================
    -- 2. SPEC VERSIONS  (10 versions - 1 per category that has specs)
    -- ============================================================================
    INSERT INTO asset_category_spec_versions
        (id, category_id, version, status, created_by)
    VALUES
        ('e1000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 1, 'active', 'admin'),
        ('e1000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000002', 1, 'active', 'admin'),
        ('e1000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000003', 1, 'active', 'admin'),
        ('e1000000-0000-0000-0000-000000000004', 'e0000000-0000-0000-0000-000000000004', 1, 'active', 'admin'),
        ('e1000000-0000-0000-0000-000000000005', 'e0000000-0000-0000-0000-000000000005', 1, 'active', 'admin'),
        ('e1000000-0000-0000-0000-000000000006', 'e0000000-0000-0000-0000-000000000006', 1, 'active', 'admin'),
        ('e1000000-0000-0000-0000-000000000007', 'e0000000-0000-0000-0000-000000000007', 1, 'active', 'admin'),
        ('e1000000-0000-0000-0000-000000000010', 'e0000000-0000-0000-0000-000000000010', 1, 'active', 'admin'),
        ('e1000000-0000-0000-0000-000000000013', 'e0000000-0000-0000-0000-000000000013', 1, 'active', 'admin'),
        ('e1000000-0000-0000-0000-000000000014', 'e0000000-0000-0000-0000-000000000014', 1, 'active', 'admin')
    ON CONFLICT
    (id) DO
    UPDATE SET status = EXCLUDED.status;

    -- ============================================================================
    -- 3. SPEC DEFINITIONS  (32 truong spec cho tung danh muc)
    -- ============================================================================
    INSERT INTO asset_category_spec_definitions
        (id, spec_version_id, key, label, field_type, unit, required, sort_order)
    VALUES
        -- PC (e1..01)
        ('e2000000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-000000000001', 'cpu', 'CPU', 'string', NULL, true, 1),
        ('e2000000-0000-0000-0000-000000000002', 'e1000000-0000-0000-0000-000000000001', 'ram', 'RAM', 'number', 'GB', true, 2),
        ('e2000000-0000-0000-0000-000000000003', 'e1000000-0000-0000-0000-000000000001', 'disk', E'\u0110\u0129a c\u1EE9ng', 'number', 'GB', true, 3),
    ('e2000000-0000-0000-0000-000000000004', 'e1000000-0000-0000-0000-000000000001', 'os', E'H\u1EC7 \u0111i\u1EC1u h\u00E0nh', 'string', NULL, false, 4),
    -- Laptop (e1..02)
    ('e2000000-0000-0000-0000-000000000011', 'e1000000-0000-0000-0000-000000000002', 'cpu', 'CPU', 'string', NULL, true, 1),
    ('e2000000-0000-0000-0000-000000000012', 'e1000000-0000-0000-0000-000000000002', 'ram', 'RAM', 'number', 'GB', true, 2),
    ('e2000000-0000-0000-0000-000000000013', 'e1000000-0000-0000-0000-000000000002', 'disk', E'\u0110\u0129a c\u1EE9ng', 'number', 'GB', true, 3),
    ('e2000000-0000-0000-0000-000000000014', 'e1000000-0000-0000-0000-000000000002', 'screen', E'M\u00E0n h\u00ECnh', 'string', 'inch', false, 4),
    -- Monitor (e1..03)
    ('e2000000-0000-0000-0000-000000000021', 'e1000000-0000-0000-0000-000000000003', 'size', E'K\u00EDch th\u01B0\u1EDBc', 'number', 'inch', true, 1),
    ('e2000000-0000-0000-0000-000000000022', 'e1000000-0000-0000-0000-000000000003', 'resolution', E'\u0110\u1ED9 ph\u00E2n gi\u1EA3i', 'string', NULL, false, 2),
    ('e2000000-0000-0000-0000-000000000023', 'e1000000-0000-0000-0000-000000000003', 'panel_type', E'Lo\u1EA1i t\u1EA5m n\u1EC1n', 'string', NULL, false, 3),
    -- Printer (e1..04)
    ('e2000000-0000-0000-0000-000000000031', 'e1000000-0000-0000-0000-000000000004', 'print_type', E'C\u00F4ng ngh\u1EC7 in', 'string', NULL, true, 1),
    ('e2000000-0000-0000-0000-000000000032', 'e1000000-0000-0000-0000-000000000004', 'speed', E'T\u1ED1c \u0111\u1ED9', 'number', 'ppm', false, 2),
    ('e2000000-0000-0000-0000-000000000033', 'e1000000-0000-0000-0000-000000000004', 'duplex', E'In 2 m\u1EB7t', 'boolean', NULL, false, 3),
    -- Network (e1..05)
    ('e2000000-0000-0000-0000-000000000041', 'e1000000-0000-0000-0000-000000000005', 'ports', E'S\u1ED1 c\u1ED5ng', 'number', NULL, true, 1),
    ('e2000000-0000-0000-0000-000000000042', 'e1000000-0000-0000-0000-000000000005', 'speed', E'T\u1ED1c \u0111\u1ED9', 'string', NULL, false, 2),
    ('e2000000-0000-0000-0000-000000000043', 'e1000000-0000-0000-0000-000000000005', 'poe', 'PoE', 'boolean', NULL, false, 3),
    -- Server (e1..06)
    ('e2000000-0000-0000-0000-000000000051', 'e1000000-0000-0000-0000-000000000006', 'cpu', 'CPU', 'string', NULL, true, 1),
    ('e2000000-0000-0000-0000-000000000052', 'e1000000-0000-0000-0000-000000000006', 'ram', 'RAM', 'number', 'GB', true, 2),
    ('e2000000-0000-0000-0000-000000000053', 'e1000000-0000-0000-0000-000000000006', 'disk', E'L\u01B0u tr\u1EEF', 'string', NULL, true, 3),
    ('e2000000-0000-0000-0000-000000000054', 'e1000000-0000-0000-0000-000000000006', 'form_factor', E'Ki\u1EC3u d\u00E1ng', 'string', NULL, false, 4),
    -- Storage (e1..07)
    ('e2000000-0000-0000-0000-000000000061', 'e1000000-0000-0000-0000-000000000007', 'capacity', E'Dung l\u01B0\u1EE3ng', 'number', 'TB', true, 1),
    ('e2000000-0000-0000-0000-000000000062', 'e1000000-0000-0000-0000-000000000007', 'raid', 'RAID', 'string', NULL, false, 2),
    ('e2000000-0000-0000-0000-000000000063', 'e1000000-0000-0000-0000-000000000007', 'bays', E'S\u1ED1 khay', 'number', NULL, false, 3),
    -- Scanner (e1..10)
    ('e2000000-0000-0000-0000-000000000071', 'e1000000-0000-0000-0000-000000000010', 'scan_type', E'Lo\u1EA1i scan', 'string', NULL, true, 1),
    ('e2000000-0000-0000-0000-000000000072', 'e1000000-0000-0000-0000-000000000010', 'dpi', E'\u0110\u1ED9 ph\u00E2n gi\u1EA3i', 'number', 'dpi', false, 2),
    -- Camera (e1..13)
    ('e2000000-0000-0000-0000-000000000081', 'e1000000-0000-0000-0000-000000000013', 'resolution', E'\u0110\u1ED9 ph\u00E2n gi\u1EA3i', 'string', 'MP', true, 1),
    ('e2000000-0000-0000-0000-000000000082', 'e1000000-0000-0000-0000-000000000013', 'night_vision', E'H\u1ED3ng ngo\u1EA1i', 'boolean', NULL, false, 2),
    ('e2000000-0000-0000-0000-000000000083', 'e1000000-0000-0000-0000-000000000013', 'storage', E'L\u01B0u tr\u1EEF', 'string', NULL, false, 3),
    -- UPS (e1..14)
    ('e2000000-0000-0000-0000-000000000091', 'e1000000-0000-0000-0000-000000000014', 'capacity', E'C\u00F4ng su\u1EA5t', 'number', 'VA', true, 1),
    ('e2000000-0000-0000-0000-000000000092', 'e1000000-0000-0000-0000-000000000014', 'battery_time', E'Th\u1EDDi gian l\u01B0u \u0111i\u1EC7n', 'number', 'min', false, 2)
ON CONFLICT
    (id) DO
    UPDATE SET
  label = EXCLUDED.label, field_type = EXCLUDED.field_type, unit = EXCLUDED.unit,
  required = EXCLUDED.required, sort_order = EXCLUDED.sort_order;

    -- ============================================================================
    -- 4. ASSET MODELS  (55 models - du de test pagination 20/page x 3 pages)
    -- ============================================================================
    INSERT INTO asset_models
        (id, category_id, spec_version_id, vendor_id, brand, model, spec, min_stock_qty, unit)
    VALUES
        -- PC (10)
        ('f0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'Dell', 'OptiPlex 7000', '{"cpu":"i7-12700","ram":16,"disk":512,"os":"Windows 11 Pro"}', 5, 'pcs'),
        ('f0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'Dell', 'OptiPlex 5000', '{"cpu":"i5-12500","ram":8,"disk":256,"os":"Windows 11 Pro"}', 3, 'pcs'),
        ('f0000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002', 'HP', 'ProDesk 400 G9', '{"cpu":"i5-12500","ram":8,"disk":256,"os":"Windows 11 Pro"}', 3, 'pcs'),
        ('f0000000-0000-0000-0000-000000000004', 'e0000000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002', 'HP', 'ProDesk 600 G9', '{"cpu":"i7-12700","ram":16,"disk":512,"os":"Windows 11 Pro"}', 3, 'pcs'),
        ('f0000000-0000-0000-0000-000000000005', 'e0000000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000003', 'Lenovo', 'ThinkCentre M70q', '{"cpu":"i5-12400T","ram":8,"disk":256,"os":"Windows 11 Pro"}', 3, 'pcs'),
        ('f0000000-0000-0000-0000-000000000006', 'e0000000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000003', 'Lenovo', 'ThinkCentre M90q', '{"cpu":"i7-12700T","ram":16,"disk":512,"os":"Windows 11 Pro"}', 2, 'pcs'),
        ('f0000000-0000-0000-0000-000000000007', 'e0000000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000006', 'ASUS', 'ExpertCenter D5', '{"cpu":"i5-13400","ram":8,"disk":512,"os":"Windows 11 Pro"}', 2, 'pcs'),
        ('f0000000-0000-0000-0000-000000000008', 'e0000000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'Dell', 'OptiPlex 3000', '{"cpu":"i3-12100","ram":4,"disk":128,"os":"Windows 11"}', 2, 'pcs'),
        ('f0000000-0000-0000-0000-000000000009', 'e0000000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002', 'HP', 'ProDesk 405 G8', '{"cpu":"Ryzen 5 5600G","ram":8,"disk":256,"os":"Windows 11 Pro"}', 2, 'pcs'),
        ('f0000000-0000-0000-0000-000000000010', 'e0000000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000003', 'Lenovo', 'ThinkCentre Neo 50s', '{"cpu":"i5-12400","ram":8,"disk":256,"os":"Windows 11 Pro"}', 2, 'pcs'),
        -- Laptop (10)
        ('f0000000-0000-0000-0000-000000000011', 'e0000000-0000-0000-0000-000000000002', 'e1000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', 'Dell', 'Latitude 5540', '{"cpu":"i7-1365U","ram":16,"disk":512,"screen":"15.6 FHD"}', 3, 'pcs'),
        ('f0000000-0000-0000-0000-000000000012', 'e0000000-0000-0000-0000-000000000002', 'e1000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', 'Dell', 'Latitude 7440', '{"cpu":"i7-1365U","ram":32,"disk":1024,"screen":"14 FHD+"}', 2, 'pcs'),
        ('f0000000-0000-0000-0000-000000000013', 'e0000000-0000-0000-0000-000000000002', 'e1000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000002', 'HP', 'EliteBook 840 G10', '{"cpu":"i7-1365U","ram":16,"disk":512,"screen":"14 FHD"}', 2, 'pcs'),
        ('f0000000-0000-0000-0000-000000000014', 'e0000000-0000-0000-0000-000000000002', 'e1000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000002', 'HP', 'ProBook 450 G10', '{"cpu":"i5-1345U","ram":8,"disk":256,"screen":"15.6 FHD"}', 3, 'pcs'),
        ('f0000000-0000-0000-0000-000000000015', 'e0000000-0000-0000-0000-000000000002', 'e1000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000003', 'Lenovo', 'ThinkPad T14s Gen 4', '{"cpu":"i7-1365U","ram":16,"disk":512,"screen":"14 FHD+"}', 2, 'pcs'),
        ('f0000000-0000-0000-0000-000000000016', 'e0000000-0000-0000-0000-000000000002', 'e1000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000003', 'Lenovo', 'ThinkPad L14 Gen 4', '{"cpu":"i5-1345U","ram":8,"disk":256,"screen":"14 FHD"}', 3, 'pcs'),
        ('f0000000-0000-0000-0000-000000000017', 'e0000000-0000-0000-0000-000000000002', 'e1000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000006', 'ASUS', 'ExpertBook B5', '{"cpu":"i7-1355U","ram":16,"disk":512,"screen":"13.3 OLED"}', 2, 'pcs'),
        ('f0000000-0000-0000-0000-000000000018', 'e0000000-0000-0000-0000-000000000002', 'e1000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', 'Dell', 'Latitude 3540', '{"cpu":"i3-1315U","ram":8,"disk":256,"screen":"15.6 FHD"}', 3, 'pcs'),
        ('f0000000-0000-0000-0000-000000000019', 'e0000000-0000-0000-0000-000000000002', 'e1000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000002', 'HP', 'ProBook 440 G10', '{"cpu":"i5-1345U","ram":16,"disk":512,"screen":"14 FHD"}', 2, 'pcs'),
        ('f0000000-0000-0000-0000-000000000020', 'e0000000-0000-0000-0000-000000000002', 'e1000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000003', 'Lenovo', 'ThinkPad E14 Gen 5', '{"cpu":"i5-1335U","ram":8,"disk":256,"screen":"14 FHD"}', 3, 'pcs'),
        -- Monitor (8)
        ('f0000000-0000-0000-0000-000000000021', 'e0000000-0000-0000-0000-000000000003', 'e1000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000001', 'Dell', 'P2422H 24"', '{"size":24,"resolution":"1920x1080","panel_type":"IPS"}', 5, 'pcs'),
        ('f0000000-0000-0000-0000-000000000022', 'e0000000-0000-0000-0000-000000000003', 'e1000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000001', 'Dell', 'U2723QE 27" 4K', '{"size":27,"resolution":"3840x2160","panel_type":"IPS"}', 2, 'pcs'),
        ('f0000000-0000-0000-0000-000000000023', 'e0000000-0000-0000-0000-000000000003', 'e1000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000002', 'HP', 'E27 G4 FHD', '{"size":27,"resolution":"1920x1080","panel_type":"IPS"}', 3, 'pcs'),
        ('f0000000-0000-0000-0000-000000000024', 'e0000000-0000-0000-0000-000000000003', 'e1000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000002', 'HP', 'Z27k G3 4K', '{"size":27,"resolution":"3840x2160","panel_type":"IPS"}', 1, 'pcs'),
        ('f0000000-0000-0000-0000-000000000025', 'e0000000-0000-0000-0000-000000000003', 'e1000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000003', 'Lenovo', 'ThinkVision T24i-30', '{"size":24,"resolution":"1920x1080","panel_type":"IPS"}', 3, 'pcs'),
        ('f0000000-0000-0000-0000-000000000026', 'e0000000-0000-0000-0000-000000000003', 'e1000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000009', 'Samsung', 'S24A400', '{"size":24,"resolution":"1920x1080","panel_type":"IPS"}', 3, 'pcs'),
        ('f0000000-0000-0000-0000-000000000027', 'e0000000-0000-0000-0000-000000000003', 'e1000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000006', 'ASUS', 'ProArt PA278QV', '{"size":27,"resolution":"2560x1440","panel_type":"IPS"}', 1, 'pcs'),
        ('f0000000-0000-0000-0000-000000000028', 'e0000000-0000-0000-0000-000000000003', 'e1000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000001', 'Dell', 'P2723QE 27" 4K', '{"size":27,"resolution":"3840x2160","panel_type":"IPS"}', 1, 'pcs'),
        -- Printer (5)
        ('f0000000-0000-0000-0000-000000000031', 'e0000000-0000-0000-0000-000000000004', 'e1000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000002', 'HP', 'LaserJet Pro M404dn', '{"print_type":"Laser","speed":40,"duplex":true}', 2, 'pcs'),
        ('f0000000-0000-0000-0000-000000000032', 'e0000000-0000-0000-0000-000000000004', 'e1000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000010', 'Brother', 'HL-L2350DW', '{"print_type":"Laser","speed":32,"duplex":true}', 2, 'pcs'),
        ('f0000000-0000-0000-0000-000000000033', 'e0000000-0000-0000-0000-000000000004', 'e1000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000010', 'Brother', 'MFC-L2750DW', '{"print_type":"Laser","speed":34,"duplex":true}', 1, 'pcs'),
        ('f0000000-0000-0000-0000-000000000034', 'e0000000-0000-0000-0000-000000000004', 'e1000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000002', 'HP', 'LaserJet Pro M428fdw', '{"print_type":"Laser","speed":38,"duplex":true}', 1, 'pcs'),
        ('f0000000-0000-0000-0000-000000000035', 'e0000000-0000-0000-0000-000000000004', 'e1000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000009', 'Samsung', 'Xpress M2835DW', '{"print_type":"Laser","speed":28,"duplex":true}', 2, 'pcs'),
        -- Network (6)
        ('f0000000-0000-0000-0000-000000000041', 'e0000000-0000-0000-0000-000000000005', 'e1000000-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-000000000004', 'Cisco', 'Catalyst 9200L-24P', '{"ports":24,"speed":"1GbE","poe":true}', 2, 'pcs'),
        ('f0000000-0000-0000-0000-000000000042', 'e0000000-0000-0000-0000-000000000005', 'e1000000-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-000000000004', 'Cisco', 'Catalyst 9300L-48P', '{"ports":48,"speed":"1GbE","poe":true}', 1, 'pcs'),
        ('f0000000-0000-0000-0000-000000000043', 'e0000000-0000-0000-0000-000000000005', 'e1000000-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-000000000005', 'Fortinet', 'FortiSwitch 124F', '{"ports":24,"speed":"1GbE","poe":true}', 1, 'pcs'),
        ('f0000000-0000-0000-0000-000000000044', 'e0000000-0000-0000-0000-000000000005', 'e1000000-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-000000000005', 'Fortinet', 'FortiGate 60F', '{"ports":10,"speed":"10GbE","poe":false}', 1, 'pcs'),
        ('f0000000-0000-0000-0000-000000000045', 'e0000000-0000-0000-0000-000000000005', 'e1000000-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-000000000004', 'Cisco', 'Catalyst 2960X-24TS', '{"ports":24,"speed":"1GbE","poe":false}', 1, 'pcs'),
        ('f0000000-0000-0000-0000-000000000046', 'e0000000-0000-0000-0000-000000000005', 'e1000000-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-000000000005', 'Fortinet', 'FortiAP 231F', '{"ports":2,"speed":"WiFi6","poe":true}', 2, 'pcs'),
        -- Server (5)
        ('f0000000-0000-0000-0000-000000000051', 'e0000000-0000-0000-0000-000000000006', 'e1000000-0000-0000-0000-000000000006', 'b0000000-0000-0000-0000-000000000001', 'Dell', 'PowerEdge R750xs', '{"cpu":"Xeon Gold 5317","ram":128,"disk":"4x1.2TB SAS","form_factor":"2U"}', 1, 'pcs'),
        ('f0000000-0000-0000-0000-000000000052', 'e0000000-0000-0000-0000-000000000006', 'e1000000-0000-0000-0000-000000000006', 'b0000000-0000-0000-0000-000000000002', 'HP', 'ProLiant DL380 G10+', '{"cpu":"Xeon Silver 4314","ram":64,"disk":"4x960GB SSD","form_factor":"2U"}', 1, 'pcs'),
        ('f0000000-0000-0000-0000-000000000053', 'e0000000-0000-0000-0000-000000000006', 'e1000000-0000-0000-0000-000000000006', 'b0000000-0000-0000-0000-000000000003', 'Lenovo', 'ThinkSystem SR650 V2', '{"cpu":"Xeon Gold 5320","ram":128,"disk":"8x1.2TB SAS","form_factor":"2U"}', 1, 'pcs'),
        ('f0000000-0000-0000-0000-000000000054', 'e0000000-0000-0000-0000-000000000006', 'e1000000-0000-0000-0000-000000000006', 'b0000000-0000-0000-0000-000000000001', 'Dell', 'PowerEdge R650xs', '{"cpu":"Xeon Silver 4310","ram":64,"disk":"4x480GB SSD","form_factor":"1U"}', 1, 'pcs'),
        ('f0000000-0000-0000-0000-000000000055', 'e0000000-0000-0000-0000-000000000006', 'e1000000-0000-0000-0000-000000000006', 'b0000000-0000-0000-0000-000000000001', 'Dell', 'PowerEdge T150', '{"cpu":"Xeon E-2324G","ram":16,"disk":"2x2TB SATA","form_factor":"Tower"}', 1, 'pcs'),
        -- Storage (3)
        ('f0000000-0000-0000-0000-000000000061', 'e0000000-0000-0000-0000-000000000007', 'e1000000-0000-0000-0000-000000000007', 'b0000000-0000-0000-0000-000000000007', 'Synology', 'DS1621+', '{"capacity":96,"raid":"RAID5","bays":6}', 1, 'pcs'),
        ('f0000000-0000-0000-0000-000000000062', 'e0000000-0000-0000-0000-000000000007', 'e1000000-0000-0000-0000-000000000007', 'b0000000-0000-0000-0000-000000000007', 'Synology', 'RS1221+', '{"capacity":192,"raid":"RAID6","bays":8}', 1, 'pcs'),
        ('f0000000-0000-0000-0000-000000000063', 'e0000000-0000-0000-0000-000000000007', 'e1000000-0000-0000-0000-000000000007', 'b0000000-0000-0000-0000-000000000007', 'Synology', 'DS220+', '{"capacity":32,"raid":"RAID1","bays":2}', 1, 'pcs'),
        -- UPS (3)
        ('f0000000-0000-0000-0000-000000000071', 'e0000000-0000-0000-0000-000000000014', NULL, 'b0000000-0000-0000-0000-000000000008', 'APC', 'Smart-UPS SRT 3000', '{"capacity":3000,"battery_time":8}', 2, 'pcs'),
        ('f0000000-0000-0000-0000-000000000072', 'e0000000-0000-0000-0000-000000000014', NULL, 'b0000000-0000-0000-0000-000000000008', 'APC', 'Smart-UPS SMT 1500', '{"capacity":1500,"battery_time":12}', 2, 'pcs'),
        ('f0000000-0000-0000-0000-000000000073', 'e0000000-0000-0000-0000-000000000014', NULL, 'b0000000-0000-0000-0000-000000000008', 'APC', 'Back-UPS BX 1100', '{"capacity":1100,"battery_time":15}', 3, 'pcs'),
        -- Camera (3)
        ('f0000000-0000-0000-0000-000000000081', 'e0000000-0000-0000-0000-000000000013', 'e1000000-0000-0000-0000-000000000013', 'b0000000-0000-0000-0000-000000000009', 'Samsung', 'Galaxy A22N 2MP', '{"resolution":"2MP","night_vision":true,"storage":"MicroSD"}', 2, 'pcs'),
        ('f0000000-0000-0000-0000-000000000082', 'e0000000-0000-0000-0000-000000000013', 'e1000000-0000-0000-0000-000000000013', 'b0000000-0000-0000-0000-000000000009', 'Samsung', 'Galaxy A32N 4MP', '{"resolution":"4MP","night_vision":true,"storage":"NVR"}', 2, 'pcs'),
        ('f0000000-0000-0000-0000-000000000083', 'e0000000-0000-0000-0000-000000000013', 'e1000000-0000-0000-0000-000000000013', 'b0000000-0000-0000-0000-000000000009', 'Samsung', 'Galaxy A42N 8MP', '{"resolution":"8MP","night_vision":true,"storage":"NVR"}', 1, 'pcs')
    ON CONFLICT
    (id) DO
    UPDATE SET
  category_id = EXCLUDED.category_id, vendor_id = EXCLUDED.vendor_id, brand = EXCLUDED.brand,
  model = EXCLUDED.model, spec = EXCLUDED.spec, min_stock_qty = EXCLUDED.min_stock_qty;

    -- ============================================================================
    -- 5. WAREHOUSES  (5 kho)
    -- ============================================================================
    INSERT INTO warehouses
        (id, code, name, location_id)
    VALUES
        ('d1000000-0000-0000-0000-000000000001', 'WH-MAIN', E'Kho ch\u00EDnh - Tr\u1EE5 s\u1EDF',  'a0000000-0000-0000-0000-000000000008'),
    ('d1000000-0000-0000-0000-000000000002', 'WH-DC',   E'Kho Data Center',       'a0000000-0000-0000-0000-000000000006'),
    ('d1000000-0000-0000-0000-000000000003', 'WH-HN',   E'Kho chi nh\u00E1nh HN',      'a0000000-0000-0000-0000-000000000007'),
    ('d1000000-0000-0000-0000-000000000004', 'WH-IT',   E'Kho IT ph\u00F2ng CNTT',    'a0000000-0000-0000-0000-000000000003'),
    ('d1000000-0000-0000-0000-000000000005', 'WH-TEMP', E'Kho t\u1EA1m',              'a0000000-0000-0000-0000-000000000001')
ON CONFLICT
    (code) DO
    UPDATE SET name = EXCLUDED.name, location_id = EXCLUDED.location_id;

    -- ============================================================================
    -- 6. SPARE PARTS  (35 linh kien - du test pagination)
    -- ============================================================================
    INSERT INTO spare_parts
        (id, part_code, name, category, uom, manufacturer, model, spec, min_level)
    VALUES
        ('c1000000-0000-0000-0000-000000000001', 'SP-RAM-8G', 'RAM DDR4 8GB 3200MHz', E'B\u1ED9 nh\u1EDB',    'pcs', 'Kingston',      'KVR32N22S8/8',  '{"speed":"3200MHz","type":"DDR4"}', 10),
    ('c1000000-0000-0000-0000-000000000002', 'SP-RAM-16G',   'RAM DDR4 16GB 3200MHz',   E'B\u1ED9 nh\u1EDB',    'pcs', 'Kingston',      'KVR32N22D8/16', '{"speed":"3200MHz","type":"DDR4"}', 5),
    ('c1000000-0000-0000-0000-000000000003', 'SP-RAM-32G',   'RAM DDR4 32GB 3200MHz',   E'B\u1ED9 nh\u1EDB',    'pcs', 'Kingston',      'KVR32N22D8/32', '{"speed":"3200MHz","type":"DDR4"}', 3),
    ('c1000000-0000-0000-0000-000000000004', 'SP-SSD-256',   'SSD NVMe 256GB',          E'\u0110\u0129a c\u1EE9ng',  'pcs', 'Samsung',       '980 PRO 256GB', '{"interface":"NVMe","form":"M.2"}', 10),
    ('c1000000-0000-0000-0000-000000000005', 'SP-SSD-512',   'SSD NVMe 512GB',          E'\u0110\u0129a c\u1EE9ng',  'pcs', 'Samsung',       '980 PRO 512GB', '{"interface":"NVMe","form":"M.2"}', 8),
    ('c1000000-0000-0000-0000-000000000006', 'SP-SSD-1T',    'SSD NVMe 1TB',            E'\u0110\u0129a c\u1EE9ng',  'pcs', 'Samsung',       '980 PRO 1TB',   '{"interface":"NVMe","form":"M.2"}', 5),
    ('c1000000-0000-0000-0000-000000000007', 'SP-HDD-1T',    E'HDD 3.5" SATA 1TB',      E'\u0110\u0129a c\u1EE9ng',  'pcs', 'Seagate',       'Barracuda 1TB', '{"interface":"SATA","rpm":7200}', 5),
    ('c1000000-0000-0000-0000-000000000008', 'SP-HDD-2T',    E'HDD 3.5" SATA 2TB',      E'\u0110\u0129a c\u1EE9ng',  'pcs', 'Seagate',       'Barracuda 2TB', '{"interface":"SATA","rpm":7200}', 3),
    ('c1000000-0000-0000-0000-000000000009', 'SP-FAN-CPU',   E'Qu\u1EA1t t\u1EA3n nhi\u1EC7t CPU',  E'T\u1EA3n nhi\u1EC7t',  'pcs', 'Cooler Master', 'Hyper 212',     '{}', 5),
    ('c1000000-0000-0000-0000-000000000010', 'SP-PSU-500W',  E'Ngu\u1ED3n 500W',             E'Ngu\u1ED3n',      'pcs', 'Corsair',       'CV550',         '{"watt":550}', 3),
    ('c1000000-0000-0000-0000-000000000011', 'SP-PSU-650W',  E'Ngu\u1ED3n 650W',             E'Ngu\u1ED3n',      'pcs', 'Corsair',       'RM650x',        '{"watt":650}', 2),
    ('c1000000-0000-0000-0000-000000000012', 'SP-KB-USB',    E'B\u00E0n ph\u00EDm USB',           E'Ngo\u1EA1i vi',   'pcs', 'Logitech',      'K120',          '{}', 20),
    ('c1000000-0000-0000-0000-000000000013', 'SP-MS-USB',    E'Chu\u1ED9t quang USB',         E'Ngo\u1EA1i vi',   'pcs', 'Logitech',      'M100',          '{}', 20),
    ('c1000000-0000-0000-0000-000000000014', 'SP-KB-WL',     E'B\u00E0n ph\u00EDm kh\u00F4ng d\u00E2y',   E'Ngo\u1EA1i vi',   'pcs', 'Logitech',      'K270',          '{}', 10),
    ('c1000000-0000-0000-0000-000000000015', 'SP-MS-WL',     E'Chu\u1ED9t kh\u00F4ng d\u00E2y',       E'Ngo\u1EA1i vi',   'pcs', 'Logitech',      'M185',          '{}', 10),
    ('c1000000-0000-0000-0000-000000000016', 'SP-CAB-RJ45',  E'C\u00E1p m\u1EA1ng CAT6 3m',      E'C\u00E1p',        'pcs', 'AMP',           'CAT6-3M',       '{"length":"3m","type":"CAT6"}', 50),
    ('c1000000-0000-0000-0000-000000000017', 'SP-CAB-HDMI',  E'C\u00E1p HDMI 2m',            E'C\u00E1p',        'pcs', 'Ugreen',        'HDMI-2M',       '{"length":"2m","version":"2.0"}', 20),
    ('c1000000-0000-0000-0000-000000000018', 'SP-CAB-DP',    E'C\u00E1p DisplayPort 2m',     E'C\u00E1p',        'pcs', 'Ugreen',        'DP-2M',         '{"length":"2m","version":"1.4"}', 10),
    ('c1000000-0000-0000-0000-000000000019', 'SP-CAB-USB3',  E'C\u00E1p USB-C to USB-A 1m',  E'C\u00E1p',        'pcs', 'Anker',         'A8163',         '{"length":"1m","usb":"3.0"}', 15),
    ('c1000000-0000-0000-0000-000000000020', 'SP-TNR-HP',    'HP Toner CF226A',          E'M\u1EF1c in',     'pcs', 'HP',            'CF226A',        '{}', 10),
    ('c1000000-0000-0000-0000-000000000021', 'SP-TNR-BRO',   'Brother Toner TN-2480',    E'M\u1EF1c in',     'pcs', 'Brother',       'TN-2480',       '{}', 10),
    ('c1000000-0000-0000-0000-000000000022', 'SP-TNR-SAM',   'Samsung Toner MLT-D116L',  E'M\u1EF1c in',     'pcs', 'Samsung',       'MLT-D116L',     '{}', 5),
    ('c1000000-0000-0000-0000-000000000023', 'SP-SFP-1G',    'SFP Module 1Gbps',         E'Module m\u1EA1ng', 'pcs', 'Cisco',         'GLC-LH-SM',     '{}', 5),
    ('c1000000-0000-0000-0000-000000000024', 'SP-SFP-10G',   'SFP+ Module 10Gbps',       E'Module m\u1EA1ng', 'pcs', 'Cisco',         'SFP-10G-SR',    '{}', 3),
    ('c1000000-0000-0000-0000-000000000025', 'SP-BAT-UPS',   'Pin UPS 12V 7Ah',          'Pin',         'pcs', 'APC',           'RBC2',          '{"voltage":"12V","capacity":"7Ah"}', 5),
    ('c1000000-0000-0000-0000-000000000026', 'SP-BAT-LAPTOP',E'Pin laptop gi\u1EA3',           'Pin',         'pcs', 'Generic',       'LI-ION',        '{}', 3),
    ('c1000000-0000-0000-0000-000000000027', 'SP-THERM',     E'Keo t\u1EA3n nhi\u1EC7t',          E'T\u1EA3n nhi\u1EC7t',  'tube','Arctic',        'MX-4',          '{}', 10),
    ('c1000000-0000-0000-0000-000000000028', 'SP-SCREEN-P',  E'T\u1EA5m b\u1EA3o v\u1EC7 m\u00E0n h\u00ECnh',  E'Ph\u1EE5 ki\u1EC7n',   'pcs', '3M',            'PF240W',        '{"size":"24 inch"}', 5),
    ('c1000000-0000-0000-0000-000000000029', 'SP-DOCK-USB',  'Hub USB-C 7in1',           E'Ph\u1EE5 ki\u1EC7n',   'pcs', 'Ugreen',        'CM511',         '{}', 5),
    ('c1000000-0000-0000-0000-000000000030', 'SP-WEBCAM',    'Webcam FullHD 1080p',      E'Ngo\u1EA1i vi',   'pcs', 'Logitech',      'C920',          '{"resolution":"1080p"}', 5),
    ('c1000000-0000-0000-0000-000000000031', 'SP-HEADSET',   E'Tai nghe USB',            E'Ngo\u1EA1i vi',   'pcs', 'Jabra',         'Evolve2 30',    '{}', 10),
    ('c1000000-0000-0000-0000-000000000032', 'SP-ADAPTER',   E'S\u1EA1c laptop \u0111a n\u0103ng',     E'Ph\u1EE5 ki\u1EC7n',   'pcs', 'Dell',          '65W Type-C',    '{"watt":65}', 5),
    ('c1000000-0000-0000-0000-000000000033', 'SP-CABLE-PWR', E'D\u00E2y ngu\u1ED3n 3 ch\u1EA5u',       E'C\u00E1p',        'pcs', 'Generic',       'IEC-C13',       '{"length":"1.8m"}', 20),
    ('c1000000-0000-0000-0000-000000000034', 'SP-CPASTE',    E'Keo t\u1EA3n nhi\u1EC7t cao c\u1EA5p',   E'T\u1EA3n nhi\u1EC7t',  'tube','Noctua',        'NT-H1',         '{}', 5),
    ('c1000000-0000-0000-0000-000000000035', 'SP-PAD-COOL',  E'\u0110\u1EBF t\u1EA3n nhi\u1EC7t laptop',    E'Ph\u1EE5 ki\u1EC7n',   'pcs', 'Cooler Master', 'Notepal U2',    '{}', 3)
ON CONFLICT
    (part_code) DO
    UPDATE SET
  name = EXCLUDED.name, category = EXCLUDED.category, manufacturer = EXCLUDED.manufacturer,
  model = EXCLUDED.model, spec = EXCLUDED.spec, min_level = EXCLUDED.min_level;

    -- ============================================================================
    -- 7. LICENSE CATEGORIES  (6 loai)
    -- ============================================================================
    INSERT INTO license_categories
        (id, name, description)
    VALUES
        ('c6000000-0000-0000-0000-000000000001', E'H\u1EC7 \u0111i\u1EC1u h\u00E0nh',        E'License h\u1EC7 \u0111i\u1EC1u h\u00E0nh Windows, macOS, Linux'),
    ('c6000000-0000-0000-0000-000000000002', E'V\u0103n ph\u00F2ng',             E'License Office, Google Workspace'),
    ('c6000000-0000-0000-0000-000000000003', E'B\u1EA3o m\u1EADt',               E'Antivirus, Firewall, Endpoint Protection'),
    ('c6000000-0000-0000-0000-000000000004', E'Ph\u00E1t tri\u1EC3n',            E'IDE, Framework, Dev Tools'),
    ('c6000000-0000-0000-0000-000000000005', E'C\u01A1 s\u1EDF d\u1EEF li\u1EC7u',      E'License database: SQL Server, Oracle, PostgreSQL'),
    ('c6000000-0000-0000-0000-000000000006', E'\u1EA2o h\u00F3a',                E'VMware, Hyper-V, Proxmox')
ON CONFLICT
    (name) DO
    UPDATE SET description = EXCLUDED.description;

    -- ============================================================================
    -- 8. ACCESSORY CATEGORIES  (6 danh muc) & MANUFACTURERS  (5 nha sx)
    -- ============================================================================
    INSERT INTO accessory_categories
        (id, code, name, description, is_active, created_by)
    VALUES
        ('ca000000-0000-0000-0000-000000000001', 'ACC-KB', E'B\u00E0n ph\u00EDm',     E'B\u00E0n ph\u00EDm c\u00E1c lo\u1EA1i',          true, '00000000-0000-0000-0000-000000000001'),
    ('ca000000-0000-0000-0000-000000000002', 'ACC-MOUSE', E'Chu\u1ED9t',         E'Chu\u1ED9t c\u00F3 d\u00E2y v\u00E0 kh\u00F4ng d\u00E2y',        true, '00000000-0000-0000-0000-000000000001'),
    ('ca000000-0000-0000-0000-000000000003', 'ACC-HEAD',  'Headset',     E'Tai nghe c\u00F3 mic',             true, '00000000-0000-0000-0000-000000000001'),
    ('ca000000-0000-0000-0000-000000000004', 'ACC-CABLE', E'C\u00E1p k\u1EBFt n\u1ED1i',  E'C\u00E1p HDMI, USB, DisplayPort',  true, '00000000-0000-0000-0000-000000000001'),
    ('ca000000-0000-0000-0000-000000000005', 'ACC-BAG',   E'T\u00FAi / Balo',    E'T\u00FAi x\u00E1ch, balo laptop',       true, '00000000-0000-0000-0000-000000000001'),
    ('ca000000-0000-0000-0000-000000000006', 'ACC-CHRG',  E'S\u1EA1c / Adapter', E'S\u1EA1c, adapter, dock',          true, '00000000-0000-0000-0000-000000000001')
ON CONFLICT
    (code) DO
    UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description;

    INSERT INTO accessory_manufacturers
        (id, code, name, is_active, created_by)
    VALUES
        ('cb000000-0000-0000-0000-000000000001', 'MFR-LOGI', 'Logitech', true, '00000000-0000-0000-0000-000000000001'),
        ('cb000000-0000-0000-0000-000000000002', 'MFR-RAZER', 'Razer', true, '00000000-0000-0000-0000-000000000001'),
        ('cb000000-0000-0000-0000-000000000003', 'MFR-JABRA', 'Jabra', true, '00000000-0000-0000-0000-000000000001'),
        ('cb000000-0000-0000-0000-000000000004', 'MFR-ANKER', 'Anker', true, '00000000-0000-0000-0000-000000000001'),
        ('cb000000-0000-0000-0000-000000000005', 'MFR-MS', 'Microsoft', true, '00000000-0000-0000-0000-000000000001')
    ON CONFLICT
    (code) DO
    UPDATE SET name = EXCLUDED.name;

    -- ============================================================================
    -- 9. CONSUMABLE CATEGORIES  (5 danh muc) & MANUFACTURERS  (4 nha sx)
    -- ============================================================================
    INSERT INTO consumable_categories
        (id, code, name, description, is_active)
    VALUES
        ('cd000000-0000-0000-0000-000000000001', 'CON-TONER', E'M\u1EF1c in laser',    E'H\u1ED9p m\u1EF1c m\u00E1y in laser',      true),
    ('cd000000-0000-0000-0000-000000000002', 'CON-PAPER', E'Gi\u1EA5y in',         E'Gi\u1EA5y in v\u0103n ph\u00F2ng',         true),
    ('cd000000-0000-0000-0000-000000000003', 'CON-TAPE',  E'B\u0103ng d\u00EDnh / Nh\u00E3n', E'B\u0103ng d\u00EDnh, nh\u00E3n m\u00E1y in',    true),
    ('cd000000-0000-0000-0000-000000000004', 'CON-INK',   E'M\u1EF1c in phun',     E'M\u1EF1c in m\u00E1y inkjet',          true),
    ('cd000000-0000-0000-0000-000000000005', 'CON-PACK',  E'V\u1EADt li\u1EC7u \u0111\u00F3ng g\u00F3i', E'Bao b\u00EC, x\u1ED1p h\u01A1i, h\u1ED9p', true)
ON CONFLICT
    (code) DO
    UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description;

    INSERT INTO consumable_manufacturers
        (id, code, name, is_active)
    VALUES
        ('ce000000-0000-0000-0000-000000000001', 'CM-BROTHER', 'Brother', true),
        ('ce000000-0000-0000-0000-000000000002', 'CM-HP', 'HP', true),
        ('ce000000-0000-0000-0000-000000000003', 'CM-DOUBLE', 'Double A', true),
        ('ce000000-0000-0000-0000-000000000004', 'CM-CANON', 'Canon', true)
    ON CONFLICT
    (code) DO
    UPDATE SET name = EXCLUDED.name;

    -- ============================================================================
    -- 10. COMPONENT CATEGORIES  (6 danh muc) & MANUFACTURERS  (5 nha sx)
    -- ============================================================================
    INSERT INTO component_categories
        (id, code, name, description, is_active, created_by)
    VALUES
        ('d2000000-0000-0000-0000-000000000001', 'COMP-RAM', 'RAM', E'B\u1ED9 nh\u1EDB RAM',            true, '00000000-0000-0000-0000-000000000001'),
    ('d2000000-0000-0000-0000-000000000002', 'COMP-SSD',  E'\u0110\u0129a SSD',   E'\u0110\u0129a c\u1EE9ng SSD',           true, '00000000-0000-0000-0000-000000000001'),
    ('d2000000-0000-0000-0000-000000000003', 'COMP-HDD',  E'\u0110\u0129a HDD',   E'\u0110\u0129a c\u1EE9ng HDD',           true, '00000000-0000-0000-0000-000000000001'),
    ('d2000000-0000-0000-0000-000000000004', 'COMP-GPU',  'Card VGA',   E'Card \u0111\u1ED3 h\u1ECDa',            true, '00000000-0000-0000-0000-000000000001'),
    ('d2000000-0000-0000-0000-000000000005', 'COMP-NIC',  'Card NIC',   E'Card m\u1EA1ng',               true, '00000000-0000-0000-0000-000000000001'),
    ('d2000000-0000-0000-0000-000000000006', 'COMP-MAIN', 'Mainboard',  E'Bo m\u1EA1ch ch\u1EE7',            true, '00000000-0000-0000-0000-000000000001')
ON CONFLICT
    (code) DO
    UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description;

    INSERT INTO component_manufacturers
        (id, code, name, is_active, created_by)
    VALUES
        ('d3000000-0000-0000-0000-000000000001', 'CMFR-KINGSTON', 'Kingston', true, '00000000-0000-0000-0000-000000000001'),
        ('d3000000-0000-0000-0000-000000000002', 'CMFR-SAMSUNG', 'Samsung', true, '00000000-0000-0000-0000-000000000001'),
        ('d3000000-0000-0000-0000-000000000003', 'CMFR-INTEL', 'Intel', true, '00000000-0000-0000-0000-000000000001'),
        ('d3000000-0000-0000-0000-000000000004', 'CMFR-WD', 'Western Digital', true, '00000000-0000-0000-0000-000000000001'),
        ('d3000000-0000-0000-0000-000000000005', 'CMFR-SEAGATE', 'Seagate', true, '00000000-0000-0000-0000-000000000001')
    ON CONFLICT
    (code) DO
    UPDATE SET name = EXCLUDED.name;

    -- ============================================================================
    -- TOTAL CATALOG ROWS:
    --   20 asset categories
    --   10 spec versions
    --   31 spec definitions
    --   53 asset models
    --    5 warehouses
    --   35 spare parts
    --    6 license categories
    --    6 accessory categories + 5 manufacturers
    --    5 consumable categories + 4 manufacturers
    --    6 component categories + 5 manufacturers
    --   = 191 rows (well above 100 for pagination testing)
    -- ============================================================================

    COMMIT;
