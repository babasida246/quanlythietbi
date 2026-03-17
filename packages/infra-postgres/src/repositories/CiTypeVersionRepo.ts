import type { CiTypeVersionRecord, ICiTypeVersionRepo, SpecVersionStatus } from '@qltb/contracts'
import type { Queryable } from './types.js'

type VersionRow = {
    id: string
    type_id: string
    version: number
    status: SpecVersionStatus
    created_by: string | null
    created_at: Date
}

const mapRow = (row: VersionRow): CiTypeVersionRecord => ({
    id: row.id,
    typeId: row.type_id,
    version: row.version,
    status: row.status,
    createdBy: row.created_by,
    createdAt: row.created_at.toISOString()
})

export class CiTypeVersionRepo implements ICiTypeVersionRepo {
    constructor(private pg: Queryable) { }

    async listByType(typeId: string): Promise<CiTypeVersionRecord[]> {
        const result = await this.pg.query<VersionRow>(
            `SELECT id, type_id, version, status, created_by, created_at
             FROM cmdb_ci_type_versions
             WHERE type_id = $1
             ORDER BY version DESC`,
            [typeId]
        )
        return result.rows.map(mapRow)
    }

    async getActiveByType(typeId: string): Promise<CiTypeVersionRecord | null> {
        const result = await this.pg.query<VersionRow>(
            `SELECT id, type_id, version, status, created_by, created_at
             FROM cmdb_ci_type_versions
             WHERE type_id = $1 AND status = 'active'
             ORDER BY version DESC
             LIMIT 1`,
            [typeId]
        )
        return result.rows[0] ? mapRow(result.rows[0]) : null
    }

    async getById(id: string): Promise<CiTypeVersionRecord | null> {
        const result = await this.pg.query<VersionRow>(
            `SELECT id, type_id, version, status, created_by, created_at
             FROM cmdb_ci_type_versions
             WHERE id = $1`,
            [id]
        )
        return result.rows[0] ? mapRow(result.rows[0]) : null
    }

    async getLatestVersionNumber(typeId: string): Promise<number> {
        const result = await this.pg.query<{ max: number | null }>(
            'SELECT MAX(version) AS max FROM cmdb_ci_type_versions WHERE type_id = $1',
            [typeId]
        )
        return result.rows[0]?.max ?? 0
    }

    async create(typeId: string, version: number, status: SpecVersionStatus, createdBy?: string | null): Promise<CiTypeVersionRecord> {
        const result = await this.pg.query<VersionRow>(
            `INSERT INTO cmdb_ci_type_versions (type_id, version, status, created_by)
             VALUES ($1, $2, $3, $4)
             RETURNING id, type_id, version, status, created_by, created_at`,
            [typeId, version, status, createdBy ?? null]
        )
        return mapRow(result.rows[0])
    }

    async updateStatus(id: string, status: SpecVersionStatus): Promise<CiTypeVersionRecord | null> {
        const result = await this.pg.query<VersionRow>(
            `UPDATE cmdb_ci_type_versions
             SET status = $1
             WHERE id = $2
             RETURNING id, type_id, version, status, created_by, created_at`,
            [status, id]
        )
        return result.rows[0] ? mapRow(result.rows[0]) : null
    }

    async retireOtherActive(typeId: string, keepId: string): Promise<number> {
        const result = await this.pg.query(
            `UPDATE cmdb_ci_type_versions
             SET status = 'retired'
             WHERE type_id = $1 AND status = 'active' AND id <> $2`,
            [typeId, keepId]
        )
        return result.rowCount ?? 0
    }
}
