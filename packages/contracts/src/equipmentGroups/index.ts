export type EquipmentGroupFieldType = 'string' | 'number' | 'boolean' | 'enum' | 'date'

// ── Records (DB mapping) ─────────────────────────────────────

export interface EquipmentGroupRecord {
    id: string
    code: string | null
    name: string
    description: string | null
    parentId: string | null
    inheritParentFields: boolean
    isActive: boolean
    sortOrder: number
    createdAt: Date
    updatedAt: Date
    // Joined fields (khi tree load)
    parentName?: string | null
    fieldCount?: number
}

export interface EquipmentGroupFieldRecord {
    id: string
    groupId: string
    key: string
    label: string
    fieldType: EquipmentGroupFieldType
    required: boolean
    enumValues: string[] | null
    defaultValue: string | null
    helpText: string | null
    sortOrder: number
    isActive: boolean
    createdAt: Date
    updatedAt: Date
}

// ── Tree node (cho UI) ───────────────────────────────────────

export interface EquipmentGroupTreeNode extends EquipmentGroupRecord {
    children: EquipmentGroupTreeNode[]
    /** Tất cả fields (bao gồm kế thừa từ cha nếu inheritParentFields=true) */
    effectiveFields?: EquipmentGroupFieldRecord[]
}

// ── Create / Update inputs ───────────────────────────────────

export interface EquipmentGroupCreateInput {
    code?: string | null
    name: string
    description?: string | null
    parentId?: string | null
    inheritParentFields?: boolean
    isActive?: boolean
    sortOrder?: number
}

export type EquipmentGroupUpdateInput = Partial<EquipmentGroupCreateInput>

export interface EquipmentGroupFieldCreateInput {
    key: string
    label: string
    fieldType: EquipmentGroupFieldType
    required?: boolean
    enumValues?: string[] | null
    defaultValue?: string | null
    helpText?: string | null
    sortOrder?: number
}

export type EquipmentGroupFieldUpdateInput = Partial<EquipmentGroupFieldCreateInput>

// ── Repository interface ─────────────────────────────────────

export interface IEquipmentGroupRepo {
    list(filters?: { isActive?: boolean }): Promise<EquipmentGroupRecord[]>
    getTree(): Promise<EquipmentGroupTreeNode[]>
    getById(id: string): Promise<EquipmentGroupRecord | null>
    create(input: EquipmentGroupCreateInput): Promise<EquipmentGroupRecord>
    update(id: string, input: EquipmentGroupUpdateInput): Promise<EquipmentGroupRecord>
    delete(id: string): Promise<boolean>
    // Fields
    listFields(groupId: string): Promise<EquipmentGroupFieldRecord[]>
    /** Trả về fields hiệu lực (kế thừa cha nếu cần) */
    getEffectiveFields(groupId: string): Promise<EquipmentGroupFieldRecord[]>
    createField(groupId: string, input: EquipmentGroupFieldCreateInput): Promise<EquipmentGroupFieldRecord>
    updateField(fieldId: string, input: EquipmentGroupFieldUpdateInput): Promise<EquipmentGroupFieldRecord>
    deleteField(fieldId: string): Promise<boolean>
}
