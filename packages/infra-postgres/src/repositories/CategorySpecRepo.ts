import type { PoolClient } from 'pg'
import type {
    CategorySpecDefCreateInput,
    CategorySpecDefInput,
    CategorySpecDefRecord,
    CategorySpecDefUpdatePatch,
    CategorySpecTransactionContext,
    ICategorySpecRepo
} from '@qltb/contracts'
import type { PgClient } from '../PgClient.js'
import type { Queryable } from './types.js'
import { CatalogRepo } from './CatalogRepo.js'
import { CategorySpecVersionRepo } from './CategorySpecVersionRepo.js'

type SpecRow = {
    id: string
    spec_version_id: string
    key: string
    label: string
    field_type: CategorySpecDefRecord['fieldType']
    unit: string | null
    required: boolean
    enum_values: string[] | null
    pattern: string | null
    min_len: number | null
    max_len: number | null
    min_value: number | null
    max_value: number | null
    step_value: number | null
    precision: number | null
    scale: number | null
    normalize: string | null
    default_value: unknown | null
    help_text: string | null
    sort_order: number
    is_active: boolean
    is_readonly: boolean
    computed_expr: string | null
    is_searchable: boolean
    is_filterable: boolean
    created_at: Date
    updated_at: Date
}

type Update = { column: string; value: unknown }

function buildUpdates(patch: Record<string, unknown>, fields: Array<[string, string]>): Update[] {
    const updates: Update[] = []
    for (const [key, column] of fields) {
        const value = patch[key]
        if (value !== undefined) updates.push({ column, value })
    }
    return updates
}

const mapSpec = (row: SpecRow): CategorySpecDefRecord => ({
    id: row.id,
    versionId: row.spec_version_id,
    key: row.key,
    label: row.label,
    fieldType: row.field_type,
    unit: row.unit,
    required: row.required,
    enumValues: row.enum_values,
    pattern: row.pattern,
    minLen: row.min_len,
    maxLen: row.max_len,
    minValue: row.min_value,
    maxValue: row.max_value,
    stepValue: row.step_value,
    precision: row.precision,
    scale: row.scale,
    normalize: (row.normalize ?? null) as CategorySpecDefRecord['normalize'],
    defaultValue: row.default_value ?? undefined,
    helpText: row.help_text,
    sortOrder: row.sort_order,
    isActive: row.is_active,
    isReadonly: row.is_readonly,
    computedExpr: row.computed_expr,
    isSearchable: row.is_searchable,
    isFilterable: row.is_filterable,
    createdAt: row.created_at,
    updatedAt: row.updated_at
})

export class CategorySpecRepo implements ICategorySpecRepo {
    private readonly pg: Queryable
    private root: PgClient | null

    constructor(pg: Queryable, root?: PgClient) {
        this.pg = pg
        this.root = root ?? (pg instanceof Object && 'transaction' in pg ? (pg as PgClient) : null)
    }

    async listByCategory(categoryId: string): Promise<CategorySpecDefRecord[]> {
        const result = await this.pg.query<SpecRow>(
            `SELECT defs.id, defs.spec_version_id, defs.key, defs.label, defs.field_type, defs.unit, defs.required, defs.enum_values,
                defs.pattern, defs.min_len, defs.max_len, defs.min_value, defs.max_value, defs.step_value, defs.precision,
                defs.scale, defs.normalize, defs.default_value, defs.help_text, defs.sort_order, defs.is_active,
                defs.is_readonly, defs.computed_expr, defs.is_searchable, defs.is_filterable, defs.created_at, defs.updated_at
             FROM asset_category_spec_definitions defs
             JOIN asset_category_spec_versions versions ON defs.spec_version_id = versions.id
             WHERE versions.category_id = $1 AND versions.status = 'active' AND defs.is_active = true
             ORDER BY defs.sort_order ASC, defs.key ASC`,
            [categoryId]
        )
        return result.rows.map(mapSpec)
    }

    async listByVersion(versionId: string): Promise<CategorySpecDefRecord[]> {
        const result = await this.pg.query<SpecRow>(
            `SELECT id, spec_version_id, key, label, field_type, unit, required, enum_values, pattern, min_len, max_len,
                min_value, max_value, step_value, precision, scale, normalize, default_value, help_text, sort_order,
                is_active, is_readonly, computed_expr, is_searchable, is_filterable, created_at, updated_at
             FROM asset_category_spec_definitions
             WHERE spec_version_id = $1 AND is_active = true
             ORDER BY sort_order ASC, key ASC`,
            [versionId]
        )
        return result.rows.map(mapSpec)
    }

    async bulkInsert(versionId: string, defs: CategorySpecDefInput[]): Promise<CategorySpecDefRecord[]> {
        if (defs.length === 0) return []
        const columns = [
            'spec_version_id',
            'key',
            'label',
            'field_type',
            'unit',
            'required',
            'enum_values',
            'pattern',
            'min_len',
            'max_len',
            'min_value',
            'max_value',
            'step_value',
            'precision',
            'scale',
            'normalize',
            'default_value',
            'help_text',
            'sort_order',
            'is_active',
            'is_readonly',
            'computed_expr',
            'is_searchable',
            'is_filterable'
        ]
        const values: unknown[] = []
        const placeholders = defs.map((def, index) => {
            const base = index * columns.length
            values.push(
                versionId,
                def.key,
                def.label,
                def.fieldType,
                def.unit ?? null,
                def.required ?? false,
                def.enumValues ?? null,
                def.pattern ?? null,
                def.minLen ?? null,
                def.maxLen ?? null,
                def.minValue ?? null,
                def.maxValue ?? null,
                def.stepValue ?? null,
                def.precision ?? null,
                def.scale ?? null,
                def.normalize ?? null,
                def.defaultValue ?? null,
                def.helpText ?? null,
                def.sortOrder ?? 0,
                def.isActive ?? true,
                def.isReadonly ?? false,
                def.computedExpr ?? null,
                def.isSearchable ?? false,
                def.isFilterable ?? false
            )
            const items = columns.map((_, colIndex) => `$${base + colIndex + 1}`)
            return `(${items.join(', ')})`
        })

        const result = await this.pg.query<SpecRow>(
            `INSERT INTO asset_category_spec_definitions (${columns.join(', ')})
             VALUES ${placeholders.join(', ')}
             RETURNING id, spec_version_id, key, label, field_type, unit, required, enum_values, pattern, min_len, max_len,
                min_value, max_value, step_value, precision, scale, normalize, default_value, help_text, sort_order,
                is_active, is_readonly, computed_expr, is_searchable, is_filterable, created_at, updated_at`,
            values
        )
        return result.rows.map(mapSpec)
    }

    async create(input: CategorySpecDefCreateInput): Promise<CategorySpecDefRecord> {
        const result = await this.pg.query<SpecRow>(
            `INSERT INTO asset_category_spec_definitions
                (spec_version_id, key, label, field_type, unit, required, enum_values, pattern, min_len, max_len, min_value, max_value,
                 step_value, precision, scale, normalize, default_value, help_text, sort_order, is_active, is_readonly,
                 computed_expr, is_searchable, is_filterable)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24)
             RETURNING id, spec_version_id, key, label, field_type, unit, required, enum_values, pattern, min_len, max_len, min_value,
                max_value, step_value, precision, scale, normalize, default_value, help_text, sort_order, is_active, is_readonly,
                computed_expr, is_searchable, is_filterable, created_at, updated_at`,
            [
                input.versionId,
                input.key,
                input.label,
                input.fieldType,
                input.unit ?? null,
                input.required ?? false,
                input.enumValues ?? null,
                input.pattern ?? null,
                input.minLen ?? null,
                input.maxLen ?? null,
                input.minValue ?? null,
                input.maxValue ?? null,
                input.stepValue ?? null,
                input.precision ?? null,
                input.scale ?? null,
                input.normalize ?? null,
                input.defaultValue ?? null,
                input.helpText ?? null,
                input.sortOrder ?? 0,
                input.isActive ?? true,
                input.isReadonly ?? false,
                input.computedExpr ?? null,
                input.isSearchable ?? false,
                input.isFilterable ?? false
            ]
        )
        return mapSpec(result.rows[0])
    }

    async update(id: string, patch: CategorySpecDefUpdatePatch): Promise<CategorySpecDefRecord | null> {
        const updates = buildUpdates(patch as Record<string, unknown>, [
            ['key', 'key'],
            ['label', 'label'],
            ['fieldType', 'field_type'],
            ['unit', 'unit'],
            ['required', 'required'],
            ['enumValues', 'enum_values'],
            ['pattern', 'pattern'],
            ['minLen', 'min_len'],
            ['maxLen', 'max_len'],
            ['minValue', 'min_value'],
            ['maxValue', 'max_value'],
            ['stepValue', 'step_value'],
            ['precision', 'precision'],
            ['scale', 'scale'],
            ['normalize', 'normalize'],
            ['defaultValue', 'default_value'],
            ['helpText', 'help_text'],
            ['sortOrder', 'sort_order'],
            ['isActive', 'is_active'],
            ['isReadonly', 'is_readonly'],
            ['computedExpr', 'computed_expr'],
            ['isSearchable', 'is_searchable'],
            ['isFilterable', 'is_filterable']
        ])
        if (updates.length === 0) {
            const existing = await this.pg.query<SpecRow>(
                `SELECT id, spec_version_id, key, label, field_type, unit, required, enum_values, pattern, min_len, max_len,
                    min_value, max_value, step_value, precision, scale, normalize, default_value, help_text, sort_order,
                    is_active, is_readonly, computed_expr, is_searchable, is_filterable, created_at, updated_at
                 FROM asset_category_spec_definitions WHERE id = $1`,
                [id]
            )
            return existing.rows[0] ? mapSpec(existing.rows[0]) : null
        }
        const setClause = updates.map((update, index) => `${update.column} = $${index + 1}`).join(', ')
        const params = updates.map(update => update.value)
        params.push(id)
        const result = await this.pg.query<SpecRow>(
            `UPDATE asset_category_spec_definitions SET ${setClause}, updated_at = NOW()
             WHERE id = $${params.length}
             RETURNING id, spec_version_id, key, label, field_type, unit, required, enum_values, pattern, min_len, max_len,
                min_value, max_value, step_value, precision, scale, normalize, default_value, help_text, sort_order,
                is_active, is_readonly, computed_expr, is_searchable, is_filterable, created_at, updated_at`,
            params
        )
        return result.rows[0] ? mapSpec(result.rows[0]) : null
    }

    async softDelete(id: string): Promise<boolean> {
        const result = await this.pg.query(
            'UPDATE asset_category_spec_definitions SET is_active = false, updated_at = NOW() WHERE id = $1',
            [id]
        )
        return (result.rowCount ?? 0) > 0
    }

    async withTransaction<T>(handler: (context: CategorySpecTransactionContext) => Promise<T>): Promise<T> {
        if (!this.root) {
            throw new Error('Transaction runner not available')
        }
        return this.root.transaction(async (client) => {
            const catalogs = new CatalogRepo(client)
            const specs = new CategorySpecRepo(client, this.root ?? undefined)
            const versions = new CategorySpecVersionRepo(client, this.root ?? undefined)
            return handler({ catalogs, specs, versions })
        })
    }
}
