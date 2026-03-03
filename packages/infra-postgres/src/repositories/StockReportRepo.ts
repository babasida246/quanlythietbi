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
    part_id: string
    part_code: string
    part_name: string
    warehouse_id: string
    warehouse_name: string
    on_hand: number
    uom: string | null
    min_level: number | null
}
type StockAvailableDbRow = StockOnHandDbRow & { reserved: number | null; available: number | null }
type ValuationDbRow = {
    part_id: string
    part_code: string
    part_name: string
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
        conditions.push(`sps.warehouse_id = $${params.length}`)
    }

    if (filters.partId) {
        params.push(filters.partId)
        conditions.push(`sps.part_id = $${params.length}`)
    }

    if (filters.q) {
        params.push(`%${filters.q}%`)
        const index = params.length
        conditions.push(`(p.part_code ILIKE $${index} OR p.name ILIKE $${index})`)
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
                p.id AS part_id,
                p.part_code AS part_code,
                p.name AS part_name,
                w.id AS warehouse_id,
                w.name AS warehouse_name,
                sps.on_hand AS on_hand,
                p.uom AS uom,
                p.min_level AS min_level
             FROM spare_part_stock sps
             JOIN spare_parts p ON p.id = sps.part_id
             JOIN warehouses w ON w.id = sps.warehouse_id
             WHERE sps.on_hand > 0
             ${whereClause}
             ORDER BY p.name ASC, w.name ASC
             LIMIT $${params.length}`,
            params
        )

        return result.rows.map((row) => ({
            partId: row.part_id,
            partCode: row.part_code,
            partName: row.part_name,
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
                p.id AS part_id,
                p.part_code AS part_code,
                p.name AS part_name,
                w.id AS warehouse_id,
                w.name AS warehouse_name,
                sps.on_hand AS on_hand,
                sps.reserved AS reserved,
                (sps.on_hand - sps.reserved) AS available,
                p.uom AS uom,
                p.min_level AS min_level
             FROM spare_part_stock sps
             JOIN spare_parts p ON p.id = sps.part_id
             JOIN warehouses w ON w.id = sps.warehouse_id
             WHERE sps.on_hand > 0
             ${whereClause}
             ORDER BY p.name ASC, w.name ASC
             LIMIT $${params.length}`,
            params
        )

        return result.rows.map((row) => ({
            partId: row.part_id,
            partCode: row.part_code,
            partName: row.part_name,
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
                p.id AS part_id,
                p.part_code AS part_code,
                p.name AS part_name,
                w.id AS warehouse_id,
                w.name AS warehouse_name,
                sps.on_hand AS on_hand,
                p.uom AS uom,
                p.min_level AS min_level
             FROM spare_part_stock sps
             JOIN spare_parts p ON p.id = sps.part_id
             JOIN warehouses w ON w.id = sps.warehouse_id
             WHERE sps.on_hand <= p.min_level
             ${whereClause}
             ORDER BY p.name ASC, w.name ASC
             LIMIT $${params.length}`,
            params
        )

        return result.rows.map((row) => ({
            partId: row.part_id,
            partCode: row.part_code,
            partName: row.part_name,
            warehouseId: row.warehouse_id,
            warehouseName: row.warehouse_name,
            onHand: toNumber(row.on_hand),
            minLevel: toNumber(row.min_level),
            uom: row.uom
        }))
    }

    async fefoLots(filters: FefoReportFilters): Promise<FefoLotRow[]> {
        const params: unknown[] = []
        const conditions: string[] = []
        const daysThreshold = filters.daysThreshold ?? 90

        if (filters.warehouseId) {
            params.push(filters.warehouseId)
            conditions.push(`l.warehouse_id = $${params.length}`)
        }

        conditions.push('l.on_hand > 0')
        conditions.push("l.status != 'consumed'")

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
        const limit = clampLimit(filters.limit)
        params.push(limit)
        params.push(daysThreshold)

        type FefoDbRow = {
            lot_id: string
            lot_number: string
            part_id: string
            part_code: string
            part_name: string
            warehouse_id: string
            warehouse_name: string
            manufacture_date: Date | null
            expiry_date: Date | null
            days_until_expiry: number | null
            on_hand: number
            uom: string | null
        }

        const result = await this.pg.query<FefoDbRow>(
            `SELECT
                l.id AS lot_id,
                l.lot_number,
                l.part_id,
                p.part_code,
                p.name AS part_name,
                l.warehouse_id,
                w.name AS warehouse_name,
                l.manufacture_date,
                l.expiry_date,
                CASE WHEN l.expiry_date IS NOT NULL
                     THEN (l.expiry_date - CURRENT_DATE)
                     ELSE NULL
                END AS days_until_expiry,
                l.on_hand,
                p.uom
             FROM spare_part_lots l
             JOIN spare_parts p ON p.id = l.part_id
             JOIN warehouses w ON w.id = l.warehouse_id
             ${whereClause}
             ORDER BY l.expiry_date ASC NULLS LAST
             LIMIT $${params.length - 1}`,
            params.slice(0, -1)
        )

        return result.rows.map((row) => {
            const days = row.days_until_expiry !== null ? Number(row.days_until_expiry) : null
            let status: FefoLotRow['status'] = 'normal'
            if (days !== null) {
                if (days <= 0) status = 'expired'
                else if (days <= daysThreshold / 3) status = 'critical'
                else if (days <= daysThreshold) status = 'warning'
            }
            return {
                lotId: row.lot_id,
                lotNumber: row.lot_number,
                partId: row.part_id,
                partCode: row.part_code,
                partName: row.part_name,
                warehouseId: row.warehouse_id,
                warehouseName: row.warehouse_name,
                manufactureDate: row.manufacture_date?.toISOString().slice(0, 10) ?? null,
                expiryDate: row.expiry_date?.toISOString().slice(0, 10) ?? null,
                daysUntilExpiry: days,
                onHand: toNumber(row.on_hand),
                uom: row.uom,
                status
            }
        })
    }

    async valuation(filters: ValuationFilters): Promise<ValuationResult> {
        const params: unknown[] = []
        const conditions: string[] = []

        if (filters.warehouseId) {
            params.push(filters.warehouseId)
            conditions.push(`sps.warehouse_id = $${params.length}`)
        }

        const limit = clampLimit(filters.limit)
        params.push(limit)
        const whereClause = conditions.length > 0 ? `AND ${conditions.join(' AND ')}` : ''

        // Weighted average cost using only inbound movements (receipt, adjust_in, transfer_in)
        const result = await this.pg.query<ValuationDbRow>(
            `WITH weighted_costs AS (
                SELECT
                    sdl.part_id,
                    SUM(sdl.qty * sdl.unit_cost) / NULLIF(SUM(sdl.qty), 0) AS avg_cost
                FROM stock_document_lines sdl
                JOIN stock_documents sd ON sd.id = sdl.document_id
                WHERE sd.status = 'posted'
                  AND sdl.unit_cost IS NOT NULL
                  AND sdl.unit_cost > 0
                  AND sd.doc_type IN ('receipt', 'adjust')
                  AND (sd.doc_type != 'adjust' OR sdl.adjust_direction IS NULL OR sdl.adjust_direction = 'plus')
                GROUP BY sdl.part_id
             )
             SELECT
                p.id AS part_id,
                p.part_code AS part_code,
                p.name AS part_name,
                sps.on_hand AS on_hand,
                COALESCE(wc.avg_cost, 0) AS avg_cost,
                (sps.on_hand * COALESCE(wc.avg_cost, 0)) AS value
             FROM spare_part_stock sps
             JOIN spare_parts p ON p.id = sps.part_id
             LEFT JOIN weighted_costs wc ON wc.part_id = sps.part_id
             WHERE sps.on_hand > 0
             ${whereClause}
             ORDER BY value DESC
             LIMIT $${params.length}`,
            params
        )

        const items: ValuationRow[] = result.rows.map((row) => ({
            partId: row.part_id,
            partCode: row.part_code,
            partName: row.part_name,
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
