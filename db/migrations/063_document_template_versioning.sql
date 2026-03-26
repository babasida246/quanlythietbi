-- =============================================================================
-- 063_document_template_versioning.sql
-- Shared document templates with server-side versioning (draft/published/archived)
-- =============================================================================

-- 1) Template master table
CREATE TABLE IF NOT EXISTS document_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_code VARCHAR(80) NOT NULL UNIQUE,
    name VARCHAR(160) NOT NULL,
    description TEXT,
    module VARCHAR(50) NOT NULL DEFAULT 'general',
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    active_version_id UUID,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_document_templates_org ON document_templates(organization_id);
CREATE INDEX IF NOT EXISTS idx_document_templates_module ON document_templates(module);
CREATE INDEX IF NOT EXISTS idx_document_templates_active ON document_templates(is_active);

COMMENT ON TABLE document_templates IS 'Server-managed document templates shared across the system';

-- 2) Template versions table
CREATE TABLE IF NOT EXISTS document_template_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID NOT NULL REFERENCES document_templates(id) ON DELETE CASCADE,
    version_no INTEGER NOT NULL,
    title VARCHAR(200),
    html_content TEXT NOT NULL,
    fields JSONB NOT NULL DEFAULT '[]'::jsonb,
    change_note TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'draft',
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    published_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    published_at TIMESTAMPTZ,
    CONSTRAINT chk_document_template_version_status CHECK (status IN ('draft', 'published', 'archived')),
    CONSTRAINT uk_document_template_versions UNIQUE (template_id, version_no)
);

CREATE INDEX IF NOT EXISTS idx_document_template_versions_template ON document_template_versions(template_id);
CREATE INDEX IF NOT EXISTS idx_document_template_versions_status ON document_template_versions(status);
CREATE INDEX IF NOT EXISTS idx_document_template_versions_created_at ON document_template_versions(created_at DESC);

COMMENT ON TABLE document_template_versions IS 'Version history for each shared document template';

-- 3) Add FK from active_version_id to versions (added separately for idempotency)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fk_document_templates_active_version'
    ) THEN
        ALTER TABLE document_templates
            ADD CONSTRAINT fk_document_templates_active_version
            FOREIGN KEY (active_version_id)
            REFERENCES document_template_versions(id)
            ON DELETE SET NULL;
    END IF;
END
$$;

-- 4) Ensure updated_at is touched
CREATE OR REPLACE FUNCTION set_document_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_trigger
        WHERE tgname = 'trg_document_templates_updated_at'
    ) THEN
        CREATE TRIGGER trg_document_templates_updated_at
        BEFORE UPDATE ON document_templates
        FOR EACH ROW
        EXECUTE FUNCTION set_document_templates_updated_at();
    END IF;
END
$$;
