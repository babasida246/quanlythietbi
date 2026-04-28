import type {
    FefoLotRow,
    FefoReportFilters,
    IStockReportRepo,
    ReorderAlertRow,
    StockAvailableRow,
    StockOnHandRow,
    StockReportFilters,
    ValuationFilters,
    ValuationResult,
    ValuationRow
} from '@qltb/contracts'
import type { PgClient } from '../PgClient.js'

type StockOnHandDbRow = {
    model_id: string
    model_name: string
    brand: string | null
    warehouse_id: string
    warehouse_name: string
    on_hand: number
    uom: string | null
    min_level: number | null
}
type StockAvailableDbRow = StockOnHandDbRow & { reserved: number | null; available: number | null }
type ValuationDbRow = {
    model_id: string
    model_name: string
    on_hand: number
    avg_cost: number | string | null
    value: number | string | null
}

const DEFAULT_LIMIT = 100
const MAX_LIMIT = 1000

function clampLimit(limit?: number): number {
    if (!limit) return DEFAULT_LIMIT
    return Math.min(Math.max(limit, 1), MAX_LIMIT)
}

function toNumber(value: number | string | null | undefined): number {
    if (value === null || value === undefined) return 0
    return typeof value === 'number' ? value : Number(value)
}

function buildStockFilters(filters: StockReportFilters, params: unknown[]): string {
    const conditions: string[] = []

    if (filters.warehouseId) {
        params.push(filters.warehouseId)
        conditions.push(`ams.warehouse_id = $${params.length}`)
    }

    if (filters.modelId) {
        params.push(filters.modelId)
        conditions.push(`ams.model_id = $${params.length}`)
    }

    if (filters.q) {
        params.push(`%${filters.q}%`)
        const index = params.length
        conditions.push(`(am.model ILIKE $${index} OR am.brand ILIKE $${index})`)
    }

    if (conditions.length === 0) return ''
    return `AND ${conditions.join(' AND ')}`
}

export class StockReportRepo implements IStockReportRepo {
    constructor(private pg: PgClient) { }

    async stockOnHand(filters: StockReportFilters): Promise<StockOnHandRow[]> {
        const params: unknown[] = []
        const whereClause = buildStockFilters(filters, params)
        const limit = clampLimit(filters.limit)
        params.push(limit)

        const result = await this.pg.query<StockOnHandDbRow>(
            `SELECT
                am.id AS model_id,
                am.model AS model_name,
                am.brand,
                w.id AS warehouse_id,
                w.name AS warehouse_name,
                ams.on_hand,
                am.unit AS uom,
                am.min_stock_qty AS min_level
             FROM asset_model_stock ams
             JOIN asset_models am ON am.id = ams.model_id
             JOIN warehouses w ON w.id = ams.warehouse_id
             WHERE ams.on_hand > 0
             ${whereClause}
             ORDER BY am.model ASC, w.name ASC
             LIMIT $${params.length}`,
            params
        )

        return result.rows.map((row) => ({
            modelId: row.model_id,
            modelName: row.model_name,
            brand: row.brand,
            warehouseId: row.warehouse_id,
            warehouseName: row.warehouse_name,
            onHand: toNumber(row.on_hand),
            uom: row.uom,
            minLevel: toNumber(row.min_level)
        }))
    }

    async stockAvailable(filters: StockReportFilters): Promise<StockAvailableRow[]> {
        const params: unknown[] = []
        const whereClause = buildStockFilters(filters, params)
        const limit = clampLimit(filters.limit)
        params.push(limit)

        const result = await this.pg.query<StockAvailableDbRow>(
            `SELECT
                am.id AS model_id,
                am.model AS model_name,
                am.brand,
                w.id AS warehouse_id,
                w.name AS warehouse_name,
                ams.on_hand,
                ams.reserved,
                GREATEST(ams.on_hand - ams.reserved, 0) AS available,
                am.unit AS uom,
                am.min_stock_qty AS min_level
             FROM asset_model_stock ams
             JOIN asset_models am ON am.id = ams.model_id
             JOIN warehouses w ON w.id = ams.warehouse_id
             WHERE ams.on_hand > 0
             ${whereClause}
             ORDER BY am.model ASC, w.name ASC
             LIMIT $${params.length}`,
            params
        )

        return result.rows.map((row) => ({
            modelId: row.model_id,
            modelName: row.model_name,
            brand: row.brand,
            warehouseId: row.warehouse_id,
            warehouseName: row.warehouse_name,
            onHand: toNumber(row.on_hand),
            reserved: toNumber(row.reserved),
            available: toNumber(row.available),
            uom: row.uom,
            minLevel: toNumber(row.min_level)
        }))
    }

    async reorderAlerts(filters: StockReportFilters): Promise<ReorderAlertRow[]> {
        const params: unknown[] = []
        const whereClause = buildStockFilters(filters, params)
        const limit = clampLimit(filters.limit)
        params.push(limit)

        const result = await this.pg.query<StockOnHandDbRow>(
            `SELECT
                am.id AS model_id,
                am.model AS model_name,
                am.brand,
                w.id AS warehouse_id,
                w.name AS warehouse_name,
                ams.on_hand,
                am.unit AS uom,
                am.min_stock_qty AS min_level
             FROM asset_model_stock ams
             JOIN asset_models am ON am.id = ams.model_id
             JOIN warehouses w ON w.id = ams.warehouse_id
             WHERE ams.on_hand <= COALESCE(am.min_stock_qty, 0)
             ${whereClause}
             ORDER BY am.model ASC, w.name ASC
             LIMIT $${params.length}`,
            params
        )

        return result.rows.map((row) => ({
            modelId: row.model_id,
            modelName: row.model_name,
            brand: row.brand,
            warehouseId: row.warehouse_id,
            warehouseName: row.warehouse_name,
            onHand: toNumber(row.on_hand),
            minLevel: toNumber(row.min_level),
            uom: row.uom
        }))
    }

    async fefoLots(_filters: FefoReportFilters): Promise<FefoLotRow[]> {
        // spare_part_lots table was removed in migration 078; no FEFO data available.
        return []
    }

    async valuation(filters: ValuationFilters): Promise<ValuationResult> {
        const params: unknown[] = []
        const conditions: string[] = []

        if (filters.warehouseId) {
            params.push(filters.warehouseId)
            conditions.push(`ams.warehouse_id = $${params.length}`)
        }

        const limit = clampLimit(filters.limit)
        params.push(limit)
        const whereClause = conditions.length > 0 ? `AND ${conditions.join(' AND ')}` : ''

        const result = await this.pg.query<ValuationDbRow>(
            `WITH weighted_costs AS (
                SELECT
                    sdl.asset_model_id,
                    SUM(sdl.qty * sdl.unit_cost) / NULLIF(SUM(sdl.qty), 0) AS avg_cost
                FROM stock_document_lines sdl
                JOIN stock_documents sd ON sd.id = sdl.document_id
                WHERE sd.status = 'posted'
                  AND sdl.unit_cost IS NOT NULL
                  AND sdl.unit_cost > 0
                  AND sdl.line_type = 'qty'
                  AND sd.doc_type IN ('receipt', 'adjust')
                  AND (sd.doc_type != 'adjust' OR sdl.adjust_direction IS NULL OR sdl.adjust_direction = 'plus')
                GROUP BY sdl.asset_model_id
             )
             SELECT
                am.id AS model_id,
                am.model AS model_name,
                ams.on_hand,
                COALESCE(wc.avg_cost, 0) AS avg_cost,
                (ams.on_hand * COALESCE(wc.avg_cost, 0)) AS value
             FROM asset_model_stock ams
             JOIN asset_models am ON am.id = ams.model_id
             LEFT JOIN weighted_costs wc ON wc.asset_model_id = ams.model_id
             WHERE ams.on_hand > 0
             ${whereClause}
             ORDER BY value DESC
             LIMIT $${params.length}`,
            params
        )

        const items: ValuationRow[] = result.rows.map((row) => ({
            modelId: row.model_id,
            modelName: row.model_name,
            onHand: toNumber(row.on_hand),
            avgCost: toNumber(row.avg_cost),
            value: toNumber(row.value)
        }))
        const total = items.reduce((sum, item) => sum + item.value, 0)

        return {
            total,
            currency: 'USD',
            items
        }
    }
}
