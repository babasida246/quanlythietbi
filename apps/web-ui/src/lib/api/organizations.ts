import { API_BASE, apiJson } from './httpClient'
import { getAssetHeaders, buildQuery } from './assets'

export type OrganizationDto = {
    id: string
    name: string
    code: string | null
    description: string | null
    parentId: string | null
    parentName: string | null
    path: string
    childrenCount: number
    createdAt: string
    updatedAt: string
}

export type CreateOrganizationInput = {
    name: string
    code?: string | null
    description?: string | null
    parentId?: string | null
}

export type UpdateOrganizationInput = {
    name?: string
    code?: string | null
    description?: string | null
    parentId?: string | null
}

export type OrgListParams = {
    search?: string
    parentId?: string | null
    flat?: boolean
    page?: number
    limit?: number
}

type ApiResponse<T> = { data: T; meta?: { total?: number } }

export async function listOrganizations(
    params: OrgListParams = {}
): Promise<ApiResponse<OrganizationDto[]>> {
    const query = buildQuery(params as Record<string, string | number | boolean | undefined>)
    return apiJson<ApiResponse<OrganizationDto[]>>(`${API_BASE}/v1/organizations${query}`, {
        headers: getAssetHeaders()
    })
}

export async function getOrganization(id: string): Promise<OrganizationDto> {
    const res = await apiJson<ApiResponse<OrganizationDto>>(
        `${API_BASE}/v1/organizations/${id}`,
        { headers: getAssetHeaders() }
    )
    return res.data
}

export async function createOrganization(
    input: CreateOrganizationInput
): Promise<OrganizationDto> {
    const res = await apiJson<ApiResponse<OrganizationDto>>(
        `${API_BASE}/v1/organizations`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...getAssetHeaders() },
            body: JSON.stringify(input)
        }
    )
    return res.data
}

export async function updateOrganization(
    id: string,
    input: UpdateOrganizationInput
): Promise<OrganizationDto> {
    const res = await apiJson<ApiResponse<OrganizationDto>>(
        `${API_BASE}/v1/organizations/${id}`,
        {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', ...getAssetHeaders() },
            body: JSON.stringify(input)
        }
    )
    return res.data
}

export async function deleteOrganization(id: string): Promise<void> {
    await apiJson(`${API_BASE}/v1/organizations/${id}`, {
        method: 'DELETE',
        headers: getAssetHeaders()
    })
}
