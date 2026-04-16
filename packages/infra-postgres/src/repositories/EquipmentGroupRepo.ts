import type {
    EquipmentGroupRecord,
    EquipmentGroupFieldRecord,
    EquipmentGroupTreeNode,
    EquipmentGroupCreateInput,
    EquipmentGroupUpdateInput,
    EquipmentGroupFieldCreateInput,
    EquipmentGroupFieldUpdateInput,
    IEquipmentGroupRepo,
} from '@qltb/contracts'
import type { Queryable } from './types.js'

type GroupRow = {
    id: string
    code: string | null
    name: string
    description: string | null
    parent_id: string | null
    inherit_parent_fields: boolean
    is_active: boolean
    sort_order: number
    created_at: Date
    updated_at: Date
    parent_name?: string | null
    field_count?: string | null
}

type FieldRow = {
    id: string
    group_id: string
    key: string
    label: string
    field_type: string
    required: boolean
    enum_values: string[] | null
    default_value: string | null
    help_text: string | null
    sort_order: number
    is_active: boolean
    created_at: Date
    updated_at: Date
}

function mapGroup(row: GroupRow): EquipmentGroupRecord {
    return {
        id: row.id,
        code: row.code,
        name: row.name,
        description: row.description,
        parentId: row.parent_id,
        inheritParentFields: row.inherit_parent_fields,
        isActive: row.is_active,
        sortOrder: row.sort_order,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        parentName: row.parent_name ?? null,
        fieldCount: row.field_count != null ? Number(row.field_count) : undefined,
    }
}

function mapField(row: FieldRow): EquipmentGroupFieldRecord {
    return {
        id: row.id,
        groupId: row.group_id,
        key: row.key,
        label: row.label,
        fieldType: row.field_type as EquipmentGroupFieldRecord['fieldType'],
        required: row.required,
        enumValues: row.enum_values,
        defaultValue: row.default_value,
        helpText: row.help_text,
        sortOrder: row.sort_order,
        isActive: row.is_active,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    }
}

export class EquipmentGroupRepo implements IEquipmentGroupRepo {
    constructor(private db: Queryable) {}

    async list(filters?: { isActive?: boolean }): Promise<EquipmentGroupRecord[]> {
        const conditions: string[] = []
        const params: unknown[] = []

        if (filters?.isActive !== undefined) {
            params.push(filters.isActive)
            conditions.push(`g.is_active = $${params.length}`)
        }

        const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
        const result = await this.db.query<GroupRow & { parent_name: string | null; field_count: string }>(
            `SELECT g.*,
                    p.name AS parent_name,
                    COUNT(f.id)::text AS field_count
             FROM equipment_groups g
             LEFT JOIN equipment_groups p ON p.id = g.parent_id
             LEFT JOIN equipment_group_fields f ON f.group_id = g.id AND f.is_active = true
             ${where}
             GROUP BY g.id, p.name
             ORDER BY g.sort_order, g.name`,
            params
        )
        return result.rows.map(mapGroup)
    }

    async getTree(): Promise<EquipmentGroupTreeNode[]> {
        const all = await this.list()
        const map = new Map<string, EquipmentGroupTreeNode>()
        for (const g of all) {
            map.set(g.id, { ...g, children: [] })
        }
        const roots: EquipmentGroupTreeNode[] = []
        for (const node of map.values()) {
            if (node.parentId && map.has(node.parentId)) {
                map.get(node.parentId)!.children.push(node)
            } else {
                roots.push(node)
            }
        }
        return roots
    }

    async getById(id: string): Promise<EquipmentGroupRecord | null> {
        const result = await this.db.query<GroupRow & { parent_name: string | null; field_count: string }>(
            `SELECT g.*,
                    p.name AS parent_name,
                    COUNT(f.id)::text AS field_count
             FROM equipment_groups g
             LEFT JOIN equipment_groups p ON p.id = g.parent_id
             LEFT JOIN equipment_group_fields f ON f.group_id = g.id AND f.is_active = true
             WHERE g.id = $1
             GROUP BY g.id, p.name`,
            [id]
        )
        if (result.rows.length === 0) return null
        return mapGroup(result.rows[0])
    }

    async create(input: EquipmentGroupCreateInput): Promise<EquipmentGroupRecord> {
        const result = await this.db.query<GroupRow>(
            `INSERT INTO equipment_groups
                (code, name, description, parent_id, inherit_parent_fields, is_active, sort_order)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING *`,
            [
                input.code ?? null,
                input.name,
                input.description ?? null,
                input.parentId ?? null,
                input.inheritParentFields ?? true,
                input.isActive ?? true,
                input.sortOrder ?? 0,
            ]
        )
        return mapGroup(result.rows[0])
    }

    async update(id: string, input: EquipmentGroupUpdateInput): Promise<EquipmentGroupRecord> {
        const sets: string[] = []
        const params: unknown[] = []

        const fields: Record<string, unknown> = {
            code: input.code,
            name: input.name,
            description: input.description,
            parent_id: input.parentId,
            inherit_parent_fields: input.inheritParentFields,
            is_active: input.isActive,
            sort_order: input.sortOrder,
        }

        for (const [col, val] of Object.entries(fields)) {
            if (val !== undefined) {
                params.push(val)
                sets.push(`${col} = $${params.length}`)
            }
        }

        if (sets.length === 0) return (await this.getById(id))!

        sets.push(`updated_at = NOW()`)
        params.push(id)
        const result = await this.db.query<GroupRow>(
            `UPDATE equipment_groups SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`,
            params
        )
        return mapGroup(result.rows[0])
    }

    async delete(id: string): Promise<boolean> {
        const result = await this.db.query(
            `DELETE FROM equipment_groups WHERE id = $1`,
            [id]
        )
        return (result.rowCount ?? 0) > 0
    }

    // ── Fields ──────────────────────────────────────────────────

    async listFields(groupId: string): Promise<EquipmentGroupFieldRecord[]> {
        const result = await this.db.query<FieldRow>(
            `SELECT * FROM equipment_group_fields
             WHERE group_id = $1 AND is_active = true
             ORDER BY sort_order, label`,
            [groupId]
        )
        return result.rows.map(mapField)
    }

    async getEffectiveFields(groupId: string): Promise<EquipmentGroupFieldRecord[]> {
        // Lấy toàn bộ tổ tiên theo đường dẫn từ root → group
        const result = await this.db.query<FieldRow & { inherit: boolean; depth: number }>(
            `WITH RECURSIVE ancestors AS (
                SELECT id, parent_id, inherit_parent_fields, 0 AS depth
                FROM equipment_groups WHERE id = $1
                UNION ALL
                SELECT g.id, g.parent_id, g.inherit_parent_fields, a.depth + 1
                FROM equipment_groups g
                JOIN ancestors a ON g.id = a.parent_id
                WHERE a.inherit_parent_fields = true
             )
             SELECT f.*, a.depth
             FROM equipment_group_fields f
             JOIN ancestors a ON a.id = f.group_id
             WHERE f.is_active = true
             ORDER BY a.depth DESC, f.sort_order, f.label`,
            [groupId]
        )
        // Dedup: key của nhóm con override key của nhóm cha (depth 0 = chính nó)
        const seen = new Set<string>()
        const fields: EquipmentGroupFieldRecord[] = []
        for (const row of result.rows) {
            if (!seen.has(row.key)) {
                seen.add(row.key)
                fields.push(mapField(row))
            }
        }
        return fields
    }

    async createField(groupId: string, input: EquipmentGroupFieldCreateInput): Promise<EquipmentGroupFieldRecord> {
        const result = await this.db.query<FieldRow>(
            `INSERT INTO equipment_group_fields
                (group_id, key, label, field_type, required, enum_values, default_value, help_text, sort_order)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             RETURNING *`,
            [
                groupId,
                input.key,
                input.label,
                input.fieldType,
                input.required ?? false,
                input.enumValues ? JSON.stringify(input.enumValues) : null,
                input.defaultValue ?? null,
                input.helpText ?? null,
                input.sortOrder ?? 0,
            ]
        )
        return mapField(result.rows[0])
    }

    async updateField(fieldId: string, input: EquipmentGroupFieldUpdateInput): Promise<EquipmentGroupFieldRecord> {
        const sets: string[] = []
        const params: unknown[] = []

        const fields: Record<string, unknown> = {
            key: input.key,
            label: input.label,
            field_type: input.fieldType,
            required: input.required,
            enum_values: input.enumValues !== undefined
                ? (input.enumValues ? JSON.stringify(input.enumValues) : null)
                : undefined,
            default_value: input.defaultValue,
            help_text: input.helpText,
            sort_order: input.sortOrder,
        }

        for (const [col, val] of Object.entries(fields)) {
            if (val !== undefined) {
                params.push(val)
                sets.push(`${col} = $${params.length}`)
            }
        }

        if (sets.length === 0) {
            const existing = await this.db.query<FieldRow>(
                `SELECT * FROM equipment_group_fields WHERE id = $1`, [fieldId]
            )
            return mapField(existing.rows[0])
        }

        sets.push(`updated_at = NOW()`)
        params.push(fieldId)
        const result = await this.db.query<FieldRow>(
            `UPDATE equipment_group_fields SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`,
            params
        )
        return mapField(result.rows[0])
    }

    async deleteField(fieldId: string): Promise<boolean> {
        const result = await this.db.query(
            `UPDATE equipment_group_fields SET is_active = false, updated_at = NOW() WHERE id = $1`,
            [fieldId]
        )
        return (result.rowCount ?? 0) > 0
    }
}
