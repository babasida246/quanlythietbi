-- 080 — Allow free-text asset description lines in stock_document_lines
-- Needed so auto-generated issue documents from workflow requests can
-- include lines where the requester provided only a text description
-- (no specific model or asset selected yet).

ALTER TABLE public.stock_document_lines
    DROP CONSTRAINT IF EXISTS stock_doc_lines_content_chk;

ALTER TABLE public.stock_document_lines
    ADD CONSTRAINT stock_doc_lines_content_chk
        CHECK (
            (asset_model_id IS NOT NULL)
            OR (asset_id IS NOT NULL)
            OR (asset_name IS NOT NULL)
        );
