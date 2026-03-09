-- =============================================================================
-- SEED: ANALYTICS, DASHBOARDS, LABELS, PRINT JOBS, COMPLIANCE, ASSET METRICS
-- =============================================================================
BEGIN;

    -- Reset compliance tables (they may have rows from previous seeds with different IDs)
    TRUNCATE TABLE compliance_assessments
    , compliance_controls, compliance_frameworks RESTART IDENTITY CASCADE;

    -- ============================================================================
    -- 1. COMPLIANCE FRAMEWORKS
    -- Actual columns: id, code, name, description, version, is_active
    -- ============================================================================
    INSERT INTO compliance_frameworks
        (id, code, name, version, description, is_active)
    VALUES
        ('cf000000-0000-0000-0000-000000000001', 'ISO27001', 'ISO/IEC 27001:2022', '2022', 'He thong quan ly an ninh thong tin', true),
        ('cf000000-0000-0000-0000-000000000002', 'COBIT', 'COBIT 2019', '2019', 'Kiem soat va quan tri CNTT doanh nghiep', true),
        ('cf000000-0000-0000-0000-000000000003', 'NIST', 'NIST Cybersecurity Framework', '1.1', 'Khung an ninh mang NIST', true)
    ON CONFLICT
    (code) DO NOTHING;

-- ============================================================================
-- 2. COMPLIANCE CONTROLS
-- Actual columns: id, framework_id, control_code, title, description, category,
--                 check_type ('manual'/'automated'/'semi_automated'), severity
-- NO status column
-- ============================================================================
INSERT INTO compliance_controls
    (id, framework_id, control_code, title, description, category, check_type, severity)
VALUES
    ('cc000000-0000-0000-0000-000000000001', 'cf000000-0000-0000-0000-000000000001', 'A.8.1', 'Asset Inventory', 'Duy tri danh muc tai san thong tin', 'Asset Management', 'manual', 'high'),
    ('cc000000-0000-0000-0000-000000000002', 'cf000000-0000-0000-0000-000000000001', 'A.8.2', 'Ownership of Assets', 'Gan chu so huu cho tai san', 'Asset Management', 'manual', 'medium'),
    ('cc000000-0000-0000-0000-000000000003', 'cf000000-0000-0000-0000-000000000001', 'A.9.2', 'User Access Management', 'Quan ly quyen truy cap nguoi dung', 'Access Control', 'semi_automated', 'high'),
    ('cc000000-0000-0000-0000-000000000004', 'cf000000-0000-0000-0000-000000000002', 'BAI09', 'Manage Assets', 'Quan ly tai san CNTT', 'Build, Acquire and Implement', 'manual', 'medium'),
    ('cc000000-0000-0000-0000-000000000005', 'cf000000-0000-0000-0000-000000000003', 'ID.AM-1', 'Asset Identification', 'Kiem ke thiet bi vat ly', 'Identify', 'automated', 'high'),
    ('cc000000-0000-0000-0000-000000000006', 'cf000000-0000-0000-0000-000000000003', 'PR.AC-1', 'Access Credentials', 'Quan ly thong tin xac thuc', 'Protect', 'semi_automated', 'high'),
    ('cc000000-0000-0000-0000-000000000007', 'cf000000-0000-0000-0000-000000000001', 'A.12.1', 'Change Management', 'Quan ly thay doi he thong', 'Operations Security', 'manual', 'medium'),
    ('cc000000-0000-0000-0000-000000000008', 'cf000000-0000-0000-0000-000000000002', 'DSS05', 'Manage Security Services', 'Quan ly dich vu bao mat', 'Deliver, Service and Support', 'manual', 'high')
ON CONFLICT
(id) DO NOTHING;

-- ============================================================================
-- 3. COMPLIANCE ASSESSMENTS
-- Actual columns: id, framework_id, assessment_date, total_controls,
--   passed_controls, failed_controls, not_applicable, score,
--   status ('in_progress'/'completed'/'reviewed'),
--   assessed_by (varchar100), results (jsonb)
-- ============================================================================
INSERT INTO compliance_assessments
    (id, framework_id, assessment_date, total_controls, passed_controls,
    failed_controls, not_applicable, score, status, assessed_by, results)
VALUES
    ('ca100000-0000-0000-0000-000000000001', 'cf000000-0000-0000-0000-000000000001', '2024-03-01', 8, 6, 1, 1, 87.50, 'completed', 'Nguyen Van B - IT Manager',
        '[{"control":"A.8.1","result":"pass"},{"control":"A.8.2","result":"pass"},{"control":"A.9.2","result":"fail"},{"control":"A.12.1","result":"pass"}]'
::jsonb),
('ca100000-0000-0000-0000-000000000002','cf000000-0000-0000-0000-000000000002','2024-03-15',2,1,1,0,75.00,'reviewed','Nguyen Van B - IT Manager',
     '[{"control":"BAI09","result":"pass"},{"control":"DSS05","result":"fail"}]'::jsonb),
('ca100000-0000-0000-0000-000000000003','cf000000-0000-0000-0000-000000000003','2024-04-01',2,2,0,0,95.00,'completed','Tran Thi C - Auditor',
     '[{"control":"ID.AM-1","result":"pass"},{"control":"PR.AC-1","result":"pass"}]'::jsonb)
ON CONFLICT
(id) DO NOTHING;

-- ============================================================================
-- 4. REPORT DEFINITIONS
-- Actual columns: id, name, description,
--   report_type ('dashboard'/'tabular'/'chart'/'scheduled'),
--   data_source, fields, filters, access_level ('all'/'admin'/'asset_manager'/'custom'),
--   is_builtin, is_active, organization_id, created_by
-- report_code auto-generated by trigger
-- NO sort_config, NO is_system, NO status
-- ============================================================================
INSERT INTO report_definitions
    (id, name, description, report_type, data_source,
    fields, filters, access_level, is_builtin, is_active,
    organization_id, created_by)
VALUES
    ('0f000000-0000-0000-0000-000000000001', 'Danh sach tai san hien hanh', 'Bao cao toan bo tai san dang quan ly', 'tabular', 'assets',
        '["asset_code","name","category","status","location","assigned_to"]'
::jsonb,
     '{"status":["active","in_use"]}'::jsonb,
     'all',true,true,
     'd0000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002'),
('0f000000-0000-0000-0000-000000000002','Bao cao khau hao tai san','Khau hao luy ke tat ca tai san','tabular','depreciation_schedules',
     '["asset_code","name","original_cost","accumulated","book_value","schedule_end"]'::jsonb,
     '{"status":"active"}'::jsonb,
     'all',true,true,
     'd0000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002'),
('0f000000-0000-0000-0000-000000000003','Ket qua kiem ke thuc dia','Bao cao ket qua kiem ke dinh ky','tabular','audit_sessions',
     '["session_name","start_date","total_items","audited","passed","failed"]'::jsonb,
     '{}'::jsonb,
     'all',true,true,
     'd0000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002'),
('0f000000-0000-0000-0000-000000000004','Bao cao bao tri sua chua','Tong hop phieu bao tri va sua chua','tabular','maintenance_tickets',
     '["ticket_code","asset","type","status","priority","cost","completed_at"]'::jsonb,
     '{"period":"last_90_days"}'::jsonb,
     'all',true,true,
     'd0000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002'),
('0f000000-0000-0000-0000-000000000005','Phan tich chi phi tai san','Tong chi phi mua sam bao tri sua chua','chart','assets',
     '["category","purchase_cost","maintenance_cost","repair_cost","total_cost"]'::jsonb,
     '{"year":2024}'::jsonb,
     'all',false,true,
     'd0000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001')
ON CONFLICT
(id) DO NOTHING;

-- ============================================================================
-- 5. REPORT EXECUTIONS
-- Actual columns: id, report_id, execution_type ('manual'/'scheduled'),
--   status ('pending'/'running'/'completed'/'failed'),
--   filters_used (jsonb), row_count, file_path, file_format, file_size_bytes,
--   started_at, completed_at, duration_ms, error_message,
--   recipients, delivery_status, delivery_error, executed_by (UUID)
-- NO triggered_by, total_rows, file_key
-- ============================================================================
INSERT INTO report_executions
    (id, report_id, execution_type, status, filters_used, row_count,
    file_format, file_path, file_size_bytes, started_at, completed_at,
    duration_ms, executed_by)
VALUES
    ('0f100000-0000-0000-0000-000000000001', '0f000000-0000-0000-0000-000000000001', 'manual', 'completed', '{"status":["active","in_use"]}'
::jsonb,50,
     'xlsx','reports/2024/03/asset-list-20240301.xlsx',204800,'2024-03-01 08:00:00','2024-03-01 08:00:05',5000,'00000000-0000-0000-0000-000000000002'),
('0f100000-0000-0000-0000-000000000002','0f000000-0000-0000-0000-000000000002','manual','completed','{"status":"active"}'::jsonb,10,
     'xlsx','reports/2024/03/depreciation-20240301.xlsx',81920,'2024-03-01 08:01:00','2024-03-01 08:01:03',3000,'00000000-0000-0000-0000-000000000002'),
('0f100000-0000-0000-0000-000000000003','0f000000-0000-0000-0000-000000000003','manual','completed','{}'::jsonb,2,
     'pdf','reports/2024/04/audit-report-20240401.pdf',163840,'2024-04-01 09:00:00','2024-04-01 09:00:04',4000,'00000000-0000-0000-0000-000000000002'),
('0f100000-0000-0000-0000-000000000004','0f000000-0000-0000-0000-000000000005','manual','failed','{"year":2024}'::jsonb,NULL,
     'xlsx',NULL,NULL,'2024-03-15 10:00:00','2024-03-15 10:00:02',2000,'00000000-0000-0000-0000-000000000001'),
('0f100000-0000-0000-0000-000000000005','0f000000-0000-0000-0000-000000000001','scheduled','running','{}'::jsonb,NULL,
     'xlsx',NULL,NULL,'2024-04-10 14:00:00',NULL,NULL,'00000000-0000-0000-0000-000000000002')
ON CONFLICT
(id) DO NOTHING;

-- ============================================================================
-- 6. DASHBOARD CONFIGS
-- Actual columns: id, user_id (varchar100), name, layout (jsonb),
--                 widgets (jsonb), is_default
-- NO description, dashboard_type, owner_id, is_public, layout_config
-- ============================================================================
INSERT INTO dashboard_configs
    (id, user_id, name, layout, widgets, is_default)
VALUES
    ('dc000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'Dashboard Quan ly Tai san',
        '[{"x":0,"y":0,"w":4,"h":2},{"x":4,"y":0,"w":4,"h":2},{"x":0,"y":2,"w":8,"h":4}]'
::jsonb,
     '["dc100000-0000-0000-0000-000000000001","dc100000-0000-0000-0000-000000000002","dc100000-0000-0000-0000-000000000003"]'::jsonb,
     true),
('dc000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000002','Dashboard CNTT Ha tang',
     '[{"x":0,"y":0,"w":8,"h":3},{"x":0,"y":3,"w":4,"h":3}]'::jsonb,
     '["dc100000-0000-0000-0000-000000000004","dc100000-0000-0000-0000-000000000005"]'::jsonb,
     false),
('dc000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000001','Dashboard Cap cao',
     '[{"x":0,"y":0,"w":4,"h":2},{"x":4,"y":0,"w":4,"h":4}]'::jsonb,
     '["dc100000-0000-0000-0000-000000000001","dc100000-0000-0000-0000-000000000006"]'::jsonb,
     true)
ON CONFLICT
(id) DO
UPDATE SET name = EXCLUDED.name;

-- ============================================================================
-- 7. DASHBOARD WIDGETS (widget library, not per-dashboard)
-- Actual columns: id, widget_code (UNIQUE), name, description, widget_type,
--   data_source, data_query, data_config (jsonb), default_size,
--   min_width, min_height, refresh_interval, is_builtin, is_active,
--   organization_id, created_by
-- widget_type: 'pie_chart'/'bar_chart'/'line_chart'/'stat_card'/'table'/
--              'timeline'/'list'/'map'
-- ============================================================================
INSERT INTO dashboard_widgets
    (id, widget_code, name, description, widget_type, data_source,
    data_config, default_size, is_builtin, is_active,
    organization_id, created_by)
VALUES
    ('dc100000-0000-0000-0000-000000000001', 'WGT-TOTAL-ASSETS', 'Tong so tai san', 'Hien thi tong so tai san dang quan ly', 'stat_card', 'assets',
        '{"metric":"count","filter":{"status":"active"}}'
::jsonb,'medium',true,true,
     'd0000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002'),
('dc100000-0000-0000-0000-000000000002','WGT-IN-USE-ASSETS','Tai san dang su dung','So tai san dang duoc su dung','stat_card','assets',
     '{"metric":"count","filter":{"status":"in_use"}}'::jsonb,'medium',true,true,
     'd0000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002'),
('dc100000-0000-0000-0000-000000000003','WGT-OPEN-TICKETS','Yeu cau bao tri mo','So phieu bao tri dang cho xu ly','stat_card','maintenance_tickets',
     '{"metric":"count","filter":{"status":"open"}}'::jsonb,'medium',true,true,
     'd0000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002'),
('dc100000-0000-0000-0000-000000000004','WGT-ASSET-BY-CAT','Tai san theo danh muc','Bieu do tron phan tich tai san theo danh muc','pie_chart','assets',
     '{"group_by":"category","limit":10}'::jsonb,'large',true,true,
     'd0000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002'),
('dc100000-0000-0000-0000-000000000005','WGT-ASSET-BY-STATUS','Tai san theo trang thai','Bieu do cot theo trang thai tai san','bar_chart','assets',
     '{"group_by":"status"}'::jsonb,'large',true,true,
     'd0000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002'),
('dc100000-0000-0000-0000-000000000006','WGT-TOTAL-VALUE','Tong gia tri tai san','Tong gia tri tai san theo gia mua','stat_card','assets',
     '{"metric":"sum","field":"purchase_cost"}'::jsonb,'medium',true,true,
     'd0000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001'),
('dc100000-0000-0000-0000-000000000007','WGT-DEPR-MONTHLY','Khau hao theo thang','Bieu do duong khau hao 12 thang gan nhat','line_chart','depreciation_entries',
     '{"period":"last_12_months","group_by":"period_month"}'::jsonb,'large',true,true,
     'd0000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001'),
('dc100000-0000-0000-0000-000000000008','WGT-RECENT-MAINT','Bao tri gan day','Danh sach phieu bao tri moi nhat','table','maintenance_tickets',
     '{"limit":10,"sort":"scheduled_date desc"}'::jsonb,'large',true,true,
     'd0000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002')
ON CONFLICT
(widget_code) DO NOTHING;

-- ============================================================================
-- 8. USER DASHBOARD LAYOUTS
-- Actual columns: id, user_id (UUID), dashboard_type, layout (jsonb)
-- UNIQUE on (user_id, dashboard_type)
-- ============================================================================
INSERT INTO user_dashboard_layouts
    (id, user_id, dashboard_type, layout)
VALUES
    ('dc200000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'main',
        '[{"widget_id":"dc100000-0000-0000-0000-000000000001","x":0,"y":0,"w":3,"h":2},{"widget_id":"dc100000-0000-0000-0000-000000000006","x":3,"y":0,"w":3,"h":2}]'
::jsonb),
('dc200000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000002','main',
     '[{"widget_id":"dc100000-0000-0000-0000-000000000001","x":0,"y":0,"w":3,"h":2},{"widget_id":"dc100000-0000-0000-0000-000000000002","x":3,"y":0,"w":3,"h":2},{"widget_id":"dc100000-0000-0000-0000-000000000004","x":0,"y":2,"w":6,"h":4}]'::jsonb),
('dc200000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000005','main',
     '[{"widget_id":"dc100000-0000-0000-0000-000000000008","x":0,"y":0,"w":12,"h":4}]'::jsonb),
('dc200000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000006','main',
     '[{"widget_id":"dc100000-0000-0000-0000-000000000005","x":0,"y":0,"w":6,"h":4}]'::jsonb)
ON CONFLICT
(user_id, dashboard_type) DO
UPDATE SET layout = EXCLUDED.layout;

-- ============================================================================
-- 9. LABEL TEMPLATES
-- Actual columns: id, template_code (auto-gen trigger), name, description,
--   label_type ('barcode'/'qrcode'/'combined'),
--   size_preset ('small'/'medium'/'large'/'custom'),
--   width_mm, height_mm, layout, fields, barcode_type, include_logo,
--   include_company_name, font_family, font_size, is_default, is_active,
--   organization_id, created_by
-- NO paper_size, label_per_row, label_per_col, status
-- ============================================================================
INSERT INTO label_templates
    (id, name, description, label_type, size_preset, width_mm, height_mm,
    layout, fields, barcode_type, include_logo, is_default, is_active,
    organization_id, created_by)
VALUES
    ('dc300000-0000-0000-0000-000000000001', 'Nhan tai san kho A4', 'Nhan chuan in tren kho A4',
        'combined', 'medium', 63.5, 38.1,
        '{"orientation":"portrait","margin":{"top":10,"left":5,"right":5,"bottom":10}}'
::jsonb,
     '["asset_code","name","qr_code","location"]'::jsonb,
     'qrcode',true,true,true,
     'd0000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002'),
('dc300000-0000-0000-0000-000000000002','Nhan nho thiet bi','Nhan in cho thiet bi nho',
     'qrcode','small',36,19,
     '{"orientation":"portrait","margin":{"top":5,"left":3,"right":3,"bottom":5}}'::jsonb,
     '["asset_code","qr_code"]'::jsonb,
     'qrcode',false,false,true,
     'd0000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002'),
('dc300000-0000-0000-0000-000000000003','Nhan phu tung kho','Nhan cho linh kien trong kho',
     'combined','large',55,35,
     '{"orientation":"landscape","margin":{"top":8,"left":8,"right":8,"bottom":8}}'::jsonb,
     '["part_code","name","lot_number","warehouse"]'::jsonb,
     'code128',false,false,true,
     'd0000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000003')
ON CONFLICT
(id) DO NOTHING;

-- ============================================================================
-- 10. LABEL SETTINGS
-- Actual columns: id, setting_key, setting_value, value_type, description,
--                 organization_id, updated_by
-- UNIQUE on (setting_key, organization_id)
-- ============================================================================
INSERT INTO label_settings
    (id, setting_key, setting_value, value_type, description, organization_id)
VALUES
    ('dc400000-0000-0000-0000-000000000001', 'default_template_id', 'dc300000-0000-0000-0000-000000000001', 'string', 'Nhan mac dinh khi in nhanh', 'd0000000-0000-0000-0000-000000000001'),
    ('dc400000-0000-0000-0000-000000000002', 'qr_code_size', 'medium', 'string', 'Kich thuoc ma QR tren nhan', 'd0000000-0000-0000-0000-000000000001'),
    ('dc400000-0000-0000-0000-000000000003', 'include_logo', 'true', 'boolean', 'In logo cong ty tren nhan', 'd0000000-0000-0000-0000-000000000001')
ON CONFLICT
(id) DO NOTHING;

-- ============================================================================
-- 11. PRINT JOBS
-- Actual columns: id, job_code (auto-gen trigger), template_id, asset_ids (jsonb),
--   asset_count, copies_per_asset, total_labels, printer_name, paper_size,
--   status ('queued'/'processing'/'completed'/'failed'/'cancelled'),
--   error_message, output_type, output_url, started_at, completed_at,
--   organization_id, created_by (UUID FK)
-- NO notes, printed_at, printed_count
-- ============================================================================
INSERT INTO print_jobs
    (id, template_id, asset_ids, asset_count, copies_per_asset, total_labels,
    status, started_at, completed_at, organization_id, created_by)
VALUES
    ('dc500000-0000-0000-0000-000000000001', 'dc300000-0000-0000-0000-000000000001',
        '["a1000000-0000-0000-0000-000000000001","a1000000-0000-0000-0000-000000000002","a1000000-0000-0000-0000-000000000011"]'
::jsonb,
     3,1,3,'completed','2024-01-20 09:30:00','2024-01-20 09:31:00',
     'd0000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000003'),
('dc500000-0000-0000-0000-000000000002','dc300000-0000-0000-0000-000000000002',
     '["a1000000-0000-0000-0000-000000000021","a1000000-0000-0000-0000-000000000022"]'::jsonb,
     2,1,2,'completed','2024-02-10 11:00:00','2024-02-10 11:01:00',
     'd0000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000003'),
('dc500000-0000-0000-0000-000000000003','dc300000-0000-0000-0000-000000000001',
     '["a1000000-0000-0000-0000-000000000034","a1000000-0000-0000-0000-000000000035"]'::jsonb,
     2,1,2,'queued',NULL,NULL,
     'd0000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000003')
ON CONFLICT
(id) DO NOTHING;

-- ============================================================================
-- 12. PRINT JOB ITEMS
-- Actual columns: id, print_job_id, asset_id, copy_number, status,
--                 error_message, label_data
-- NO job_id, copies, printed_at
-- ============================================================================
INSERT INTO print_job_items
    (id, print_job_id, asset_id, copy_number, status)
VALUES
    ('dc600000-0000-0000-0000-000000000001', 'dc500000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 1, 'completed'),
    ('dc600000-0000-0000-0000-000000000002', 'dc500000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000002', 1, 'completed'),
    ('dc600000-0000-0000-0000-000000000003', 'dc500000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000011', 1, 'completed'),
    ('dc600000-0000-0000-0000-000000000004', 'dc500000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000021', 1, 'completed'),
    ('dc600000-0000-0000-0000-000000000005', 'dc500000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000034', 1, 'pending'),
    ('dc600000-0000-0000-0000-000000000006', 'dc500000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000035', 1, 'pending')
ON CONFLICT
(id) DO NOTHING;

-- ============================================================================
-- 13. ASSET ANALYTICS SNAPSHOTS
-- Actual columns: id, snapshot_date (UNIQUE), total_assets, active_assets,
--   in_repair_assets, disposed_assets, unassigned_assets,
--   warranty_expiring_30d, warranty_expired,
--   total_maintenance_tickets, open_tickets, avg_repair_hours,
--   category_breakdown (jsonb), location_breakdown (jsonb), vendor_breakdown (jsonb)
-- NOT per-asset - org-level daily snapshot
-- ============================================================================
INSERT INTO asset_analytics_snapshots
    (id, snapshot_date, total_assets, active_assets, in_repair_assets,
    disposed_assets, unassigned_assets, warranty_expiring_30d, warranty_expired,
    total_maintenance_tickets, open_tickets, avg_repair_hours,
    category_breakdown, location_breakdown, vendor_breakdown)
VALUES
    ('dc700000-0000-0000-0000-000000000001', '2024-01-31', 52, 40, 3, 2, 7, 5, 8, 12, 4, 2.50,
        '{"May tinh":20,"Laptop":15,"May in":5,"Server":3,"Switch":2,"Khac":7}'
::jsonb,
     '{"Van phong tang 3":18,"Phong server":8,"Kho thiet bi":10,"Khac":16}'::jsonb,
     '{"Dell":15,"HP":12,"Cisco":5,"Lenovo":8,"Khac":12}'::jsonb),
('dc700000-0000-0000-0000-000000000002','2024-02-29',54,42,2,2,8,4,9,15,5,2.30,
     '{"May tinh":21,"Laptop":16,"May in":5,"Server":3,"Switch":2,"Khac":7}'::jsonb,
     '{"Van phong tang 3":19,"Phong server":8,"Kho thiet bi":10,"Khac":17}'::jsonb,
     '{"Dell":16,"HP":12,"Cisco":5,"Lenovo":9,"Khac":12}'::jsonb),
('dc700000-0000-0000-0000-000000000003','2024-03-31',56,44,2,3,7,3,10,18,3,1.80,
     '{"May tinh":22,"Laptop":17,"May in":5,"Server":3,"Switch":2,"Khac":7}'::jsonb,
     '{"Van phong tang 3":20,"Phong server":8,"Kho thiet bi":11,"Khac":17}'::jsonb,
     '{"Dell":17,"HP":13,"Cisco":5,"Lenovo":9,"Khac":12}'::jsonb)
ON CONFLICT
(snapshot_date) DO
UPDATE SET
    total_assets = EXCLUDED.total_assets,
    active_assets = EXCLUDED.active_assets;

-- ============================================================================
-- 14. ASSET COST RECORDS
-- Actual columns: id, asset_id, cost_type, amount, currency,
--                 description, recorded_date, recorded_by (varchar100)
-- NO cost_date, ref_doc_type, ref_doc_id, created_by
-- cost_type: 'purchase'/'maintenance'/'repair'/'upgrade'/'disposal'/'other'
-- ============================================================================
INSERT INTO asset_cost_records
    (id, asset_id, cost_type, amount, currency, description, recorded_date, recorded_by)
VALUES
    ('dc800000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 'purchase', 15000000, 'VND', 'Chi phi mua PC Desktop HP EliteDesk 800', '2023-01-15', 'Nguyen Van C - Kho'),
    ('dc800000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000001', 'maintenance', 450000, 'VND', 'Ve sinh may dinh ky', '2023-06-15', 'Nguyen Van C - Kho'),
    ('dc800000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000011', 'purchase', 28000000, 'VND', 'Chi phi mua Laptop Dell Latitude 5540', '2023-01-20', 'Nguyen Van C - Kho'),
    ('dc800000-0000-0000-0000-000000000004', 'a1000000-0000-0000-0000-000000000011', 'repair', 2500000, 'VND', 'Thay pin laptop', '2023-09-10', 'Nguyen Van C - Kho'),
    ('dc800000-0000-0000-0000-000000000005', 'a1000000-0000-0000-0000-000000000034', 'purchase', 180000000, 'VND', 'Chi phi mua Server HP ProLiant DL380 Gen10', '2022-01-01', 'Nguyen Van C - Kho'),
    ('dc800000-0000-0000-0000-000000000006', 'a1000000-0000-0000-0000-000000000034', 'maintenance', 3500000, 'VND', 'Bao tri server dinh ky', '2023-03-15', 'Nguyen Van C - Kho'),
    ('dc800000-0000-0000-0000-000000000007', 'a1000000-0000-0000-0000-000000000016', 'purchase', 45000000, 'VND', 'Chi phi mua Cisco Catalyst Core Switch', '2022-03-01', 'Nguyen Van C - Kho'),
    ('dc800000-0000-0000-0000-000000000008', 'a1000000-0000-0000-0000-000000000020', 'purchase', 95000000, 'VND', 'Chi phi mua Synology RS1221+ NAS Backup', '2022-03-01', 'Nguyen Van C - Kho')
ON CONFLICT
(id) DO NOTHING;

-- ============================================================================
-- 15. ASSET PERFORMANCE METRICS
-- Actual columns: id, asset_id, metric_type, metric_value, unit,
--                 recorded_at (timestamptz), metadata (jsonb)
-- metric_type: 'uptime'/'response_time'/'error_rate'/'utilization'/
--              'throughput'/'temperature'/'custom'
-- NO metric_date, value, source, notes
-- ============================================================================
INSERT INTO asset_performance_metrics
    (id, asset_id, metric_type, metric_value, unit, recorded_at, metadata)
VALUES
    ('dc900000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000034', 'utilization', 42.5, 'percent', '2024-03-01 00:00:00', '{"source":"prometheus","label":"cpu_utilization"}'
::jsonb),
('dc900000-0000-0000-0000-000000000002','a1000000-0000-0000-0000-000000000034','utilization',68.3,'percent','2024-03-01 01:00:00','{"source":"prometheus","label":"memory_utilization"}'::jsonb),
('dc900000-0000-0000-0000-000000000003','a1000000-0000-0000-0000-000000000034','throughput',325.7,'mbps','2024-03-01 02:00:00','{"source":"prometheus","label":"disk_io_mbps"}'::jsonb),
('dc900000-0000-0000-0000-000000000004','a1000000-0000-0000-0000-000000000016','utilization',75.0,'percent','2024-03-01 00:00:00','{"source":"snmp","label":"port_utilization"}'::jsonb),
('dc900000-0000-0000-0000-000000000005','a1000000-0000-0000-0000-000000000016','throughput',456.2,'mbps','2024-03-01 00:00:00','{"source":"snmp","label":"throughput_mbps"}'::jsonb),
('dc900000-0000-0000-0000-000000000006','a1000000-0000-0000-0000-000000000020','utilization',63.4,'percent','2024-03-01 00:00:00','{"source":"agent","label":"disk_usage_pct"}'::jsonb),
('dc900000-0000-0000-0000-000000000007','a1000000-0000-0000-0000-000000000035','utilization',28.1,'percent','2024-03-01 00:00:00','{"source":"prometheus","label":"cpu_utilization"}'::jsonb),
('dc900000-0000-0000-0000-000000000008','a1000000-0000-0000-0000-000000000035','utilization',71.5,'percent','2024-03-01 01:00:00','{"source":"prometheus","label":"memory_utilization"}'::jsonb)
ON CONFLICT
(id) DO NOTHING;

-- ============================================================================
-- 16. ASSET CONSUMPTION LOGS
-- Actual columns: id, model_id (FK asset_models), consumption_date, quantity,
--                 reason, ref_doc_type, ref_doc_id, note, created_by (varchar)
-- model_id references asset_models table
-- ============================================================================
INSERT INTO asset_consumption_logs
    (id, model_id, consumption_date, quantity, reason, note, created_by)
VALUES
    ('dca00000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000073', '2024-02-01', 1, 'Toner het sau 3 thang su dung', 'Thay toner may in Canon MF4450', 'nguyen.van.c'),
    ('dca00000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-000000000073', '2024-02-15', 1, 'Toner HP LaserJet het', 'Thay toner HP LaserJet Pro M402', 'tran.thi.d'),
    ('dca00000-0000-0000-0000-000000000003', 'f0000000-0000-0000-0000-000000000001', '2024-01-15', 1, 'Chuot hong thay moi', 'Thay chuot USB cho PC HP EliteDesk', 'le.van.e'),
    ('dca00000-0000-0000-0000-000000000004', 'f0000000-0000-0000-0000-000000000041', '2024-03-01', 2, 'Thay pin UPS theo lich bao tri', 'Pin UPS APC Back-UPS 650VA het han', 'pham.van.f')
ON CONFLICT
(id) DO NOTHING;

COMMIT;
