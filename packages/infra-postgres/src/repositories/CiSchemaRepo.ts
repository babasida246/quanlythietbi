import type { PoolClient } from 'pg'
import type {
    CiAttrDefCreateInput,
    CiAttrDefInput,
    CiAttrDefRecord,
    CiAttrDefUpdatePatch,
    CiSchemaTransactionContext,
    ICiSchemaRepo
} from '@qltb/contracts'
import type { PgClient } from '../PgClient.js'
import type { Queryable } from './types.js'
import { CiTypeRepo } from './CiTypeRepo.js'
import { CiTypeVersionRepo } from './CiTypeVersionRepo.js'

type DefRow = {
    id: string
    ci_type_version_id: string
    key: string
    label: string
    field_type: CiAttrDefRecord['fieldType']
    required: boolean
    unit: string | null
    enum_values: string[] | null
    pattern: string | null
    min_value: number | null
    max_value: number | null
    step_value: number | null
    min_len: number | null
    max_len: number | null
    default_value: unknown | null
    is_searchable: boolean
    is_filterable: boolean
    sort_order: number
    is_active: boolean
    created_at: Date
    updated_at: Date
}

type Update = { column: string; value: unknown }

const mapRow = (row: DefRow): CiAttrDefRecord => ({
    id: row.id,
    versionId: row.ci_type_version_id,
    key: row.key,
    label: row.label,
    fieldType: row.field_type,
    required: row.required,
    unit: row.unit,
    enumValues: row.enum_values,
    pattern: row.pattern,
    minValue: row.min_value,
    maxValue: row.max_value,
    stepValue: row.step_value,
    minLen: row.min_len,
    maxLen: row.max_len,
    defaultValue: row.default_value ?? undefined,
    isSearchable: row.is_searchable,
    isFilterable: row.is_filterable,
    sortOrder: row.sort_order,
    isActive: row.is_active,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString()
})

function buildUpdates(patch: CiAttrDefUpdatePatch): Update[] {
    const updates: Update[] = []
    if (patch.key !== undefined) updates.push({ column: 'key', value: patch.key })
    if (patch.label !== undefined) updates.push({ column: 'label', value: patch.label })
    if (patch.fieldType !== undefined) updates.push({ column: 'field_type', value: patch.fieldType })
    if (patch.required !== undefined) updates.push({ column: 'required', value: patch.required })
    if (patch.unit !== undefined) updates.push({ column: 'unit', value: patch.unit })
    if (patch.enumValues !== undefined) updates.push({ column: 'enum_values', value: patch.enumValues })
    if (patch.pattern !== undefined) updates.push({ column: 'pattern', value: patch.pattern })
    if (patch.minValue !== undefined) updates.push({ column: 'min_value', value: patch.minValue })
    if (patch.maxValue !== undefined) updates.push({ column: 'max_value', value: patch.maxValue })
    if (patch.stepValue !== undefined) updates.push({ column: 'step_value', value: patch.stepValue })
    if (patch.minLen !== undefined) updates.push({ column: 'min_len', value: patch.minLen })
    if (patch.maxLen !== undefined) updates.push({ column: 'max_len', value: patch.maxLen })
    if (patch.defaultValue !== undefined) updates.push({ column: 'default_value', value: patch.defaultValue })
    if (patch.isSearchable !== undefined) updates.push({ column: 'is_searchable', value: patch.isSearchable })
    if (patch.isFilterable !== undefined) updates.push({ column: 'is_filterable', value: patch.isFilterable })
    if (patch.sortOrder !== undefined) updates.push({ column: 'sort_order', value: patch.sortOrder })
    if (patch.isActive !== undefined) updates.push({ column: 'is_active', value: patch.isActive })
    return updates
}

export class CiSchemaRepo implements ICiSchemaRepo {
    private root: PgClient | null

    constructor(private pg: Queryable, root?: PgClient) {
        this.root = root ?? (pg instanceof Object && 'transaction' in pg ? (pg as PgClient) : null)
    }

    async listByVersion(versionId: string): Promise<CiAttrDefRecord[]> {
        const result = await this.pg.query<DefRow>(
            `SELECT id, ci_type_version_id, key, label, field_type, required, unit, enum_values, pattern,
                min_value, max_value, step_value, min_len, max_len, default_value, is_searchable,
                is_filterable, sort_order, is_active, created_at, updated_at
             FROM cmdb_ci_type_attr_defs
             WHERE ci_type_version_id = $1 AND is_active = true
             ORDER BY sort_order ASC, key ASC`,
            [versionId]
        )
        return result.rows.map(mapRow)
    }

    async bulkInsert(versionId: string, defs: CiAttrDefInput[]): Promise<CiAttrDefRecord[]> {
        if (defs.length === 0) return []
        const columns = [
            'ci_type_version_id',
            'key',
            'label',
            'field_type',
            'required',
            'unit',
            'enum_values',
            'pattern',
            'min_value',
            'max_value',
            'step_value',
            'min_len',
            'max_len',
            'default_value',
            'is_searchable',
            'is_filterable',
            'sort_order',
            'is_active'
        ]
        const values: unknown[] = []
        const placeholders = defs.map((def, index) => {
            const base = index * columns.length
            values.push(
                versionId,
                def.key,
                def.label,
                def.fieldType,
                def.required ?? false,
                def.unit ?? null,
                def.enumValues ?? null,
                def.pattern ?? null,
                def.minValue ?? null,
                def.maxValue ?? null,
                def.stepValue ?? null,
                def.minLen ?? null,
                def.maxLen ?? null,
                def.defaultValue ?? null,
                def.isSearchable ?? false,
                def.isFilterable ?? false,
                def.sortOrder ?? 0,
                def.isActive ?? true
            )
            const items = columns.map((_, colIndex) => `$${base + colIndex + 1}`)
            return `(${items.join(', ')})`
        })

        const result = await this.pg.query<DefRow>(
            `INSERT INTO cmdb_ci_type_attr_defs (${columns.join(', ')})
             VALUES ${placeholders.join(', ')}
             RETURNING id, version_id, key, label, field_type, required, unit, enum_values, pattern,
                min_value, max_value, step_value, min_len, max_len, default_value, is_searchable,
                is_filterable, sort_order, is_active, created_at, updated_at`,
            values
        )
        return result.rows.map(mapRow)
    }

    async create(input: CiAttrDefCreateInput): Promise<CiAttrDefRecord> {
        const result = await this.pg.query<DefRow>(
            `INSERT INTO cmdb_ci_type_attr_defs
                (ci_type_version_id, key, label, field_type, required, unit, enum_values, pattern, min_value,
                 max_value, step_value, min_len, max_len, default_value, is_searchable, is_filterable,
                 sort_order, is_active)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
             RETURNING id, ci_type_version_id, key, label, field_type, required, unit, enum_values, pattern,
                min_value, max_value, step_value, min_len, max_len, default_value, is_searchable,
                is_filterable, sort_order, is_active, created_at, updated_at`,
            [
                input.versionId,
                input.key,
                input.label,
                input.fieldType,
                input.required ?? false,
                input.unit ?? null,
                input.enumValues ?? null,
                input.pattern ?? null,
                input.minValue ?? null,
                input.maxValue ?? null,
                input.stepValue ?? null,
                input.minLen ?? null,
                input.maxLen ?? null,
                input.defaultValue ?? null,
                input.isSearchable ?? false,
                input.isFilterable ?? false,
                input.sortOrder ?? 0,
                input.isActive ?? true
            ]
        )
        return mapRow(result.rows[0])
    }

    async update(id: string, patch: CiAttrDefUpdatePatch): Promise<CiAttrDefRecord | null> {
        const updates = buildUpdates(patch)
        if (updates.length === 0) {
            const existing = await this.pg.query<DefRow>(
                `SELECT id, ci_type_version_id, key, label, field_type, required, unit, enum_values, pattern,
                    min_value, max_value, step_value, min_len, max_len, default_value, is_searchable,
                    is_filterable, sort_order, is_active, created_at, updated_at
                 FROM cmdb_ci_type_attr_defs WHERE id = $1`,
                [id]
            )
            return existing.rows[0] ? mapRow(existing.rows[0]) : null
        }
        const setClause = updates.map((update, index) => `${update.column} = $${index + 1}`).join(', ')
        const params = updates.map(update => update.value)
        params.push(id)
        const result = await this.pg.query<DefRow>(
            `UPDATE cmdb_ci_type_attr_defs SET ${setClause}, updated_at = NOW()
             WHERE id = $${params.length}
             RETURNING id, ci_type_version_id, key, label, field_type, required, unit, enum_values, pattern,
                min_value, max_value, step_value, min_len, max_len, default_value, is_searchable,
                is_filterable, sort_order, is_active, created_at, updated_at`,
            params
        )
        return result.rows[0] ? mapRow(result.rows[0]) : null
    }

    async softDelete(id: string): Promise<boolean> {
        const result = await this.pg.query(
            'UPDATE cmdb_ci_type_attr_defs SET is_active = false, updated_at = NOW() WHERE id = $1',
            [id]
        )
        return (result.rowCount ?? 0) > 0
    }

    async withTransaction<T>(handler: (context: CiSchemaTransactionContext) => Promise<T>): Promise<T> {
        if (!this.root) {
            throw new Error('Transaction runner not available')
        }
        return this.root.transaction(async (client: PoolClient) => {
            const types = new CiTypeRepo(client)
            const versions = new CiTypeVersionRepo(client)
            const defs = new CiSchemaRepo(client, this.root ?? undefined)
            return handler({ types, versions, defs })
        })
    }
}
