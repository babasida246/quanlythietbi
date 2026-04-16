-- Migration 056: Workflow Request Lines
-- Adds wf_request_lines table: header + lines model for all wf_requests
-- Each request line represents one item (asset / spare part / service)
-- with individual status tracking and partial-fulfillment support.

BEGIN;

-- ==================== wf_request_lines ====================
CREATE TABLE IF NOT EXISTS wf_request_lines (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id      UUID NOT NULL REFERENCES wf_requests(id) ON DELETE CASCADE,
    line_no         INT NOT NULL,           -- 1-based ordering within a request

    -- Item classification
    item_type       VARCHAR(20) NOT NULL DEFAULT 'part'
                        CHECK (item_type IN ('asset', 'part', 'service')),

    -- References (only one should be set unless item_type = 'service')
    asset_id        UUID REFERENCES assets(id) ON DELETE SET NULL,
    part_id         UUID REFERENCES spare_parts(id) ON DELETE SET NULL,

    -- Quantities
    requested_qty   INT NOT NULL DEFAULT 1 CHECK (requested_qty > 0),
    fulfilled_qty   INT NOT NULL DEFAULT 0 CHECK (fulfilled_qty >= 0),

    -- Optional pricing & notes
    unit_cost       NUMERIC(18, 4),
    note            TEXT,
    metadata        JSONB NOT NULL DEFAULT '{}',   -- free-form extras (serial_no, spec, etc.)

    -- Line-level lifecycle
    status          VARCHAR(20) NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'partial', 'fulfilled', 'cancelled')),

    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE (request_id, line_no)
);

COMMENT ON TABLE  wf_request_lines IS 'Individual line items within a workflow request (header+lines model)';
COMMENT ON COLUMN wf_request_lines.item_type    IS 'asset | part | service';
COMMENT ON COLUMN wf_request_lines.fulfilled_qty IS 'Quantity actually provided; enables partial-fulfillment tracking';
COMMENT ON COLUMN wf_request_lines.metadata      IS 'Arbitrary per-line data: serial_no, spec fields, etc.';
COMMENT ON COLUMN wf_request_lines.status        IS 'pending | partial | fulfilled | cancelled';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_wf_req_lines_request ON wf_request_lines(request_id);
CREATE INDEX IF NOT EXISTS idx_wf_req_lines_status  ON wf_request_lines(status);
CREATE INDEX IF NOT EXISTS idx_wf_req_lines_part    ON wf_request_lines(part_id) WHERE part_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_wf_req_lines_asset   ON wf_request_lines(asset_id) WHERE asset_id IS NOT NULL;

-- ==================== Helper trigger: keep updated_at fresh ====================
CREATE OR REPLACE FUNCTION fn_wf_req_line_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_wf_req_lines_updated_at ON wf_request_lines;
CREATE TRIGGER trg_wf_req_lines_updated_at
    BEFORE UPDATE ON wf_request_lines
    FOR EACH ROW EXECUTE FUNCTION fn_wf_req_line_updated_at();

-- ==================== Helper view: request with line summary ====================
CREATE OR REPLACE VIEW v_wf_request_line_summary AS
SELECT
    r.id                AS request_id,
    r.code,
    r.title,
    r.status            AS request_status,
    COUNT(l.id)         AS total_lines,
    SUM(l.requested_qty) AS total_requested_qty,
    SUM(l.fulfilled_qty) AS total_fulfilled_qty,
    SUM(CASE WHEN l.status = 'fulfilled' THEN 1 ELSE 0 END)  AS fulfilled_lines,
    SUM(CASE WHEN l.status = 'partial'   THEN 1 ELSE 0 END)  AS partial_lines,
    SUM(CASE WHEN l.status = 'pending'   THEN 1 ELSE 0 END)  AS pending_lines,
    SUM(CASE WHEN l.status = 'cancelled' THEN 1 ELSE 0 END)  AS cancelled_lines,
    ROUND(
        CASE WHEN SUM(l.requested_qty) > 0
             THEN 100.0 * SUM(l.fulfilled_qty) / SUM(l.requested_qty)
             ELSE 0
        END, 1
    )                   AS fulfill_pct
FROM wf_requests r
LEFT JOIN wf_request_lines l ON l.request_id = r.id
GROUP BY r.id, r.code, r.title, r.status;

COMMENT ON VIEW v_wf_request_line_summary IS
    'Summary of line fulfillment per wf_request (total_lines, fulfill_pct, etc.)';

COMMIT;
