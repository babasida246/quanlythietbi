import type { IWarehouseRepo, WarehouseCreateInput, WarehouseRecord, WarehouseUpdatePatch } from '@qltb/contracts'
import type { PgClient } from '../PgClient.js'

type WarehouseRow = {
    id: string
    code: string
    name: string
    location_id: string | null
    created_at: Date
}

type Update = { column: string; value: unknown }

const mapWarehouse = (row: WarehouseRow): WarehouseRecord => ({
    id: row.id,
    code: row.code,
    name: row.name,
    locationId: row.location_id,
    createdAt: row.created_at
})

function buildUpdates(patch: WarehouseUpdatePatch): Update[] {
    const updates: Update[] = []
    if (patch.code !== undefined) updates.push({ column: 'code', value: patch.code })
    if (patch.name !== undefined) updates.push({ column: 'name', value: patch.name })
    if (patch.locationId !== undefined) updates.push({ column: 'location_id', value: patch.locationId })
    return updates
}

export class WarehouseRepo implements IWarehouseRepo {
    constructor(private pg: PgClient) { }

    async list(): Promise<WarehouseRecord[]> {
        const result = await this.pg.query<WarehouseRow>(
            'SELECT id, code, name, location_id, created_at FROM warehouses ORDER BY name ASC'
        )
        return result.rows.map(mapWarehouse)
    }

    async getById(id: string): Promise<WarehouseRecord | null> {
        const result = await this.pg.query<WarehouseRow>(
            'SELECT id, code, name, location_id, created_at FROM warehouses WHERE id = $1',
            [id]
        )
        return result.rows[0] ? mapWarehouse(result.rows[0]) : null
    }

    async create(input: WarehouseCreateInput): Promise<WarehouseRecord> {
        const result = await this.pg.query<WarehouseRow>(
            `INSERT INTO warehouses (code, name, location_id)
             VALUES ($1,$2,$3)
             RETURNING id, code, name, location_id, created_at`,
            [input.code, input.name, input.locationId ?? null]
        )
        return mapWarehouse(result.rows[0])
    }

    async update(id: string, patch: WarehouseUpdatePatch): Promise<WarehouseRecord | null> {
        const updates = buildUpdates(patch)
        if (updates.length === 0) {
            return await this.getById(id)
        }
        const setClause = updates.map((update, index) => `${update.column} = $${index + 1}`).join(', ')
        const params = updates.map(update => update.value)
        params.push(id)
        const result = await this.pg.query<WarehouseRow>(
            `UPDATE warehouses SET ${setClause} WHERE id = $${params.length}
             RETURNING id, code, name, location_id, created_at`,
            params
        )
        return result.rows[0] ? mapWarehouse(result.rows[0]) : null
    }

    async delete(id: string): Promise<boolean> {
        const result = await this.pg.query(
            'DELETE FROM warehouses WHERE id = $1',
            [id]
        )
        return (result.rowCount ?? 0) > 0
    }
}
