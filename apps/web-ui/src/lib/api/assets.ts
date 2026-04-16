import { API_BASE, apiJson, authorizedFetch, requireAccessToken } from './httpClient'
import type { AssetStatus, AssigneeType, MaintenanceSeverity, MaintenanceStatus } from '@qltb/contracts'

export type { AssetStatus, AssigneeType, MaintenanceSeverity, MaintenanceStatus }
export type AssetStatusCounts = Record<AssetStatus, number>

export type Asset = {
    id: string
    assetCode: string
    status: AssetStatus
    modelId?: string | null
    categoryId?: string | null
    vendorId?: string | null
    locationId?: string | null
    warehouseId?: string | null
    serialNo?: string | null
    macAddress?: string | null
    mgmtIp?: string | null
    hostname?: string | null
    vlanId?: number | null
    switchName?: string | null
    switchPort?: string | null
    purchaseDate?: string | null
    warrantyEnd?: string | null
    notes?: string | null
    spec?: Record<string, unknown> | null
    modelName?: string | null
    modelBrand?: string | null
    categoryName?: string | null
    vendorName?: string | null
    locationName?: string | null
    warehouseName?: string | null
    groupId?: string | null
    groupName?: string | null
    createdAt: string
    updatedAt: string
}

export type AssetAssignment = {
    id: string
    assetId: string
    assigneeType: AssigneeType
    assigneeId?: string | null
    assigneeName: string
    assignedAt: string
    returnedAt?: string | null
    note?: string | null
}

export type MaintenanceTicket = {
    id: string
    assetId: string
    title: string
    severity: MaintenanceSeverity
    status: MaintenanceStatus
    openedAt: string
    closedAt?: string | null
    diagnosis?: string | null
    resolution?: string | null
    createdBy?: string | null
}

export type AssetEvent = {
    id: string
    assetId: string
    eventType: string
    payload: Record<string, unknown>
    actorUserId?: string | null
    correlationId?: string | null
    createdAt: string
}

export type AssetSearchParams = {
    scope?: 'my_ou'
    query?: string
    status?: AssetStatus
    categoryId?: string
    modelId?: string
    vendorId?: string
    locationId?: string
    warehouseId?: string
    groupId?: string
    warrantyExpiringDays?: number
    page?: number
    limit?: number
    sort?: 'newest' | 'asset_code_asc' | 'asset_code_desc' | 'warranty_end_asc'
}

export type AssetCreateInput = {
    assetCode: string
    modelId: string
    status?: AssetStatus
    vendorId?: string
    locationId?: string
    warehouseId?: string
    serialNo?: string
    macAddress?: string
    mgmtIp?: string
    hostname?: string
    vlanId?: number
    switchName?: string
    switchPort?: string
    purchaseDate?: string
    warrantyEnd?: string
    notes?: string
    spec?: Record<string, unknown>
}

export type AssetAssignInput = {
    assigneeType: AssigneeType
    assigneeId: string
    assigneeName: string
    assignedAt?: string
    note?: string
    locationId?: string | null
    organizationId?: string | null
}

export type MaintenanceCreateInput = {
    assetId: string
    title: string
    severity: MaintenanceSeverity
    diagnosis?: string
    resolution?: string
}

type ApiResponse<T> = { data: T; meta?: { total?: number; page?: number; limit?: number } }

export function getAssetHeaders(): Record<string, string> {
    requireAccessToken()
    return {}
}

export function buildQuery(params: Record<string, string | number | undefined>): string {
    const entries = Object.entries(params).filter(([, value]) => value !== undefined && value !== '')
    if (entries.length === 0) return ''
    const query = entries
        .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
        .join('&')
    return `?${query}`
}

export type AssetModelOption = { id: string; name: string; categoryName?: string | null }

export async function listAssetModels(params: { limit?: number; categoryId?: string } = {}): Promise<ApiResponse<AssetModelOption[]>> {
    const qs = new URLSearchParams()
    if (params.categoryId) qs.set('categoryId', params.categoryId)
    const suffix = qs.toString() ? `?${qs.toString()}` : ''
    const response = await apiJson<ApiResponse<Array<{ id: string; model: string; categoryId?: string | null }>>>(
        `${API_BASE}/v1/asset-models${suffix}`,
        { headers: getAssetHeaders() }
    )
    const data = (Array.isArray(response.data) ? response.data : []).map(m => ({
        id: m.id,
        name: m.model,
        categoryName: null as string | null
    }))
    return { ...response, data }
}

export async function listAssets(params: AssetSearchParams = {}): Promise<ApiResponse<Asset[]>> {
    const query = buildQuery(params)
    return apiJson<ApiResponse<Asset[]>>(`${API_BASE}/v1/assets${query}`, {
        headers: getAssetHeaders()
    })
}

export async function getAssetStatusCounts(params: { scope?: 'my_ou' } = {}): Promise<ApiResponse<AssetStatusCounts> | null> {
    const query = buildQuery(params)
    const response = await authorizedFetch(`${API_BASE}/v1/assets/status-counts${query}`, {
        headers: getAssetHeaders()
    })

    if (response.status === 404 || response.status === 501) {
        return null
    }

    if (!response.ok) {
        throw new Error(await response.text())
    }

    return (await response.json()) as ApiResponse<AssetStatusCounts>
}

export async function exportAssetsCsv(params: AssetSearchParams = {}): Promise<string> {
    const query = buildQuery({ ...params, export: 'csv' })
    const response = await authorizedFetch(`${API_BASE}/v1/assets${query}`, {
        headers: getAssetHeaders()
    })
    if (!response.ok) {
        throw new Error(await response.text())
    }
    return response.text()
}

export async function getAssetDetail(assetId: string): Promise<ApiResponse<{
    asset: Asset
    assignments: AssetAssignment[]
    maintenance: MaintenanceTicket[]
}>> {
    return apiJson<ApiResponse<{ asset: Asset; assignments: AssetAssignment[]; maintenance: MaintenanceTicket[] }>>(
        `${API_BASE}/v1/assets/${assetId}`,
        { headers: getAssetHeaders() }
    )
}

export async function getAssetTimeline(assetId: string, page = 1, limit = 20): Promise<ApiResponse<AssetEvent[]>> {
    const query = buildQuery({ page, limit })
    return apiJson<ApiResponse<AssetEvent[]>>(`${API_BASE}/v1/assets/${assetId}/timeline${query}`, {
        headers: getAssetHeaders()
    })
}

export async function createAsset(input: AssetCreateInput): Promise<ApiResponse<Asset>> {
    return apiJson<ApiResponse<Asset>>(`${API_BASE}/v1/assets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAssetHeaders() },
        body: JSON.stringify(input)
    })
}

export async function updateAsset(assetId: string, patch: Partial<AssetCreateInput>): Promise<ApiResponse<Asset>> {
    return apiJson<ApiResponse<Asset>>(`${API_BASE}/v1/assets/${assetId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getAssetHeaders() },
        body: JSON.stringify(patch)
    })
}

export async function deleteAsset(assetId: string): Promise<void> {
    await apiJson<void>(`${API_BASE}/v1/assets/${assetId}`, {
        method: 'DELETE',
        headers: getAssetHeaders()
    })
}

export async function assignAsset(assetId: string, input: AssetAssignInput): Promise<ApiResponse<{ asset: Asset; assignment: AssetAssignment }>> {
    return apiJson<ApiResponse<{ asset: Asset; assignment: AssetAssignment }>>(`${API_BASE}/v1/assets/${assetId}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAssetHeaders() },
        body: JSON.stringify(input)
    })
}

export async function returnAsset(assetId: string, note?: string): Promise<ApiResponse<{ asset: Asset; assignment: AssetAssignment }>> {
    return apiJson<ApiResponse<{ asset: Asset; assignment: AssetAssignment }>>(`${API_BASE}/v1/assets/${assetId}/return`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAssetHeaders() },
        body: JSON.stringify({ note })
    })
}

export async function moveAsset(assetId: string, locationId: string): Promise<ApiResponse<Asset>> {
    return apiJson<ApiResponse<Asset>>(`${API_BASE}/v1/assets/${assetId}/move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAssetHeaders() },
        body: JSON.stringify({ locationId })
    })
}

export async function openMaintenanceTicket(input: MaintenanceCreateInput): Promise<ApiResponse<MaintenanceTicket>> {
    return apiJson<ApiResponse<MaintenanceTicket>>(`${API_BASE}/v1/maintenance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAssetHeaders() },
        body: JSON.stringify(input)
    })
}
