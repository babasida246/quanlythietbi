-- Migration 066: Extend attachments entity_type to support 'asset_model'
-- Allows storing images and documents for asset model catalog entries.

DO $$
BEGIN
    -- Drop old CHECK constraint and replace with an extended one
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE table_name = 'attachments'
          AND constraint_type = 'CHECK'
          AND constraint_name LIKE '%entity_type%'
    ) THEN
        ALTER TABLE public.attachments
            DROP CONSTRAINT IF EXISTS attachments_entity_type_check;
    END IF;

    ALTER TABLE public.attachments
        ADD CONSTRAINT attachments_entity_type_check
        CHECK (entity_type = ANY (ARRAY[
            'repair_order'::text,
            'stock_document'::text,
            'asset_model'::text
        ]));
END$$;

-- Index for fast lookup by asset_model
CREATE INDEX IF NOT EXISTS idx_attachments_asset_model
    ON public.attachments (entity_id)
    WHERE entity_type = 'asset_model';
