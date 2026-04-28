-- ============================================================================
-- Migration 078: Merge spare_parts into asset_models catalog
--
-- What changes:
--   1. Create asset_model_stock  — replaces spare_part_stock (per-warehouse qty)
--   2. Create asset_model_movements — replaces spare_part_movements (ledger)
--   3. stock_document_lines: drop part_id, update line_type constraint
--      ('spare_part' → 'qty', 'asset' → 'serial')
--   4. repair_order_parts: add model_id column (parallel to old part_id)
--   5. Drop: v_stock_available, spare_part_lots, spare_part_movements,
--            spare_part_stock, spare_parts
--   6. Drop: component module tables
-- ============================================================================

-- ─── 1. New: per-warehouse model quantity stock ───────────────────────────────
CREATE TABLE IF NOT EXISTS public.asset_model_stock (
    id          uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    warehouse_id uuid NOT NULL,
    model_id     uuid NOT NULL REFERENCES public.asset_models(id) ON DELETE CASCADE,
    on_hand      integer DEFAULT 0 NOT NULL CHECK (on_hand >= 0),
    reserved     integer DEFAULT 0 NOT NULL CHECK (reserved >= 0),
    updated_at   timestamptz DEFAULT now(),
    CONSTRAINT asset_model_stock_pk PRIMARY KEY (id),
    CONSTRAINT asset_model_stock_wh_model_uq UNIQUE (warehouse_id, model_id)
);
CREATE INDEX IF NOT EXISTS idx_asset_model_stock_warehouse ON public.asset_model_stock (warehouse_id);
CREATE INDEX IF NOT EXISTS idx_asset_model_stock_model    ON public.asset_model_stock (model_id);

-- ─── 2. New: model quantity movement ledger ──────────────────────────────────
CREATE TABLE IF NOT EXISTS public.asset_model_movements (
    id              uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    warehouse_id    uuid NOT NULL,
    model_id        uuid NOT NULL REFERENCES public.asset_models(id) ON DELETE CASCADE,
    movement_type   text NOT NULL
        CHECK (movement_type = ANY (ARRAY[
            'in','out','adjust_in','adjust_out',
            'transfer_in','transfer_out','reserve','release'
        ])),
    qty             integer NOT NULL CHECK (qty > 0),
    unit_cost       numeric(12,2),
    ref_type        text,
    ref_id          uuid,
    actor_user_id   text,
    correlation_id  text,
    created_at      timestamptz DEFAULT now(),
    CONSTRAINT asset_model_movements_pk PRIMARY KEY (id)
);
CREATE INDEX IF NOT EXISTS idx_asset_model_movements_model    ON public.asset_model_movements (model_id);
CREATE INDEX IF NOT EXISTS idx_asset_model_movements_warehouse ON public.asset_model_movements (warehouse_id);

-- ─── 3. stock_document_lines: migrate line_type values ───────────────────────
-- Update existing rows: 'spare_part' → 'qty', 'asset' → 'serial'
-- We do this before altering the constraint so existing data isn't blocked.
UPDATE public.stock_document_lines
SET line_type = 'qty'
WHERE line_type = 'spare_part';

UPDATE public.stock_document_lines
SET line_type = 'serial'
WHERE line_type = 'asset';

-- For rows that had part_id but no asset_model_id, copy the spare_part model_id
-- via the FK we added in migration 077. This requires spare_parts to still exist.
UPDATE public.stock_document_lines sdl
SET asset_model_id = sp.model_id
FROM public.spare_parts sp
WHERE sdl.part_id = sp.id
  AND sdl.asset_model_id IS NULL
  AND sp.model_id IS NOT NULL;

-- Drop the old content check that references part_id
ALTER TABLE public.stock_document_lines
    DROP CONSTRAINT IF EXISTS stock_doc_lines_content_chk;

-- Drop the old line_type check
ALTER TABLE public.stock_document_lines
    DROP CONSTRAINT IF EXISTS stock_doc_lines_type_chk;

-- Add updated constraints
ALTER TABLE public.stock_document_lines
    ADD CONSTRAINT stock_doc_lines_content_chk
        CHECK ((asset_model_id IS NOT NULL) OR (asset_id IS NOT NULL)),
    ADD CONSTRAINT stock_doc_lines_type_chk
        CHECK ((line_type)::text = ANY (ARRAY['qty'::text, 'serial'::text]));

-- Drop part_id column (was FK to spare_parts)
ALTER TABLE public.stock_document_lines
    DROP COLUMN IF EXISTS part_id;

-- ─── 4. repair_order_parts: add model_id column ──────────────────────────────
-- Keep old part_id for backward-compat data migration; add new model_id.
-- Populate model_id from spare_parts.model_id where possible.
ALTER TABLE public.repair_order_parts
    ADD COLUMN IF NOT EXISTS model_id uuid REFERENCES public.asset_models(id) ON DELETE SET NULL;

UPDATE public.repair_order_parts rop
SET model_id = sp.model_id
FROM public.spare_parts sp
WHERE rop.part_id = sp.id
  AND rop.model_id IS NULL
  AND sp.model_id IS NOT NULL;

-- ─── 5. Drop spare_part infrastructure ───────────────────────────────────────
DROP VIEW  IF EXISTS public.v_stock_available;
DROP TABLE IF EXISTS public.spare_part_lots      CASCADE;
DROP TABLE IF EXISTS public.spare_part_movements CASCADE;
DROP TABLE IF EXISTS public.spare_part_stock     CASCADE;
DROP TABLE IF EXISTS public.spare_parts          CASCADE;

-- old part_id column in repair_order_parts no longer needed
ALTER TABLE public.repair_order_parts
    DROP COLUMN IF EXISTS part_id;

-- ─── 6. Drop component module tables ─────────────────────────────────────────
DROP TABLE IF EXISTS public.component_audit_logs    CASCADE;
DROP TABLE IF EXISTS public.component_assignments   CASCADE;
DROP TABLE IF EXISTS public.component_receipts      CASCADE;
DROP TABLE IF EXISTS public.component_manufacturers CASCADE;
DROP TABLE IF EXISTS public.component_categories    CASCADE;
DROP TABLE IF EXISTS public.components              CASCADE;

-- ─── 7. Replace v_stock_available with model-based view ──────────────────────
CREATE OR REPLACE VIEW public.v_model_stock AS
SELECT
    ams.warehouse_id,
    w.code  AS warehouse_code,
    w.name  AS warehouse_name,
    ams.model_id,
    am.model AS model_name,
    am.brand,
    ac.name  AS category_name,
    am.unit  AS uom,
    ams.on_hand,
    ams.reserved,
    GREATEST(ams.on_hand - ams.reserved, 0) AS available,
    am.min_stock_qty AS min_level
FROM public.asset_model_stock ams
JOIN public.warehouses   w  ON w.id  = ams.warehouse_id
JOIN public.asset_models am ON am.id = ams.model_id
LEFT JOIN public.asset_categories ac ON ac.id = am.category_id;
