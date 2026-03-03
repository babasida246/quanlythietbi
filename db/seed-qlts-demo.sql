-- ============================================================================
-- seed-qlts-demo.sql — Dữ liệu demo CMDB, Workflow, Purchase Plans
-- Bao gồm: CMDB CIs & Relationships, Services, Purchase Plans,
--   Asset Increase Docs, Consumption Logs
-- Chạy SAU seed-assets-management.sql
-- ============================================================================

BEGIN;

    -- ============================================================================
    -- 1. CMDB CONFIGURATION ITEMS (CIs) — Hạ tầng CNTT thực tế
    -- ============================================================================
    INSERT INTO cmdb_cis
        (id, type_id, asset_id, location_id, name, ci_code, status, environment, owner_team, notes, metadata, created_at, updated_at)
    VALUES
        -- Servers (vật lý – liên kết asset)
        ('ca100000-0000-0000-0000-000000000001',
            (SELECT id
            FROM cmdb_ci_types
            WHERE code='server'
    LIMIT 1),
     'ee100000-0000-0000-0000-000000000011',
     'cc100000-0000-0000-0000-000000000005',
     'srv-app-01 (Dell PowerEdge R750xs)', 'CI-SRV-APP01', 'active', 'prod',
     'Phòng CNTT', 'Server ứng dụng ERP/HRM',
     '{"os":"Ubuntu 22.04 LTS","cpu":"2x Xeon Silver 4314","ram":"64 GB","rack":"A1-U20"}'::jsonb, NOW
    (), NOW
    ()),
    ('ca100000-0000-0000-0000-000000000002',
    (SELECT id
    FROM cmdb_ci_types
    WHERE code='server'
    LIMIT 1),
     'ee100000-0000-0000-0000-000000000012',
     'cc100000-0000-0000-0000-000000000005',
     'srv-db-01 (HP ProLiant DL380 Gen10+)', 'CI-SRV-DB01', 'active', 'prod',
     'Phòng CNTT', 'Database Server chính PostgreSQL 16',
     '{"os":"Rocky Linux 9","cpu":"2x Xeon Silver 4310","ram":"128 GB","storage":"RAID-10 SAS","rack":"A1-U22"}'::jsonb, NOW
    (), NOW
    ()),

    -- Virtual Machines
    ('ca100000-0000-0000-0000-000000000003',
    (SELECT id
    FROM cmdb_ci_types
    WHERE code='virtual_machine'
    LIMIT 1),
     NULL, 'cc100000-0000-0000-0000-000000000005',
     'vm-erp-01', 'CI-VM-ERP01', 'active', 'prod',
     'Phòng CNTT', 'VM chạy ứng dụng ERP',
     '{"hypervisor":"VMware vSphere 8","vcpu":8,"vram":"16 GB","vdisk":"200 GB","host":"srv-app-01"}'::jsonb, NOW
    (), NOW
    ()),
    ('ca100000-0000-0000-0000-000000000004',
    (SELECT id
    FROM cmdb_ci_types
    WHERE code='virtual_machine'
    LIMIT 1),
     NULL, 'cc100000-0000-0000-0000-000000000005',
     'vm-hrm-01', 'CI-VM-HRM01', 'active', 'prod',
     'Phòng CNTT', 'VM chạy ứng dụng HRM',
     '{"hypervisor":"VMware vSphere 8","vcpu":4,"vram":"8 GB","vdisk":"100 GB","host":"srv-app-01"}'::jsonb, NOW
    (), NOW
    ()),
    ('ca100000-0000-0000-0000-000000000005',
    (SELECT id
    FROM cmdb_ci_types
    WHERE code='virtual_machine'
    LIMIT 1),
     NULL, 'cc100000-0000-0000-0000-000000000005',
     'vm-backup-01', 'CI-VM-BAK01', 'active', 'prod',
     'Phòng CNTT', 'VM backup & monitoring',
     '{"hypervisor":"VMware vSphere 8","vcpu":4,"vram":"8 GB","vdisk":"500 GB","host":"srv-app-01"}'::jsonb, NOW
    (), NOW
    ()),

    -- Network Devices
    ('ca100000-0000-0000-0000-000000000006',
    (SELECT id
    FROM cmdb_ci_types
    WHERE code='network_device'
    LIMIT 1),
     'ee100000-0000-0000-0000-000000000014',
     'cc100000-0000-0000-0000-000000000002',
     'sw-tang1-01 (Cisco C9200L-48P)', 'CI-SW-T1-01', 'active', 'prod',
     'Phòng CNTT', 'Core switch tầng 1 PoE+',
     '{"model":"C9200L-48P-4G","firmware":"17.09.04","ports":48,"mgmt_ip":"10.10.1.1"}'::jsonb, NOW
    (), NOW
    ()),
    ('ca100000-0000-0000-0000-000000000007',
    (SELECT id
    FROM cmdb_ci_types
    WHERE code='network_device'
    LIMIT 1),
     'ee100000-0000-0000-0000-000000000016',
     'cc100000-0000-0000-0000-000000000005',
     'fw-edge-01 (FortiGate 100F)', 'CI-FW-EDGE01', 'active', 'prod',
     'Phòng CNTT', 'Firewall biên Internet',
     '{"model":"FortiGate 100F","firmware":"7.4.3","ha":"standalone","mgmt_ip":"10.10.1.254"}'::jsonb, NOW
    (), NOW
    ()),

    -- Databases
    ('ca100000-0000-0000-0000-000000000008',
    (SELECT id
    FROM cmdb_ci_types
    WHERE code='database'
    LIMIT 1),
     NULL, 'cc100000-0000-0000-0000-000000000005',
     'db-erp-prod (PostgreSQL 16)', 'CI-DB-ERP', 'active', 'prod',
     'Phòng CNTT', 'Database ERP chính – PostgreSQL 16',
     '{"engine":"PostgreSQL","version":"16.2","host":"srv-db-01","port":5432,"size":"45 GB"}'::jsonb, NOW
    (), NOW
    ()),
    ('ca100000-0000-0000-0000-000000000009',
    (SELECT id
    FROM cmdb_ci_types
    WHERE code='database'
    LIMIT 1),
     NULL, 'cc100000-0000-0000-0000-000000000005',
     'db-hrm-prod (PostgreSQL 16)', 'CI-DB-HRM', 'active', 'prod',
     'Phòng CNTT', 'Database HRM – PostgreSQL 16',
     '{"engine":"PostgreSQL","version":"16.2","host":"srv-db-01","port":5433,"size":"12 GB"}'::jsonb, NOW
    (), NOW
    ()),

    -- Applications
    ('ca100000-0000-0000-0000-000000000010',
    (SELECT id
    FROM cmdb_ci_types
    WHERE code='application'
    LIMIT 1),
     NULL, NULL,
     'ERP System v3.5', 'CI-APP-ERP', 'active', 'prod',
     'Phòng CNTT', 'Hệ thống quản lý tổng hợp ERP',
     '{"version":"3.5.2","framework":"Java Spring Boot","url":"https://erp.company.vn"}'::jsonb, NOW
    (), NOW
    ()),
    ('ca100000-0000-0000-0000-000000000011',
    (SELECT id
    FROM cmdb_ci_types
    WHERE code='application'
    LIMIT 1),
     NULL, NULL,
     'HRM System v2.1', 'CI-APP-HRM', 'active', 'prod',
     'Phòng CNTT', 'Hệ thống quản lý nhân sự',
     '{"version":"2.1.0","framework":"Node.js + React","url":"https://hrm.company.vn"}'::jsonb, NOW
    (), NOW
    ()),

    -- Storage (NAS)
    ('ca100000-0000-0000-0000-000000000012',
    (SELECT id
    FROM cmdb_ci_types
    WHERE code='storage'
    LIMIT 1),
     NULL, 'cc100000-0000-0000-0000-000000000005',
     'nas-backup-01 (Synology RS1221+)', 'CI-NAS-BAK01', 'active', 'prod',
     'Phòng CNTT', 'NAS backup dữ liệu & file server',
     '{"model":"RS1221+","firmware":"DSM 7.2","capacity":"32 TB (SHR-2)","raid":"SHR-2","used":"18 TB"}'::jsonb, NOW
    (), NOW
    ())
ON CONFLICT
    (id) DO
    UPDATE SET
    name = EXCLUDED.name, ci_code = EXCLUDED.ci_code, status = EXCLUDED.status,
    environment = EXCLUDED.environment, owner_team = EXCLUDED.owner_team,
    notes = EXCLUDED.notes, metadata = EXCLUDED.metadata, updated_at = NOW();

    -- ============================================================================
    -- 2. CMDB RELATIONSHIPS — Quan hệ giữa CIs
    -- ============================================================================
    INSERT INTO cmdb_relationships
        (id, type_id, from_ci_id, to_ci_id, metadata, created_at)
    VALUES
        -- VMs run on server
        ('cb100000-0000-0000-0000-000000000001',
            (SELECT id
            FROM cmdb_relationship_types
            WHERE code='runs_on'
    LIMIT 1),
     'ca100000-0000-0000-0000-000000000003', 'ca100000-0000-0000-0000-000000000001',
     '{"note":"vm-erp-01 chạy trên srv-app-01"}'::jsonb, NOW
    ()),
    ('cb100000-0000-0000-0000-000000000002',
    (SELECT id
    FROM cmdb_relationship_types
    WHERE code='runs_on'
    LIMIT 1),
     'ca100000-0000-0000-0000-000000000004', 'ca100000-0000-0000-0000-000000000001',
     '{"note":"vm-hrm-01 chạy trên srv-app-01"}'::jsonb, NOW
    ()),
    ('cb100000-0000-0000-0000-000000000003',
    (SELECT id
    FROM cmdb_relationship_types
    WHERE code='runs_on'
    LIMIT 1),
     'ca100000-0000-0000-0000-000000000005', 'ca100000-0000-0000-0000-000000000001',
     '{"note":"vm-backup-01 chạy trên srv-app-01"}'::jsonb, NOW
    ()),

    -- Apps depend on VMs
    ('cb100000-0000-0000-0000-000000000004',
    (SELECT id
    FROM cmdb_relationship_types
    WHERE code='depends_on'
    LIMIT 1),
     'ca100000-0000-0000-0000-000000000010', 'ca100000-0000-0000-0000-000000000003',
     '{"note":"ERP app phụ thuộc vm-erp-01"}'::jsonb, NOW
    ()),
    ('cb100000-0000-0000-0000-000000000005',
    (SELECT id
    FROM cmdb_relationship_types
    WHERE code='depends_on'
    LIMIT 1),
     'ca100000-0000-0000-0000-000000000011', 'ca100000-0000-0000-0000-000000000004',
     '{"note":"HRM app phụ thuộc vm-hrm-01"}'::jsonb, NOW
    ()),

    -- Apps depend on databases
    ('cb100000-0000-0000-0000-000000000006',
    (SELECT id
    FROM cmdb_relationship_types
    WHERE code='depends_on'
    LIMIT 1),
     'ca100000-0000-0000-0000-000000000010', 'ca100000-0000-0000-0000-000000000008',
     '{"note":"ERP app phụ thuộc db-erp-prod"}'::jsonb, NOW
    ()),
    ('cb100000-0000-0000-0000-000000000007',
    (SELECT id
    FROM cmdb_relationship_types
    WHERE code='depends_on'
    LIMIT 1),
     'ca100000-0000-0000-0000-000000000011', 'ca100000-0000-0000-0000-000000000009',
     '{"note":"HRM app phụ thuộc db-hrm-prod"}'::jsonb, NOW
    ()),

    -- Databases run on DB server
    ('cb100000-0000-0000-0000-000000000008',
    (SELECT id
    FROM cmdb_relationship_types
    WHERE code='runs_on'
    LIMIT 1),
     'ca100000-0000-0000-0000-000000000008', 'ca100000-0000-0000-0000-000000000002',
     '{"note":"db-erp-prod chạy trên srv-db-01"}'::jsonb, NOW
    ()),
    ('cb100000-0000-0000-0000-000000000009',
    (SELECT id
    FROM cmdb_relationship_types
    WHERE code='runs_on'
    LIMIT 1),
     'ca100000-0000-0000-0000-000000000009', 'ca100000-0000-0000-0000-000000000002',
     '{"note":"db-hrm-prod chạy trên srv-db-01"}'::jsonb, NOW
    ()),

    -- Firewall connects to switch
    ('cb100000-0000-0000-0000-000000000010',
    (SELECT id
    FROM cmdb_relationship_types
    WHERE code='connects_to'
    LIMIT 1),
     'ca100000-0000-0000-0000-000000000007', 'ca100000-0000-0000-0000-000000000006',
     '{"port":"Gi1/1 → sw-tang1-01 Gi1/0/48","bandwidth":"1 Gbps"}'::jsonb, NOW
    ()),

    -- NAS backed up by backup VM
    ('cb100000-0000-0000-0000-000000000011',
    (SELECT id
    FROM cmdb_relationship_types
    WHERE code='backed_up_by'
    LIMIT 1),
     'ca100000-0000-0000-0000-000000000002', 'ca100000-0000-0000-0000-000000000012',
     '{"schedule":"Nightly 02:00","retention":"30 days","method":"pg_dump + rsync"}'::jsonb, NOW
    ())
ON CONFLICT
    (id) DO
    UPDATE SET
    type_id = EXCLUDED.type_id, from_ci_id = EXCLUDED.from_ci_id, to_ci_id = EXCLUDED.to_ci_id,
    metadata = EXCLUDED.metadata;

    -- ============================================================================
    -- 3. CMDB SERVICES — Dịch vụ CNTT nghiệp vụ
    -- ============================================================================
    -- Xóa service_cis phụ thuộc trước, rồi xóa services trùng code từ seed trước
    DELETE FROM cmdb_service_cis WHERE service_id IN (SELECT id
    FROM cmdb_services
    WHERE code IN ('SVC-ERP','SVC-EMAIL','SVC-BACKUP'));
    DELETE FROM cmdb_services WHERE code IN ('SVC-ERP','SVC-EMAIL','SVC-BACKUP');

    INSERT INTO cmdb_services
        (id, code, name, description, criticality, owner, sla, status, metadata, created_at, updated_at)
    VALUES
        ('cd100000-0000-0000-0000-000000000001', 'SVC-ERP', 'Dịch vụ ERP',
            'Hệ thống quản lý tổng hợp: Kế toán, Vật tư, Mua sắm', 'critical',
            'Nguyễn Văn Quản (TP CNTT)',
            '{"uptime":"99.5%","rto_hours":4,"rpo_hours":1,"support":"8x5"}'
    ::jsonb,
     'active', '{"users":50,"dept":["Kế toán","Kho","Mua sắm"]}'::jsonb, NOW
    (), NOW
    ()),
    ('cd100000-0000-0000-0000-000000000002', 'SVC-HRM', 'Dịch vụ HRM',
     'Hệ thống quản lý nhân sự, chấm công, tính lương', 'high',
     'Nguyễn Văn Quản (TP CNTT)',
     '{"uptime":"99%","rto_hours":8,"rpo_hours":4,"support":"8x5"}'::jsonb,
     'active', '{"users":40,"dept":["Nhân sự","Ban GĐ"]}'::jsonb, NOW
    (), NOW
    ()),
    ('cd100000-0000-0000-0000-000000000003', 'SVC-EMAIL', 'Dịch vụ Email (Microsoft 365)',
     'Email, Calendar, Teams cho toàn bộ nhân viên', 'high',
     'Nguyễn Văn Quản (TP CNTT)',
     '{"uptime":"99.9% (SLA Microsoft)","rto_hours":1,"rpo_hours":0,"support":"24x7 MS"}'::jsonb,
     'active', '{"provider":"Microsoft","plan":"Business Premium","users":50}'::jsonb, NOW
    (), NOW
    ()),
    ('cd100000-0000-0000-0000-000000000004', 'SVC-BACKUP', 'Dịch vụ Backup & DR',
     'Sao lưu dữ liệu hàng ngày, phục hồi thảm họa', 'critical',
     'Phạm Đức Mạnh (Kỹ thuật viên)',
     '{"uptime":"99%","rto_hours":8,"rpo_hours":24,"support":"8x5"}'::jsonb,
     'active', '{"storage":"Synology NAS 32TB","schedule":"Daily 02:00"}'::jsonb, NOW
    (), NOW
    ())
ON CONFLICT
    (id) DO
    UPDATE SET
    code = EXCLUDED.code, name = EXCLUDED.name, description = EXCLUDED.description,
    criticality = EXCLUDED.criticality, owner = EXCLUDED.owner, sla = EXCLUDED.sla,
    status = EXCLUDED.status, metadata = EXCLUDED.metadata, updated_at = NOW();

    -- Liên kết Service ↔ CI
    INSERT INTO cmdb_service_cis
        (id, service_id, ci_id, dependency_type, created_at)
    VALUES
        -- ERP Service
        ('ce100000-0000-0000-0000-000000000001', 'cd100000-0000-0000-0000-000000000001', 'ca100000-0000-0000-0000-000000000010', 'primary', NOW()),
        -- ERP App
        ('ce100000-0000-0000-0000-000000000002', 'cd100000-0000-0000-0000-000000000001', 'ca100000-0000-0000-0000-000000000003', 'uses', NOW()),
        -- vm-erp-01
        ('ce100000-0000-0000-0000-000000000003', 'cd100000-0000-0000-0000-000000000001', 'ca100000-0000-0000-0000-000000000008', 'uses', NOW()),
        -- db-erp-prod
        -- HRM Service
        ('ce100000-0000-0000-0000-000000000004', 'cd100000-0000-0000-0000-000000000002', 'ca100000-0000-0000-0000-000000000011', 'primary', NOW()),
        -- HRM App
        ('ce100000-0000-0000-0000-000000000005', 'cd100000-0000-0000-0000-000000000002', 'ca100000-0000-0000-0000-000000000004', 'uses', NOW()),
        -- vm-hrm-01
        ('ce100000-0000-0000-0000-000000000006', 'cd100000-0000-0000-0000-000000000002', 'ca100000-0000-0000-0000-000000000009', 'uses', NOW()),
        -- db-hrm-prod
        -- Email Service (Microsoft 365)
        ('ce100000-0000-0000-0000-000000000009', 'cd100000-0000-0000-0000-000000000003', 'c1200000-0000-0000-0000-000000000010', 'primary', NOW()),
        -- VM-MAIL-01 (mail sync / relay server)
        ('ce100000-0000-0000-0000-000000000010', 'cd100000-0000-0000-0000-000000000003', 'ca100000-0000-0000-0000-000000000007', 'dependency', NOW()),
        -- FW-EDGE01 (internet gateway to M365)
        -- Backup Service
        ('ce100000-0000-0000-0000-000000000007', 'cd100000-0000-0000-0000-000000000004', 'ca100000-0000-0000-0000-000000000005', 'primary', NOW()),
        -- vm-backup-01
        ('ce100000-0000-0000-0000-000000000008', 'cd100000-0000-0000-0000-000000000004', 'ca100000-0000-0000-0000-000000000012', 'uses', NOW())
    -- NAS
    ON CONFLICT
    (id) DO
    UPDATE SET
    service_id = EXCLUDED.service_id, ci_id = EXCLUDED.ci_id, dependency_type = EXCLUDED.dependency_type;

    -- Liên kết Service ↔ CI (cmdb_service_members — bảng dùng bởi API listMembers)
    INSERT INTO cmdb_service_members
        (id, service_id, ci_id, role, created_at)
    VALUES
        -- SVC-ERP
        ('cf100000-0000-0000-0000-000000000001', 'cd100000-0000-0000-0000-000000000001', 'ca100000-0000-0000-0000-000000000010', 'primary', NOW()),
        ('cf100000-0000-0000-0000-000000000002', 'cd100000-0000-0000-0000-000000000001', 'ca100000-0000-0000-0000-000000000003', 'uses', NOW()),
        ('cf100000-0000-0000-0000-000000000003', 'cd100000-0000-0000-0000-000000000001', 'ca100000-0000-0000-0000-000000000008', 'uses', NOW()),
        -- SVC-HRM
        ('cf100000-0000-0000-0000-000000000004', 'cd100000-0000-0000-0000-000000000002', 'ca100000-0000-0000-0000-000000000011', 'primary', NOW()),
        ('cf100000-0000-0000-0000-000000000005', 'cd100000-0000-0000-0000-000000000002', 'ca100000-0000-0000-0000-000000000004', 'uses', NOW()),
        ('cf100000-0000-0000-0000-000000000006', 'cd100000-0000-0000-0000-000000000002', 'ca100000-0000-0000-0000-000000000009', 'uses', NOW()),
        -- SVC-EMAIL
        ('cf100000-0000-0000-0000-000000000007', 'cd100000-0000-0000-0000-000000000003', 'c1200000-0000-0000-0000-000000000010', 'primary', NOW()),
        ('cf100000-0000-0000-0000-000000000008', 'cd100000-0000-0000-0000-000000000003', 'ca100000-0000-0000-0000-000000000007', 'dependency', NOW()),
        -- SVC-BACKUP
        ('cf100000-0000-0000-0000-000000000009', 'cd100000-0000-0000-0000-000000000004', 'ca100000-0000-0000-0000-000000000005', 'primary', NOW()),
        ('cf100000-0000-0000-0000-000000000010', 'cd100000-0000-0000-0000-000000000004', 'ca100000-0000-0000-0000-000000000012', 'uses', NOW())
    ON CONFLICT
    (id) DO
    UPDATE SET
        service_id = EXCLUDED.service_id, ci_id = EXCLUDED.ci_id, role = EXCLUDED.role;

    -- ============================================================================
    -- 4. KẾ HOẠCH MUA SẮM (Purchase Plan Documents) — Q2-2025
    -- ============================================================================
    INSERT INTO purchase_plan_docs
        (id, doc_no, doc_date, fiscal_year, org_unit_name, title, description, total_estimated_cost, currency, status, created_by, created_at, updated_at)
    VALUES
        ('da100000-0000-0000-0000-000000000001', 'KH-MS-2025-Q2', '2025-04-01', 2025,
            'Phòng CNTT',
            'Kế hoạch mua sắm vật tư CNTT Quý 2/2025',
            'Bổ sung laptop cho nhân viên mới, thay thế ắc quy UPS, mua bổ sung RAM/SSD dự phòng trong kho.',
            185000000, 'VND', 'submitted',
            'nvquan', NOW() - INTERVAL
    '7 days', NOW
    () - INTERVAL '5 days'),
    ('da100000-0000-0000-0000-000000000002', 'KH-MS-2025-SRV', '2025-03-15', 2025,
     'Phòng CNTT',
     'Kế hoạch gia hạn bản quyền & nâng cấp server 2025',
     'Gia hạn VMware vSphere, Kaspersky, FortiCare UTM. Nâng cấp RAM server DB.',
     250000000, 'VND', 'approved',
     'nvquan', NOW
    () - INTERVAL '30 days', NOW
    () - INTERVAL '25 days')
ON CONFLICT
    (id) DO
    UPDATE SET
    doc_no = EXCLUDED.doc_no, title = EXCLUDED.title, description = EXCLUDED.description,
    total_estimated_cost = EXCLUDED.total_estimated_cost, status = EXCLUDED.status;

    -- Dòng chi tiết kế hoạch mua sắm Q2
    INSERT INTO purchase_plan_lines
        (id, doc_id, line_no, model_id, category_id, item_description, quantity, unit, estimated_unit_cost, estimated_total_cost, suggestion_reason, current_stock, min_stock, priority, using_dept, note)
    VALUES
        ('da200000-0000-0000-0000-000000000001', 'da100000-0000-0000-0000-000000000001', 1,
            'dd100000-0000-0000-0000-000000000001', 'bb100000-0000-0000-0000-000000000001',
            'Laptop Dell Latitude 5540 (i7/16GB/512GB)', 3, 'cái', 28000000, 84000000,
            'low_stock', 3, 5, 'high', 'Phòng Nhân sự, Kế toán',
            'Bổ sung cho 3 nhân viên mới onboarding Q2'),
        ('da200000-0000-0000-0000-000000000002', 'da100000-0000-0000-0000-000000000001', 2,
            NULL, NULL,
            'Ắc quy thay thế APC RBC43 cho UPS SR3000', 2, 'bộ', 8500000, 17000000,
            'manual', NULL, NULL, 'high', 'Phòng Server DC',
            'UPS cảnh báo Replace Battery – cần thay gấp'),
        ('da200000-0000-0000-0000-000000000003', 'da100000-0000-0000-0000-000000000001', 3,
            NULL, NULL,
            'RAM DDR5 16GB 4800MHz SODIMM (dự phòng kho)', 10, 'thanh', 850000, 8500000,
            'low_stock', 4, 5, 'medium', 'Kho CNTT',
            'Dự phòng nâng cấp RAM cho laptop DDR5'),
        ('da200000-0000-0000-0000-000000000004', 'da100000-0000-0000-0000-000000000001', 4,
            NULL, NULL,
            'SSD NVMe 512GB Samsung 980 PRO (dự phòng kho)', 10, 'cái', 1200000, 12000000,
            'low_stock', 5, 6, 'medium', 'Kho CNTT',
            'Dự phòng thay thế SSD laptop/desktop'),
        ('da200000-0000-0000-0000-000000000005', 'da100000-0000-0000-0000-000000000001', 5,
            'dd100000-0000-0000-0000-000000000011', 'bb100000-0000-0000-0000-000000000005',
            'Màn hình Dell P2423D 24 inch QHD', 5, 'cái', 6500000, 32500000,
            'manual', 6, 10, 'low', 'Phòng Kế toán, Phòng Nhân sự',
            'Bổ sung màn hình cho workstation mới'),
        ('da200000-0000-0000-0000-000000000006', 'da100000-0000-0000-0000-000000000001', 6,
            NULL, NULL,
            'Hộp mực HP 59A (CF259A)', 15, 'hộp', 450000, 6750000,
            'high_consumption', 8, 6, 'low', 'Kho CNTT',
            'Mực in tiêu thụ ~2 hộp/tháng, dự trữ 6 tháng')
    ON CONFLICT
    (id) DO
    UPDATE SET
    item_description = EXCLUDED.item_description, quantity = EXCLUDED.quantity,
    estimated_unit_cost = EXCLUDED.estimated_unit_cost, estimated_total_cost = EXCLUDED.estimated_total_cost,
    suggestion_reason = EXCLUDED.suggestion_reason, priority = EXCLUDED.priority, note = EXCLUDED.note;

    -- Dòng chi tiết kế hoạch server/license
    INSERT INTO purchase_plan_lines
        (id, doc_id, line_no, item_description, quantity, unit, estimated_unit_cost, estimated_total_cost, suggestion_reason, priority, using_dept, note)
    VALUES
        ('da200000-0000-0000-0000-000000000010', 'da100000-0000-0000-0000-000000000002', 1,
            'Gia hạn VMware vSphere Enterprise Plus (2 host, 1 năm)', 1, 'gói', 48000000, 48000000,
            'manual', 'high', 'Phòng Server DC',
            'License hết hạn 01/2026, cần gia hạn trước'),
        ('da200000-0000-0000-0000-000000000011', 'da100000-0000-0000-0000-000000000002', 2,
            'Gia hạn Kaspersky Endpoint Security (40 seats, 1 năm)', 1, 'gói', 32000000, 32000000,
            'manual', 'high', 'Toàn đơn vị',
            'License hết hạn 06/2025'),
        ('da200000-0000-0000-0000-000000000012', 'da100000-0000-0000-0000-000000000002', 3,
            'Gia hạn FortiCare UTM Bundle (2x FortiGate 100F, 1 năm)', 1, 'gói', 40000000, 40000000,
            'manual', 'high', 'Phòng CNTT',
            'FortiCare hết hạn 06/2026, gia hạn sớm được discount'),
        ('da200000-0000-0000-0000-000000000013', 'da100000-0000-0000-0000-000000000002', 4,
            'RAM DDR4 32GB ECC RDIMM 3200MHz (nâng cấp srv-db-01)', 4, 'thanh', 2500000, 10000000,
            'low_stock', 'medium', 'Phòng Server DC',
            'Nâng cấp RAM DB server lên 256 GB cho PostgreSQL'),
        ('da200000-0000-0000-0000-000000000014', 'da100000-0000-0000-0000-000000000002', 5,
            'HDD SAS 2.4TB 10K RPM – thay thế dự phòng cho server', 4, 'cái', 3500000, 14000000,
            'low_stock', 'medium', 'Phòng Server DC',
            'Dự phòng hotspare cho RAID array')
    ON CONFLICT
    (id) DO
    UPDATE SET
    item_description = EXCLUDED.item_description, quantity = EXCLUDED.quantity,
    estimated_unit_cost = EXCLUDED.estimated_unit_cost, estimated_total_cost = EXCLUDED.estimated_total_cost,
    priority = EXCLUDED.priority, note = EXCLUDED.note;

    -- ============================================================================
    -- 5. BIÊN BẢN TĂNG TÀI SẢN (Asset Increase Documents)
    -- ============================================================================
    INSERT INTO asset_increase_docs
        (id, doc_no, doc_date, increase_type, org_unit_name, vendor_id, vendor_name, invoice_no, invoice_date, total_cost, currency, status, created_by, purchase_plan_doc_id, note, created_at, updated_at)
    VALUES
        ('db100000-0000-0000-0000-000000000001', 'BB-TANG-2024-001', '2024-01-15', 'purchase',
            'Phòng CNTT',
            'aa100000-0000-0000-0000-000000000001', 'Dell Technologies',
            'INV-DELL-240115', '2024-01-10',
            140000000, 'VND', 'posted',
            'nvquan', NULL,
            'Mua 3 laptop Dell Latitude 5540 và 5 desktop Dell OptiPlex 7010 SFF cho đợt onboarding Q1/2024.',
            NOW() - INTERVAL
    '200 days', NOW
    () - INTERVAL '195 days'),
    ('db100000-0000-0000-0000-000000000002', 'BB-TANG-2024-002', '2024-06-01', 'purchase',
     'Phòng CNTT',
     'aa100000-0000-0000-0000-000000000004', 'Cisco Systems Vietnam',
     'INV-CISCO-240601', '2024-05-25',
     220000000, 'VND', 'posted',
     'nvquan', NULL,
     'Mua 2 switch Cisco Catalyst 9200L + 2 FortiGate 100F cho nâng cấp hạ tầng mạng.',
     NOW
    () - INTERVAL '120 days', NOW
    () - INTERVAL '115 days')
ON CONFLICT
    (id) DO
    UPDATE SET
    doc_no = EXCLUDED.doc_no, increase_type = EXCLUDED.increase_type, vendor_name = EXCLUDED.vendor_name,
    total_cost = EXCLUDED.total_cost, status = EXCLUDED.status, note = EXCLUDED.note;

    -- Dòng chi tiết biên bản tăng
    INSERT INTO asset_increase_lines
        (id, doc_id, line_no, asset_code, asset_name, category_id, model_id, serial_number, quantity, unit, original_cost, location_id, location_name, custodian_name, acquisition_date, warranty_end_date, asset_id, note)
    VALUES
        ('db200000-0000-0000-0000-000000000001', 'db100000-0000-0000-0000-000000000001', 1,
            'LAP-DELL-001', 'Laptop Dell Latitude 5540 #1', 'bb100000-0000-0000-0000-000000000001', 'dd100000-0000-0000-0000-000000000001',
            'DL5540-VN240101', 1, 'cái', 28000000,
            'cc100000-0000-0000-0000-000000000003', 'Tầng 2 - Phòng Kế toán', 'Trần Thị Hương', '2024-01-15', '2027-01-15',
            'ee100000-0000-0000-0000-000000000001', 'Giao cho Kế toán trưởng'),
        ('db200000-0000-0000-0000-000000000002', 'db100000-0000-0000-0000-000000000001', 2,
            'LAP-DELL-002', 'Laptop Dell Latitude 5540 #2', 'bb100000-0000-0000-0000-000000000001', 'dd100000-0000-0000-0000-000000000001',
            'DL5540-VN240102', 1, 'cái', 28000000,
            'cc100000-0000-0000-0000-000000000003', 'Tầng 2 - Phòng Kế toán', 'Lê Văn Bình', '2024-01-15', '2027-01-15',
            'ee100000-0000-0000-0000-000000000002', 'Giao cho Kế toán viên'),
        ('db200000-0000-0000-0000-000000000003', 'db100000-0000-0000-0000-000000000001', 3,
            'DT-DELL-001', 'Desktop Dell OptiPlex 7010 SFF #1', 'bb100000-0000-0000-0000-000000000002', 'dd100000-0000-0000-0000-000000000004',
            'DL7010-VN240301', 1, 'cái', 16000000,
            'cc100000-0000-0000-0000-000000000002', 'Tầng 1 - Tiếp nhận', NULL, '2024-03-01', '2027-03-01',
            'ee100000-0000-0000-0000-000000000008', 'Quầy tiếp nhận 1')
    ON CONFLICT
    (id) DO
    UPDATE SET
    asset_code = EXCLUDED.asset_code, asset_name = EXCLUDED.asset_name,
    original_cost = EXCLUDED.original_cost, asset_id = EXCLUDED.asset_id, note = EXCLUDED.note;

    -- ============================================================================
    -- 6. NHẬT KÝ TIÊU THỤ MẪU THIẾT BỊ (Asset Consumption Logs)
    -- ============================================================================
    INSERT INTO asset_consumption_logs
        (id, model_id, consumption_date, quantity, reason, ref_doc_type, note, created_by, created_at)
    VALUES
        ('dc100000-0000-0000-0000-000000000001', 'dd100000-0000-0000-0000-000000000001', '2024-01-15', 3, 'deployed', 'asset_increase', 'Triển khai 3 laptop Dell Latitude 5540', 'nvquan', NOW() - INTERVAL
    '200 days'),
    ('dc100000-0000-0000-0000-000000000002', 'dd100000-0000-0000-0000-000000000004', '2024-03-01', 5, 'deployed',  'asset_increase', 'Triển khai 5 desktop Dell OptiPlex 7010', 'nvquan', NOW
    () - INTERVAL '150 days'),
    ('dc100000-0000-0000-0000-000000000003', 'dd100000-0000-0000-0000-000000000002', '2024-02-01', 4, 'deployed',  'asset_increase', 'Triển khai 4 laptop HP EliteBook 840 G10','nvquan', NOW
    () - INTERVAL '170 days'),
    ('dc100000-0000-0000-0000-000000000004', 'dd100000-0000-0000-0000-000000000011', '2024-07-01', 2, 'installed', NULL,              'Lắp 2 màn hình Dell P2423D cho phòng họp','ttkho',  NOW
    () - INTERVAL '90 days'),
    ('dc100000-0000-0000-0000-000000000005', 'dd100000-0000-0000-0000-000000000001', '2024-11-01', 1, 'lost',      NULL,              'Mất 1 laptop Dell cũ tại sự kiện',       'nvquan', NOW
    () - INTERVAL '30 days')
ON CONFLICT
    (id) DO
    UPDATE SET
    model_id = EXCLUDED.model_id, consumption_date = EXCLUDED.consumption_date,
    quantity = EXCLUDED.quantity, reason = EXCLUDED.reason, note = EXCLUDED.note;

    -- ============================================================================
    -- 7. PHÊ DUYỆT (Approvals) — Mẫu phê duyệt kế hoạch mua sắm
    -- ============================================================================
    INSERT INTO approvals
        (id, entity_type, entity_id, step_no, approver_id, approver_name, decision, note, decided_at, created_at)
    VALUES
        ('dd100000-0000-0000-0000-000000000001', 'purchase_plan', 'da100000-0000-0000-0000-000000000002', 1,
            'nvquan', 'Trưởng phòng CNTT duyệt', 'approved', 'Đồng ý, cần gia hạn trước khi license hết hạn.', NOW() - INTERVAL
    '28 days', NOW
    () - INTERVAL '30 days'),
    ('dd100000-0000-0000-0000-000000000002', 'purchase_plan', 'da100000-0000-0000-0000-000000000002', 2,
     'admin', 'Phó Giám đốc duyệt', 'approved', 'Đã kiểm tra ngân sách, phê duyệt.', NOW
    () - INTERVAL '25 days', NOW
    () - INTERVAL '28 days'),
    ('dd100000-0000-0000-0000-000000000003', 'asset_increase', 'db100000-0000-0000-0000-000000000001', 1,
     'nvquan', 'Trưởng phòng CNTT duyệt', 'approved', 'Xác nhận đã kiểm tra số lượng và chất lượng.', NOW
    () - INTERVAL '198 days', NOW
    () - INTERVAL '200 days'),
    ('dd100000-0000-0000-0000-000000000004', 'asset_increase', 'db100000-0000-0000-0000-000000000001', 2,
     'ptketoan', 'Kế toán trưởng duyệt', 'approved', 'Đã đối chiếu hóa đơn INV-DELL-240115, khớp.', NOW
    () - INTERVAL '196 days', NOW
    () - INTERVAL '198 days')
ON CONFLICT
    (id) DO
    UPDATE SET
    decision = EXCLUDED.decision, note = EXCLUDED.note, decided_at = EXCLUDED.decided_at;

    -- ============================================================================
    -- 8. WORKFLOW AUTOMATION — Quy tắc tự động hóa, thông báo, lịch tác vụ
    -- ============================================================================

    -- 8a. Automation Rules
    INSERT INTO workflow_automation_rules
        (id, name, description, trigger_type, trigger_config, conditions, actions, is_active, priority, created_by, created_at, updated_at)
    VALUES
        -- R1: Cảnh báo bảo hành sắp hết hạn (30 ngày trước)
        ('aa100000-0000-0000-0000-000000000001',
            'Cảnh báo bảo hành sắp hết hạn',
            'Tự động thông báo khi thiết bị còn ≤ 30 ngày bảo hành để chuẩn bị gia hạn hoặc thanh lý.',
            'warranty_expiring',
            '{"days_before": 30, "check_time": "08:00"}',
            '[{"field": "status", "operator": "in", "value": ["in_use", "in_stock"]}]',
            '[{"type": "notify", "channel": "ui", "recipients": ["nvquan", "admin"], "template": "warranty_expiring_30d"},
           {"type": "notify", "channel": "email", "recipients": ["nvquan"], "template": "warranty_expiring_30d"}]',
            true, 10, 'admin', NOW() - INTERVAL
    '60 days', NOW
    () - INTERVAL '60 days'),

    -- R2: Nhắc lịch bảo trì định kỳ (7 ngày trước)
    ('aa100000-0000-0000-0000-000000000002',
         'Nhắc lịch bảo trì định kỳ',
         'Gửi thông báo nhắc đội kỹ thuật chuẩn bị 7 ngày trước lịch bảo trì đã lên kế hoạch.',
         'maintenance_due',
         '{"days_before": 7, "check_time": "07:30"}',
         '[{"field": "maintenance_type", "operator": "eq", "value": "preventive"}]',
         '[{"type": "notify", "channel": "ui", "recipients": ["nvquan", "ttkho"], "template": "maintenance_due_7d"},
           {"type": "create_task", "assignee": "nvquan", "priority": "high"}]',
         true, 8, 'admin', NOW
    () - INTERVAL '60 days', NOW
    () - INTERVAL '60 days'),

    -- R3: Cảnh báo tài sản chuyển sang trạng thái "mất"
    ('aa100000-0000-0000-0000-000000000003',
         'Cảnh báo tài sản bị mất',
         'Khi trạng thái tài sản được đổi thành "lost", gửi ngay cảnh báo khẩn tới quản lý và tạo báo cáo sự cố.',
         'status_change',
         '{"from_status": "*", "to_status": "lost"}',
         '[]',
         '[{"type": "notify", "channel": "ui",    "recipients": ["admin", "nvquan"], "template": "asset_lost_alert", "priority": "urgent"},
           {"type": "notify", "channel": "email",  "recipients": ["admin"],           "template": "asset_lost_alert"},
           {"type": "log_incident", "severity": "high"}]',
         true, 20, 'admin', NOW
    () - INTERVAL '45 days', NOW
    () - INTERVAL '45 days'),

    -- R4: Thiết bị chuyển sang trạng thái "in_repair" → gán kỹ thuật viên
    ('aa100000-0000-0000-0000-000000000004',
         'Tự động phân công sửa chữa',
         'Khi tài sản chuyển sang trạng thái sửa chữa, tự động gán công việc cho kỹ thuật viên kho.',
         'status_change',
         '{"from_status": "in_use", "to_status": "in_repair"}',
         '[{"field": "category", "operator": "in", "value": ["server", "laptop", "desktop", "printer"]}]',
         '[{"type": "notify",      "channel": "ui", "recipients": ["ttkho"], "template": "repair_assigned"},
           {"type": "create_task", "assignee": "ttkho", "priority": "normal", "title": "Kiểm tra và sửa chữa thiết bị"}]',
         true, 9, 'nvquan', NOW
    () - INTERVAL '30 days', NOW
    () - INTERVAL '30 days'),

    -- R5: Cảnh báo bảo hành sắp hết hạn — nhắc lần 2 (7 ngày)
    ('aa100000-0000-0000-0000-000000000005',
         'Nhắc khẩn bảo hành còn 7 ngày',
         'Nhắc lần 2 khi chỉ còn 7 ngày bảo hành, ưu tiên cao hơn lần nhắc 30 ngày.',
         'warranty_expiring',
         '{"days_before": 7, "check_time": "08:00"}',
         '[{"field": "status", "operator": "in", "value": ["in_use", "in_stock"]}]',
         '[{"type": "notify", "channel": "ui",    "recipients": ["admin", "nvquan"], "template": "warranty_expiring_7d", "priority": "high"},
           {"type": "notify", "channel": "email",  "recipients": ["admin", "nvquan"], "template": "warranty_expiring_7d"}]',
         true, 15, 'admin', NOW
    () - INTERVAL '45 days', NOW
    () - INTERVAL '45 days'),

    -- R6: Ghi nhận khi thiết bị được bàn giao / thu hồi
    ('aa100000-0000-0000-0000-000000000006',
         'Ghi nhận bàn giao & thu hồi thiết bị',
         'Khi thiết bị được gán hoặc thu hồi khỏi người dùng, ghi audit log và thông báo cho người liên quan.',
         'assignment_change',
         '{"events": ["assigned", "returned"]}',
         '[]',
         '[{"type": "notify", "channel": "ui", "recipients": ["nvquan"], "template": "assignment_changed"},
           {"type": "audit_log", "severity": "info"}]',
         true, 5, 'nvquan', NOW
    () - INTERVAL '60 days', NOW
    () - INTERVAL '15 days')
    ON CONFLICT
    (id) DO
    UPDATE SET
        name = EXCLUDED.name, description = EXCLUDED.description,
        trigger_config = EXCLUDED.trigger_config, conditions = EXCLUDED.conditions,
        actions = EXCLUDED.actions, is_active = EXCLUDED.is_active,
        priority = EXCLUDED.priority, updated_at = NOW();

    -- 8b. Notification Rules
    INSERT INTO notification_rules
        (id, name, event_type, channel, recipients, template, is_active, created_at, updated_at)
    VALUES
        -- NR1: Thông báo UI — bảo hành sắp hết hạn
        ('ab100000-0000-0000-0000-000000000001',
            'Thông báo bảo hành sắp hết hạn (UI)',
            'warranty_expiring', 'ui',
            '["nvquan", "admin"]',
            'Thiết bị {{asset_name}} ({{asset_code}}) sẽ hết bảo hành vào {{expiry_date}}. Vui lòng xem xét gia hạn hoặc lên kế hoạch thay thế.',
            true, NOW() - INTERVAL
    '60 days', NOW
    () - INTERVAL '60 days'),

    -- NR2: Email — bảo hành sắp hết hạn
    ('ab100000-0000-0000-0000-000000000002',
         'Email cảnh báo bảo hành sắp hết hạn',
         'warranty_expiring', 'email',
         '["nvquan@company.vn", "admin@company.vn"]',
         '[Cảnh báo bảo hành] Thiết bị {{asset_name}} ({{asset_code}}) sẽ hết bảo hành vào {{expiry_date}}.',
         true, NOW
    () - INTERVAL '60 days', NOW
    () - INTERVAL '60 days'),

    -- NR3: Thông báo UI — lịch bảo trì
    ('ab100000-0000-0000-0000-000000000003',
         'Thông báo lịch bảo trì sắp tới (UI)',
         'maintenance_due', 'ui',
         '["nvquan", "ttkho"]',
         'Lịch bảo trì định kỳ cho {{asset_name}} sẽ diễn ra vào {{scheduled_date}}. Vui lòng chuẩn bị.',
         true, NOW
    () - INTERVAL '60 days', NOW
    () - INTERVAL '60 days'),

    -- NR4: Thông báo UI — thiết bị được bàn giao
    ('ab100000-0000-0000-0000-000000000004',
         'Thông báo bàn giao thiết bị',
         'asset_assigned', 'ui',
         '["nvquan"]',
         'Thiết bị {{asset_name}} đã được bàn giao cho {{user_name}} ({{department}}) lúc {{assigned_at}}.',
         true, NOW
    () - INTERVAL '45 days', NOW
    () - INTERVAL '45 days'),

    -- NR5: Thông báo UI — thiết bị được thu hồi
    ('ab100000-0000-0000-0000-000000000005',
         'Thông báo thu hồi thiết bị',
         'asset_returned', 'ui',
         '["nvquan", "ttkho"]',
         'Thiết bị {{asset_name}} đã được thu hồi từ {{user_name}} và nhập kho {{warehouse_name}}.',
         true, NOW
    () - INTERVAL '45 days', NOW
    () - INTERVAL '45 days'),

    -- NR6: Thông báo UI — workflow được phê duyệt
    ('ab100000-0000-0000-0000-000000000006',
         'Thông báo phê duyệt yêu cầu',
         'workflow_approved', 'ui',
         '[]',
         'Yêu cầu {{request_code}} của bạn đã được {{approver_name}} phê duyệt vào {{approved_at}}.',
         true, NOW
    () - INTERVAL '30 days', NOW
    () - INTERVAL '30 days'),

    -- NR7: Thông báo UI — workflow bị từ chối
    ('ab100000-0000-0000-0000-000000000007',
         'Thông báo từ chối yêu cầu',
         'workflow_rejected', 'ui',
         '[]',
         'Yêu cầu {{request_code}} đã bị {{approver_name}} từ chối. Lý do: {{reject_reason}}.',
         true, NOW
    () - INTERVAL '30 days', NOW
    () - INTERVAL '30 days'),

    -- NR8: Thông báo Teams — ngưỡng thiết bị kho xuống thấp
    ('ab100000-0000-0000-0000-000000000008',
         'Teams: Cảnh báo tồn kho thấp',
         'threshold_exceeded', 'teams',
         '["nvquan", "ttkho"]',
         '⚠️ Cảnh báo: Tồn kho mặt hàng {{item_name}} chỉ còn {{current_qty}} (ngưỡng tối thiểu: {{min_qty}}). Cần đặt hàng bổ sung.',
         true, NOW
    () - INTERVAL '20 days', NOW
    () - INTERVAL '20 days')
    ON CONFLICT
    (id) DO
    UPDATE SET
        name = EXCLUDED.name, event_type = EXCLUDED.event_type,
        channel = EXCLUDED.channel, recipients = EXCLUDED.recipients,
        template = EXCLUDED.template, is_active = EXCLUDED.is_active,
        updated_at = NOW();

    -- 8c. Scheduled Tasks
    INSERT INTO scheduled_tasks
        (id, name, task_type, cron_expression, config, is_active, last_run_at, next_run_at, last_status, created_at, updated_at)
    VALUES
        -- ST1: Kiểm tra bảo hành — mỗi ngày 08:00
        ('ac100000-0000-0000-0000-000000000001',
            'Kiểm tra bảo hành hàng ngày',
            'warranty_check',
            '0 8 * * *',
            '{"days_threshold": [30, 7, 1], "notification_rule_ids": ["ab100000-0000-0000-0000-000000000001", "ab100000-0000-0000-0000-000000000002"]}',
            true,
            NOW() - INTERVAL
    '1 day' + INTERVAL '8 hours',
         NOW
    ()             + INTERVAL '8 hours',
         'success',
         NOW
    () - INTERVAL '60 days', NOW
    () - INTERVAL '1 day'),

    -- ST2: Nhắc bảo trì — mỗi thứ Hai 07:30
    ('ac100000-0000-0000-0000-000000000002',
         'Nhắc lịch bảo trì hàng tuần',
         'maintenance_reminder',
         '30 7 * * 1',
         '{"days_threshold": 7, "notification_rule_id": "ab100000-0000-0000-0000-000000000003", "include_types": ["preventive", "scheduled"]}',
         true,
         NOW
    () - INTERVAL '7 days' + INTERVAL '7 hours 30 minutes',
         NOW
    () + INTERVAL '7 days' - EXTRACT
    (DOW FROM NOW
    ()) * INTERVAL '1 day' + INTERVAL '7 hours 30 minutes',
         'success',
         NOW
    () - INTERVAL '60 days', NOW
    () - INTERVAL '7 days'),

    -- ST3: Tạo báo cáo tổng hợp — mỗi tháng ngày 1 lúc 06:00
    ('ac100000-0000-0000-0000-000000000003',
         'Báo cáo tổng hợp tài sản hàng tháng',
         'report_generation',
         '0 6 1 * *',
         '{"report_type": "monthly_asset_summary", "recipients": ["admin", "nvquan"], "format": "pdf", "sections": ["asset_status", "warranty_expiring", "maintenance_summary", "depreciation"]}',
         true,
         DATE_TRUNC
    ('month', NOW
    ()) + INTERVAL '6 hours',
         DATE_TRUNC
    ('month', NOW
    ()) + INTERVAL '1 month' + INTERVAL '6 hours',
         'success',
         NOW
    () - INTERVAL '60 days', DATE_TRUNC
    ('month', NOW
    ())),

    -- ST4: Dọn dẹp log cũ — mỗi Chủ nhật 02:00
    ('ac100000-0000-0000-0000-000000000004',
         'Dọn dẹp log tự động cũ',
         'data_cleanup',
         '0 2 * * 0',
         '{"tables": ["workflow_automation_logs", "notifications"], "retain_days": 90, "batch_size": 1000}',
         true,
         NOW
    () - INTERVAL '7 days' + INTERVAL '2 hours',
         NOW
    () + INTERVAL '7 days' - EXTRACT
    (DOW FROM NOW
    ()) * INTERVAL '1 day' + INTERVAL '2 hours',
         'success',
         NOW
    () - INTERVAL '30 days', NOW
    () - INTERVAL '7 days'),

    -- ST5: Đồng bộ danh mục tài sản từ hệ thống ngoài — mỗi ngày 01:00
    ('ac100000-0000-0000-0000-000000000005',
         'Đồng bộ dữ liệu hệ thống ngoài',
         'sync_external',
         '0 1 * * *',
         '{"source": "erp_system", "endpoint": "http://erp.internal/api/assets", "auth_type": "bearer", "sync_fields": ["serial_number", "purchase_date", "cost"]}',
         false,
         NULL,
         NULL,
         NULL,
         NOW
    () - INTERVAL '20 days', NOW
    () - INTERVAL '20 days')
    ON CONFLICT
    (id) DO
    UPDATE SET
        name = EXCLUDED.name, task_type = EXCLUDED.task_type,
        cron_expression = EXCLUDED.cron_expression, config = EXCLUDED.config,
        is_active = EXCLUDED.is_active, last_run_at = EXCLUDED.last_run_at,
        next_run_at = EXCLUDED.next_run_at, last_status = EXCLUDED.last_status,
        updated_at = NOW();

    -- 8d. Automation Execution Logs (lịch sử chạy quy tắc)
    INSERT INTO workflow_automation_logs
        (id, rule_id, trigger_event, actions_executed, status, error_message, started_at, completed_at, correlation_id)
    VALUES
        -- Log R1: bảo hành sắp hết → thành công
        ('ad100000-0000-0000-0000-000000000001',
            'aa100000-0000-0000-0000-000000000001',
            '{"asset_id": "c1200000-0000-0000-0000-000000000001", "asset_code": "CI-SRV-001", "days_remaining": 28}',
            '[{"type": "notify", "channel": "ui",    "status": "sent", "recipients": ["nvquan", "admin"]},
           {"type": "notify", "channel": "email",  "status": "sent", "recipients": ["nvquan"]}]',
            'completed', NULL,
            NOW() - INTERVAL
    '2 days' + INTERVAL '8 hours',
         NOW
    () - INTERVAL '2 days' + INTERVAL '8 hours' + INTERVAL '1.2 seconds',
         'corr-war-20260227-001'),

    -- Log R2: nhắc bảo trì → thành công
    ('ad100000-0000-0000-0000-000000000002',
         'aa100000-0000-0000-0000-000000000002',
         '{"asset_id": "ca100000-0000-0000-0000-000000000001", "asset_code": "CI-SRV-APP01", "scheduled_date": "2026-03-08"}',
         '[{"type": "notify",      "channel": "ui", "status": "sent", "recipients": ["nvquan", "ttkho"]},
           {"type": "create_task", "status": "created", "task_id": "auto-task-20260222"}]',
         'completed', NULL,
         NOW
    () - INTERVAL '7 days' + INTERVAL '7 hours 30 minutes',
         NOW
    () - INTERVAL '7 days' + INTERVAL '7 hours 30 minutes' + INTERVAL '0.8 seconds',
         'corr-mnt-20260222-001'),

    -- Log R3: tài sản bị mất → thành công
    ('ad100000-0000-0000-0000-000000000003',
         'aa100000-0000-0000-0000-000000000003',
         '{"asset_id": "c1200000-0000-0000-0000-000000000009", "asset_code": "CI-VM-001", "from_status": "in_use", "to_status": "lost", "changed_by": "nvquan"}',
         '[{"type": "notify",       "channel": "ui",    "status": "sent",    "recipients": ["admin", "nvquan"]},
           {"type": "notify",       "channel": "email",  "status": "sent",    "recipients": ["admin"]},
           {"type": "log_incident", "status": "created", "incident_id": "INC-20260215-001"}]',
         'completed', NULL,
         NOW
    () - INTERVAL '14 days',
         NOW
    () - INTERVAL '14 days' + INTERVAL '2.1 seconds',
         'corr-lost-20260215-001'),

    -- Log R6: bàn giao thiết bị → thành công
    ('ad100000-0000-0000-0000-000000000004',
         'aa100000-0000-0000-0000-000000000006',
         '{"asset_id": "ca100000-0000-0000-0000-000000000010", "asset_code": "CI-APP-ERP", "event": "assigned", "assigned_to": "lmhotro"}',
         '[{"type": "notify",    "channel": "ui", "status": "sent", "recipients": ["nvquan"]},
           {"type": "audit_log", "status": "written"}]',
         'completed', NULL,
         NOW
    () - INTERVAL '5 days',
         NOW
    () - INTERVAL '5 days' + INTERVAL '0.5 seconds',
         'corr-asgn-20260224-001'),

    -- Log R4: chuyển trạng thái in_repair → lỗi kết nối task service
    ('ad100000-0000-0000-0000-000000000005',
         'aa100000-0000-0000-0000-000000000004',
         '{"asset_id": "c1200000-0000-0000-0000-000000000003", "asset_code": "CI-SRV-003", "from_status": "in_use", "to_status": "in_repair"}',
         '[{"type": "notify",      "channel": "ui", "status": "sent",   "recipients": ["ttkho"]},
           {"type": "create_task", "status": "failed", "error": "task service timeout"}]',
         'failed',
         'Không thể tạo task: task service không phản hồi sau 5s.',
         NOW
    () - INTERVAL '10 days',
         NOW
    () - INTERVAL '10 days' + INTERVAL '5.3 seconds',
         'corr-rpr-20260219-001')
    ON CONFLICT
    (id) DO
    UPDATE SET
        status = EXCLUDED.status, actions_executed = EXCLUDED.actions_executed,
        completed_at = EXCLUDED.completed_at;

    -- 8e. Notifications (thông báo mẫu cho người dùng)
    INSERT INTO notifications
        (id, rule_id, user_id, title, body, channel, status, metadata, created_at, read_at, sent_at)
    VALUES
        -- N1: Bảo hành sắp hết — đã đọc
        ('ae100000-0000-0000-0000-000000000001',
            'ab100000-0000-0000-0000-000000000001',
            '00000000-0000-0000-0000-000000000002',
            'Bảo hành sắp hết hạn: CI-SRV-001',
            'Thiết bị CI-SRV-001 (SRV-ERP-01) sẽ hết bảo hành vào 28/03/2026. Vui lòng xem xét gia hạn hoặc lên kế hoạch thay thế.',
            'ui', 'read',
            '{"asset_id": "c1200000-0000-0000-0000-000000000001", "days_remaining": 28}',
            NOW() - INTERVAL
    '2 days', NOW
    () - INTERVAL '1 day', NOW
    () - INTERVAL '2 days'),

    -- N2: Bảo hành sắp hết — chưa đọc (admin)
    ('ae100000-0000-0000-0000-000000000002',
         'ab100000-0000-0000-0000-000000000001',
         '00000000-0000-0000-0000-000000000001',
         'Bảo hành sắp hết hạn: CI-SRV-001',
         'Thiết bị CI-SRV-001 (SRV-ERP-01) sẽ hết bảo hành vào 28/03/2026. Vui lòng xem xét gia hạn hoặc lên kế hoạch thay thế.',
         'ui', 'sent',
         '{"asset_id": "c1200000-0000-0000-0000-000000000001", "days_remaining": 28}',
         NOW
    () - INTERVAL '2 days', NULL, NOW
    () - INTERVAL '2 days'),

    -- N3: Nhắc bảo trì — đã đọc (nvquan)
    ('ae100000-0000-0000-0000-000000000003',
         'ab100000-0000-0000-0000-000000000003',
         '00000000-0000-0000-0000-000000000002',
         'Lịch bảo trì: CI-SRV-APP01 — 08/03/2026',
         'Lịch bảo trì định kỳ cho CI-SRV-APP01 (srv-app-01) sẽ diễn ra vào 08/03/2026. Vui lòng chuẩn bị.',
         'ui', 'read',
         '{"asset_id": "ca100000-0000-0000-0000-000000000001", "scheduled_date": "2026-03-08"}',
         NOW
    () - INTERVAL '7 days', NOW
    () - INTERVAL '6 days', NOW
    () - INTERVAL '7 days'),

    -- N4: Nhắc bảo trì — chưa đọc (ttkho)
    ('ae100000-0000-0000-0000-000000000004',
         'ab100000-0000-0000-0000-000000000003',
         '00000000-0000-0000-0000-000000000003',
         'Lịch bảo trì: CI-SRV-APP01 — 08/03/2026',
         'Lịch bảo trì định kỳ cho CI-SRV-APP01 (srv-app-01) sẽ diễn ra vào 08/03/2026. Vui lòng chuẩn bị.',
         'ui', 'sent',
         '{"asset_id": "ca100000-0000-0000-0000-000000000001", "scheduled_date": "2026-03-08"}',
         NOW
    () - INTERVAL '7 days', NULL, NOW
    () - INTERVAL '7 days'),

    -- N5: Cảnh báo tài sản bị mất — đã đọc (admin)
    ('ae100000-0000-0000-0000-000000000005',
         NULL,
         '00000000-0000-0000-0000-000000000001',
         '🚨 Cảnh báo: Tài sản CI-VM-001 bị ghi nhận mất',
         'Thiết bị CI-VM-001 (VM-WEB-01) đã được đổi trạng thái sang "mất" bởi nvquan lúc 15/02/2026 10:30. Vui lòng kiểm tra và xác minh.',
         'ui', 'read',
         '{"asset_id": "c1200000-0000-0000-0000-000000000009", "changed_by": "nvquan", "incident_id": "INC-20260215-001"}',
         NOW
    () - INTERVAL '14 days', NOW
    () - INTERVAL '13 days', NOW
    () - INTERVAL '14 days'),

    -- N6: Cảnh báo tài sản mất — đã đọc (nvquan)
    ('ae100000-0000-0000-0000-000000000006',
         NULL,
         '00000000-0000-0000-0000-000000000002',
         '🚨 Cảnh báo: Tài sản CI-VM-001 bị ghi nhận mất',
         'Thiết bị CI-VM-001 (VM-WEB-01) đã được đổi trạng thái sang "mất". Sự cố INC-20260215-001 đã được tạo tự động.',
         'ui', 'read',
         '{"asset_id": "c1200000-0000-0000-0000-000000000009", "incident_id": "INC-20260215-001"}',
         NOW
    () - INTERVAL '14 days', NOW
    () - INTERVAL '14 days' + INTERVAL '10 minutes', NOW
    () - INTERVAL '14 days'),

    -- N7: Bàn giao thiết bị — đã đọc (nvquan)
    ('ae100000-0000-0000-0000-000000000007',
         'ab100000-0000-0000-0000-000000000004',
         '00000000-0000-0000-0000-000000000002',
         'Bàn giao thiết bị: CI-APP-ERP → lmhotro',
         'Thiết bị CI-APP-ERP (ERP System v3.5) đã được bàn giao cho Lê Minh Hỗ Trợ (Phòng CNTT) lúc 24/02/2026.',
         'ui', 'read',
         '{"asset_id": "ca100000-0000-0000-0000-000000000010", "assigned_to": "lmhotro", "department": "CNTT"}',
         NOW
    () - INTERVAL '5 days', NOW
    () - INTERVAL '4 days', NOW
    () - INTERVAL '5 days'),

    -- N8: Phê duyệt yêu cầu — đã đọc (lmhotro)
    ('ae100000-0000-0000-0000-000000000008',
         'ab100000-0000-0000-0000-000000000006',
         '00000000-0000-0000-0000-000000000004',
         'Yêu cầu của bạn đã được phê duyệt',
         'Yêu cầu PPLN-2025-002 đã được nvquan (Trưởng phòng CNTT) phê duyệt vào 01/02/2026.',
         'ui', 'read',
         '{"request_code": "PPLN-2025-002", "approver": "nvquan", "approved_at": "2026-02-01"}',
         NOW
    () - INTERVAL '28 days', NOW
    () - INTERVAL '27 days', NOW
    () - INTERVAL '28 days'),

    -- N9: Cảnh báo tồn kho thấp — chưa đọc (ttkho)
    ('ae100000-0000-0000-0000-000000000009',
         'ab100000-0000-0000-0000-000000000008',
         '00000000-0000-0000-0000-000000000003',
         '⚠️ Tồn kho thấp: RAM DDR4 32GB',
         'Tồn kho mặt hàng RAM DDR4 32GB chỉ còn 2 đơn vị (ngưỡng tối thiểu: 5). Cần đặt hàng bổ sung.',
         'ui', 'sent',
         '{"item_name": "RAM DDR4 32GB", "current_qty": 2, "min_qty": 5, "warehouse": "Kho CNTT"}',
         NOW
    () - INTERVAL '3 days', NULL, NOW
    () - INTERVAL '3 days'),

    -- N10: Bảo hành còn 7 ngày — chưa đọc (admin, khẩn)
    ('ae100000-0000-0000-0000-000000000010',
         'ab100000-0000-0000-0000-000000000001',
         '00000000-0000-0000-0000-000000000001',
         '🔴 Khẩn: Bảo hành CI-SRV-002 còn 7 ngày',
         'Thiết bị CI-SRV-002 (SRV-DB-01) sẽ hết bảo hành vào 08/03/2026 (còn 7 ngày). Cần quyết định ngay.',
         'ui', 'sent',
         '{"asset_id": "c1200000-0000-0000-0000-000000000002", "days_remaining": 7, "expiry_date": "2026-03-08", "priority": "urgent"}',
         NOW
    () - INTERVAL '1 day', NULL, NOW
    () - INTERVAL '1 day')
    ON CONFLICT
    (id) DO
    UPDATE SET
        status = EXCLUDED.status, read_at = EXCLUDED.read_at;

    COMMIT;
