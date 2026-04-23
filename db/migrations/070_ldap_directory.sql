-- Migration 070: LDAP Directory integration
--   1. Thêm cột tracking LDAP vào org_units (ldap_dn, ldap_sync_at, source)
--   2. Tạo bảng ldap_directory_configs để lưu cấu hình kết nối Domain Controller
-- Idempotent: IF NOT EXISTS / IF EXISTS throughout

-- ── org_units: LDAP tracking columns ────────────────────────────────────────
ALTER TABLE org_units
    ADD COLUMN IF NOT EXISTS ldap_dn       TEXT,
    ADD COLUMN IF NOT EXISTS ldap_sync_at  TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS source        VARCHAR(20) DEFAULT 'manual' NOT NULL;

-- Unique index trên ldap_dn (NULL values không vi phạm UNIQUE constraint)
CREATE UNIQUE INDEX IF NOT EXISTS org_units_ldap_dn_key
    ON org_units (ldap_dn)
    WHERE ldap_dn IS NOT NULL;

-- ── ldap_directory_configs ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ldap_directory_configs (
    id                     UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name                   VARCHAR(255) NOT NULL,
    -- Kết nối DC: ldap://dc.company.local hoặc ldaps://dc.company.local
    server_url             TEXT NOT NULL,
    -- Base Distinguished Name, ví dụ: DC=company,DC=local
    base_dn                TEXT NOT NULL,
    -- Service account dùng để bind, ví dụ: CN=svc_ldap,OU=Service Accounts,DC=company,DC=local
    bind_dn                TEXT NOT NULL,
    -- Mật khẩu service account (lưu dạng plain, nên giới hạn quyền API cho admin)
    bind_password          TEXT NOT NULL,
    -- OU gốc để search OUs (optional — mặc định dùng base_dn)
    ou_search_base         TEXT,
    -- LDAP search filter cho OUs
    ou_filter              TEXT DEFAULT '(objectClass=organizationalUnit)' NOT NULL,
    -- Bật/tắt TLS (dùng với ldaps://)
    tls_enabled            BOOLEAN DEFAULT FALSE NOT NULL,
    -- Kiểm tra certificate của DC (tắt khi dùng self-signed cert trong lab)
    tls_reject_unauthorized BOOLEAN DEFAULT TRUE NOT NULL,
    -- Chu kỳ tự động sync (giờ), 0 = chỉ sync thủ công
    sync_interval_hours    INTEGER DEFAULT 24 NOT NULL,
    -- Kết quả sync gần nhất
    last_sync_at           TIMESTAMPTZ,
    last_sync_status       VARCHAR(20),   -- 'success' | 'error' | 'running'
    last_sync_error        TEXT,
    last_sync_count        INTEGER,
    is_active              BOOLEAN DEFAULT TRUE NOT NULL,
    created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
