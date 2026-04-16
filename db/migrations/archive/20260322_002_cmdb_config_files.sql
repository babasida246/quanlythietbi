-- ============================================================================
-- Migration 20260322_002: Quản lý file cấu hình trong CMDB
--
-- Cho phép đính kèm file config / script config vào từng CI (Configuration Item)
-- Có lịch sử phiên bản để theo dõi thay đổi cấu hình theo thời gian.
-- ============================================================================

BEGIN;

-- ── 1. Bảng chính: file cấu hình gắn với CI ──────────────────────────────────
CREATE TABLE IF NOT EXISTS cmdb_config_files (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ci_id           UUID NOT NULL REFERENCES cmdb_cis(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    -- loại file: 'config' | 'script' | 'template' | 'env' | 'other'
    file_type       TEXT NOT NULL DEFAULT 'config'
        CHECK (file_type IN ('config', 'script', 'template', 'env', 'other')),
    -- ngôn ngữ / syntax highlighting hint: 'nginx', 'bash', 'python', 'yaml', 'json', 'xml', 'ini', 'sql', 'other'
    language        TEXT,
    description     TEXT,
    -- đường dẫn trên máy chủ, vd: /etc/nginx/nginx.conf
    file_path       TEXT,
    -- nội dung file hiện tại
    content         TEXT NOT NULL DEFAULT '',
    -- version hiện tại (tăng tự động mỗi khi update content)
    current_version INT  NOT NULL DEFAULT 1,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_by      UUID REFERENCES users(id),
    updated_by      UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_cmdb_config_files_ci_id
    ON cmdb_config_files(ci_id)
    WHERE deleted_at IS NULL;

-- ── 2. Bảng lịch sử phiên bản ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cmdb_config_file_versions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    config_file_id  UUID NOT NULL REFERENCES cmdb_config_files(id) ON DELETE CASCADE,
    version         INT  NOT NULL,
    content         TEXT NOT NULL,
    change_summary  TEXT,         -- ghi chú ngắn cho phiên bản này
    created_by      UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (config_file_id, version)
);

CREATE INDEX IF NOT EXISTS idx_cmdb_config_file_versions_file_id
    ON cmdb_config_file_versions(config_file_id);

COMMIT;
