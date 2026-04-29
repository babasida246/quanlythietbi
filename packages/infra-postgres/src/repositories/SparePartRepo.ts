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
    category_id: string | null
    category_name: string | null
    model_id: string | null
    model_name: string | null
    uom: string | null
    manufacturer: string | null
    model: string | null
    spec: Record<string, unknown> | null
    min_level: number | null
    unit_cost: number | null
    created_at: Date
}

type Update = { column: string; value: unknown }

const SELECT_COLS = `
    am.id, '' AS part_code, am.model AS name, ac.name AS category, am.category_id,
    ac.name AS category_name,
    am.id AS model_id, am.model AS model_name,
    am.unit AS uom, am.brand AS manufacturer, am.model, am.spec,
    am.min_stock_qty AS min_level, NULL::numeric AS unit_cost, am.created_at
`

const FROM_JOIN = `
    FROM asset_models am
    LEFT JOIN asset_categories ac ON ac.id = am.category_id
`

const mapSparePart = (row: SparePartRow): SparePartRecord => ({
    id: row.id,
    partCode: row.part_code,
    name: row.name,
    category: row.category,
    categoryId: row.category_id,
    categoryName: row.category_name,
    modelId: row.model_id,
    modelName: row.model_name,
    uom: row.uom,
    manufacturer: row.manufacturer,
    model: row.model,
    spec: row.spec ?? {},
    minLevel: row.min_level ?? 0,
    unitCost: row.unit_cost ?? null,
    createdAt: row.created_at
})

function buildUpdates(patch: SparePartUpdatePatch): Update[] {
    const updates: Update[] = []
    if (patch.partCode !== undefined) updates.push({ column: 'part_code', value: patch.partCode })
    if (patch.name !== undefined) updates.push({ column: 'name', value: patch.name })
    if (patch.category !== undefined) updates.push({ column: 'category', value: patch.category })
    if (patch.categoryId !== undefined) updates.push({ column: 'category_id', value: patch.categoryId })
    if (patch.modelId !== undefined) updates.push({ column: 'model_id', value: patch.modelId })
    if (patch.uom !== undefined) updates.push({ column: 'uom', value: patch.uom })
    if (patch.manufacturer !== undefined) updates.push({ column: 'manufacturer', value: patch.manufacturer })
    if (patch.model !== undefined) updates.push({ column: 'model', value: patch.model })
    if (patch.spec !== undefined) updates.push({ column: 'spec', value: patch.spec })
    if (patch.minLevel !== undefined) updates.push({ column: 'min_level', value: patch.minLevel })
    if (patch.unitCost !== undefined) updates.push({ column: 'unit_cost', value: patch.unitCost })
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
            conditions.push(`(am.model ILIKE $${index} OR am.brand ILIKE $${index})`)
        }

        if ((filters as { categoryId?: string }).categoryId) {
            params.push((filters as { categoryId?: string }).categoryId)
            conditions.push(`am.category_id = $${params.length}`)
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
        const { page, limit, offset } = normalizePagination(filters)

        const countResult = await this.pg.query<{ count: string }>(
            `SELECT COUNT(*) AS count ${FROM_JOIN} ${whereClause}`,
            params
        )
        const total = parseInt(countResult.rows[0]?.count ?? '0', 10)

        const listParams = [...params, limit, offset]
        const listResult = await this.pg.query<SparePartRow>(
            `SELECT ${SELECT_COLS} ${FROM_JOIN}
             ${whereClause}
             ORDER BY am.model ASC
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
            `SELECT ${SELECT_COLS} ${FROM_JOIN} WHERE am.id = $1`,
            [id]
        )
        return result.rows[0] ? mapSparePart(result.rows[0]) : null
    }

    async create(input: SparePartCreateInput): Promise<SparePartRecord> {
        const result = await this.pg.query<SparePartRow>(
            `INSERT INTO asset_models (brand, model, category_id, unit, spec, min_stock_qty)
             VALUES ($1,$2,$3,$4,$5,$6)
             RETURNING id, '' AS part_code, model AS name, NULL::text AS category, category_id,
                       NULL::text AS category_name, id AS model_id, model AS model_name,
                       unit AS uom, brand AS manufacturer, model, spec,
                       min_stock_qty AS min_level, NULL::numeric AS unit_cost, created_at`,
            [
                input.manufacturer ?? input.name,
                input.name,
                input.categoryId ?? null,
                input.uom ?? 'pcs',
                input.spec ?? {},
                input.minLevel ?? 0
            ]
        )
        return mapSparePart(result.rows[0])
    }

    async update(id: string, patch: SparePartUpdatePatch): Promise<SparePartRecord | null> {
        const colMap: Record<string, string> = {
            name: 'model', manufacturer: 'brand', uom: 'unit',
            categoryId: 'category_id', minLevel: 'min_stock_qty', spec: 'spec'
        }
        const updates: Array<{ column: string; value: unknown }> = []
        for (const [key, col] of Object.entries(colMap)) {
            if ((patch as Record<string, unknown>)[key] !== undefined) {
                updates.push({ column: col, value: (patch as Record<string, unknown>)[key] })
            }
        }
        if (updates.length === 0) return await this.getById(id)
        const setClause = updates.map((u, i) => `${u.column} = $${i + 1}`).join(', ')
        const params = [...updates.map(u => u.value), id]
        await this.pg.query(
            `UPDATE asset_models SET ${setClause} WHERE id = $${params.length}`,
            params
        )
        return await this.getById(id)
    }

    async delete(id: string): Promise<boolean> {
        const result = await this.pg.query(
            'DELETE FROM asset_models WHERE id = $1',
            [id]
        )
        return (result.rowCount ?? 0) > 0
    }
}
