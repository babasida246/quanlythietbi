-- Migration: Documents Module
-- Creates tables for document management

-- Function for auto-updating updated_at timestamps
CREATE OR REPLACE FUNCTION set_updated_at_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 1. documents
-- ============================================================
CREATE TABLE IF NOT EXISTS documents (
    id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_id        UUID        NULL,
    type             TEXT        NOT NULL DEFAULT 'other',
    title            TEXT        NOT NULL,
    summary          TEXT        NULL,
    content_type     TEXT        NOT NULL DEFAULT 'file',
    markdown         TEXT        NULL,
    external_url     TEXT        NULL,
    visibility       TEXT        NOT NULL DEFAULT 'team',
    approval_status  TEXT        NOT NULL DEFAULT 'draft',
    approval_reason  TEXT        NULL,
    requested_by     UUID        NULL,
    approved_by      UUID        NULL,
    approved_at      TIMESTAMPTZ NULL,
    version          TEXT        NOT NULL DEFAULT '1',
    tags             TEXT[]      NULL,
    created_by       UUID        NULL,
    updated_by       UUID        NULL,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_documents_type        ON documents (type);
CREATE INDEX IF NOT EXISTS idx_documents_visibility  ON documents (visibility);
CREATE INDEX IF NOT EXISTS idx_documents_status      ON documents (approval_status);
CREATE INDEX IF NOT EXISTS idx_documents_updated_at  ON documents (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_documents_tags        ON documents USING GIN (tags);

-- ============================================================
-- 2. document_files
-- ============================================================
CREATE TABLE IF NOT EXISTS document_files (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id   UUID        NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    storage_key   TEXT        NOT NULL,
    filename      TEXT        NOT NULL,
    sha256        TEXT        NULL,
    size_bytes    BIGINT      NULL,
    mime_type     TEXT        NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_document_files_document ON document_files (document_id);

-- ============================================================
-- 3. document_relations
-- ============================================================
CREATE TABLE IF NOT EXISTS document_relations (
    document_id    UUID   NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    relation_type  TEXT   NOT NULL,
    relation_id    TEXT   NOT NULL,
    PRIMARY KEY (document_id, relation_type, relation_id)
);

CREATE INDEX IF NOT EXISTS idx_document_relations_document ON document_relations (document_id);
CREATE INDEX IF NOT EXISTS idx_document_relations_type_id  ON document_relations (relation_type, relation_id);
