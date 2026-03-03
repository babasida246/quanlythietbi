import type {
    CmdbChangeCreateInput,
    CmdbChangeListFilters,
    CmdbChangePage,
    CmdbChangeRecord,
    CmdbChangeUpdatePatch,
    ICmdbChangeRepo
} from '@qltb/contracts'
import type { Queryable } from './types.js'

type ChangeRow = {
    id: string
    code: string
    title: string
    description: string | null
    status: CmdbChangeRecord['status']
    risk: CmdbChangeRecord['risk']
    primary_ci_id: string | null
    impact_snapshot: unknown
    implementation_plan: string | null
    rollback_plan: string | null
    planned_start_at: Date | null
    planned_end_at: Date | null
    requested_by: string | null
    approved_by: string | null
    implemented_by: string | null
    implemented_at: Date | null
    closed_at: Date | null
    metadata: Record<string, unknown> | null
    created_at: Date
    updated_at: Date
}

const RETURNING_COLUMNS = `
    id, code, title, description, status, risk, primary_ci_id, impact_snapshot, implementation_plan, rollback_plan,
    planned_start_at, planned_end_at, requested_by, approved_by, implemented_by, implemented_at, closed_at, metadata,
    created_at, updated_at
`

const mapRow = (row: ChangeRow): CmdbChangeRecord => ({
    id: row.id,
    code: row.code,
    title: row.title,
    description: row.description,
    status: row.status,
    risk: row.risk,
    primaryCiId: row.primary_ci_id,
    impactSnapshot: row.impact_snapshot ?? null,
    implementationPlan: row.implementation_plan,
    rollbackPlan: row.rollback_plan,
    plannedStartAt: row.planned_start_at,
    plannedEndAt: row.planned_end_at,
    requestedBy: row.requested_by,
    approvedBy: row.approved_by,
    implementedBy: row.implemented_by,
    implementedAt: row.implemented_at,
    closedAt: row.closed_at,
    metadata: row.metadata,
    createdAt: row.created_at,
    updatedAt: row.updated_at
})

function normalizePagination(filters: CmdbChangeListFilters): { page: number; limit: number; offset: number } {
    const page = Math.max(1, filters.page ?? 1)
    const limit = Math.min(Math.max(1, filters.limit ?? 20), 100)
    return { page, limit, offset: (page - 1) * limit }
}

export class CmdbChangeRepo implements ICmdbChangeRepo {
    constructor(private pg: Queryable) { }

    async create(input: CmdbChangeCreateInput): Promise<CmdbChangeRecord> {
        const result = await this.pg.query<ChangeRow>(
            `WITH next_code AS (
                SELECT CONCAT(
                    'CHG-',
                    TO_CHAR(CURRENT_DATE, 'YYYY'),
                    '-',
                    LPAD((COALESCE(MAX(NULLIF(split_part(code, '-', 3), '')::int), 0) + 1)::text, 6, '0')
                ) AS code
                FROM cmdb_changes
                WHERE code LIKE CONCAT('CHG-', TO_CHAR(CURRENT_DATE, 'YYYY'), '-%')
             )
             INSERT INTO cmdb_changes (
                code, title, description, status, risk, primary_ci_id, impact_snapshot, implementation_plan, rollback_plan,
                planned_start_at, planned_end_at, requested_by, metadata
             )
             SELECT
                next_code.code, $1, $2, 'draft', COALESCE($3, 'medium'), $4, NULL, $5, $6, $7, $8, $9, $10::jsonb
             FROM next_code
             RETURNING ${RETURNING_COLUMNS}`,
            [
                input.title,
                input.description ?? null,
                input.risk ?? null,
                input.primaryCiId ?? null,
                input.implementationPlan ?? null,
                input.rollbackPlan ?? null,
                input.plannedStartAt ?? null,
                input.plannedEndAt ?? null,
                input.requestedBy ?? null,
                input.metadata ?? null
            ]
        )
        return mapRow(result.rows[0])
    }

    async update(id: string, patch: CmdbChangeUpdatePatch): Promise<CmdbChangeRecord | null> {
        const updates: Array<{ column: string; value: unknown }> = []
        if (patch.title !== undefined) updates.push({ column: 'title', value: patch.title })
        if (patch.description !== undefined) updates.push({ column: 'description', value: patch.description })
        if (patch.status !== undefined) updates.push({ column: 'status', value: patch.status })
        if (patch.risk !== undefined) updates.push({ column: 'risk', value: patch.risk })
        if (patch.primaryCiId !== undefined) updates.push({ column: 'primary_ci_id', value: patch.primaryCiId })
        if (patch.impactSnapshot !== undefined) updates.push({ column: 'impact_snapshot', value: patch.impactSnapshot })
        if (patch.implementationPlan !== undefined) updates.push({ column: 'implementation_plan', value: patch.implementationPlan })
        if (patch.rollbackPlan !== undefined) updates.push({ column: 'rollback_plan', value: patch.rollbackPlan })
        if (patch.plannedStartAt !== undefined) updates.push({ column: 'planned_start_at', value: patch.plannedStartAt })
        if (patch.plannedEndAt !== undefined) updates.push({ column: 'planned_end_at', value: patch.plannedEndAt })
        if (patch.approvedBy !== undefined) updates.push({ column: 'approved_by', value: patch.approvedBy })
        if (patch.implementedBy !== undefined) updates.push({ column: 'implemented_by', value: patch.implementedBy })
        if (patch.implementedAt !== undefined) updates.push({ column: 'implemented_at', value: patch.implementedAt })
        if (patch.closedAt !== undefined) updates.push({ column: 'closed_at', value: patch.closedAt })
        if (patch.metadata !== undefined) updates.push({ column: 'metadata', value: patch.metadata })

        if (updates.length === 0) {
            return await this.getById(id)
        }

        const setClause = updates.map((u, index) => `${u.column} = $${index + 1}`).join(', ')
        const params = updates.map(u => u.value)
        params.push(id)
        const result = await this.pg.query<ChangeRow>(
            `UPDATE cmdb_changes
             SET ${setClause}, updated_at = NOW()
             WHERE id = $${params.length}
             RETURNING ${RETURNING_COLUMNS}`,
            params
        )
        return result.rows[0] ? mapRow(result.rows[0]) : null
    }

    async getById(id: string): Promise<CmdbChangeRecord | null> {
        const result = await this.pg.query<ChangeRow>(
            `SELECT ${RETURNING_COLUMNS}
             FROM cmdb_changes
             WHERE id = $1`,
            [id]
        )
        return result.rows[0] ? mapRow(result.rows[0]) : null
    }

    async list(filters: CmdbChangeListFilters): Promise<CmdbChangePage> {
        const params: unknown[] = []
        const conditions: string[] = []
        if (filters.q) {
            params.push(`%${filters.q}%`)
            const idx = params.length
            conditions.push(`(code ILIKE $${idx} OR title ILIKE $${idx})`)
        }
        if (filters.status) {
            params.push(filters.status)
            conditions.push(`status = $${params.length}`)
        }
        if (filters.risk) {
            params.push(filters.risk)
            conditions.push(`risk = $${params.length}`)
        }
        if (filters.primaryCiId) {
            params.push(filters.primaryCiId)
            conditions.push(`primary_ci_id = $${params.length}`)
        }
        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
        const { page, limit, offset } = normalizePagination(filters)

        const countResult = await this.pg.query<{ count: string }>(
            `SELECT COUNT(*) AS count FROM cmdb_changes ${whereClause}`,
            params
        )
        const total = parseInt(countResult.rows[0]?.count ?? '0', 10)

        const listParams = [...params, limit, offset]
        const result = await this.pg.query<ChangeRow>(
            `SELECT ${RETURNING_COLUMNS}
             FROM cmdb_changes
             ${whereClause}
             ORDER BY created_at DESC
             LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
            listParams
        )

        return {
            items: result.rows.map(mapRow),
            total,
            page,
            limit
        }
    }
}
