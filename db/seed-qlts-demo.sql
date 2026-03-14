-- ============================================================================
-- seed-qlts-demo.sql
-- Du lieu demo nang cao: CMDB CIs, Relationships, Services, CI Type Versions,
--   CI Schemas, CI Attr Values, Smart Tags, Change Assessments, Discovery Rules,
--   Impact Rules, Workflow Definitions + Steps + Requests + Approvals + Lines
-- Chay SAU seed-assets-management.sql
-- ============================================================================
SET client_encoding
= 'UTF8';

BEGIN;

    -- ============================================================================
    -- 1. CMDB CI TYPE VERSIONS  (phien ban cho moi CI type)
    -- ============================================================================
    INSERT INTO cmdb_ci_type_versions
        (id, type_id, version, status, created_by)
    VALUES
        ('f1000000-0000-0000-0000-000000000001', (SELECT id
            FROM cmdb_ci_types
            WHERE code='server'), 1, 'active', 'admin'),
        ('f1000000-0000-0000-0000-000000000002', (SELECT id
            FROM cmdb_ci_types
            WHERE code='virtual_machine'), 1, 'active', 'admin'),
        ('f1000000-0000-0000-0000-000000000003', (SELECT id
            FROM cmdb_ci_types
            WHERE code='network_device'), 1, 'active', 'admin'),
        ('f1000000-0000-0000-0000-000000000004', (SELECT id
            FROM cmdb_ci_types
            WHERE code='storage'), 1, 'active', 'admin'),
        ('f1000000-0000-0000-0000-000000000005', (SELECT id
            FROM cmdb_ci_types
            WHERE code='database'), 1, 'active', 'admin'),
        ('f1000000-0000-0000-0000-000000000006', (SELECT id
            FROM cmdb_ci_types
            WHERE code='application'), 1, 'active', 'admin'),
        ('f1000000-0000-0000-0000-000000000007', (SELECT id
            FROM cmdb_ci_types
            WHERE code='service'), 1, 'active', 'admin'),
        ('f1000000-0000-0000-0000-000000000008', (SELECT id
            FROM cmdb_ci_types
            WHERE code='firewall'), 1, 'active', 'admin')
    ON CONFLICT
    (type_id, version) DO
    UPDATE SET status = EXCLUDED.status;

    -- ============================================================================
    -- 2. CMDB CI SCHEMAS  (dinh nghia thuoc tinh cho moi CI type version)
    -- ============================================================================
    INSERT INTO cmdb_ci_schemas
        (id, version_id, attr_key, attr_label, ci_type_version_id, attribute_key, attribute_label, data_type, is_required, display_order)
    VALUES
        -- Server
        ('f2000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000001', 'os', E'H\u1EC7 \u0111i\u1EC1u h\u00E0nh', 'f1000000-0000-0000-0000-000000000001', 'os',         E'H\u1EC7 \u0111i\u1EC1u h\u00E0nh',  'text',    true,  1),
    ('f2000000-0000-0000-0000-000000000002', 'f1000000-0000-0000-0000-000000000001', 'cpu',        'CPU',            'f1000000-0000-0000-0000-000000000001', 'cpu',        'CPU',             'text',    true,  2),
    ('f2000000-0000-0000-0000-000000000003', 'f1000000-0000-0000-0000-000000000001', 'ram_gb',     'RAM (GB)',       'f1000000-0000-0000-0000-000000000001', 'ram_gb',     'RAM (GB)',        'number',  true,  3),
    ('f2000000-0000-0000-0000-000000000004', 'f1000000-0000-0000-0000-000000000001', 'disk_tb',    E'\u0110\u0129a (TB)',    'f1000000-0000-0000-0000-000000000001', 'disk_tb',    E'\u0110\u0129a (TB)',     'number',  false, 4),
    ('f2000000-0000-0000-0000-000000000005', 'f1000000-0000-0000-0000-000000000001', 'mgmt_ip',    'Management IP',  'f1000000-0000-0000-0000-000000000001', 'mgmt_ip',    'Management IP',   'text',    false, 5),
    -- Virtual Machine
    ('f2000000-0000-0000-0000-000000000011', 'f1000000-0000-0000-0000-000000000002', 'hypervisor', 'Hypervisor',     'f1000000-0000-0000-0000-000000000002', 'hypervisor', 'Hypervisor',      'text',    true,  1),
    ('f2000000-0000-0000-0000-000000000012', 'f1000000-0000-0000-0000-000000000002', 'vcpu',       'vCPU',           'f1000000-0000-0000-0000-000000000002', 'vcpu',       'vCPU',            'number',  true,  2),
    ('f2000000-0000-0000-0000-000000000013', 'f1000000-0000-0000-0000-000000000002', 'vram_gb',    'vRAM (GB)',      'f1000000-0000-0000-0000-000000000002', 'vram_gb',    'vRAM (GB)',       'number',  true,  3),
    ('f2000000-0000-0000-0000-000000000014', 'f1000000-0000-0000-0000-000000000002', 'os',         E'H\u1EC7 \u0111i\u1EC1u h\u00E0nh', 'f1000000-0000-0000-0000-000000000002', 'os',         E'H\u1EC7 \u0111i\u1EC1u h\u00E0nh',  'text',    true,  4),
    -- Network Device
    ('f2000000-0000-0000-0000-000000000021', 'f1000000-0000-0000-0000-000000000003', 'device_type', E'Lo\u1EA1i thi\u1EBFt b\u1ECB', 'f1000000-0000-0000-0000-000000000003', 'device_type', E'Lo\u1EA1i thi\u1EBFt b\u1ECB', 'select',  true,  1),
    ('f2000000-0000-0000-0000-000000000022', 'f1000000-0000-0000-0000-000000000003', 'firmware',   'Firmware',       'f1000000-0000-0000-0000-000000000003', 'firmware',   'Firmware',        'text',    false, 2),
    ('f2000000-0000-0000-0000-000000000023', 'f1000000-0000-0000-0000-000000000003', 'ports',      E'S\u1ED1 c\u1ED5ng',    'f1000000-0000-0000-0000-000000000003', 'ports',      E'S\u1ED1 c\u1ED5ng',     'number',  false, 3),
    -- Database
    ('f2000000-0000-0000-0000-000000000031', 'f1000000-0000-0000-0000-000000000005', 'engine',     'Engine',         'f1000000-0000-0000-0000-000000000005', 'engine',     'Engine',          'text',    true,  1),
    ('f2000000-0000-0000-0000-000000000032', 'f1000000-0000-0000-0000-000000000005', 'version',    'Version',        'f1000000-0000-0000-0000-000000000005', 'version',    'Version',         'text',    true,  2),
    ('f2000000-0000-0000-0000-000000000033', 'f1000000-0000-0000-0000-000000000005', 'size_gb',    E'Dung l\u01B0\u1EE3ng (GB)', 'f1000000-0000-0000-0000-000000000005', 'size_gb',    E'Dung l\u01B0\u1EE3ng (GB)', 'number',  false, 3),
    -- Application
    ('f2000000-0000-0000-0000-000000000041', 'f1000000-0000-0000-0000-000000000006', 'tech_stack', E'N\u1EC1n t\u1EA3ng',    'f1000000-0000-0000-0000-000000000006', 'tech_stack', E'N\u1EC1n t\u1EA3ng',     'text',    true,  1),
    ('f2000000-0000-0000-0000-000000000042', 'f1000000-0000-0000-0000-000000000006', 'url',        'URL',            'f1000000-0000-0000-0000-000000000006', 'url',        'URL',             'url',     false, 2),
    ('f2000000-0000-0000-0000-000000000043', 'f1000000-0000-0000-0000-000000000006', 'version',    'Version',        'f1000000-0000-0000-0000-000000000006', 'version',    'Version',         'text',    false, 3)
ON CONFLICT
    (ci_type_version_id, attribute_key) DO
    UPDATE SET
    attribute_label = EXCLUDED.attribute_label, data_type = EXCLUDED.data_type;

    -- ============================================================================
    -- 3. CMDB CIs  (26 configuration items)
    -- ============================================================================
    INSERT INTO cmdb_cis
        (id, type_id, asset_id, location_id, name, ci_code, status, environment, owner_team, notes)
    VALUES
        -- Physical Servers (2) — linked to assets
        ('f3000000-0000-0000-0000-000000000001', (SELECT id
            FROM cmdb_ci_types
            WHERE code='server'), 'a1000000-0000-0000-0000-000000000018', 'a0000000-0000-0000-0000-000000000006', 'ESXi Host 01', 'CI-SRV-001', 'active', 'prod', E'Ph\u00F2ng CNTT', E'M\u00E1y ch\u1EE7 Dell PowerEdge R740'),
    ('f3000000-0000-0000-0000-000000000002',
    (SELECT id
    FROM cmdb_ci_types
    WHERE code='server')
    , 'a1000000-0000-0000-0000-000000000019', 'a0000000-0000-0000-0000-000000000006', 'ESXi Host 02',     'CI-SRV-002', 'active', 'prod', E'Ph\u00F2ng CNTT', E'M\u00E1y ch\u1EE7 HP ProLiant DL380'),
    -- Virtual Machines (6)
    ('f3000000-0000-0000-0000-000000000003',
    (SELECT id
    FROM cmdb_ci_types
    WHERE code='virtual_machine')
    , NULL, 'a0000000-0000-0000-0000-000000000006', 'VM-DC01',          'CI-VM-001', 'active', 'prod', E'Ph\u00F2ng CNTT', E'Domain Controller ch\u00EDnh'),
    ('f3000000-0000-0000-0000-000000000004',
    (SELECT id
    FROM cmdb_ci_types
    WHERE code='virtual_machine')
    , NULL, 'a0000000-0000-0000-0000-000000000006', 'VM-DB01',          'CI-VM-002', 'active', 'prod', E'Ph\u00F2ng CNTT', E'Database Server ch\u00EDnh'),
    ('f3000000-0000-0000-0000-000000000005',
    (SELECT id
    FROM cmdb_ci_types
    WHERE code='virtual_machine')
    , NULL, 'a0000000-0000-0000-0000-000000000006', 'VM-APP01',         'CI-VM-003', 'active', 'prod', E'Ph\u00F2ng CNTT', E'Application Server #1'),
    ('f3000000-0000-0000-0000-000000000006',
    (SELECT id
    FROM cmdb_ci_types
    WHERE code='virtual_machine')
    , NULL, 'a0000000-0000-0000-0000-000000000006', 'VM-APP02',         'CI-VM-004', 'active', 'prod', E'Ph\u00F2ng CNTT', E'Application Server #2'),
    ('f3000000-0000-0000-0000-000000000007',
    (SELECT id
    FROM cmdb_ci_types
    WHERE code='virtual_machine')
    , NULL, 'a0000000-0000-0000-0000-000000000006', 'VM-WEB01',         'CI-VM-005', 'active', 'prod', E'Ph\u00F2ng CNTT', E'Web Server/Reverse Proxy'),
    ('f3000000-0000-0000-0000-000000000008',
    (SELECT id
    FROM cmdb_ci_types
    WHERE code='virtual_machine')
    , NULL, 'a0000000-0000-0000-0000-000000000006', 'VM-BACKUP01',      'CI-VM-006', 'active', 'prod', E'Ph\u00F2ng CNTT', E'Backup Server'),
    -- Network Devices (3) — linked to assets
    ('f3000000-0000-0000-0000-000000000009',
    (SELECT id
    FROM cmdb_ci_types
    WHERE code='network_device')
    , 'a1000000-0000-0000-0000-000000000016', 'a0000000-0000-0000-0000-000000000006', 'Core Switch DC',   'CI-NET-001', 'active', 'prod', E'Ph\u00F2ng CNTT', 'Cisco Catalyst 2960-X'),
    ('f3000000-0000-0000-0000-000000000010',
    (SELECT id
    FROM cmdb_ci_types
    WHERE code='firewall')
    ,       'a1000000-0000-0000-0000-000000000017', 'a0000000-0000-0000-0000-000000000006', 'Firewall DC',      'CI-FW-001',  'active', 'prod', E'Ph\u00F2ng CNTT', 'FortiGate 60F'),
    ('f3000000-0000-0000-0000-000000000011',
    (SELECT id
    FROM cmdb_ci_types
    WHERE code='network_device')
    , NULL, 'a0000000-0000-0000-0000-000000000001', 'AP-Office-01',     'CI-NET-002', 'active', 'prod', E'Ph\u00F2ng CNTT', E'Access Point v\u0103n ph\u00F2ng'),
    -- Storage (1) — linked to asset
    ('f3000000-0000-0000-0000-000000000012',
    (SELECT id
    FROM cmdb_ci_types
    WHERE code='storage')
    , 'a1000000-0000-0000-0000-000000000020', 'a0000000-0000-0000-0000-000000000006', 'NAS Backup',       'CI-STO-001', 'active', 'prod', E'Ph\u00F2ng CNTT', 'Synology RS1221+'),
    -- Databases (3)
    ('f3000000-0000-0000-0000-000000000013',
    (SELECT id
    FROM cmdb_ci_types
    WHERE code='database')
    , NULL, 'a0000000-0000-0000-0000-000000000006', 'PostgreSQL Main',  'CI-DB-001',  'active', 'prod', E'Ph\u00F2ng CNTT', E'Database ch\u00EDnh c\u1EE7a h\u1EC7 th\u1ED1ng'),
    ('f3000000-0000-0000-0000-000000000014',
    (SELECT id
    FROM cmdb_ci_types
    WHERE code='database')
    , NULL, 'a0000000-0000-0000-0000-000000000006', 'SQL Server Report','CI-DB-002',  'active', 'prod', E'Ph\u00F2ng CNTT', E'Database b\u00E1o c\u00E1o'),
    ('f3000000-0000-0000-0000-000000000015',
    (SELECT id
    FROM cmdb_ci_types
    WHERE code='database')
    , NULL, 'a0000000-0000-0000-0000-000000000006', 'Redis Cache',      'CI-DB-003',  'active', 'prod', E'Ph\u00F2ng CNTT', E'Cache layer'),
    -- Applications (5)
    ('f3000000-0000-0000-0000-000000000016',
    (SELECT id
    FROM cmdb_ci_types
    WHERE code='application')
    , NULL, NULL, E'H\u1EC7 th\u1ED1ng QLTB',    'CI-APP-001', 'active', 'prod', E'Ph\u00F2ng CNTT', E'\u1EE8ng d\u1EE5ng qu\u1EA3n l\u00FD thi\u1EBFt b\u1ECB ch\u00EDnh'),
    ('f3000000-0000-0000-0000-000000000017',
    (SELECT id
    FROM cmdb_ci_types
    WHERE code='application')
    , NULL, NULL, 'ERP System',       'CI-APP-002', 'active', 'prod', E'Ph\u00F2ng CNTT', E'H\u1EC7 th\u1ED1ng ERP'),
    ('f3000000-0000-0000-0000-000000000018',
    (SELECT id
    FROM cmdb_ci_types
    WHERE code='application')
    , NULL, NULL, 'Email System',     'CI-APP-003', 'active', 'prod', E'Ph\u00F2ng CNTT', 'Microsoft 365'),
    ('f3000000-0000-0000-0000-000000000019',
    (SELECT id
    FROM cmdb_ci_types
    WHERE code='application')
    , NULL, NULL, 'Monitoring',       'CI-APP-004', 'active', 'prod', E'Ph\u00F2ng CNTT', 'Prometheus + Grafana'),
    ('f3000000-0000-0000-0000-000000000020',
    (SELECT id
    FROM cmdb_ci_types
    WHERE code='application')
    , NULL, NULL, 'VPN Gateway',      'CI-APP-005', 'active', 'prod', E'Ph\u00F2ng CNTT', 'FortiClient VPN'),
    -- Services (6)
    ('f3000000-0000-0000-0000-000000000021',
    (SELECT id
    FROM cmdb_ci_types
    WHERE code='service')
    , NULL, NULL, 'Active Directory', 'CI-SVC-001', 'active', 'prod', E'Ph\u00F2ng CNTT', E'D\u1ECBch v\u1EE5 x\u00E1c th\u1EF1c'),
    ('f3000000-0000-0000-0000-000000000022',
    (SELECT id
    FROM cmdb_ci_types
    WHERE code='service')
    , NULL, NULL, 'DNS Service',      'CI-SVC-002', 'active', 'prod', E'Ph\u00F2ng CNTT', E'D\u1ECBch v\u1EE5 ph\u00E2n gi\u1EA3i t\u00EAn mi\u1EC1n'),
    ('f3000000-0000-0000-0000-000000000023',
    (SELECT id
    FROM cmdb_ci_types
    WHERE code='service')
    , NULL, NULL, 'DHCP Service',     'CI-SVC-003', 'active', 'prod', E'Ph\u00F2ng CNTT', E'D\u1ECBch v\u1EE5 c\u1EA5p ph\u00E1t IP'),
    ('f3000000-0000-0000-0000-000000000024',
    (SELECT id
    FROM cmdb_ci_types
    WHERE code='service')
    , NULL, NULL, 'Backup Service',   'CI-SVC-004', 'active', 'prod', E'Ph\u00F2ng CNTT', E'D\u1ECBch v\u1EE5 sao l\u01B0u'),
    ('f3000000-0000-0000-0000-000000000025',
    (SELECT id
    FROM cmdb_ci_types
    WHERE code='service')
    , NULL, NULL, 'VPN Service',      'CI-SVC-005', 'active', 'prod', E'Ph\u00F2ng CNTT', E'D\u1ECBch v\u1EE5 VPN'),
    ('f3000000-0000-0000-0000-000000000026',
    (SELECT id
    FROM cmdb_ci_types
    WHERE code='service')
    , NULL, NULL, E'D\u1ECBch v\u1EE5 Email',   'CI-SVC-006', 'active', 'prod', E'Ph\u00F2ng CNTT', E'D\u1ECBch v\u1EE5 email c\u00F4ng ty')
ON CONFLICT
    (ci_code) DO
    UPDATE SET
    name = EXCLUDED.name, status = EXCLUDED.status, environment = EXCLUDED.environment,
    owner_team = EXCLUDED.owner_team, notes = EXCLUDED.notes;

    -- ============================================================================
    -- 4. CMDB CI ATTRIBUTE VALUES  (gia tri thuoc tinh cho tung CI)
    -- ============================================================================
    INSERT INTO cmdb_ci_attr_values
        (id, ci_id, schema_id, attr_key, value)
    VALUES
        -- ESXi Host 01
        ('f4000000-0000-0000-0000-000000000001', 'f3000000-0000-0000-0000-000000000001', 'f2000000-0000-0000-0000-000000000001', 'os', '"VMware ESXi 7.0"'),
        ('f4000000-0000-0000-0000-000000000002', 'f3000000-0000-0000-0000-000000000001', 'f2000000-0000-0000-0000-000000000002', 'cpu', '"Intel Xeon Gold 6248R x2"'),
        ('f4000000-0000-0000-0000-000000000003', 'f3000000-0000-0000-0000-000000000001', 'f2000000-0000-0000-0000-000000000003', 'ram_gb', '128'),
        ('f4000000-0000-0000-0000-000000000004', 'f3000000-0000-0000-0000-000000000001', 'f2000000-0000-0000-0000-000000000004', 'disk_tb', '4'),
        -- ESXi Host 02
        ('f4000000-0000-0000-0000-000000000005', 'f3000000-0000-0000-0000-000000000002', 'f2000000-0000-0000-0000-000000000001', 'os', '"VMware ESXi 7.0"'),
        ('f4000000-0000-0000-0000-000000000006', 'f3000000-0000-0000-0000-000000000002', 'f2000000-0000-0000-0000-000000000002', 'cpu', '"Intel Xeon Silver 4214R x2"'),
        ('f4000000-0000-0000-0000-000000000007', 'f3000000-0000-0000-0000-000000000002', 'f2000000-0000-0000-0000-000000000003', 'ram_gb', '64'),
        -- VM-DC01
        ('f4000000-0000-0000-0000-000000000011', 'f3000000-0000-0000-0000-000000000003', 'f2000000-0000-0000-0000-000000000011', 'hypervisor', '"ESXi Host 01"'),
        ('f4000000-0000-0000-0000-000000000012', 'f3000000-0000-0000-0000-000000000003', 'f2000000-0000-0000-0000-000000000012', 'vcpu', '4'),
        ('f4000000-0000-0000-0000-000000000013', 'f3000000-0000-0000-0000-000000000003', 'f2000000-0000-0000-0000-000000000013', 'vram_gb', '8'),
        ('f4000000-0000-0000-0000-000000000014', 'f3000000-0000-0000-0000-000000000003', 'f2000000-0000-0000-0000-000000000014', 'os', '"Windows Server 2022"'),
        -- VM-DB01
        ('f4000000-0000-0000-0000-000000000021', 'f3000000-0000-0000-0000-000000000004', 'f2000000-0000-0000-0000-000000000011', 'hypervisor', '"ESXi Host 01"'),
        ('f4000000-0000-0000-0000-000000000022', 'f3000000-0000-0000-0000-000000000004', 'f2000000-0000-0000-0000-000000000012', 'vcpu', '8'),
        ('f4000000-0000-0000-0000-000000000023', 'f3000000-0000-0000-0000-000000000004', 'f2000000-0000-0000-0000-000000000013', 'vram_gb', '32'),
        ('f4000000-0000-0000-0000-000000000024', 'f3000000-0000-0000-0000-000000000004', 'f2000000-0000-0000-0000-000000000014', 'os', '"Ubuntu 22.04 LTS"'),
        -- PostgreSQL Main
        ('f4000000-0000-0000-0000-000000000031', 'f3000000-0000-0000-0000-000000000013', 'f2000000-0000-0000-0000-000000000031', 'engine', '"PostgreSQL"'),
        ('f4000000-0000-0000-0000-000000000032', 'f3000000-0000-0000-0000-000000000013', 'f2000000-0000-0000-0000-000000000032', 'version', '"16.2"'),
        ('f4000000-0000-0000-0000-000000000033', 'f3000000-0000-0000-0000-000000000013', 'f2000000-0000-0000-0000-000000000033', 'size_gb', '120'),
        -- HT QLTB (Application)
        ('f4000000-0000-0000-0000-000000000041', 'f3000000-0000-0000-0000-000000000016', 'f2000000-0000-0000-0000-000000000041', 'tech_stack', '"SvelteKit + Fastify + PostgreSQL"'),
        ('f4000000-0000-0000-0000-000000000042', 'f3000000-0000-0000-0000-000000000016', 'f2000000-0000-0000-0000-000000000042', 'url', '"https://qltb.company.local"'),
        ('f4000000-0000-0000-0000-000000000043', 'f3000000-0000-0000-0000-000000000016', 'f2000000-0000-0000-0000-000000000043', 'version', '"2.0.0"')
    ON CONFLICT
    (ci_id, attr_key) DO
    UPDATE SET value = EXCLUDED.value;

    -- ============================================================================
    -- 5. CMDB RELATIONSHIPS  (lien ket giua cac CI)
    -- ============================================================================
    INSERT INTO cmdb_relationships
        (id, type_id, from_ci_id, to_ci_id, metadata)
    VALUES
        -- VMs run_on Servers
        ('f5000000-0000-0000-0000-000000000001', (SELECT id
            FROM cmdb_relationship_types
            WHERE code='runs_on'), 'f3000000-0000-0000-0000-000000000003', 'f3000000-0000-0000-0000-000000000001', '{}'),
        ('f5000000-0000-0000-0000-000000000002', (SELECT id
            FROM cmdb_relationship_types
            WHERE code='runs_on'), 'f3000000-0000-0000-0000-000000000004', 'f3000000-0000-0000-0000-000000000001', '{}'),
        ('f5000000-0000-0000-0000-000000000003', (SELECT id
            FROM cmdb_relationship_types
            WHERE code='runs_on'), 'f3000000-0000-0000-0000-000000000005', 'f3000000-0000-0000-0000-000000000001', '{}'),
        ('f5000000-0000-0000-0000-000000000004', (SELECT id
            FROM cmdb_relationship_types
            WHERE code='runs_on'), 'f3000000-0000-0000-0000-000000000006', 'f3000000-0000-0000-0000-000000000002', '{}'),
        ('f5000000-0000-0000-0000-000000000005', (SELECT id
            FROM cmdb_relationship_types
            WHERE code='runs_on'), 'f3000000-0000-0000-0000-000000000007', 'f3000000-0000-0000-0000-000000000002', '{}'),
        ('f5000000-0000-0000-0000-000000000006', (SELECT id
            FROM cmdb_relationship_types
            WHERE code='runs_on'), 'f3000000-0000-0000-0000-000000000008', 'f3000000-0000-0000-0000-000000000002', '{}'),
        -- Database runs_on VM
        ('f5000000-0000-0000-0000-000000000007', (SELECT id
            FROM cmdb_relationship_types
            WHERE code='runs_on'), 'f3000000-0000-0000-0000-000000000013', 'f3000000-0000-0000-0000-000000000004', '{}'),
        -- Application depends_on Database
        ('f5000000-0000-0000-0000-000000000008', (SELECT id
            FROM cmdb_relationship_types
            WHERE code='depends_on'), 'f3000000-0000-0000-0000-000000000016', 'f3000000-0000-0000-0000-000000000013', '{}'),
        ('f5000000-0000-0000-0000-000000000009', (SELECT id
            FROM cmdb_relationship_types
            WHERE code='depends_on'), 'f3000000-0000-0000-0000-000000000016', 'f3000000-0000-0000-0000-000000000015', '{}'),
        ('f5000000-0000-0000-0000-000000000010', (SELECT id
            FROM cmdb_relationship_types
            WHERE code='depends_on'), 'f3000000-0000-0000-0000-000000000017', 'f3000000-0000-0000-0000-000000000014', '{}'),
        -- Application deployed_on VM
        ('f5000000-0000-0000-0000-000000000011', (SELECT id
            FROM cmdb_relationship_types
            WHERE code='deployed_on'), 'f3000000-0000-0000-0000-000000000016', 'f3000000-0000-0000-0000-000000000005', '{}'),
        ('f5000000-0000-0000-0000-000000000012', (SELECT id
            FROM cmdb_relationship_types
            WHERE code='deployed_on'), 'f3000000-0000-0000-0000-000000000017', 'f3000000-0000-0000-0000-000000000006', '{}'),
        -- Service depends_on Application
        ('f5000000-0000-0000-0000-000000000013', (SELECT id
            FROM cmdb_relationship_types
            WHERE code='depends_on'), 'f3000000-0000-0000-0000-000000000021', 'f3000000-0000-0000-0000-000000000003', '{}'),
        ('f5000000-0000-0000-0000-000000000014', (SELECT id
            FROM cmdb_relationship_types
            WHERE code='depends_on'), 'f3000000-0000-0000-0000-000000000024', 'f3000000-0000-0000-0000-000000000008', '{}'),
        -- Monitoring monitors everything
        ('f5000000-0000-0000-0000-000000000015', (SELECT id
            FROM cmdb_relationship_types
            WHERE code='monitors'), 'f3000000-0000-0000-0000-000000000019', 'f3000000-0000-0000-0000-000000000001', '{}'),
        ('f5000000-0000-0000-0000-000000000016', (SELECT id
            FROM cmdb_relationship_types
            WHERE code='monitors'), 'f3000000-0000-0000-0000-000000000019', 'f3000000-0000-0000-0000-000000000002', '{}'),
        ('f5000000-0000-0000-0000-000000000017', (SELECT id
            FROM cmdb_relationship_types
            WHERE code='monitors'), 'f3000000-0000-0000-0000-000000000019', 'f3000000-0000-0000-0000-000000000009', '{}'),
        -- NAS backed_up_by Backup Service
        ('f5000000-0000-0000-0000-000000000018', (SELECT id
            FROM cmdb_relationship_types
            WHERE code='backed_up_by'), 'f3000000-0000-0000-0000-000000000012', 'f3000000-0000-0000-0000-000000000008', '{}'),
        -- Firewall connects_to Switch
        ('f5000000-0000-0000-0000-000000000019', (SELECT id
            FROM cmdb_relationship_types
            WHERE code='connects_to'), 'f3000000-0000-0000-0000-000000000010', 'f3000000-0000-0000-0000-000000000009', '{}'),
        -- VPN part_of Firewall
        ('f5000000-0000-0000-0000-000000000020', (SELECT id
            FROM cmdb_relationship_types
            WHERE code='part_of'), 'f3000000-0000-0000-0000-000000000020', 'f3000000-0000-0000-0000-000000000010', '{}')
    ON CONFLICT
    (type_id, from_ci_id, to_ci_id) DO NOTHING;

-- ============================================================================
-- 6. CMDB SERVICES  (dich vu CNTT)
-- ============================================================================
INSERT INTO cmdb_services
    (id, code, name, description, criticality, owner, sla, status)
VALUES
    ('f6000000-0000-0000-0000-000000000001', 'SVC-EMAIL', E'D\u1ECBch v\u1EE5 Email',         E'H\u1EC7 th\u1ED1ng email c\u00F4ng ty',              'high',     E'Ph\u00F2ng CNTT', '{"uptime":"99.9%","response_time":"4h","resolution_time":"8h"}', 'active'),
('f6000000-0000-0000-0000-000000000002', 'SVC-VPN',      E'D\u1ECBch v\u1EE5 VPN',           E'Truy c\u1EADp t\u1EEB xa qua VPN',                  'high',     E'Ph\u00F2ng CNTT', '{"uptime":"99.5%","response_time":"2h","resolution_time":"4h"}', 'active'),
('f6000000-0000-0000-0000-000000000003', 'SVC-BACKUP',   E'D\u1ECBch v\u1EE5 Backup & DR',   E'Sao l\u01B0u v\u00E0 kh\u00F4i ph\u1EE5c d\u1EEF li\u1EC7u',           'critical', E'Ph\u00F2ng CNTT', '{"uptime":"99.99%","rpo":"1h","rto":"4h"}', 'active'),
('f6000000-0000-0000-0000-000000000004', 'SVC-MONITOR',  E'D\u1ECBch v\u1EE5 Monitoring',    E'Gi\u00E1m s\u00E1t h\u1EC7 th\u1ED1ng v\u00E0 c\u1EA3nh b\u00E1o',         'high',     E'Ph\u00F2ng CNTT', '{"uptime":"99.9%","alert_latency":"5m"}', 'active'),
('f6000000-0000-0000-0000-000000000005', 'SVC-AD',       'Active Directory',     E'D\u1ECBch v\u1EE5 x\u00E1c th\u1EF1c t\u1EADp trung',             'critical', E'Ph\u00F2ng CNTT', '{"uptime":"99.99%","response_time":"1h","resolution_time":"2h"}', 'active'),
('f6000000-0000-0000-0000-000000000006', 'SVC-QLTB',     E'H\u1EC7 th\u1ED1ng Qu\u1EA3n l\u00FD TB', E'H\u1EC7 th\u1ED1ng qu\u1EA3n l\u00FD thi\u1EBFt b\u1ECB CNTT',          'normal',   E'Ph\u00F2ng CNTT', '{"uptime":"99.5%","response_time":"4h","resolution_time":"8h"}', 'active')
ON CONFLICT
(code) DO
UPDATE SET
    name = EXCLUDED.name, description = EXCLUDED.description, criticality = EXCLUDED.criticality,
    owner = EXCLUDED.owner, sla = EXCLUDED.sla, status = EXCLUDED.status;

-- ============================================================================
-- 7. CMDB SERVICE CIs  (gan CI vao dich vu)
-- ============================================================================
INSERT INTO cmdb_service_cis
    (service_id, ci_id, dependency_type)
VALUES
    -- Email Service
    ('f6000000-0000-0000-0000-000000000001', 'f3000000-0000-0000-0000-000000000018', 'primary'),
    ('f6000000-0000-0000-0000-000000000001', 'f3000000-0000-0000-0000-000000000021', 'supporting'),
    -- VPN Service
    ('f6000000-0000-0000-0000-000000000002', 'f3000000-0000-0000-0000-000000000020', 'primary'),
    ('f6000000-0000-0000-0000-000000000002', 'f3000000-0000-0000-0000-000000000010', 'supporting'),
    -- Backup Service
    ('f6000000-0000-0000-0000-000000000003', 'f3000000-0000-0000-0000-000000000008', 'primary'),
    ('f6000000-0000-0000-0000-000000000003', 'f3000000-0000-0000-0000-000000000012', 'primary'),
    -- Monitoring Service
    ('f6000000-0000-0000-0000-000000000004', 'f3000000-0000-0000-0000-000000000019', 'primary'),
    -- AD Service
    ('f6000000-0000-0000-0000-000000000005', 'f3000000-0000-0000-0000-000000000003', 'primary'),
    -- QLTB Service
    ('f6000000-0000-0000-0000-000000000006', 'f3000000-0000-0000-0000-000000000016', 'primary'),
    ('f6000000-0000-0000-0000-000000000006', 'f3000000-0000-0000-0000-000000000013', 'supporting'),
    ('f6000000-0000-0000-0000-000000000006', 'f3000000-0000-0000-0000-000000000005', 'supporting')
ON CONFLICT
(service_id, ci_id) DO
UPDATE SET dependency_type = EXCLUDED.dependency_type;

-- ============================================================================
-- 8. CMDB SMART TAGS
-- ============================================================================
INSERT INTO cmdb_smart_tags
    (id, tag_name, tag_category, color, description, auto_assign_rules)
VALUES
    ('f7000000-0000-0000-0000-000000000001', E'S\u1EA3n xu\u1EA5t',     'environment', '#22c55e', E'CI thu\u1ED9c m\u00F4i tr\u01B0\u1EDDng production',   '[{"field":"environment","operator":"=","value":"prod"}]'),
('f7000000-0000-0000-0000-000000000002', E'Quan tr\u1ECDng cao', 'priority',    '#ef4444', E'CI \u0111\u01B0\u1EE3c \u0111\u00E1nh gi\u00E1 quan tr\u1ECDng',  '[{"field":"notes","operator":"contains","value":"critical"}]'),
('f7000000-0000-0000-0000-000000000003', 'Windows',       'os',          '#0078d4', E'CI ch\u1EA1y Windows',                '[{"field":"os","operator":"contains","value":"Windows"}]'),
('f7000000-0000-0000-0000-000000000004', 'Linux',         'os',          '#f5a623', E'CI ch\u1EA1y Linux/Ubuntu',            '[{"field":"os","operator":"contains","value":"Ubuntu"}]'),
('f7000000-0000-0000-0000-000000000005', 'VMware',        'platform',    '#717cb4', E'CI tr\u00EAn n\u1EC1n t\u1EA3ng VMware',        '[{"field":"hypervisor","operator":"contains","value":"ESXi"}]')
ON CONFLICT
(id) DO
UPDATE SET tag_name = EXCLUDED.tag_name;

-- ============================================================================
-- 9. CMDB CI TAGS  (gan tag cho CI)
-- ============================================================================
INSERT INTO cmdb_ci_tags
    (ci_id, tag_id, assigned_by, confidence)
VALUES
    ('f3000000-0000-0000-0000-000000000001', 'f7000000-0000-0000-0000-000000000001', 'auto', 1.0),
    ('f3000000-0000-0000-0000-000000000002', 'f7000000-0000-0000-0000-000000000001', 'auto', 1.0),
    ('f3000000-0000-0000-0000-000000000001', 'f7000000-0000-0000-0000-000000000005', 'auto', 1.0),
    ('f3000000-0000-0000-0000-000000000003', 'f7000000-0000-0000-0000-000000000003', 'auto', 0.95),
    ('f3000000-0000-0000-0000-000000000004', 'f7000000-0000-0000-0000-000000000004', 'auto', 0.95),
    ('f3000000-0000-0000-0000-000000000016', 'f7000000-0000-0000-0000-000000000002', 'manual', 1.0)
ON CONFLICT
(ci_id, tag_id) DO NOTHING;

-- ============================================================================
-- 10. CMDB IMPACT RULES
-- ============================================================================
INSERT INTO cmdb_impact_rules
    (id, name, source_ci_type_id, relationship_type_id, impact_level, propagation_depth, conditions, is_active)
VALUES
    ('f8000000-0000-0000-0000-000000000001', E'Server down \u1EA3nh h\u01B0\u1EDFng VM',
(SELECT id
FROM cmdb_ci_types
WHERE code='server')
,
(SELECT id
FROM cmdb_relationship_types
WHERE code='runs_on')
, 'critical', 3, '{"source_status": "inactive"}', true),
('f8000000-0000-0000-0000-000000000002', E'Database down \u1EA3nh h\u01B0\u1EDFng \u1EE9ng d\u1EE5ng',
(SELECT id
FROM cmdb_ci_types
WHERE code='database')
,
(SELECT id
FROM cmdb_relationship_types
WHERE code='depends_on')
, 'high', 2, '{"source_status": "inactive"}', true),
('f8000000-0000-0000-0000-000000000003', E'Firewall down \u1EA3nh h\u01B0\u1EDFng m\u1EA1ng',
(SELECT id
FROM cmdb_ci_types
WHERE code='firewall')
,
(SELECT id
FROM cmdb_relationship_types
WHERE code='connects_to')
, 'critical', 1, '{"source_status": "inactive"}', true)
ON CONFLICT
(id) DO
UPDATE SET name = EXCLUDED.name;

-- ============================================================================
-- 11. CMDB DISCOVERY RULES
-- ============================================================================
INSERT INTO cmdb_discovery_rules
    (id, name, discovery_type, scope, schedule_cron, mapping_rules, is_active)
VALUES
    ('f9000000-0000-0000-0000-000000000001', E'Qu\u00E9t m\u1EA1ng DC', 'network_scan', '["10.0.1.0/24","10.0.2.0/24"]', '0 2 * * 0', '[{"field":"hostname","target":"name"},{"field":"ip","target":"mgmt_ip"}]', true),
('f9000000-0000-0000-0000-000000000002', E'Nh\u1EADp t\u1EEB CMDB file', 'manual_import', '["csv","excel"]', NULL, '[{"field":"Name","target":"name"},{"field":"Type","target":"type_code"}]', true)
ON CONFLICT
(id) DO
UPDATE SET name = EXCLUDED.name;

-- ============================================================================
-- 12. CMDB CHANGE ASSESSMENTS
-- ============================================================================
INSERT INTO cmdb_change_assessments
    (id, title, description, target_ci_ids, impact_analysis, risk_score, status, created_by)
VALUES
    ('fa000000-0000-0000-0000-000000000001', E'N\u00E2ng c\u1EA5p ESXi 7.0 l\u00EAn 8.0', E'N\u00E2ng c\u1EA5p h\u1EC7 \u0111i\u1EC1u h\u00E0nh VMware ESXi tr\u00EAn c\u1EA3 2 host', ARRAY['f3000000-0000-0000-0000-000000000001','f3000000-0000-0000-0000-000000000002']::uuid[], '{"affected_vms": 6, "estimated_downtime": "4h", "rollback_plan": "Restore from backup"}', 7.5, 'reviewed', '00000000-0000-0000-0000-000000000002'),
('fa000000-0000-0000-0000-000000000002', E'Thay th\u1EBF Core Switch', E'Thay th\u1EBF Cisco Catalyst 2960-X b\u1EB1ng model m\u1EDBi', ARRAY['f3000000-0000-0000-0000-000000000009']::uuid[], '{"affected_devices": 15, "estimated_downtime": "2h", "rollback_plan": "Keep old switch as backup"}', 8.0, 'draft', '00000000-0000-0000-0000-000000000006')
ON CONFLICT
(id) DO
UPDATE SET title = EXCLUDED.title;

-- ============================================================================
-- 13. WORKFLOW DEFINITIONS + STEPS  (quy trinh phe duyet)
-- ============================================================================
INSERT INTO wf_definitions
    (id, key, name, request_type, version, is_active)
VALUES
    ('fb000000-0000-0000-0000-000000000001', 'wf-purchase-plan', E'Quy tr\u00ECnh duy\u1EC7t mua s\u1EAFm', 'purchase', 1, true),
('fb000000-0000-0000-0000-000000000002', 'wf-asset-issue',   E'Quy tr\u00ECnh c\u1EA5p ph\u00E1t t\u00E0i s\u1EA3n', 'asset_request', 1, true),
('fb000000-0000-0000-0000-000000000003', 'wf-asset-dispose', E'Quy tr\u00ECnh thanh l\u00FD t\u00E0i s\u1EA3n', 'disposal_request', 1, true),
('fb000000-0000-0000-0000-000000000004', 'wf-repair-order',  E'Quy tr\u00ECnh s\u1EEDa ch\u1EEFa', 'repair_request', 1, true)
ON CONFLICT
(key) DO
UPDATE SET name = EXCLUDED.name;

INSERT INTO wf_steps
    (id, definition_id, step_no, name, approver_rule, on_approve, on_reject)
VALUES
    -- Purchase plan: IT Manager -> Director
    ('fc000000-0000-0000-0000-000000000001', 'fb000000-0000-0000-0000-000000000001', 1, E'Tr\u01B0\u1EDFng ph\u00F2ng CNTT duy\u1EC7t', '{"role":"it_asset_manager"}', '{"next_step": 2}', '{"cancel": true}'),
('fc000000-0000-0000-0000-000000000002', 'fb000000-0000-0000-0000-000000000001', 2, E'Ban gi\u00E1m \u0111\u1ED1c duy\u1EC7t',   '{"role":"admin"}', '{"complete": true}', '{"cancel": true}'),
-- Asset issue: IT Manager
('fc000000-0000-0000-0000-000000000003', 'fb000000-0000-0000-0000-000000000002', 1, E'Tr\u01B0\u1EDFng ph\u00F2ng CNTT duy\u1EC7t', '{"role":"it_asset_manager"}', '{"complete": true}', '{"cancel": true}'),
-- Asset dispose: IT Manager -> Director
('fc000000-0000-0000-0000-000000000004', 'fb000000-0000-0000-0000-000000000003', 1, E'Tr\u01B0\u1EDFng ph\u00F2ng CNTT duy\u1EC7t', '{"role":"it_asset_manager"}', '{"next_step": 2}', '{"cancel": true}'),
('fc000000-0000-0000-0000-000000000005', 'fb000000-0000-0000-0000-000000000003', 2, E'Ban gi\u00E1m \u0111\u1ED1c duy\u1EC7t',   '{"role":"admin"}', '{"complete": true}', '{"cancel": true}'),
-- Repair order: IT Manager
('fc000000-0000-0000-0000-000000000006', 'fb000000-0000-0000-0000-000000000004', 1, E'Tr\u01B0\u1EDFng ph\u00F2ng CNTT duy\u1EC7t', '{"role":"it_asset_manager"}', '{"complete": true}', '{"cancel": true}')
ON CONFLICT
(definition_id, step_no) DO
UPDATE SET name = EXCLUDED.name;

-- ============================================================================
-- 14. WF REQUESTS  (yeu cau phe duyet mau)
-- ============================================================================
INSERT INTO wf_requests
    (id, code, title, request_type, priority, status, requester_id, definition_id, current_step_no, payload, submitted_at)
VALUES
    ('fd000000-0000-0000-0000-000000000001', 'WF-2024-001', E'Y\u00EAu c\u1EA7u c\u1EA5p laptop m\u1EDBi', 'asset_request', 'high', 'in_review', '00000000-0000-0000-0000-000000000004', 'fb000000-0000-0000-0000-000000000002', 1, '{"asset_type":"laptop","reason":"New employee","department":"IT"}', '2024-06-15'),
('fd000000-0000-0000-0000-000000000002', 'WF-2024-002', E'Y\u00EAu c\u1EA7u s\u1EEDa m\u00E1y in PR-001', 'repair_request', 'normal', 'approved', '00000000-0000-0000-0000-000000000006', 'fb000000-0000-0000-0000-000000000004', 1, '{"asset_code":"PR-001","severity":"medium"}', '2024-05-01'),
('fd000000-0000-0000-0000-000000000003', 'WF-2024-003', E'Y\u00EAu c\u1EA7u thanh l\u00FD LT-005', 'disposal_request', 'low', 'submitted', '00000000-0000-0000-0000-000000000002', 'fb000000-0000-0000-0000-000000000003', 1, '{"asset_code":"LT-005","reason":"End of life, beyond repair"}', '2024-07-01')
ON CONFLICT
(code) DO
UPDATE SET status = EXCLUDED.status;

-- ============================================================================
-- 15. WF APPROVALS  (ket qua phe duyet)
-- ============================================================================
INSERT INTO wf_approvals
    (id, request_id, step_id, step_no, assignee_user_id, status, comment, decision_at, decision_by)
VALUES
    ('fe000000-0000-0000-0000-000000000001', 'fd000000-0000-0000-0000-000000000001', 'fc000000-0000-0000-0000-000000000003', 1, '00000000-0000-0000-0000-000000000002', 'pending', NULL, NULL, NULL),
    ('fe000000-0000-0000-0000-000000000002', 'fd000000-0000-0000-0000-000000000002', 'fc000000-0000-0000-0000-000000000006', 1, '00000000-0000-0000-0000-000000000002', 'approved', E'\u0110\u1ED3ng \u00FD s\u1EEDa ch\u1EEFa', '2024-05-02', '00000000-0000-0000-0000-000000000002'),
('fe000000-0000-0000-0000-000000000003', 'fd000000-0000-0000-0000-000000000003', 'fc000000-0000-0000-0000-000000000004', 1, '00000000-0000-0000-0000-000000000002', 'pending', NULL, NULL, NULL)
ON CONFLICT
(id) DO
UPDATE SET status = EXCLUDED.status;

-- ============================================================================
-- 16. WF REQUEST LINES  (chi tiet yeu cau)
-- ============================================================================
INSERT INTO wf_request_lines
    (id, request_id, line_no, item_type, requested_qty, note, status)
VALUES
    ('ff000000-0000-0000-0000-000000000001', 'fd000000-0000-0000-0000-000000000001', 1, 'asset', 1, 'Lenovo ThinkPad T14s', 'pending'),
    ('ff000000-0000-0000-0000-000000000002', 'fd000000-0000-0000-0000-000000000001', 2, 'asset', 1, E'M\u00E0n h\u00ECnh Dell U2422H', 'pending'),
('ff000000-0000-0000-0000-000000000003', 'fd000000-0000-0000-0000-000000000002', 1, 'part',  1, 'Roller Pickup thay th\u1EBF', 'fulfilled')
ON CONFLICT
(request_id, line_no) DO
UPDATE SET status = EXCLUDED.status;

COMMIT;
