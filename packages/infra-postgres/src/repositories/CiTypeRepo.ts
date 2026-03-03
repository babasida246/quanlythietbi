import type { ICiTypeRepo, CiTypeRecord } from '@qltb/contracts'
import type { Queryable } from './types.js'

type CiTypeRow = {
    id: string
    code: string
    name: string
    description: string | null
    created_at: Date
}

const mapRow = (row: CiTypeRow): CiTypeRecord => ({
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description,
    createdAt: row.created_at
})

export class CiTypeRepo implements ICiTypeRepo {
    constructor(private pg: Queryable) { }

    async create(input: { code: string; name: string; description?: string | null }): Promise<CiTypeRecord> {
        const result = await this.pg.query<CiTypeRow>(
            `INSERT INTO cmdb_ci_types (code, name, description)
             VALUES ($1, $2, $3)
             RETURNING id, code, name, description, created_at`,
            [input.code, input.name, input.description ?? null]
        )
        return mapRow(result.rows[0])
    }

    async getById(id: string): Promise<CiTypeRecord | null> {
        const result = await this.pg.query<CiTypeRow>(
            `SELECT id, code, name, description, created_at
             FROM cmdb_ci_types
             WHERE id = $1`,
            [id]
        )
        return result.rows[0] ? mapRow(result.rows[0]) : null
    }

    async list(): Promise<CiTypeRecord[]> {
        const result = await this.pg.query<CiTypeRow>(
            `SELECT id, code, name, description, created_at
             FROM cmdb_ci_types
             ORDER BY name ASC`
        )
        return result.rows.map(mapRow)
    }
}
