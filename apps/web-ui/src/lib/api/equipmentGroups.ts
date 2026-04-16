import { API_BASE, requireAccessToken } from './httpClient'

export type EquipmentGroupFieldType = 'string' | 'number' | 'boolean' | 'enum' | 'date'

export interface EquipmentGroupField {
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
    createdAt: string
    updatedAt: string
}

export interface EquipmentGroup {
    id: string
    code: string | null
    name: string
    description: string | null
    parentId: string | null
    parentName: string | null
    inheritParentFields: boolean
    isActive: boolean
    sortOrder: number
    fieldCount?: number
    createdAt: string
    updatedAt: string
}

export interface EquipmentGroupTreeNode extends EquipmentGroup {
    children: EquipmentGroupTreeNode[]
}

function authHeader(): HeadersInit {
    return { Authorization: `Bearer ${requireAccessToken()}`, 'Content-Type': 'application/json' }
}

async function handleResponse<T>(res: Response): Promise<T> {
    const json = await res.json()
    if (!res.ok || !json.success) throw new Error(json.error?.message ?? `HTTP ${res.status}`)
    return json.data as T
}

// ── Groups ────────────────────────────────────────────────────

export async function listEquipmentGroups(isActive?: boolean): Promise<EquipmentGroup[]> {
    const qs = isActive !== undefined ? `?isActive=${isActive}` : ''
    const res = await fetch(`${API_BASE}/v1/equipment-groups${qs}`, { headers: authHeader() })
    return handleResponse<EquipmentGroup[]>(res)
}

export async function getEquipmentGroupTree(): Promise<EquipmentGroupTreeNode[]> {
    const res = await fetch(`${API_BASE}/v1/equipment-groups/tree`, { headers: authHeader() })
    return handleResponse<EquipmentGroupTreeNode[]>(res)
}

export async function createEquipmentGroup(data: {
    name: string
    code?: string | null
    description?: string | null
    parentId?: string | null
    inheritParentFields?: boolean
    isActive?: boolean
    sortOrder?: number
}): Promise<EquipmentGroup> {
    const res = await fetch(`${API_BASE}/v1/equipment-groups`, {
        method: 'POST',
        headers: authHeader(),
        body: JSON.stringify(data),
    })
    return handleResponse<EquipmentGroup>(res)
}

export async function updateEquipmentGroup(id: string, data: Partial<{
    name: string
    code: string | null
    description: string | null
    parentId: string | null
    inheritParentFields: boolean
    isActive: boolean
    sortOrder: number
}>): Promise<EquipmentGroup> {
    const res = await fetch(`${API_BASE}/v1/equipment-groups/${id}`, {
        method: 'PUT',
        headers: authHeader(),
        body: JSON.stringify(data),
    })
    return handleResponse<EquipmentGroup>(res)
}

export async function deleteEquipmentGroup(id: string): Promise<void> {
    const res = await fetch(`${API_BASE}/v1/equipment-groups/${id}`, {
        method: 'DELETE',
        headers: authHeader(),
    })
    await handleResponse<null>(res)
}

// ── Fields ────────────────────────────────────────────────────

export async function listEquipmentGroupFields(groupId: string): Promise<EquipmentGroupField[]> {
    const res = await fetch(`${API_BASE}/v1/equipment-groups/${groupId}/fields`, { headers: authHeader() })
    return handleResponse<EquipmentGroupField[]>(res)
}

export async function getEffectiveFields(groupId: string): Promise<EquipmentGroupField[]> {
    const res = await fetch(`${API_BASE}/v1/equipment-groups/${groupId}/effective-fields`, { headers: authHeader() })
    return handleResponse<EquipmentGroupField[]>(res)
}

export async function createEquipmentGroupField(groupId: string, data: {
    key: string
    label: string
    fieldType: EquipmentGroupFieldType
    required?: boolean
    enumValues?: string[] | null
    defaultValue?: string | null
    helpText?: string | null
    sortOrder?: number
}): Promise<EquipmentGroupField> {
    const res = await fetch(`${API_BASE}/v1/equipment-groups/${groupId}/fields`, {
        method: 'POST',
        headers: authHeader(),
        body: JSON.stringify(data),
    })
    return handleResponse<EquipmentGroupField>(res)
}

export async function updateEquipmentGroupField(fieldId: string, data: Partial<{
    label: string
    fieldType: EquipmentGroupFieldType
    required: boolean
    enumValues: string[] | null
    defaultValue: string | null
    helpText: string | null
    sortOrder: number
}>): Promise<EquipmentGroupField> {
    const res = await fetch(`${API_BASE}/v1/equipment-group-fields/${fieldId}`, {
        method: 'PUT',
        headers: authHeader(),
        body: JSON.stringify(data),
    })
    return handleResponse<EquipmentGroupField>(res)
}

export async function deleteEquipmentGroupField(fieldId: string): Promise<void> {
    const res = await fetch(`${API_BASE}/v1/equipment-group-fields/${fieldId}`, {
        method: 'DELETE',
        headers: authHeader(),
    })
    await handleResponse<null>(res)
}
