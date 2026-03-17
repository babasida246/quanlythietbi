import type { IRelRepo, RelationshipRecord } from '@qltb/contracts'
import type { Queryable } from './types.js'

type RelRow = {
    id: string
    rel_type_id: string
    from_ci_id: string
    to_ci_id: string
    status: RelationshipRecord['status']
    since_date: string | null
    note: string | null
    created_at: Date
}

type RelSchemaInfo = {
    typeColumn: 'type_id' | 'rel_type_id'
    hasStatus: boolean
    hasSinceDate: boolean
    hasNote: boolean
    hasMetadata: boolean
}

const mapRow = (row: RelRow): RelationshipRecord => ({
    id: row.id,
    relTypeId: row.rel_type_id,
    fromCiId: row.from_ci_id,
    toCiId: row.to_ci_id,
    status: row.status,
    sinceDate: row.since_date ?? null,
    note: row.note ?? null,
    createdAt: row.created_at.toISOString()
})

export class RelationshipRepo implements IRelRepo {
    private schemaInfoPromise: Promise<RelSchemaInfo> | null = null

    constructor(private pg: Queryable) { }

    private async getSchemaInfo(): Promise<RelSchemaInfo> {
        if (!this.schemaInfoPromise) {
            this.schemaInfoPromise = (async () => {
                const result = await this.pg.query<{ column_name: string }>(
                    `
                    SELECT column_name
                    FROM information_schema.columns
                    WHERE table_schema = 'public'
                      AND table_name = 'cmdb_relationships'
                    `
                )
                const cols = new Set(result.rows.map(row => row.column_name))
                return {
                    typeColumn: cols.has('type_id') ? 'type_id' : 'rel_type_id',
                    hasStatus: cols.has('status'),
                    hasSinceDate: cols.has('since_date'),
                    hasNote: cols.has('note'),
                    hasMetadata: cols.has('metadata')
                }
            })()
        }
        return await this.schemaInfoPromise
    }

    private selectColumns(info: RelSchemaInfo): string {
        const statusExpr = info.hasStatus ? 'status' : `'active'::text AS status`
        const sinceExpr = info.hasSinceDate
            ? 'since_date'
            : (info.hasMetadata ? "NULLIF(metadata->>'sinceDate', '') AS since_date" : 'NULL::text AS since_date')
        const noteExpr = info.hasNote
            ? 'note'
            : (info.hasMetadata ? "NULLIF(metadata->>'note', '') AS note" : 'NULL::text AS note')

        return `id, ${info.typeColumn} AS rel_type_id, from_ci_id, to_ci_id, ${statusExpr}, ${sinceExpr}, ${noteExpr}, created_at`
    }

    async create(input: {
        relTypeId: string
        fromCiId: string
        toCiId: string
        sinceDate?: string | null
        note?: string | null
    }): Promise<RelationshipRecord> {
        const info = await this.getSchemaInfo()
        if (!info.hasStatus && info.hasMetadata) {
            const metadata = {
                ...(input.sinceDate ? { sinceDate: input.sinceDate } : {}),
                ...(input.note ? { note: input.note } : {})
            }
            const result = await this.pg.query<RelRow>(
                `INSERT INTO cmdb_relationships (${info.typeColumn}, from_ci_id, to_ci_id, metadata)
                 VALUES ($1,$2,$3,$4::jsonb)
                 RETURNING ${this.selectColumns(info)}`,
                [input.relTypeId, input.fromCiId, input.toCiId, metadata]
            )
            return mapRow(result.rows[0])
        }

        const result = await this.pg.query<RelRow>(
            `INSERT INTO cmdb_relationships (${info.typeColumn}, from_ci_id, to_ci_id, since_date, note)
             VALUES ($1,$2,$3,$4,$5)
             RETURNING ${this.selectColumns(info)}`,
            [input.relTypeId, input.fromCiId, input.toCiId, input.sinceDate ?? null, input.note ?? null]
        )
        return mapRow(result.rows[0])
    }

    async retire(id: string): Promise<RelationshipRecord | null> {
        const info = await this.getSchemaInfo()
        if (!info.hasStatus) {
            const current = await this.pg.query<RelRow>(
                `SELECT ${this.selectColumns(info)}
                 FROM cmdb_relationships
                 WHERE id = $1`,
                [id]
            )
            if (!current.rows[0]) return null
            await this.pg.query('DELETE FROM cmdb_relationships WHERE id = $1', [id])
            return {
                ...mapRow(current.rows[0]),
                status: 'retired'
            }
        }

        const result = await this.pg.query<RelRow>(
            `UPDATE cmdb_relationships
             SET status = 'retired'
             WHERE id = $1
             RETURNING ${this.selectColumns(info)}`,
            [id]
        )
        return result.rows[0] ? mapRow(result.rows[0]) : null
    }

    async listByCi(ciId: string): Promise<RelationshipRecord[]> {
        const info = await this.getSchemaInfo()
        const whereStatus = info.hasStatus ? `status = 'active' AND ` : ''
        const result = await this.pg.query<RelRow>(
            `SELECT ${this.selectColumns(info)}
             FROM cmdb_relationships
             WHERE ${whereStatus}(from_ci_id = $1 OR to_ci_id = $1)
             ORDER BY created_at DESC`,
            [ciId]
        )
        return result.rows.map(mapRow)
    }

    async list(): Promise<RelationshipRecord[]> {
        const info = await this.getSchemaInfo()
        const whereStatus = info.hasStatus ? `WHERE status = 'active'` : ''
        const result = await this.pg.query<RelRow>(
            `SELECT ${this.selectColumns(info)}
             FROM cmdb_relationships
             ${whereStatus}
             ORDER BY created_at DESC`
        )
        return result.rows.map(mapRow)
    }
}
