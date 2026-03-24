/**
 * Organization Repository
 * CRUD + hierarchy (parent/child) for organizations (OU)
 */

import type { PgClient } from '../PgClient.js'
import type {
    OrganizationDto,
    CreateOrganizationDto,
    UpdateOrganizationDto,
    OrganizationListQuery,
    IOrganizationRepository
} from '@qltb/contracts'

function mapRow(row: Record<string, unknown>): OrganizationDto {
    return {
        id: row.id as string,
        name: row.name as string,
        code: (row.code as string) ?? null,
        description: (row.description as string) ?? null,
        parentId: (row.parent_id as string) ?? null,
        parentName: (row.parent_name as string) ?? null,
        path: (row.path as string) ?? (row.name as string),
        childrenCount: Number(row.children_count ?? 0),
        createdAt: (row.created_at as Date).toISOString(),
        updatedAt: (row.updated_at as Date).toISOString()
    }
}

export class OrganizationRepo implements IOrganizationRepository {
    constructor(private db: PgClient) {}

    async findAll(query: OrganizationListQuery): Promise<{ items: OrganizationDto[]; total: number }> {
        const conditions: string[] = []
        const params: unknown[] = []
        let p = 1

        if (query.search) {
            conditions.push(`(o.name ILIKE $${p} OR o.code ILIKE $${p})`)
            params.push(`%${query.search}%`)
            p++
        }

        if (query.parentId === null) {
            conditions.push('o.parent_id IS NULL')
        } else if (query.parentId) {
            conditions.push(`o.parent_id = $${p}`)
            params.push(query.parentId)
            p++
        } else if (!query.flat) {
            // Default: top-level only
            conditions.push('o.parent_id IS NULL')
        }

        const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
        const limit = Math.min(query.limit ?? 100, 200)
        const offset = ((query.page ?? 1) - 1) * limit

        const sql = `
            WITH org_tree AS (
                SELECT
                    o.*,
                    p.name AS parent_name,
                    COALESCE(p.name || ' > ', '') || o.name AS path,
                    (SELECT COUNT(*) FROM organizations c WHERE c.parent_id = o.id) AS children_count
                FROM organizations o
                LEFT JOIN organizations p ON p.id = o.parent_id
            )
            SELECT *, COUNT(*) OVER () AS total_count
            FROM org_tree o
            ${where}
            ORDER BY o.path, o.name
            LIMIT $${p} OFFSET $${p + 1}
        `
        params.push(limit, offset)

        const result = await this.db.query<Record<string, unknown>>(sql, params)
        const total = result.rows.length > 0 ? Number(result.rows[0].total_count) : 0

        return { items: result.rows.map(mapRow), total }
    }

    async findById(id: string): Promise<OrganizationDto | null> {
        const result = await this.db.query<Record<string, unknown>>(`
            SELECT
                o.*,
                p.name AS parent_name,
                COALESCE(p.name || ' > ', '') || o.name AS path,
                (SELECT COUNT(*) FROM organizations c WHERE c.parent_id = o.id) AS children_count
            FROM organizations o
            LEFT JOIN organizations p ON p.id = o.parent_id
            WHERE o.id = $1
        `, [id])

        return result.rows[0] ? mapRow(result.rows[0]) : null
    }

    async findByCode(code: string): Promise<OrganizationDto | null> {
        const result = await this.db.query<Record<string, unknown>>(`
            SELECT
                o.*,
                p.name AS parent_name,
                COALESCE(p.name || ' > ', '') || o.name AS path,
                (SELECT COUNT(*) FROM organizations c WHERE c.parent_id = o.id) AS children_count
            FROM organizations o
            LEFT JOIN organizations p ON p.id = o.parent_id
            WHERE o.code = $1
        `, [code])

        return result.rows[0] ? mapRow(result.rows[0]) : null
    }

    async create(dto: CreateOrganizationDto): Promise<OrganizationDto> {
        const result = await this.db.query<Record<string, unknown>>(`
            INSERT INTO organizations (name, code, description, parent_id, updated_at)
            VALUES ($1, $2, $3, $4, NOW())
            RETURNING *
        `, [dto.name, dto.code ?? null, dto.description ?? null, dto.parentId ?? null])

        const row = result.rows[0]
        // Fetch with joins for parent_name + path
        return (await this.findById(row.id as string))!
    }

    async update(id: string, dto: UpdateOrganizationDto): Promise<OrganizationDto | null> {
        const fields: string[] = []
        const params: unknown[] = []
        let p = 1

        if (dto.name !== undefined) { fields.push(`name = $${p++}`); params.push(dto.name) }
        if (dto.code !== undefined) { fields.push(`code = $${p++}`); params.push(dto.code) }
        if (dto.description !== undefined) { fields.push(`description = $${p++}`); params.push(dto.description) }
        if (dto.parentId !== undefined) { fields.push(`parent_id = $${p++}`); params.push(dto.parentId) }

        if (fields.length === 0) return this.findById(id)

        fields.push(`updated_at = NOW()`)
        params.push(id)

        const result = await this.db.query<Record<string, unknown>>(`
            UPDATE organizations SET ${fields.join(', ')} WHERE id = $${p} RETURNING id
        `, params)

        if (result.rows.length === 0) return null
        return this.findById(id)
    }

    async delete(id: string): Promise<boolean> {
        // Move children to parent before delete
        await this.db.query(`
            UPDATE organizations SET parent_id = (
                SELECT parent_id FROM organizations WHERE id = $1
            ) WHERE parent_id = $1
        `, [id])

        const result = await this.db.query(
            `DELETE FROM organizations WHERE id = $1 RETURNING id`, [id]
        )
        return (result.rowCount ?? 0) > 0
    }
}
