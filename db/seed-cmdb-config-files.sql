-- =============================================================================
-- seed-cmdb-config-files.sql
-- Dữ liệu mẫu cho bảng cmdb_config_files và cmdb_config_file_versions
-- Tham chiếu CI từ seed-qlts-demo.sql (f3000000-...)
-- =============================================================================

DO $$
BEGIN

-- =============================================================================
-- 1. FILE CẤU HÌNH CHO CI-SRV-001 (ESXi Host 01)
-- =============================================================================

INSERT INTO cmdb_config_files
    (id, ci_id, name, file_type, language, description, file_path, content, current_version, created_by, updated_by)
VALUES
    (
        'e1000000-0000-0000-0000-000000000001',
        'f3000000-0000-0000-0000-000000000001',
        'network.conf',
        'config',
        'ini',
        'Cấu hình mạng cho ESXi Host 01',
        '/etc/vmware/esx.conf',
        E'/adv/Net/followHardwareMac = "true"\n/Net/TcpipHeapSize = 30\n/Net/TcpipHeapMax = 1024\n/adv/Misc/HostAgentUpdateInterval = 10\n/adv/UserVars/ESXiVPsAllowedCiphers = "!aNULL:kECDH+AESGCM:ECDH+AESGCM:RSA+AESGCM:kECDH+AES:ECDH+AES:RSA+AES"',
        1,
        '00000000-0000-0000-0000-000000000001',
        '00000000-0000-0000-0000-000000000001'
    ),
    (
        'e1000000-0000-0000-0000-000000000002',
        'f3000000-0000-0000-0000-000000000001',
        'snmp.conf',
        'config',
        'ini',
        'Cấu hình SNMP monitoring',
        '/etc/vmware/snmp.xml',
        E'<config>\n  <snmpSettings>\n    <enable>true</enable>\n    <port>161</port>\n    <communities>public</communities>\n    <syslocation>DataCenter-Room1</syslocation>\n    <syscontact>it@hospital.vn</syscontact>\n    <loglevel>info</loglevel>\n  </snmpSettings>\n</config>',
        1,
        '00000000-0000-0000-0000-000000000001',
        '00000000-0000-0000-0000-000000000001'
    )
ON CONFLICT (id) DO NOTHING;

-- Versions cho ESXi config files
INSERT INTO cmdb_config_file_versions
    (config_file_id, version, content, change_summary, created_by)
VALUES
    (
        'e1000000-0000-0000-0000-000000000001', 1,
        E'/adv/Net/followHardwareMac = "true"\n/Net/TcpipHeapSize = 30\n/Net/TcpipHeapMax = 1024\n/adv/Misc/HostAgentUpdateInterval = 10\n/adv/UserVars/ESXiVPsAllowedCiphers = "!aNULL:kECDH+AESGCM:ECDH+AESGCM:RSA+AESGCM:kECDH+AES:ECDH+AES:RSA+AES"',
        'Khởi tạo',
        '00000000-0000-0000-0000-000000000001'
    ),
    (
        'e1000000-0000-0000-0000-000000000002', 1,
        E'<config>\n  <snmpSettings>\n    <enable>true</enable>\n    <port>161</port>\n    <communities>public</communities>\n    <syslocation>DataCenter-Room1</syslocation>\n    <syscontact>it@hospital.vn</syscontact>\n    <loglevel>info</loglevel>\n  </snmpSettings>\n</config>',
        'Khởi tạo',
        '00000000-0000-0000-0000-000000000001'
    )
ON CONFLICT DO NOTHING;

-- =============================================================================
-- 2. FILE CẤU HÌNH CHO CI-VM-005 (VM-WEB01 — Nginx Web/Reverse Proxy)
-- =============================================================================

INSERT INTO cmdb_config_files
    (id, ci_id, name, file_type, language, description, file_path, content, current_version, created_by, updated_by)
VALUES
    (
        'e1000000-0000-0000-0000-000000000003',
        'f3000000-0000-0000-0000-000000000007',
        'nginx.conf',
        'config',
        'nginx',
        'Cấu hình Nginx chính — reverse proxy cho các service backend',
        '/etc/nginx/nginx.conf',
        E'user nginx;\nworker_processes auto;\nerror_log /var/log/nginx/error.log warn;\npid /var/run/nginx.pid;\n\nevents {\n    worker_connections 1024;\n    use epoll;\n}\n\nhttp {\n    include       /etc/nginx/mime.types;\n    default_type  application/octet-stream;\n    sendfile      on;\n    keepalive_timeout 65;\n    gzip on;\n    gzip_types text/plain application/json application/javascript text/css;\n\n    include /etc/nginx/conf.d/*.conf;\n}',
        2,
        '00000000-0000-0000-0000-000000000002',
        '00000000-0000-0000-0000-000000000002'
    ),
    (
        'e1000000-0000-0000-0000-000000000004',
        'f3000000-0000-0000-0000-000000000007',
        'qltb-api.conf',
        'config',
        'nginx',
        'Virtual host cho QLTB API (port 3000)',
        '/etc/nginx/conf.d/qltb-api.conf',
        E'upstream qltb_api {\n    server 127.0.0.1:3000;\n    keepalive 32;\n}\n\nserver {\n    listen 80;\n    server_name api.hospital.internal;\n\n    location /api/ {\n        proxy_pass http://qltb_api;\n        proxy_set_header Host $host;\n        proxy_set_header X-Real-IP $remote_addr;\n        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\n        proxy_connect_timeout 30s;\n        proxy_read_timeout 60s;\n    }\n\n    location /docs {\n        proxy_pass http://qltb_api;\n        proxy_set_header Host $host;\n    }\n}',
        1,
        '00000000-0000-0000-0000-000000000002',
        '00000000-0000-0000-0000-000000000002'
    ),
    (
        'e1000000-0000-0000-0000-000000000005',
        'f3000000-0000-0000-0000-000000000007',
        'deploy.sh',
        'script',
        'bash',
        'Script deploy tự động từ CI/CD pipeline',
        '/opt/scripts/deploy.sh',
        E'#!/bin/bash\nset -euo pipefail\n\nAPP_DIR="/opt/qltb"\nBACKUP_DIR="/opt/backups/qltb"\nSERVICE="qltb-api"\n\necho "=== Deploy QLTB API ===" \necho "Timestamp: $(date)"\n\n# Backup hiện tại\nmkdir -p "$BACKUP_DIR"\ncp -r "$APP_DIR" "$BACKUP_DIR/$(date +%Y%m%d_%H%M%S)"\n\n# Pull code mới\ncd "$APP_DIR"\ngit pull origin main\n\n# Install dependencies\npnpm install --frozen-lockfile\n\n# Build\npnpm build:api\n\n# Restart service\nsystemctl restart "$SERVICE"\nsystemctl status "$SERVICE" --no-pager\n\necho "=== Deploy complete ==="',
        3,
        '00000000-0000-0000-0000-000000000002',
        '00000000-0000-0000-0000-000000000002'
    )
ON CONFLICT (id) DO NOTHING;

-- Versions cho nginx và deploy script
INSERT INTO cmdb_config_file_versions
    (config_file_id, version, content, change_summary, created_by)
VALUES
    -- nginx.conf v1
    (
        'e1000000-0000-0000-0000-000000000003', 1,
        E'user nginx;\nworker_processes 4;\nerror_log /var/log/nginx/error.log;\npid /var/run/nginx.pid;\n\nevents {\n    worker_connections 512;\n}\n\nhttp {\n    include       /etc/nginx/mime.types;\n    default_type  application/octet-stream;\n    sendfile      on;\n    keepalive_timeout 65;\n    include /etc/nginx/conf.d/*.conf;\n}',
        'Khởi tạo',
        '00000000-0000-0000-0000-000000000002'
    ),
    -- nginx.conf v2 (current)
    (
        'e1000000-0000-0000-0000-000000000003', 2,
        E'user nginx;\nworker_processes auto;\nerror_log /var/log/nginx/error.log warn;\npid /var/run/nginx.pid;\n\nevents {\n    worker_connections 1024;\n    use epoll;\n}\n\nhttp {\n    include       /etc/nginx/mime.types;\n    default_type  application/octet-stream;\n    sendfile      on;\n    keepalive_timeout 65;\n    gzip on;\n    gzip_types text/plain application/json application/javascript text/css;\n\n    include /etc/nginx/conf.d/*.conf;\n}',
        'Bật gzip, tăng worker_connections, thêm epoll',
        '00000000-0000-0000-0000-000000000001'
    ),
    -- qltb-api.conf v1
    (
        'e1000000-0000-0000-0000-000000000004', 1,
        E'upstream qltb_api {\n    server 127.0.0.1:3000;\n    keepalive 32;\n}\n\nserver {\n    listen 80;\n    server_name api.hospital.internal;\n\n    location /api/ {\n        proxy_pass http://qltb_api;\n        proxy_set_header Host $host;\n        proxy_set_header X-Real-IP $remote_addr;\n        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\n        proxy_connect_timeout 30s;\n        proxy_read_timeout 60s;\n    }\n\n    location /docs {\n        proxy_pass http://qltb_api;\n        proxy_set_header Host $host;\n    }\n}',
        'Khởi tạo',
        '00000000-0000-0000-0000-000000000002'
    ),
    -- deploy.sh v1
    (
        'e1000000-0000-0000-0000-000000000005', 1,
        E'#!/bin/bash\nAPP_DIR="/opt/qltb"\nSERVICE="qltb-api"\n\ngit -C "$APP_DIR" pull origin main\npnpm --prefix "$APP_DIR" install\npnpm --prefix "$APP_DIR" build:api\nsystemctl restart "$SERVICE"\necho "Done"',
        'Khởi tạo',
        '00000000-0000-0000-0000-000000000002'
    ),
    -- deploy.sh v2
    (
        'e1000000-0000-0000-0000-000000000005', 2,
        E'#!/bin/bash\nset -euo pipefail\nAPP_DIR="/opt/qltb"\nBACKUP_DIR="/opt/backups/qltb"\nSERVICE="qltb-api"\n\necho "=== Deploy QLTB API ==="\nmkdir -p "$BACKUP_DIR"\ncp -r "$APP_DIR" "$BACKUP_DIR/$(date +%Y%m%d_%H%M%S)"\n\ncd "$APP_DIR"\ngit pull origin main\npnpm install --frozen-lockfile\npnpm build:api\nsystemctl restart "$SERVICE"\necho "Done"',
        'Thêm backup trước khi deploy, dùng set -euo pipefail',
        '00000000-0000-0000-0000-000000000001'
    ),
    -- deploy.sh v3 (current)
    (
        'e1000000-0000-0000-0000-000000000005', 3,
        E'#!/bin/bash\nset -euo pipefail\n\nAPP_DIR="/opt/qltb"\nBACKUP_DIR="/opt/backups/qltb"\nSERVICE="qltb-api"\n\necho "=== Deploy QLTB API ===" \necho "Timestamp: $(date)"\n\n# Backup hiện tại\nmkdir -p "$BACKUP_DIR"\ncp -r "$APP_DIR" "$BACKUP_DIR/$(date +%Y%m%d_%H%M%S)"\n\n# Pull code mới\ncd "$APP_DIR"\ngit pull origin main\n\n# Install dependencies\npnpm install --frozen-lockfile\n\n# Build\npnpm build:api\n\n# Restart service\nsystemctl restart "$SERVICE"\nsystemctl status "$SERVICE" --no-pager\n\necho "=== Deploy complete ==="',
        'Thêm systemctl status sau restart, thêm comments',
        '00000000-0000-0000-0000-000000000002'
    )
ON CONFLICT DO NOTHING;

-- =============================================================================
-- 3. FILE CẤU HÌNH CHO CI-DB-001 (PostgreSQL Main)
-- =============================================================================

INSERT INTO cmdb_config_files
    (id, ci_id, name, file_type, language, description, file_path, content, current_version, created_by, updated_by)
VALUES
    (
        'e1000000-0000-0000-0000-000000000006',
        'f3000000-0000-0000-0000-000000000013',
        'postgresql.conf',
        'config',
        'ini',
        'Cấu hình PostgreSQL 16 — tuning cho workload OLTP',
        '/etc/postgresql/16/main/postgresql.conf',
        E'# PostgreSQL 16 — QLTB Production\n\n# Connection\nlisten_addresses = ''localhost''\nport = 5432\nmax_connections = 200\n\n# Memory\nshared_buffers = 2GB\neffective_cache_size = 6GB\nwork_mem = 16MB\nmaintenance_work_mem = 512MB\n\n# WAL\nwal_level = replica\nmax_wal_size = 2GB\nmin_wal_size = 256MB\ncheckpoint_completion_target = 0.9\n\n# Query Planner\nrandom_page_cost = 1.1\neffective_io_concurrency = 200\n\n# Logging\nlog_min_duration_statement = 1000\nlog_line_prefix = ''%t [%p]: [%l-1] user=%u,db=%d,app=%a,client=%h ''\nlog_checkpoints = on\nlog_lock_waits = on\n\n# Autovacuum\nautovacuum_vacuum_scale_factor = 0.05\nautovacuum_analyze_scale_factor = 0.02',
        2,
        '00000000-0000-0000-0000-000000000001',
        '00000000-0000-0000-0000-000000000001'
    ),
    (
        'e1000000-0000-0000-0000-000000000007',
        'f3000000-0000-0000-0000-000000000013',
        'pg_hba.conf',
        'config',
        NULL,
        'Host-Based Authentication cho PostgreSQL',
        '/etc/postgresql/16/main/pg_hba.conf',
        E'# PostgreSQL Client Authentication Configuration\n# TYPE  DATABASE        USER            ADDRESS                 METHOD\n\n# Local connections\nlocal   all             postgres                                peer\nlocal   all             all                                     md5\n\n# IPv4 local connections\nhost    all             all             127.0.0.1/32            scram-sha-256\nhost    qltb            qltb_app        10.0.1.0/24             scram-sha-256\n\n# Replication\nlocal   replication     postgres                                peer\nhost    replication     replicator      10.0.1.0/24             scram-sha-256',
        1,
        '00000000-0000-0000-0000-000000000001',
        '00000000-0000-0000-0000-000000000001'
    ),
    (
        'e1000000-0000-0000-0000-000000000008',
        'f3000000-0000-0000-0000-000000000013',
        'backup.sh',
        'script',
        'bash',
        'Script backup PostgreSQL hàng đêm — dump + upload S3',
        '/opt/scripts/pg-backup.sh',
        E'#!/bin/bash\nset -euo pipefail\n\nDB="qltb"\nBACKUP_DIR="/opt/backups/postgres"\nDATE=$(date +%Y%m%d_%H%M%S)\nFILE="$BACKUP_DIR/${DB}_${DATE}.sql.gz"\n\nmkdir -p "$BACKUP_DIR"\n\necho "[$(date)] Starting backup of $DB..."\npg_dump -U postgres "$DB" | gzip > "$FILE"\n\necho "[$(date)] Backup saved: $FILE ($(du -sh "$FILE" | cut -f1))"\n\n# Xoá backup cũ hơn 7 ngày\nfind "$BACKUP_DIR" -name "*.sql.gz" -mtime +7 -delete\n\necho "[$(date)] Old backups cleaned. Done."',
        1,
        '00000000-0000-0000-0000-000000000001',
        '00000000-0000-0000-0000-000000000001'
    )
ON CONFLICT (id) DO NOTHING;

-- Versions cho PostgreSQL config
INSERT INTO cmdb_config_file_versions
    (config_file_id, version, content, change_summary, created_by)
VALUES
    -- postgresql.conf v1
    (
        'e1000000-0000-0000-0000-000000000006', 1,
        E'# PostgreSQL 16\nlisten_addresses = ''localhost''\nport = 5432\nmax_connections = 100\nshared_buffers = 128MB\neffective_cache_size = 4GB\nwork_mem = 4MB\nwal_level = minimal\nlog_min_duration_statement = 5000',
        'Khởi tạo với cấu hình mặc định',
        '00000000-0000-0000-0000-000000000001'
    ),
    -- postgresql.conf v2 (current — tuned)
    (
        'e1000000-0000-0000-0000-000000000006', 2,
        E'# PostgreSQL 16 — QLTB Production\n\n# Connection\nlisten_addresses = ''localhost''\nport = 5432\nmax_connections = 200\n\n# Memory\nshared_buffers = 2GB\neffective_cache_size = 6GB\nwork_mem = 16MB\nmaintenance_work_mem = 512MB\n\n# WAL\nwal_level = replica\nmax_wal_size = 2GB\nmin_wal_size = 256MB\ncheckpoint_completion_target = 0.9\n\n# Query Planner\nrandom_page_cost = 1.1\neffective_io_concurrency = 200\n\n# Logging\nlog_min_duration_statement = 1000\nlog_line_prefix = ''%t [%p]: [%l-1] user=%u,db=%d,app=%a,client=%h ''\nlog_checkpoints = on\nlog_lock_waits = on\n\n# Autovacuum\nautovacuum_vacuum_scale_factor = 0.05\nautovacuum_analyze_scale_factor = 0.02',
        'Tuning memory, WAL, autovacuum cho production workload',
        '00000000-0000-0000-0000-000000000001'
    ),
    -- pg_hba.conf v1
    (
        'e1000000-0000-0000-0000-000000000007', 1,
        E'# TYPE  DATABASE  USER  ADDRESS   METHOD\nlocal   all       postgres          peer\nlocal   all       all               md5\nhost    all       all  127.0.0.1/32  scram-sha-256\nhost    qltb      qltb_app 10.0.1.0/24  scram-sha-256\nlocal   replication  postgres       peer\nhost    replication  replicator 10.0.1.0/24  scram-sha-256',
        'Khởi tạo',
        '00000000-0000-0000-0000-000000000001'
    ),
    -- backup.sh v1
    (
        'e1000000-0000-0000-0000-000000000008', 1,
        E'#!/bin/bash\nset -euo pipefail\n\nDB="qltb"\nBACKUP_DIR="/opt/backups/postgres"\nDATE=$(date +%Y%m%d_%H%M%S)\nFILE="$BACKUP_DIR/${DB}_${DATE}.sql.gz"\n\nmkdir -p "$BACKUP_DIR"\n\necho "[$(date)] Starting backup of $DB..."\npg_dump -U postgres "$DB" | gzip > "$FILE"\n\necho "[$(date)] Backup saved: $FILE ($(du -sh "$FILE" | cut -f1))"\n\n# Xoá backup cũ hơn 7 ngày\nfind "$BACKUP_DIR" -name "*.sql.gz" -mtime +7 -delete\n\necho "[$(date)] Old backups cleaned. Done."',
        'Khởi tạo',
        '00000000-0000-0000-0000-000000000001'
    )
ON CONFLICT DO NOTHING;

-- =============================================================================
-- 4. FILE CẤU HÌNH CHO CI-FW-001 (Firewall FortiGate 60F)
-- =============================================================================

INSERT INTO cmdb_config_files
    (id, ci_id, name, file_type, language, description, file_path, content, current_version, created_by, updated_by)
VALUES
    (
        'e1000000-0000-0000-0000-000000000009',
        'f3000000-0000-0000-0000-000000000010',
        'firewall-policy.conf',
        'config',
        NULL,
        'Chính sách tường lửa — rule set cho vùng DMZ và LAN',
        '/sys/backup/firewall-policy.conf',
        E'# FortiGate 60F — Firewall Policy Export\n# Generated: 2026-03-22\n\nconfig firewall policy\n    edit 1\n        set name "LAN-to-DMZ-HTTP"\n        set srcintf "internal"\n        set dstintf "dmz"\n        set srcaddr "LAN-Subnet"\n        set dstaddr "DMZ-Servers"\n        set action accept\n        set service "HTTP" "HTTPS"\n        set logtraffic all\n    next\n    edit 2\n        set name "DMZ-to-DB-Deny"\n        set srcintf "dmz"\n        set dstintf "internal"\n        set srcaddr "DMZ-Servers"\n        set dstaddr "DB-Subnet"\n        set action deny\n        set logtraffic all\n    next\n    edit 3\n        set name "WAN-DNAT-API"\n        set srcintf "wan1"\n        set dstintf "dmz"\n        set srcaddr "all"\n        set dstaddr "VIP-API"\n        set action accept\n        set service "HTTPS"\n        set logtraffic all\n    next\nend',
        1,
        '00000000-0000-0000-0000-000000000001',
        '00000000-0000-0000-0000-000000000001'
    ),
    (
        'e1000000-0000-0000-0000-000000000010',
        'f3000000-0000-0000-0000-000000000010',
        'env-production.env',
        'env',
        NULL,
        'Biến môi trường production cho QLTB API (không chứa secret thực)',
        '/opt/qltb/.env.production.template',
        E'# QLTB Production Environment Template\n# Lưu ý: Các giá trị secret thực được inject qua Vault\n\nNODE_ENV=production\nPORT=3000\nLOG_LEVEL=info\n\n# Database (secret từ Vault)\nDATABASE_URL=postgresql://qltb_app:<DB_PASSWORD>@localhost:5432/qltb\n\n# JWT (secret từ Vault)\nJWT_SECRET=<JWT_SECRET_FROM_VAULT>\nJWT_REFRESH_SECRET=<JWT_REFRESH_SECRET_FROM_VAULT>\nJWT_EXPIRES_IN=15m\nJWT_REFRESH_EXPIRES_IN=7d\n\n# Redis\nREDIS_URL=redis://localhost:6379\nREDIS_CACHE_ENABLED=true\n\n# Email\nSMTP_HOST=smtp.hospital.internal\nSMTP_PORT=587\nSMTP_FROM=noreply@hospital.vn',
        1,
        '00000000-0000-0000-0000-000000000001',
        '00000000-0000-0000-0000-000000000001'
    )
ON CONFLICT (id) DO NOTHING;

INSERT INTO cmdb_config_file_versions
    (config_file_id, version, content, change_summary, created_by)
VALUES
    (
        'e1000000-0000-0000-0000-000000000009', 1,
        E'# FortiGate 60F — Firewall Policy Export\n# Generated: 2026-03-22\n\nconfig firewall policy\n    edit 1\n        set name "LAN-to-DMZ-HTTP"\n        set srcintf "internal"\n        set dstintf "dmz"\n        set srcaddr "LAN-Subnet"\n        set dstaddr "DMZ-Servers"\n        set action accept\n        set service "HTTP" "HTTPS"\n        set logtraffic all\n    next\n    edit 2\n        set name "DMZ-to-DB-Deny"\n        set srcintf "dmz"\n        set dstintf "internal"\n        set srcaddr "DMZ-Servers"\n        set dstaddr "DB-Subnet"\n        set action deny\n        set logtraffic all\n    next\n    edit 3\n        set name "WAN-DNAT-API"\n        set srcintf "wan1"\n        set dstintf "dmz"\n        set srcaddr "all"\n        set dstaddr "VIP-API"\n        set action accept\n        set service "HTTPS"\n        set logtraffic all\n    next\nend',
        'Khởi tạo — export từ FortiGate console',
        '00000000-0000-0000-0000-000000000001'
    ),
    (
        'e1000000-0000-0000-0000-000000000010', 1,
        E'# QLTB Production Environment Template\nNODE_ENV=production\nPORT=3000\nLOG_LEVEL=info\nDATABASE_URL=postgresql://qltb_app:<DB_PASSWORD>@localhost:5432/qltb\nJWT_SECRET=<JWT_SECRET_FROM_VAULT>\nJWT_REFRESH_SECRET=<JWT_REFRESH_SECRET_FROM_VAULT>\nJWT_EXPIRES_IN=15m\nJWT_REFRESH_EXPIRES_IN=7d\nREDIS_URL=redis://localhost:6379\nREDIS_CACHE_ENABLED=true',
        'Khởi tạo',
        '00000000-0000-0000-0000-000000000001'
    )
ON CONFLICT DO NOTHING;

-- =============================================================================
-- 5. FILE CẤU HÌNH CHO CI-NET-001 (Core Switch Cisco Catalyst)
-- =============================================================================

INSERT INTO cmdb_config_files
    (id, ci_id, name, file_type, language, description, file_path, content, current_version, created_by, updated_by)
VALUES
    (
        'e1000000-0000-0000-0000-000000000011',
        'f3000000-0000-0000-0000-000000000009',
        'running-config.txt',
        'config',
        NULL,
        'Running config của Core Switch — Cisco Catalyst 2960-X',
        'flash:/running-config.txt',
        E'! Cisco Catalyst 2960-X — Core Switch DC\n! Hostname: CORE-SW-DC\n!\nversion 15.2\nservice timestamps debug datetime msec\nservice timestamps log datetime msec\nno service password-encryption\n!\nhostname CORE-SW-DC\n!\nip domain-name hospital.local\n!\nvlan 10\n name Management\nvlan 20\n name Servers\nvlan 30\n name DMZ\nvlan 40\n name Users\n!\ninterface Vlan10\n ip address 10.0.10.1 255.255.255.0\n!\ninterface Vlan20\n ip address 10.0.20.1 255.255.255.0\n!\nip default-gateway 10.0.10.254\n!\nsnmp-server community public RO\nsnmp-server host 10.0.10.50 version 2c public\n!\nlogging host 10.0.10.51\nlogging trap informational\n!\nend',
        1,
        '00000000-0000-0000-0000-000000000001',
        '00000000-0000-0000-0000-000000000001'
    )
ON CONFLICT (id) DO NOTHING;

INSERT INTO cmdb_config_file_versions
    (config_file_id, version, content, change_summary, created_by)
VALUES
    (
        'e1000000-0000-0000-0000-000000000011', 1,
        E'! Cisco Catalyst 2960-X — Core Switch DC\nhostname CORE-SW-DC\nip domain-name hospital.local\nvlan 10\n name Management\nvlan 20\n name Servers\nvlan 30\n name DMZ\nvlan 40\n name Users\ninterface Vlan10\n ip address 10.0.10.1 255.255.255.0\ninterface Vlan20\n ip address 10.0.20.1 255.255.255.0\nip default-gateway 10.0.10.254\nsnmp-server community public RO\nend',
        'Khởi tạo — export từ switch',
        '00000000-0000-0000-0000-000000000001'
    )
ON CONFLICT DO NOTHING;

END $$;
