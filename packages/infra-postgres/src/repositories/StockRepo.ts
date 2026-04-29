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
    model_id: string
    on_hand: number
    reserved: number
    updated_at: Date
}

type StockViewRow = {
    warehouse_id: string
    warehouse_code: string
    warehouse_name: string
    model_id: string
    part_code: string
    part_name: string
    brand: string | null
    category_name: string | null
    on_hand: number
    reserved: number
    available: number
    uom: string | null
    min_level: number | null
}

const mapStock = (row: StockRow): StockRecord => ({
    id: row.id,
    warehouseId: row.warehouse_id,
    modelId: row.model_id,
    onHand: row.on_hand,
    reserved: row.reserved,
    updatedAt: row.updated_at
})

const mapViewRow = (row: StockViewRow): StockViewRecord => ({
    warehouseId: row.warehouse_id,
    warehouseCode: row.warehouse_code,
    warehouseName: row.warehouse_name,
    modelId: row.model_id,
    partCode: row.part_code,
    partName: row.part_name,
    brand: row.brand,
    categoryName: row.category_name,
    onHand: row.on_hand,
    reserved: row.reserved,
    available: row.available,
    uom: row.uom,
    minLevel: row.min_level ?? 0
})

function normalizePagination(filters: StockViewFilters): { page: number; limit: number; offset: number } {
    const page = Math.max(1, filters.page ?? 1)
    const limit = Math.min(Math.max(1, filters.limit ?? 50), 200)
    const offset = (page - 1) * limit
    return { page, limit, offset }
}

function buildViewFilters(filters: StockViewFilters, params: unknown[]): string {
    const conditions: string[] = []

    if (filters.warehouseId) {
        params.push(filters.warehouseId)
        conditions.push(`ams.warehouse_id = $${params.length}`)
    }

    if (filters.q) {
        params.push(`%${filters.q}%`)
        const index = params.length
        conditions.push(`(am.model ILIKE $${index} OR am.brand ILIKE $${index})`)
    }

    if (filters.belowMin) {
        conditions.push('ams.on_hand < am.min_stock_qty')
    }

    return conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
}

export class StockRepo implements IStockRepo {
    constructor(private pg: Queryable) { }

    async get(warehouseId: string, modelId: string): Promise<StockRecord | null> {
        const result = await this.pg.query<StockRow>(
            `SELECT id, warehouse_id, model_id, on_hand, reserved, updated_at
             FROM asset_model_stock
             WHERE warehouse_id = $1 AND model_id = $2`,
            [warehouseId, modelId]
        )
        return result.rows[0] ? mapStock(result.rows[0]) : null
    }

    async getForUpdate(warehouseId: string, modelId: string): Promise<StockRecord | null> {
        const result = await this.pg.query<StockRow>(
            `SELECT id, warehouse_id, model_id, on_hand, reserved, updated_at
             FROM asset_model_stock
             WHERE warehouse_id = $1 AND model_id = $2
             FOR UPDATE`,
            [warehouseId, modelId]
        )
        return result.rows[0] ? mapStock(result.rows[0]) : null
    }

    async upsert(input: StockUpsertInput): Promise<StockRecord> {
        const result = await this.pg.query<StockRow>(
            `INSERT INTO asset_model_stock (warehouse_id, model_id, on_hand, reserved)
             VALUES ($1,$2,$3,$4)
             ON CONFLICT (warehouse_id, model_id)
             DO UPDATE SET on_hand = EXCLUDED.on_hand, reserved = EXCLUDED.reserved, updated_at = NOW()
             RETURNING id, warehouse_id, model_id, on_hand, reserved, updated_at`,
            [input.warehouseId, input.modelId, input.onHand, input.reserved]
        )
        return mapStock(result.rows[0])
    }

    async adjustStock(warehouseId: string, modelId: string, delta: number): Promise<StockRecord> {
        if (delta >= 0) {
            const result = await this.pg.query<StockRow>(
                `INSERT INTO asset_model_stock (warehouse_id, model_id, on_hand, reserved)
                 VALUES ($1, $2, $3, 0)
                 ON CONFLICT (warehouse_id, model_id)
                 DO UPDATE SET on_hand = asset_model_stock.on_hand + $3, updated_at = NOW()
                 RETURNING id, warehouse_id, model_id, on_hand, reserved, updated_at`,
                [warehouseId, modelId, delta]
            )
            return mapStock(result.rows[0])
        } else {
            const absDelta = Math.abs(delta)
            const result = await this.pg.query<StockRow>(
                `UPDATE asset_model_stock
                 SET on_hand = on_hand - $3, updated_at = NOW()
                 WHERE warehouse_id = $1 AND model_id = $2
                   AND (on_hand - reserved) >= $3
                 RETURNING id, warehouse_id, model_id, on_hand, reserved, updated_at`,
                [warehouseId, modelId, absDelta]
            )
            if (!result.rows[0]) {
                throw new Error('Insufficient stock available for this operation')
            }
            return mapStock(result.rows[0])
        }
    }

    async reserve(warehouseId: string, modelId: string, qty: number): Promise<StockRecord> {
        const result = await this.pg.query<StockRow>(
            `UPDATE asset_model_stock
             SET reserved = reserved + $3, updated_at = NOW()
             WHERE warehouse_id = $1 AND model_id = $2
               AND (on_hand - reserved) >= $3
             RETURNING id, warehouse_id, model_id, on_hand, reserved, updated_at`,
            [warehouseId, modelId, qty]
        )
        if (!result.rows[0]) {
            throw new Error('Insufficient available stock to reserve')
        }
        return mapStock(result.rows[0])
    }

    async release(warehouseId: string, modelId: string, qty: number): Promise<StockRecord> {
        const result = await this.pg.query<StockRow>(
            `UPDATE asset_model_stock
             SET reserved = GREATEST(reserved - $3, 0), updated_at = NOW()
             WHERE warehouse_id = $1 AND model_id = $2
             RETURNING id, warehouse_id, model_id, on_hand, reserved, updated_at`,
            [warehouseId, modelId, qty]
        )
        if (!result.rows[0]) {
            throw new Error('Stock record not found')
        }
        return mapStock(result.rows[0])
    }

    async commitReserved(warehouseId: string, modelId: string, qty: number): Promise<StockRecord> {
        const result = await this.pg.query<StockRow>(
            `UPDATE asset_model_stock
             SET on_hand = on_hand - $3, reserved = GREATEST(reserved - $3, 0), updated_at = NOW()
             WHERE warehouse_id = $1 AND model_id = $2
               AND reserved >= $3 AND on_hand >= $3
             RETURNING id, warehouse_id, model_id, on_hand, reserved, updated_at`,
            [warehouseId, modelId, qty]
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
             FROM asset_model_stock ams
             JOIN asset_models am ON am.id = ams.model_id
             ${whereClause}`,
            params
        )
        const total = parseInt(countResult.rows[0]?.count ?? '0', 10)

        const listParams = [...params, limit, offset]
        const result = await this.pg.query<StockViewRow>(
            `SELECT
                ams.warehouse_id,
                w.code  AS warehouse_code,
                w.name  AS warehouse_name,
                ams.model_id,
                am.model AS part_code,
                am.brand || ' ' || am.model AS part_name,
                am.brand,
                ac.name  AS category_name,
                am.unit  AS uom,
                ams.on_hand,
                ams.reserved,
                GREATEST(ams.on_hand - ams.reserved, 0) AS available,
                am.min_stock_qty AS min_level
             FROM asset_model_stock ams
             JOIN warehouses   w  ON w.id  = ams.warehouse_id
             JOIN asset_models am ON am.id = ams.model_id
             LEFT JOIN asset_categories ac ON ac.id = am.category_id
             ${whereClause}
             ORDER BY am.model ASC, w.name ASC
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
