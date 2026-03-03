import type {
    CiCreateInput,
    CiListFilters,
    CiPage,
    CiRecord,
    ICiRepo
} from '@qltb/contracts'
import type { Queryable } from './types.js'

type CiRow = {
    id: string
    type_id: string
    name: string
    ci_code: string
    status: CiRecord['status']
    environment: CiRecord['environment']
    asset_id: string | null
    location_id: string | null
    owner_team: string | null
    notes: string | null
    created_at: Date
    updated_at: Date
}

type Update = { column: string; value: unknown }

const mapRow = (row: CiRow): CiRecord => ({
    id: row.id,
    typeId: row.type_id,
    name: row.name,
    ciCode: row.ci_code,
    status: row.status,
    environment: row.environment,
    assetId: row.asset_id,
    locationId: row.location_id,
    ownerTeam: row.owner_team,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at
})

function buildUpdates(patch: Partial<CiCreateInput>): Update[] {
    const updates: Update[] = []
    if (patch.typeId !== undefined) updates.push({ column: 'type_id', value: patch.typeId })
    if (patch.name !== undefined) updates.push({ column: 'name', value: patch.name })
    if (patch.ciCode !== undefined) updates.push({ column: 'ci_code', value: patch.ciCode })
    if (patch.status !== undefined) updates.push({ column: 'status', value: patch.status })
    if (patch.environment !== undefined) updates.push({ column: 'environment', value: patch.environment })
    if (patch.assetId !== undefined) updates.push({ column: 'asset_id', value: patch.assetId })
    if (patch.locationId !== undefined) updates.push({ column: 'location_id', value: patch.locationId })
    if (patch.ownerTeam !== undefined) updates.push({ column: 'owner_team', value: patch.ownerTeam })
    if (patch.notes !== undefined) updates.push({ column: 'notes', value: patch.notes })
    return updates
}

function normalizePagination(filters: CiListFilters): { page: number; limit: number; offset: number } {
    const page = Math.max(1, filters.page ?? 1)
    const limit = Math.min(Math.max(1, filters.limit ?? 20), 100)
    const offset = (page - 1) * limit
    return { page, limit, offset }
}

export class CiRepo implements ICiRepo {
    constructor(private pg: Queryable) { }

    async create(input: CiCreateInput): Promise<CiRecord> {
        const result = await this.pg.query<CiRow>(
            `INSERT INTO cmdb_cis
                (type_id, name, ci_code, status, environment, asset_id, location_id, owner_team, notes)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
             RETURNING id, type_id, name, ci_code, status, environment, asset_id, location_id, owner_team, notes, created_at, updated_at`,
            [
                input.typeId,
                input.name,
                input.ciCode,
                input.status ?? 'active',
                input.environment ?? 'prod',
                input.assetId ?? null,
                input.locationId ?? null,
                input.ownerTeam ?? null,
                input.notes ?? null
            ]
        )
        return mapRow(result.rows[0])
    }

    async update(id: string, patch: Partial<CiCreateInput>): Promise<CiRecord | null> {
        const updates = buildUpdates(patch)
        if (updates.length === 0) {
            return await this.getById(id)
        }
        const setClause = updates.map((update, index) => `${update.column} = $${index + 1}`).join(', ')
        const params = updates.map(update => update.value)
        params.push(id)
        const result = await this.pg.query<CiRow>(
            `UPDATE cmdb_cis SET ${setClause}, updated_at = NOW()
             WHERE id = $${params.length}
             RETURNING id, type_id, name, ci_code, status, environment, asset_id, location_id, owner_team, notes, created_at, updated_at`,
            params
        )
        return result.rows[0] ? mapRow(result.rows[0]) : null
    }

    async getById(id: string): Promise<CiRecord | null> {
        const result = await this.pg.query<CiRow>(
            `SELECT id, type_id, name, ci_code, status, environment, asset_id, location_id, owner_team, notes, created_at, updated_at
             FROM cmdb_cis WHERE id = $1`,
            [id]
        )
        return result.rows[0] ? mapRow(result.rows[0]) : null
    }

    async getByAssetId(assetId: string): Promise<CiRecord | null> {
        const result = await this.pg.query<CiRow>(
            `SELECT id, type_id, name, ci_code, status, environment, asset_id, location_id, owner_team, notes, created_at, updated_at
             FROM cmdb_cis WHERE asset_id = $1`,
            [assetId]
        )
        return result.rows[0] ? mapRow(result.rows[0]) : null
    }

    async list(filters: CiListFilters): Promise<CiPage> {
        const params: unknown[] = []
        const conditions: string[] = []

        if (filters.typeId) {
            params.push(filters.typeId)
            conditions.push(`type_id = $${params.length}`)
        }
        if (filters.status) {
            params.push(filters.status)
            conditions.push(`status = $${params.length}`)
        }
        if (filters.environment) {
            params.push(filters.environment)
            conditions.push(`environment = $${params.length}`)
        }
        if (filters.q) {
            params.push(`%${filters.q}%`)
            const index = params.length
            conditions.push(`(ci_code ILIKE $${index} OR name ILIKE $${index})`)
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
        const { page, limit, offset } = normalizePagination(filters)

        const countResult = await this.pg.query<{ count: string }>(
            `SELECT COUNT(*) AS count FROM cmdb_cis ${whereClause}`,
            params
        )
        const total = parseInt(countResult.rows[0]?.count ?? '0', 10)

        const listParams = [...params, limit, offset]
        const result = await this.pg.query<CiRow>(
            `SELECT id, type_id, name, ci_code, status, environment, asset_id, location_id, owner_team, notes, created_at, updated_at
             FROM cmdb_cis
             ${whereClause}
             ORDER BY name ASC
             LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
            listParams
        )

        return { items: result.rows.map(mapRow), total, page, limit }
    }
}
