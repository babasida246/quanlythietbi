import type { CmdbServiceMemberRecord, CmdbServicePage, CmdbServiceRecord, IServiceRepo } from '@qltb/contracts'
import type { Queryable } from './types.js'

type ServiceRow = {
    id: string
    code: string
    name: string
    criticality: string | null
    owner: string | null
    sla: string | null
    status: string | null
    created_at: Date
}

type MemberRow = {
    id: string
    service_id: string
    ci_id: string
    role: string | null
    created_at: Date
}

const mapService = (row: ServiceRow): CmdbServiceRecord => ({
    id: row.id,
    code: row.code,
    name: row.name,
    criticality: row.criticality,
    owner: row.owner,
    sla: row.sla,
    status: row.status,
    createdAt: row.created_at
})

const mapMember = (row: MemberRow): CmdbServiceMemberRecord => ({
    id: row.id,
    serviceId: row.service_id,
    ciId: row.ci_id,
    role: row.role,
    createdAt: row.created_at
})

function normalizePagination(page?: number, limit?: number): { page: number; limit: number; offset: number } {
    const safePage = Math.max(1, page ?? 1)
    const safeLimit = Math.min(Math.max(1, limit ?? 20), 100)
    return { page: safePage, limit: safeLimit, offset: (safePage - 1) * safeLimit }
}

export class CmdbServiceRepo implements IServiceRepo {
    constructor(private pg: Queryable) { }

    async create(input: {
        code: string
        name: string
        criticality?: string | null
        owner?: string | null
        sla?: string | null
        status?: string | null
    }): Promise<CmdbServiceRecord> {
        const result = await this.pg.query<ServiceRow>(
            `INSERT INTO cmdb_services (code, name, criticality, owner, sla, status)
             VALUES ($1,$2,$3,$4,$5,$6)
             RETURNING id, code, name, criticality, owner, sla, status, created_at`,
            [
                input.code,
                input.name,
                input.criticality ?? null,
                input.owner ?? null,
                input.sla ?? null,
                input.status ?? null
            ]
        )
        return mapService(result.rows[0])
    }

    async update(id: string, patch: Partial<CmdbServiceRecord>): Promise<CmdbServiceRecord | null> {
        const updates: Array<{ column: string; value: unknown }> = []
        if (patch.code !== undefined) updates.push({ column: 'code', value: patch.code })
        if (patch.name !== undefined) updates.push({ column: 'name', value: patch.name })
        if (patch.criticality !== undefined) updates.push({ column: 'criticality', value: patch.criticality })
        if (patch.owner !== undefined) updates.push({ column: 'owner', value: patch.owner })
        if (patch.sla !== undefined) updates.push({ column: 'sla', value: patch.sla })
        if (patch.status !== undefined) updates.push({ column: 'status', value: patch.status })
        if (updates.length === 0) {
            return await this.getById(id)
        }
        const setClause = updates.map((u, index) => `${u.column} = $${index + 1}`).join(', ')
        const params = updates.map(u => u.value)
        params.push(id)
        const result = await this.pg.query<ServiceRow>(
            `UPDATE cmdb_services SET ${setClause}
             WHERE id = $${params.length}
             RETURNING id, code, name, criticality, owner, sla, status, created_at`,
            params
        )
        return result.rows[0] ? mapService(result.rows[0]) : null
    }

    async getById(id: string): Promise<CmdbServiceRecord | null> {
        const result = await this.pg.query<ServiceRow>(
            `SELECT id, code, name, criticality, owner, sla, status, created_at
             FROM cmdb_services
             WHERE id = $1`,
            [id]
        )
        return result.rows[0] ? mapService(result.rows[0]) : null
    }

    async list(filters: { q?: string; page?: number; limit?: number }): Promise<CmdbServicePage> {
        const params: unknown[] = []
        const conditions: string[] = []
        if (filters.q) {
            params.push(`%${filters.q}%`)
            const index = params.length
            conditions.push(`(code ILIKE $${index} OR name ILIKE $${index})`)
        }
        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
        const { page, limit, offset } = normalizePagination(filters.page, filters.limit)

        const countResult = await this.pg.query<{ count: string }>(
            `SELECT COUNT(*) AS count FROM cmdb_services ${whereClause}`,
            params
        )
        const total = parseInt(countResult.rows[0]?.count ?? '0', 10)

        const listParams = [...params, limit, offset]
        const result = await this.pg.query<ServiceRow>(
            `SELECT id, code, name, criticality, owner, sla, status, created_at
             FROM cmdb_services
             ${whereClause}
             ORDER BY name ASC
             LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
            listParams
        )
        return { items: result.rows.map(mapService), total, page, limit }
    }

    async addMember(serviceId: string, input: { ciId: string; role?: string | null }): Promise<CmdbServiceMemberRecord> {
        const result = await this.pg.query<MemberRow>(
            `INSERT INTO cmdb_service_members (service_id, ci_id, role)
             VALUES ($1,$2,$3)
             RETURNING id, service_id, ci_id, role, created_at`,
            [serviceId, input.ciId, input.role ?? null]
        )
        return mapMember(result.rows[0])
    }

    async removeMember(memberId: string): Promise<boolean> {
        const result = await this.pg.query(
            'DELETE FROM cmdb_service_members WHERE id = $1',
            [memberId]
        )
        return (result.rowCount ?? 0) > 0
    }

    async listMembers(serviceId: string): Promise<CmdbServiceMemberRecord[]> {
        const result = await this.pg.query<MemberRow>(
            `SELECT id, service_id, ci_id, role, created_at
             FROM cmdb_service_members
             WHERE service_id = $1
             ORDER BY created_at ASC`,
            [serviceId]
        )
        return result.rows.map(mapMember)
    }
}
