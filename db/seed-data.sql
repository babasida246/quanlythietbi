-- ============================================================================
-- seed-data.sql  --  Du lieu nen tang: Users, Asset Status Catalog, Locations,
--   Vendors, Suppliers, CMDB CI Types, Relationship Types, Organizations
-- Chay DAU TIEN truoc cac file seed khac
-- ============================================================================
SET client_encoding
= 'UTF8';

BEGIN;

    -- ============================================================================
    -- 1. USERS  (mat khau = "Benhvien@121" cho tat ca)
    -- Hash: bcryptjs.hash('Benhvien@121', 10)
    -- ============================================================================
    INSERT INTO users
        (id, email, name, username, password_hash, role, is_active, status, created_at, updated_at)
    VALUES
        ('00000000-0000-0000-0000-000000000001', 'admin@example.com', E
    'Admin H\u1EC7 th\u1ED1ng',    'admin',     '$2b$10$uUd3WfgsTfuV.2rK23paM.v66yLIOKeg5Hrrml4WtO2v/Ep5FEVXu', 'admin',            true, 'active', NOW
    (), NOW
    ()),
    ('00000000-0000-0000-0000-000000000002', 'it.manager@example.com',  E'Nguy\u1EC5n V\u0103n Qu\u1EA3n',   'it_asset_manager', '$2b$10$uUd3WfgsTfuV.2rK23paM.v66yLIOKeg5Hrrml4WtO2v/Ep5FEVXu', 'it_asset_manager', true, 'active', NOW
    (), NOW
    ()),
    ('00000000-0000-0000-0000-000000000003', 'warehouse@example.com',   E'Tr\u1EA7n Th\u1ECB Kho',      'warehouse_keeper', '$2b$10$uUd3WfgsTfuV.2rK23paM.v66yLIOKeg5Hrrml4WtO2v/Ep5FEVXu', 'warehouse_keeper', true, 'active', NOW
    (), NOW
    ()),
    ('00000000-0000-0000-0000-000000000004', 'helpdesk@example.com',    E'L\u00EA Minh H\u1ED7 tr\u1EE3',    'user',      '$2b$10$uUd3WfgsTfuV.2rK23paM.v66yLIOKeg5Hrrml4WtO2v/Ep5FEVXu', 'user',             true, 'active', NOW
    (), NOW
    ()),
    ('00000000-0000-0000-0000-000000000005', 'accountant@example.com',  E'Ph\u1EA1m Thu K\u1EBF to\u00E1n',   'accountant','$2b$10$uUd3WfgsTfuV.2rK23paM.v66yLIOKeg5Hrrml4WtO2v/Ep5FEVXu', 'accountant',       true, 'active', NOW
    (), NOW
    ()),
    ('00000000-0000-0000-0000-000000000006', 'technician@example.com',  E'Ph\u1EA1m \u0110\u1EE9c Minh',      'technician','$2b$10$uUd3WfgsTfuV.2rK23paM.v66yLIOKeg5Hrrml4WtO2v/Ep5FEVXu', 'technician',       true, 'active', NOW
    (), NOW
    ()),
    ('00000000-0000-0000-0000-000000000007', 'requester@example.com',   E'Ho\u00E0ng Th\u1ECB Y\u1EBFn',      'requester', '$2b$10$uUd3WfgsTfuV.2rK23paM.v66yLIOKeg5Hrrml4WtO2v/Ep5FEVXu', 'requester',        true, 'active', NOW
    (), NOW
    ()),
    ('00000000-0000-0000-0000-000000000008', 'viewer@example.com',      E'\u0110\u1EB7ng Qu\u1ED1c Vi\u1EC7t',     'viewer',    '$2b$10$uUd3WfgsTfuV.2rK23paM.v66yLIOKeg5Hrrml4WtO2v/Ep5FEVXu', 'viewer',           true, 'active', NOW
    (), NOW
    ())
ON CONFLICT
    (email) DO
    UPDATE SET
    id = EXCLUDED.id, name = EXCLUDED.name, username = EXCLUDED.username,
    password_hash = EXCLUDED.password_hash, role = EXCLUDED.role,
    is_active = EXCLUDED.is_active, status = EXCLUDED.status;

    -- ============================================================================
    -- 2. ASSET STATUS CATALOG (unique index on lower(code) — use DO NOTHING)
    -- ============================================================================
    DELETE FROM asset_status_catalogs;
    INSERT INTO asset_status_catalogs
        (id, name, code, is_terminal, color)
    VALUES
        ('c0100000-0000-0000-0000-000000000001', E
    '\u0110ang s\u1EED d\u1EE5ng',  'in_use',     false, '#22c55e'),
    ('c0100000-0000-0000-0000-000000000002', E'Trong kho',      'in_stock',   false, '#3b82f6'),
    ('c0100000-0000-0000-0000-000000000003', E'\u0110ang s\u1EEDa ch\u1EEFa', 'in_repair',  false, '#f59e0b'),
    ('c0100000-0000-0000-0000-000000000004', E'\u0110\u00E3 thanh l\u00FD',   'retired',    true,  '#6b7280'),
    ('c0100000-0000-0000-0000-000000000005', E'M\u1EA5t',           'lost',       true,  '#ef4444'),
    ('c0100000-0000-0000-0000-000000000006', E'H\u1ECFng',          'broken',     true,  '#dc2626'),
    ('c0100000-0000-0000-0000-000000000007', E'Ch\u1EDD ph\u00EA duy\u1EC7t', 'pending',    false, '#a855f7'),
    ('c0100000-0000-0000-0000-000000000008', E'\u0110\u00E3 cho m\u01B0\u1EE3n',   'checked_out',false, '#06b6d4')
ON CONFLICT
    (id) DO
    UPDATE SET
    name = EXCLUDED.name, code = EXCLUDED.code, is_terminal = EXCLUDED.is_terminal, color = EXCLUDED.color;

    -- ============================================================================
    -- 3. LOCATIONS
    -- ============================================================================
    INSERT INTO locations
        (id, name, parent_id, path)
    VALUES
        ('a0000000-0000-0000-0000-000000000001', E
    'Tr\u1EE5 s\u1EDF ch\u00EDnh',          NULL, '/'),
    ('a0000000-0000-0000-0000-000000000002', E'T\u1EA7ng 1 - L\u1EC5 t\u00E2n',      'a0000000-0000-0000-0000-000000000001', '/tru-so-chinh/tang-1'),
    ('a0000000-0000-0000-0000-000000000003', E'T\u1EA7ng 2 - Ph\u00F2ng CNTT',  'a0000000-0000-0000-0000-000000000001', '/tru-so-chinh/tang-2'),
    ('a0000000-0000-0000-0000-000000000004', E'T\u1EA7ng 3 - K\u1EBF to\u00E1n',     'a0000000-0000-0000-0000-000000000001', '/tru-so-chinh/tang-3'),
    ('a0000000-0000-0000-0000-000000000005', E'T\u1EA7ng 4 - Ban gi\u00E1m \u0111\u1ED1c','a0000000-0000-0000-0000-000000000001', '/tru-so-chinh/tang-4'),
    ('a0000000-0000-0000-0000-000000000006', E'Trung t\u00E2m d\u1EEF li\u1EC7u',    NULL, '/data-center'),
    ('a0000000-0000-0000-0000-000000000007', E'Chi nh\u00E1nh H\u00E0 N\u1ED9i',      NULL, '/chi-nhanh-hn'),
    ('a0000000-0000-0000-0000-000000000008', E'Kho thi\u1EBFt b\u1ECB',          'a0000000-0000-0000-0000-000000000001', '/tru-so-chinh/kho')
ON CONFLICT
    (id) DO
    UPDATE SET
    name = EXCLUDED.name, parent_id = EXCLUDED.parent_id, path = EXCLUDED.path;

    -- ============================================================================
    -- 4. VENDORS
    -- ============================================================================
    INSERT INTO vendors
        (id, name, tax_code, phone, email, address)
    VALUES
        ('b0000000-0000-0000-0000-000000000001', 'Dell Technologies', '0100000001', '1800-1111', 'sales@dell.com', E
    'M\u1EF9'),
    ('b0000000-0000-0000-0000-000000000002', 'HP Inc.',              '0100000002', '1800-2222', 'sales@hp.com',        E'M\u1EF9'),
    ('b0000000-0000-0000-0000-000000000003', 'Lenovo',               '0100000003', '1800-3333', 'sales@lenovo.com',    E'Trung Qu\u1ED1c'),
    ('b0000000-0000-0000-0000-000000000004', 'Cisco Systems',        '0100000004', '1800-4444', 'sales@cisco.com',     E'M\u1EF9'),
    ('b0000000-0000-0000-0000-000000000005', 'Fortinet',             '0100000005', '1800-5555', 'sales@fortinet.com',  E'M\u1EF9'),
    ('b0000000-0000-0000-0000-000000000006', 'ASUS',                 '0100000006', '1800-6666', 'sales@asus.com',      E'\u0110\u00E0i Loan'),
    ('b0000000-0000-0000-0000-000000000007', 'Synology',             '0100000007', '1800-7777', 'sales@synology.com',  E'\u0110\u00E0i Loan'),
    ('b0000000-0000-0000-0000-000000000008', 'APC by Schneider',     '0100000008', '1800-8888', 'sales@apc.com',       E'Ph\u00E1p'),
    ('b0000000-0000-0000-0000-000000000009', 'Samsung',              '0100000009', '1800-9999', 'sales@samsung.com',   E'H\u00E0n Qu\u1ED1c'),
    ('b0000000-0000-0000-0000-000000000010', 'Brother',              '0100000010', '1800-1010', 'sales@brother.com',   E'Nh\u1EADt B\u1EA3n')
ON CONFLICT
    (id) DO
    UPDATE SET
    name = EXCLUDED.name, tax_code = EXCLUDED.tax_code, phone = EXCLUDED.phone,
    email = EXCLUDED.email, address = EXCLUDED.address;

    -- ============================================================================
    -- 5. SUPPLIERS
    -- ============================================================================
    INSERT INTO suppliers
        (id, code, name, contact_name, contact_email, contact_phone, address)
    VALUES
        ('b1000000-0000-0000-0000-000000000001', 'SUP-FPT', 'FPT Information System', E
    'Nguy\u1EC5n Minh Tu\u1EA5n', 'tuan.nm@fpt.com',    '024-7300-0000', E'T\u00F2a nh\u00E0 FPT, C\u1EA7u Gi\u1EA5y, H\u00E0 N\u1ED9i'),
    ('b1000000-0000-0000-0000-000000000002', 'SUP-CMC',   'CMC Telecom',           E'Tr\u1EA7n H\u1EEFu \u0110\u1EE9c',     'duc.th@cmc.com',     '024-3577-0000', E'11 Duy T\u00E2n, C\u1EA7u Gi\u1EA5y, H\u00E0 N\u1ED9i'),
    ('b1000000-0000-0000-0000-000000000003', 'SUP-VTL',   'Viettel IDC',           E'L\u00EA Quang H\u1EA3i',     'hai.lq@viettel.com', '024-6255-0000', E'01 Giang V\u0103n Minh, Ba \u0110\u00ECnh, H\u00E0 N\u1ED9i'),
    ('b1000000-0000-0000-0000-000000000004', 'SUP-MS',    E'Microsoft Vi\u1EC7t Nam',    E'Ph\u1EA1m Th\u1ECB Lan',     'lan.pt@microsoft.vn','028-3821-0000', 'SC VivoCity, Q.7, TP.HCM')
ON CONFLICT
    (id) DO
    UPDATE SET
    code = EXCLUDED.code, name = EXCLUDED.name, contact_name = EXCLUDED.contact_name,
    contact_email = EXCLUDED.contact_email, contact_phone = EXCLUDED.contact_phone, address = EXCLUDED.address;

    -- ============================================================================
    -- 6. CMDB CI TYPES
    -- ============================================================================
    INSERT INTO cmdb_ci_types
        (code, name, description, created_at)
    VALUES
        ('server', E
    'M\u00E1y ch\u1EE7 v\u1EADt l\u00FD',       E'Server v\u1EADt l\u00FD rack/tower/blade',         NOW
    ()),
    ('virtual_machine',E'M\u00E1y \u1EA3o (VM)',           E'Virtual Machine ch\u1EA1y tr\u00EAn hypervisor',   NOW
    ()),
    ('network_device', E'Thi\u1EBFt b\u1ECB m\u1EA1ng',        E'Switch, Router, Access Point, Firewall', NOW
    ()),
    ('storage',        E'H\u1EC7 th\u1ED1ng l\u01B0u tr\u1EEF',     E'SAN, NAS, Object Storage',               NOW
    ()),
    ('database',       E'C\u01A1 s\u1EDF d\u1EEF li\u1EC7u',       E'PostgreSQL, MySQL, SQL Server, Oracle',   NOW
    ()),
    ('application',    E'\u1EE8ng d\u1EE5ng',             E'Web app, API, Microservice',              NOW
    ()),
    ('service',        E'D\u1ECBch v\u1EE5 CNTT',         E'Email, VPN, DNS, DHCP, Active Directory', NOW
    ()),
    ('workstation',    E'M\u00E1y tr\u1EA1m',             E'PC/Laptop endpoint ng\u01B0\u1EDDi d\u00F9ng cu\u1ED1i',      NOW
    ()),
    ('firewall',       E'T\u01B0\u1EDDng l\u1EEDa',            E'Thi\u1EBFt b\u1ECB b\u1EA3o m\u1EADt m\u1EA1ng',                   NOW
    ()),
    ('load_balancer',  E'C\u00E2n b\u1EB1ng t\u1EA3i',         E'Load Balancer ph\u00E2n ph\u1ED1i l\u01B0u l\u01B0\u1EE3ng',       NOW
    ()),
    ('container',      'Container',            'Docker container / Kubernetes pod',        NOW
    ()),
    ('cloud_instance', E'M\u00E1y ch\u1EE7 \u0111\u00E1m m\u00E2y',     'EC2, Azure VM, GCE instance',             NOW
    ())
ON CONFLICT
    (code) DO
    UPDATE SET
    name = EXCLUDED.name, description = EXCLUDED.description;

    -- ============================================================================
    -- 7. CMDB RELATIONSHIP TYPES
    -- ============================================================================
    INSERT INTO cmdb_relationship_types
        (code, name, reverse_name, created_at)
    VALUES
        ('runs_on', E
    'Ch\u1EA1y tr\u00EAn',             E'\u0110\u01B0\u1EE3c host b\u1EDFi',     NOW
    ()),
    ('depends_on',    E'Ph\u1EE5 thu\u1ED9c v\u00E0o',         E'\u0110\u01B0\u1EE3c ph\u1EE5 thu\u1ED9c b\u1EDFi',NOW
    ()),
    ('connects_to',   E'K\u1EBFt n\u1ED1i \u0111\u1EBFn',           E'\u0110\u01B0\u1EE3c k\u1EBFt n\u1ED1i t\u1EEB',   NOW
    ()),
    ('part_of',       E'Thu\u1ED9c v\u1EC1',              E'Bao g\u1ED3m',           NOW
    ()),
    ('managed_by',    E'\u0110\u01B0\u1EE3c qu\u1EA3n l\u00FD b\u1EDFi',      E'Qu\u1EA3n l\u00FD',           NOW
    ()),
    ('backed_up_by',  E'\u0110\u01B0\u1EE3c backup b\u1EDFi',       E'Backup cho',        NOW
    ()),
    ('deployed_on',   E'Tri\u1EC3n khai tr\u00EAn',       E'Ch\u1EE9a tri\u1EC3n khai',   NOW
    ()),
    ('monitors',      E'Gi\u00E1m s\u00E1t',              E'\u0110\u01B0\u1EE3c gi\u00E1m s\u00E1t b\u1EDFi', NOW
    ())
ON CONFLICT
    (code) DO
    UPDATE SET
    name = EXCLUDED.name, reverse_name = EXCLUDED.reverse_name;

    -- ============================================================================
    -- 8. ORGANIZATIONS
    -- ============================================================================
    INSERT INTO organizations
        (id, name, created_at)
    VALUES
        ('d0000000-0000-0000-0000-000000000001', E
    'C\u00F4ng ty TNHH C\u00F4ng ngh\u1EC7 ABC',     NOW
    ()),
    ('d0000000-0000-0000-0000-000000000002', E'Ph\u00F2ng C\u00F4ng ngh\u1EC7 th\u00F4ng tin',  NOW
    ()),
    ('d0000000-0000-0000-0000-000000000003', E'Ph\u00F2ng K\u1EBF to\u00E1n - T\u00E0i ch\u00EDnh', NOW
    ())
ON CONFLICT
    (id) DO
    UPDATE SET
    name = EXCLUDED.name;

    COMMIT;
