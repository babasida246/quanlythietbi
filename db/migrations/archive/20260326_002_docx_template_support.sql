-- Migration: Add DOCX binary template support to document_template_versions
-- Date: 2026-03-26
-- Allows document_template_versions to store either HTML or .docx binary content.
-- docxtemplater syntax: {variable}, {#array}...{/array} for table row loops.

ALTER TABLE document_template_versions
    ADD COLUMN IF NOT EXISTS template_format TEXT NOT NULL DEFAULT 'html',
    ADD COLUMN IF NOT EXISTS binary_content   BYTEA;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'chk_dtv_template_format'
          AND conrelid = 'document_template_versions'::regclass
    ) THEN
        ALTER TABLE document_template_versions
            ADD CONSTRAINT chk_dtv_template_format
                CHECK (template_format IN ('html', 'docx'));
    END IF;
END $$;

COMMENT ON COLUMN document_template_versions.template_format IS
    'html = HTML template with {{field}} placeholders; docx = binary .docx with docxtemplater {field} / {#arr}..{/arr} syntax';
COMMENT ON COLUMN document_template_versions.binary_content IS
    'Raw .docx file bytes (non-null when template_format = ''docx'')';
