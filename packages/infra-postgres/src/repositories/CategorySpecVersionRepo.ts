import type { PoolClient } from 'pg'
import type {
    CategorySpecVersionRecord,
    ICategorySpecVersionRepo,
    SpecVersionStatus
} from '@qltb/contracts'
import type { PgClient } from '../PgClient.js'
import type { Queryable } from './types.js'

type VersionRow = {
    id: string
    category_id: string
    version: number
    status: SpecVersionStatus
    created_by: string | null
    created_at: Date
}

const mapVersion = (row: VersionRow): CategorySpecVersionRecord => ({
    id: row.id,
    categoryId: row.category_id,
    version: row.version,
    status: row.status,
    createdBy: row.created_by,
    createdAt: row.created_at
})

export class CategorySpecVersionRepo implements ICategorySpecVersionRepo {
    private root: PgClient | null

    constructor(private pg: Queryable, root?: PgClient) {
        this.root = root ?? (pg instanceof Object && 'transaction' in pg ? (pg as PgClient) : null)
    }

    async listByCategory(categoryId: string): Promise<CategorySpecVersionRecord[]> {
        const result = await this.pg.query<VersionRow>(
            `SELECT id, category_id, version, status, created_by, created_at
             FROM asset_category_spec_versions
             WHERE category_id = $1
             ORDER BY version DESC`,
            [categoryId]
        )
        return result.rows.map(mapVersion)
    }

    async getActiveByCategory(categoryId: string): Promise<CategorySpecVersionRecord | null> {
        const result = await this.pg.query<VersionRow>(
            `SELECT id, category_id, version, status, created_by, created_at
             FROM asset_category_spec_versions
             WHERE category_id = $1 AND status = 'active'
             ORDER BY version DESC
             LIMIT 1`,
            [categoryId]
        )
        return result.rows[0] ? mapVersion(result.rows[0]) : null
    }

    async getById(id: string): Promise<CategorySpecVersionRecord | null> {
        const result = await this.pg.query<VersionRow>(
            `SELECT id, category_id, version, status, created_by, created_at
             FROM asset_category_spec_versions
             WHERE id = $1`,
            [id]
        )
        return result.rows[0] ? mapVersion(result.rows[0]) : null
    }

    async getLatestVersionNumber(categoryId: string): Promise<number> {
        const result = await this.pg.query<{ max: number | null }>(
            'SELECT MAX(version) AS max FROM asset_category_spec_versions WHERE category_id = $1',
            [categoryId]
        )
        return result.rows[0]?.max ?? 0
    }

    async create(
        categoryId: string,
        version: number,
        status: SpecVersionStatus,
        createdBy?: string | null
    ): Promise<CategorySpecVersionRecord> {
        const result = await this.pg.query<VersionRow>(
            `INSERT INTO asset_category_spec_versions (category_id, version, status, created_by)
             VALUES ($1,$2,$3,$4)
             RETURNING id, category_id, version, status, created_by, created_at`,
            [categoryId, version, status, createdBy ?? null]
        )
        return mapVersion(result.rows[0])
    }

    async updateStatus(id: string, status: SpecVersionStatus): Promise<CategorySpecVersionRecord | null> {
        const result = await this.pg.query<VersionRow>(
            `UPDATE asset_category_spec_versions
             SET status = $1
             WHERE id = $2
             RETURNING id, category_id, version, status, created_by, created_at`,
            [status, id]
        )
        return result.rows[0] ? mapVersion(result.rows[0]) : null
    }

    async retireOtherActive(categoryId: string, keepId: string): Promise<number> {
        const result = await this.pg.query(
            `UPDATE asset_category_spec_versions
             SET status = 'retired'
             WHERE category_id = $1 AND status = 'active' AND id <> $2`,
            [categoryId, keepId]
        )
        return result.rowCount ?? 0
    }
}
