-- 067_document_template_sql_data_source.sql
-- Add SQL data-source binding metadata for print document templates.
-- This migration stores linkage only (routine kind/name). Routine definitions are managed via API.

BEGIN;

ALTER TABLE public.document_templates
    ADD COLUMN IF NOT EXISTS data_source_kind character varying(20) NOT NULL DEFAULT 'none',
    ADD COLUMN IF NOT EXISTS data_source_name character varying(200),
    ADD COLUMN IF NOT EXISTS data_source_updated_at timestamp with time zone,
    ADD COLUMN IF NOT EXISTS data_source_updated_by uuid;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'chk_document_templates_data_source_kind'
    ) THEN
        ALTER TABLE public.document_templates
            ADD CONSTRAINT chk_document_templates_data_source_kind
            CHECK (
                data_source_kind IN ('none', 'function', 'procedure')
            );
    END IF;
END
$$;

COMMENT ON COLUMN public.document_templates.data_source_kind IS
    'Source kind for print data loading: none|function|procedure';
COMMENT ON COLUMN public.document_templates.data_source_name IS
    'Schema-qualified routine name used to load print data (e.g. print_data_sources.get_issue_data)';

COMMIT;
