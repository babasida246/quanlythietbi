import type {
    ISparePartRepo,
    SparePartCreateInput,
    SparePartListFilters,
    SparePartPage,
    SparePartRecord,
    SparePartUpdatePatch
} from '@qltb/contracts'
import type { PgClient } from '../PgClient.js'

type SparePartRow = {
    id: string
    part_code: string
    name: string
    category: string | null
    uom: string | null
    manufacturer: string | null
    model: string | null
    spec: Record<string, unknown> | null
    min_level: number | null
    created_at: Date
}

type Update = { column: string; value: unknown }

const mapSparePart = (row: SparePartRow): SparePartRecord => ({
    id: row.id,
    partCode: row.part_code,
    name: row.name,
    category: row.category,
    uom: row.uom,
    manufacturer: row.manufacturer,
    model: row.model,
    spec: row.spec ?? {},
    minLevel: row.min_level ?? 0,
    createdAt: row.created_at
})

function buildUpdates(patch: SparePartUpdatePatch): Update[] {
    const updates: Update[] = []
    if (patch.partCode !== undefined) updates.push({ column: 'part_code', value: patch.partCode })
    if (patch.name !== undefined) updates.push({ column: 'name', value: patch.name })
    if (patch.category !== undefined) updates.push({ column: 'category', value: patch.category })
    if (patch.uom !== undefined) updates.push({ column: 'uom', value: patch.uom })
    if (patch.manufacturer !== undefined) updates.push({ column: 'manufacturer', value: patch.manufacturer })
    if (patch.model !== undefined) updates.push({ column: 'model', value: patch.model })
    if (patch.spec !== undefined) updates.push({ column: 'spec', value: patch.spec })
    if (patch.minLevel !== undefined) updates.push({ column: 'min_level', value: patch.minLevel })
    return updates
}

function normalizePagination(filters: SparePartListFilters): { page: number; limit: number; offset: number } {
    const page = Math.max(1, filters.page ?? 1)
    const limit = Math.min(Math.max(1, filters.limit ?? 20), 100)
    const offset = (page - 1) * limit
    return { page, limit, offset }
}

export class SparePartRepo implements ISparePartRepo {
    constructor(private pg: PgClient) { }

    async list(filters: SparePartListFilters): Promise<SparePartPage> {
        const params: unknown[] = []
        const conditions: string[] = []

        if (filters.q) {
            params.push(`%${filters.q}%`)
            const index = params.length
            conditions.push(`(part_code ILIKE $${index} OR name ILIKE $${index})`)
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
        const { page, limit, offset } = normalizePagination(filters)

        const countResult = await this.pg.query<{ count: string }>(
            `SELECT COUNT(*) AS count FROM spare_parts ${whereClause}`,
            params
        )
        const total = parseInt(countResult.rows[0]?.count ?? '0', 10)

        const listParams = [...params, limit, offset]
        const listResult = await this.pg.query<SparePartRow>(
            `SELECT id, part_code, name, category, uom, manufacturer, model, spec, min_level, created_at
             FROM spare_parts
             ${whereClause}
             ORDER BY name ASC
             LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
            listParams
        )

        return {
            items: listResult.rows.map(mapSparePart),
            total,
            page,
            limit
        }
    }

    async getById(id: string): Promise<SparePartRecord | null> {
        const result = await this.pg.query<SparePartRow>(
            'SELECT id, part_code, name, category, uom, manufacturer, model, spec, min_level, created_at FROM spare_parts WHERE id = $1',
            [id]
        )
        return result.rows[0] ? mapSparePart(result.rows[0]) : null
    }

    async create(input: SparePartCreateInput): Promise<SparePartRecord> {
        const result = await this.pg.query<SparePartRow>(
            `INSERT INTO spare_parts (part_code, name, category, uom, manufacturer, model, spec, min_level)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
             RETURNING id, part_code, name, category, uom, manufacturer, model, spec, min_level, created_at`,
            [
                input.partCode,
                input.name,
                input.category ?? null,
                input.uom ?? null,
                input.manufacturer ?? null,
                input.model ?? null,
                input.spec ?? {},
                input.minLevel ?? 0
            ]
        )
        return mapSparePart(result.rows[0])
    }

    async update(id: string, patch: SparePartUpdatePatch): Promise<SparePartRecord | null> {
        const updates = buildUpdates(patch)
        if (updates.length === 0) {
            return await this.getById(id)
        }
        const setClause = updates.map((update, index) => `${update.column} = $${index + 1}`).join(', ')
        const params = updates.map(update => update.value)
        params.push(id)
        const result = await this.pg.query<SparePartRow>(
            `UPDATE spare_parts SET ${setClause} WHERE id = $${params.length}
             RETURNING id, part_code, name, category, uom, manufacturer, model, spec, min_level, created_at`,
            params
        )
        return result.rows[0] ? mapSparePart(result.rows[0]) : null
    }

    async delete(id: string): Promise<boolean> {
        const result = await this.pg.query(
            'DELETE FROM spare_parts WHERE id = $1',
            [id]
        )
        return (result.rowCount ?? 0) > 0
    }
}
