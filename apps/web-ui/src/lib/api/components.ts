import { API_BASE, apiJson, authorizedFetch } from './httpClient'
import { getAssetHeaders, buildQuery } from './assets'

export type ComponentType =
    | 'ram'
    | 'ssd'
    | 'hdd'
    | 'cpu'
    | 'gpu'
    | 'psu'
    | 'motherboard'
    | 'network_card'
    | 'other'

export type AssignmentStatus = 'installed' | 'removed'
export type RemovalReason = 'upgrade' | 'repair' | 'decommission'
export type PostRemovalAction = 'restock' | 'dispose'
export type StockStatus = 'in_stock' | 'low_stock' | 'out_of_stock'

export type ComponentWithDetails = {
    id: string
    componentCode: string
    name: string
    modelNumber: string | null
    componentType: ComponentType
    specifications: string | null
    totalQuantity: number
    availableQuantity: number
    minQuantity: number
    installedQuantity: number
    stockStatus: StockStatus
    categoryName: string | null
    manufacturerName: string | null
    unitPrice: number
    currency: string
    notes: string | null
    status: 'active' | 'inactive' | 'discontinued'
    locationName: string | null
    createdAt: string
    updatedAt: string
}

export type ComponentAssignmentWithDetails = {
    id: string
    componentId: string
    quantity: number
    serialNumbers: string[] | null
    assetId: string
    assetTag: string
    assetName: string
    componentCode: string
    componentName: string
    componentType: ComponentType
    installedAt: string
    installedBy: string
    installedByName: string | null
    installationNotes: string | null
    removedAt: string | null
    removedBy: string | null
    removalReason: RemovalReason | null
    removalNotes: string | null
    postRemovalAction: PostRemovalAction | null
    status: AssignmentStatus
    createdAt: string
    updatedAt: string
}

export type AssetComponents = {
    assetId: string
    assetTag: string
    assetName: string
    components: ComponentAssignmentWithDetails[]
}

export type InstallComponentInput = {
    assetId: string
    quantity: number
    serialNumbers?: string[]
    installationNotes?: string
}

export type RemoveComponentInput = {
    removalReason: RemovalReason
    postRemovalAction: PostRemovalAction
    removalNotes?: string
}

export type ComponentListParams = {
    page?: number
    limit?: number
    componentType?: ComponentType
    search?: string
    status?: string
}

type ApiResponse<T> = { data: T; meta?: { total?: number; page?: number; limit?: number } }

export async function listComponents(
    params: ComponentListParams = {}
): Promise<ApiResponse<ComponentWithDetails[]>> {
    const query = buildQuery(params as Record<string, string | number | undefined>)
    return apiJson<ApiResponse<ComponentWithDetails[]>>(`${API_BASE}/v1/components${query}`, {
        headers: getAssetHeaders()
    })
}

export async function getAssetComponents(assetId: string): Promise<AssetComponents | null> {
    const response = await authorizedFetch(
        `${API_BASE}/v1/components/assets/${assetId}/components`,
        { headers: getAssetHeaders() }
    )
    if (response.status === 404) return null
    if (!response.ok) throw new Error(await response.text())
    const json = await response.json()
    return (json.data ?? json) as AssetComponents
}

export async function installComponent(
    componentId: string,
    input: InstallComponentInput
): Promise<ApiResponse<ComponentAssignmentWithDetails>> {
    return apiJson<ApiResponse<ComponentAssignmentWithDetails>>(
        `${API_BASE}/v1/components/${componentId}/install`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...getAssetHeaders() },
            body: JSON.stringify(input)
        }
    )
}

export async function removeComponent(
    assignmentId: string,
    input: RemoveComponentInput
): Promise<ApiResponse<ComponentAssignmentWithDetails>> {
    return apiJson<ApiResponse<ComponentAssignmentWithDetails>>(
        `${API_BASE}/v1/components/assignments/${assignmentId}/remove`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...getAssetHeaders() },
            body: JSON.stringify(input)
        }
    )
}
