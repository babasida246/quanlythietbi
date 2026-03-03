import type {
    ISparePartLotRepo,
    SparePartLotCreateInput,
    SparePartLotFilters,
    SparePartLotPage,
    SparePartLotRecord
} from '@qltb/contracts'
import type { Queryable } from './types.js'

type LotRow = {
    id: string
    warehouse_id: string
    part_id: string
    lot_number: string
    serial_no: string | null
    manufacture_date: Date | null
    expiry_date: Date | null
    on_hand: number
    reserved: number
    status: SparePartLotRecord['status']
    created_at: Date
    updated_at: Date
}

const mapLot = (row: LotRow): SparePartLotRecord => ({
    id: row.id,
    warehouseId: row.warehouse_id,
    partId: row.part_id,
    lotNumber: row.lot_number,
    serialNo: row.serial_no,
    manufactureDate: row.manufacture_date?.toISOString().slice(0, 10) ?? null,
    expiryDate: row.expiry_date?.toISOString().slice(0, 10) ?? null,
    onHand: row.on_hand,
    reserved: row.reserved,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at
})

function normalizePagination(filters: SparePartLotFilters): { page: number; limit: number; offset: number } {
    const page = Math.max(1, filters.page ?? 1)
    const limit = Math.min(Math.max(1, filters.limit ?? 20), 100)
    const offset = (page - 1) * limit
    return { page, limit, offset }
}

export class SparePartLotRepo implements ISparePartLotRepo {
    constructor(private pg: Queryable) { }

    async create(input: SparePartLotCreateInput): Promise<SparePartLotRecord> {
        const result = await this.pg.query<LotRow>(
            `INSERT INTO spare_part_lots (warehouse_id, part_id, lot_number, serial_no, manufacture_date, expiry_date, on_hand)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING id, warehouse_id, part_id, lot_number, serial_no, manufacture_date, expiry_date,
                       on_hand, reserved, status, created_at, updated_at`,
            [
                input.warehouseId,
                input.partId,
                input.lotNumber,
                input.serialNo ?? null,
                input.manufactureDate ?? null,
                input.expiryDate ?? null,
                input.onHand
            ]
        )
        return mapLot(result.rows[0])
    }

    async getById(id: string): Promise<SparePartLotRecord | null> {
        const result = await this.pg.query<LotRow>(
            `SELECT id, warehouse_id, part_id, lot_number, serial_no, manufacture_date, expiry_date,
                    on_hand, reserved, status, created_at, updated_at
             FROM spare_part_lots WHERE id = $1`,
            [id]
        )
        return result.rows[0] ? mapLot(result.rows[0]) : null
    }

    async list(filters: SparePartLotFilters): Promise<SparePartLotPage> {
        const params: unknown[] = []
        const conditions: string[] = []

        if (filters.warehouseId) {
            params.push(filters.warehouseId)
            conditions.push(`l.warehouse_id = $${params.length}`)
        }
        if (filters.partId) {
            params.push(filters.partId)
            conditions.push(`l.part_id = $${params.length}`)
        }
        if (filters.status) {
            params.push(filters.status)
            conditions.push(`l.status = $${params.length}`)
        }
        if (filters.q) {
            params.push(`%${filters.q}%`)
            conditions.push(`(l.lot_number ILIKE $${params.length} OR l.serial_no ILIKE $${params.length})`)
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
        const { page, limit, offset } = normalizePagination(filters)

        const countResult = await this.pg.query<{ count: string }>(
            `SELECT COUNT(*) AS count FROM spare_part_lots l ${whereClause}`,
            params
        )
        const total = parseInt(countResult.rows[0]?.count ?? '0', 10)

        const listParams = [...params, limit, offset]
        const result = await this.pg.query<LotRow>(
            `SELECT l.id, l.warehouse_id, l.part_id, l.lot_number, l.serial_no, l.manufacture_date, l.expiry_date,
                    l.on_hand, l.reserved, l.status, l.created_at, l.updated_at
             FROM spare_part_lots l
             ${whereClause}
             ORDER BY l.expiry_date ASC NULLS LAST, l.created_at ASC
             LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
            listParams
        )

        return {
            items: result.rows.map(mapLot),
            total,
            page,
            limit
        }
    }

    async adjustQty(id: string, delta: number): Promise<SparePartLotRecord | null> {
        const result = await this.pg.query<LotRow>(
            `UPDATE spare_part_lots
             SET on_hand = on_hand + $2,
                 status = CASE
                     WHEN on_hand + $2 <= 0 THEN 'consumed'
                     WHEN expiry_date IS NOT NULL AND expiry_date < CURRENT_DATE THEN 'expired'
                     ELSE 'active'
                 END,
                 updated_at = NOW()
             WHERE id = $1 AND on_hand + $2 >= 0
             RETURNING id, warehouse_id, part_id, lot_number, serial_no, manufacture_date, expiry_date,
                       on_hand, reserved, status, created_at, updated_at`,
            [id, delta]
        )
        return result.rows[0] ? mapLot(result.rows[0]) : null
    }

    async updateStatus(id: string, status: SparePartLotRecord['status']): Promise<SparePartLotRecord | null> {
        const result = await this.pg.query<LotRow>(
            `UPDATE spare_part_lots
             SET status = $2, updated_at = NOW()
             WHERE id = $1
             RETURNING id, warehouse_id, part_id, lot_number, serial_no, manufacture_date, expiry_date,
                       on_hand, reserved, status, created_at, updated_at`,
            [id, status]
        )
        return result.rows[0] ? mapLot(result.rows[0]) : null
    }
}
