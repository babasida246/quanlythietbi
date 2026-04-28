import type { IMovementRepo, StockMovementFilters, StockMovementInput, StockMovementPage, StockMovementRecord } from '@qltb/contracts'
import type { Queryable } from './types.js'

type MovementRow = {
    id: string
    warehouse_id: string
    model_id: string
    movement_type: StockMovementRecord['movementType']
    qty: number
    unit_cost: number | string | null
    ref_type: string | null
    ref_id: string | null
    actor_user_id: string | null
    correlation_id: string | null
    created_at: Date
}

const mapMovement = (row: MovementRow): StockMovementRecord => ({
    id: row.id,
    warehouseId: row.warehouse_id,
    modelId: row.model_id,
    movementType: row.movement_type,
    qty: row.qty,
    unitCost: row.unit_cost === null ? null : Number(row.unit_cost),
    refType: row.ref_type,
    refId: row.ref_id,
    actorUserId: row.actor_user_id,
    correlationId: row.correlation_id,
    createdAt: row.created_at
})

function normalizePagination(filters: StockMovementFilters): { page: number; limit: number; offset: number } {
    const page = Math.max(1, filters.page ?? 1)
    const limit = Math.min(Math.max(1, filters.limit ?? 20), 100)
    const offset = (page - 1) * limit
    return { page, limit, offset }
}

export class MovementRepo implements IMovementRepo {
    constructor(private pg: Queryable) { }

    async addMany(inputs: StockMovementInput[]): Promise<StockMovementRecord[]> {
        if (inputs.length === 0) return []
        const params: unknown[] = []
        const values = inputs.map((input, index) => {
            const base = index * 9
            params.push(
                input.warehouseId,
                input.modelId,
                input.movementType,
                input.qty,
                input.unitCost ?? null,
                input.refType ?? null,
                input.refId ?? null,
                input.actorUserId ?? null,
                input.correlationId ?? null
            )
            return `($${base + 1},$${base + 2},$${base + 3},$${base + 4},$${base + 5},$${base + 6},$${base + 7},$${base + 8},$${base + 9})`
        })

        const result = await this.pg.query<MovementRow>(
            `INSERT INTO asset_model_movements (
                warehouse_id,
                model_id,
                movement_type,
                qty,
                unit_cost,
                ref_type,
                ref_id,
                actor_user_id,
                correlation_id
             ) VALUES ${values.join(', ')}
             RETURNING id, warehouse_id, model_id, movement_type, qty, unit_cost, ref_type, ref_id, actor_user_id, correlation_id, created_at`,
            params
        )
        return result.rows.map(mapMovement)
    }

    async list(filters: StockMovementFilters): Promise<StockMovementPage> {
        const params: unknown[] = []
        const conditions: string[] = []

        if (filters.modelId) {
            params.push(filters.modelId)
            conditions.push(`model_id = $${params.length}`)
        }
        if (filters.warehouseId) {
            params.push(filters.warehouseId)
            conditions.push(`warehouse_id = $${params.length}`)
        }
        if (filters.from) {
            params.push(filters.from)
            conditions.push(`created_at >= $${params.length}::timestamptz`)
        }
        if (filters.to) {
            params.push(filters.to)
            conditions.push(`created_at <= $${params.length}::timestamptz`)
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
        const { page, limit, offset } = normalizePagination(filters)

        const countResult = await this.pg.query<{ count: string }>(
            `SELECT COUNT(*) AS count FROM asset_model_movements ${whereClause}`,
            params
        )
        const total = parseInt(countResult.rows[0]?.count ?? '0', 10)

        const listParams = [...params, limit, offset]
        const result = await this.pg.query<MovementRow>(
            `SELECT id, warehouse_id, model_id, movement_type, qty, unit_cost, ref_type, ref_id, actor_user_id, correlation_id, created_at
             FROM asset_model_movements
             ${whereClause}
             ORDER BY created_at DESC
             LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
            listParams
        )

        return {
            items: result.rows.map(mapMovement),
            total,
            page,
            limit
        }
    }
}
