import type {
    IStockRepo,
    StockRecord,
    StockUpsertInput,
    StockViewFilters,
    StockViewPage,
    StockViewRecord
} from '@qltb/contracts'
import type { Queryable } from './types.js'

type StockRow = {
    id: string
    warehouse_id: string
    part_id: string
    on_hand: number
    reserved: number
    updated_at: Date
}

type StockViewRow = {
    warehouse_id: string
    warehouse_code: string
    warehouse_name: string
    part_id: string
    part_code: string
    part_name: string
    on_hand: number
    reserved: number
    available: number
    uom: string | null
    min_level: number | null
}

const mapStock = (row: StockRow): StockRecord => ({
    id: row.id,
    warehouseId: row.warehouse_id,
    partId: row.part_id,
    onHand: row.on_hand,
    reserved: row.reserved,
    updatedAt: row.updated_at
})

const mapViewRow = (row: StockViewRow): StockViewRecord => ({
    warehouseId: row.warehouse_id,
    warehouseCode: row.warehouse_code,
    warehouseName: row.warehouse_name,
    partId: row.part_id,
    partCode: row.part_code,
    partName: row.part_name,
    onHand: row.on_hand,
    reserved: row.reserved,
    available: row.available,
    uom: row.uom,
    minLevel: row.min_level ?? 0
})

function normalizePagination(filters: StockViewFilters): { page: number; limit: number; offset: number } {
    const page = Math.max(1, filters.page ?? 1)
    const limit = Math.min(Math.max(1, filters.limit ?? 20), 100)
    const offset = (page - 1) * limit
    return { page, limit, offset }
}

function buildViewFilters(filters: StockViewFilters, params: unknown[]): string {
    const conditions: string[] = []

    if (filters.warehouseId) {
        params.push(filters.warehouseId)
        conditions.push(`sps.warehouse_id = $${params.length}`)
    }

    if (filters.q) {
        params.push(`%${filters.q}%`)
        const index = params.length
        conditions.push(`(p.part_code ILIKE $${index} OR p.name ILIKE $${index})`)
    }

    if (filters.belowMin) {
        conditions.push('sps.on_hand < p.min_level')
    }

    return conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
}

export class StockRepo implements IStockRepo {
    constructor(private pg: Queryable) { }

    async get(warehouseId: string, partId: string): Promise<StockRecord | null> {
        const result = await this.pg.query<StockRow>(
            `SELECT id, warehouse_id, part_id, on_hand, reserved, updated_at
             FROM spare_part_stock
             WHERE warehouse_id = $1 AND part_id = $2`,
            [warehouseId, partId]
        )
        return result.rows[0] ? mapStock(result.rows[0]) : null
    }

    async getForUpdate(warehouseId: string, partId: string): Promise<StockRecord | null> {
        const result = await this.pg.query<StockRow>(
            `SELECT id, warehouse_id, part_id, on_hand, reserved, updated_at
             FROM spare_part_stock
             WHERE warehouse_id = $1 AND part_id = $2
             FOR UPDATE`,
            [warehouseId, partId]
        )
        return result.rows[0] ? mapStock(result.rows[0]) : null
    }

    async upsert(input: StockUpsertInput): Promise<StockRecord> {
        const result = await this.pg.query<StockRow>(
            `INSERT INTO spare_part_stock (warehouse_id, part_id, on_hand, reserved)
             VALUES ($1,$2,$3,$4)
             ON CONFLICT (warehouse_id, part_id)
             DO UPDATE SET on_hand = EXCLUDED.on_hand, reserved = EXCLUDED.reserved, updated_at = NOW()
             RETURNING id, warehouse_id, part_id, on_hand, reserved, updated_at`,
            [input.warehouseId, input.partId, input.onHand, input.reserved]
        )
        return mapStock(result.rows[0])
    }

    async adjustStock(warehouseId: string, partId: string, delta: number): Promise<StockRecord> {
        // Delta-based atomic update with safety check
        if (delta >= 0) {
            // Increase: upsert with delta
            const result = await this.pg.query<StockRow>(
                `INSERT INTO spare_part_stock (warehouse_id, part_id, on_hand, reserved)
                 VALUES ($1, $2, $3, 0)
                 ON CONFLICT (warehouse_id, part_id)
                 DO UPDATE SET on_hand = spare_part_stock.on_hand + $3, updated_at = NOW()
                 RETURNING id, warehouse_id, part_id, on_hand, reserved, updated_at`,
                [warehouseId, partId, delta]
            )
            return mapStock(result.rows[0])
        } else {
            // Decrease: atomic check + update in one statement
            const absDelta = Math.abs(delta)
            const result = await this.pg.query<StockRow>(
                `UPDATE spare_part_stock
                 SET on_hand = on_hand - $3, updated_at = NOW()
                 WHERE warehouse_id = $1 AND part_id = $2
                   AND (on_hand - reserved) >= $3
                 RETURNING id, warehouse_id, part_id, on_hand, reserved, updated_at`,
                [warehouseId, partId, absDelta]
            )
            if (!result.rows[0]) {
                throw new Error('Insufficient stock available for this operation')
            }
            return mapStock(result.rows[0])
        }
    }

    async reserve(warehouseId: string, partId: string, qty: number): Promise<StockRecord> {
        const result = await this.pg.query<StockRow>(
            `UPDATE spare_part_stock
             SET reserved = reserved + $3, updated_at = NOW()
             WHERE warehouse_id = $1 AND part_id = $2
               AND (on_hand - reserved) >= $3
             RETURNING id, warehouse_id, part_id, on_hand, reserved, updated_at`,
            [warehouseId, partId, qty]
        )
        if (!result.rows[0]) {
            throw new Error('Insufficient available stock to reserve')
        }
        return mapStock(result.rows[0])
    }

    async release(warehouseId: string, partId: string, qty: number): Promise<StockRecord> {
        const result = await this.pg.query<StockRow>(
            `UPDATE spare_part_stock
             SET reserved = GREATEST(reserved - $3, 0), updated_at = NOW()
             WHERE warehouse_id = $1 AND part_id = $2
             RETURNING id, warehouse_id, part_id, on_hand, reserved, updated_at`,
            [warehouseId, partId, qty]
        )
        if (!result.rows[0]) {
            throw new Error('Stock record not found')
        }
        return mapStock(result.rows[0])
    }

    async commitReserved(warehouseId: string, partId: string, qty: number): Promise<StockRecord> {
        // Commit reserved: decrease both on_hand and reserved atomically
        const result = await this.pg.query<StockRow>(
            `UPDATE spare_part_stock
             SET on_hand = on_hand - $3, reserved = GREATEST(reserved - $3, 0), updated_at = NOW()
             WHERE warehouse_id = $1 AND part_id = $2
               AND reserved >= $3 AND on_hand >= $3
             RETURNING id, warehouse_id, part_id, on_hand, reserved, updated_at`,
            [warehouseId, partId, qty]
        )
        if (!result.rows[0]) {
            throw new Error('Insufficient reserved stock to commit')
        }
        return mapStock(result.rows[0])
    }

    async listView(filters: StockViewFilters): Promise<StockViewPage> {
        const params: unknown[] = []
        const whereClause = buildViewFilters(filters, params)
        const { page, limit, offset } = normalizePagination(filters)

        const countResult = await this.pg.query<{ count: string }>(
            `SELECT COUNT(*) AS count
             FROM spare_part_stock sps
             JOIN spare_parts p ON p.id = sps.part_id
             ${whereClause}`,
            params
        )
        const total = parseInt(countResult.rows[0]?.count ?? '0', 10)

        const listParams = [...params, limit, offset]
        const result = await this.pg.query<StockViewRow>(
            `SELECT
                sps.warehouse_id,
                w.code AS warehouse_code,
                w.name AS warehouse_name,
                sps.part_id,
                p.part_code,
                p.name AS part_name,
                sps.on_hand,
                sps.reserved,
                (sps.on_hand - sps.reserved) AS available,
                p.uom,
                p.min_level
             FROM spare_part_stock sps
             JOIN spare_parts p ON p.id = sps.part_id
             JOIN warehouses w ON w.id = sps.warehouse_id
             ${whereClause}
             ORDER BY p.name ASC, w.name ASC
             LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
            listParams
        )

        return {
            items: result.rows.map(mapViewRow),
            total,
            page,
            limit
        }
    }
}
