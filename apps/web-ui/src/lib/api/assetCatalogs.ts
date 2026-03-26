import { API_BASE, apiJson } from './httpClient'
import { getAssetHeaders } from './assets'
import type { SpecFieldType, NormalizeMode, SpecVersionStatus } from '@qltb/contracts'

export type { SpecFieldType, NormalizeMode, SpecVersionStatus }

export type Vendor = { id: string; name: string; taxCode?: string | null; phone?: string | null; email?: string | null; address?: string | null }
export type Location = { id: string; name: string; parentId?: string | null; path: string; organizationId?: string | null; organizationName?: string | null }
export type AssetCategory = { id: string; name: string }
export type AssetModel = { id: string; model: string; brand?: string | null; categoryId?: string | null; specVersionId?: string | null; vendorId?: string | null; spec: Record<string, unknown> }
export type AssetStatusCatalog = { id: string; name: string; code: string; isTerminal: boolean; color?: string | null; createdAt?: string }
export type CategorySpecVersion = {
    id: string
    categoryId: string
    version: number
    status: SpecVersionStatus
    createdBy?: string | null
    createdAt?: string
}
export type CategorySpecDef = {
    id: string
    versionId: string
    key: string
    label: string
    fieldType: SpecFieldType
    unit?: string | null
    required: boolean
    enumValues?: string[] | null
    pattern?: string | null
    minLen?: number | null
    maxLen?: number | null
    minValue?: number | null
    maxValue?: number | null
    stepValue?: number | null
    precision?: number | null
    scale?: number | null
    normalize?: NormalizeMode | null
    defaultValue?: unknown
    helpText?: string | null
    sortOrder: number
    isActive: boolean
    isReadonly: boolean
    computedExpr?: string | null
    isSearchable: boolean
    isFilterable: boolean
    createdAt?: string
    updatedAt?: string
}

export type SpecPublishWarning = {
    modelId: string
    modelName: string
    missingKeys: string[]
}

export type SpecPublishSyncSummary = {
    totalModels: number
    syncedModels: number
    modelsMissingRequired: number
}

export type Catalogs = {
    categories: AssetCategory[]
    locations: Location[]
    vendors: Vendor[]
    models: AssetModel[]
}

export type VendorInput = { name: string; taxCode?: string | null; phone?: string | null; email?: string | null; address?: string | null }
export type CategoryInput = { name: string }
export type ModelInput = { model: string; brand?: string | null; categoryId?: string | null; specVersionId?: string | null; vendorId?: string | null; spec?: Record<string, unknown> | null }
export type LocationInput = { name: string; parentId?: string | null; organizationId?: string | null }
export type StatusCatalogInput = { name: string; code: string; isTerminal?: boolean; color?: string | null }
export type CategorySpecDefInput = {
    key: string
    label: string
    fieldType: SpecFieldType
    unit?: string | null
    required?: boolean
    enumValues?: string[] | null
    pattern?: string | null
    minLen?: number | null
    maxLen?: number | null
    minValue?: number | null
    maxValue?: number | null
    stepValue?: number | null
    precision?: number | null
    scale?: number | null
    normalize?: NormalizeMode | null
    defaultValue?: unknown
    helpText?: string | null
    sortOrder?: number
    isActive?: boolean
    isReadonly?: boolean
    computedExpr?: string | null
    isSearchable?: boolean
    isFilterable?: boolean
}

type ApiResponse<T> = { data: T; meta?: { total?: number; page?: number; limit?: number } }

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function readTextValue(value: unknown): string | null {
    if (typeof value === 'string') {
        const trimmed = value.trim()
        return trimmed ? trimmed : null
    }

    if (typeof value === 'number' || typeof value === 'boolean') {
        return String(value)
    }

    if (!isRecord(value)) return null

    const preferredKeys = ['name', 'label', 'title', 'value', 'text', 'vi', 'en', 'code']
    for (const key of preferredKeys) {
        const candidate = value[key]
        if (typeof candidate === 'string' && candidate.trim()) {
            return candidate.trim()
        }
    }

    for (const candidate of Object.values(value)) {
        if (typeof candidate === 'string' && candidate.trim()) {
            return candidate.trim()
        }
    }

    return null
}

function readRequiredString(value: unknown): string {
    return readTextValue(value) ?? ''
}

function readOptionalString(value: unknown): string | null {
    return readTextValue(value)
}

function normalizeCategory(value: unknown): AssetCategory | null {
    if (!isRecord(value)) return null
    const id = readRequiredString(value.id)
    const name = readRequiredString(value.name)
    if (!id || !name) return null
    return { id, name }
}

function normalizeLocation(value: unknown): Location | null {
    if (!isRecord(value)) return null
    const id = readRequiredString(value.id)
    const name = readRequiredString(value.name)
    if (!id || !name) return null
    return {
        id,
        name,
        parentId: readOptionalString(value.parentId),
        path: readOptionalString(value.path) ?? `/${id}`,
        organizationId: readOptionalString(value.organizationId),
        organizationName: readOptionalString(value.organizationName)
    }
}

function normalizeVendor(value: unknown): Vendor | null {
    if (!isRecord(value)) return null
    const id = readRequiredString(value.id)
    const name = readRequiredString(value.name)
    if (!id || !name) return null
    return {
        id,
        name,
        taxCode: readOptionalString(value.taxCode),
        phone: readOptionalString(value.phone),
        email: readOptionalString(value.email),
        address: readOptionalString(value.address)
    }
}

function normalizeModel(value: unknown): AssetModel | null {
    if (!isRecord(value)) return null
    const id = readRequiredString(value.id)
    const model = readRequiredString(value.model)
    if (!id || !model) return null
    return {
        id,
        model,
        brand: readOptionalString(value.brand),
        categoryId: readOptionalString(value.categoryId),
        specVersionId: readOptionalString(value.specVersionId),
        vendorId: readOptionalString(value.vendorId),
        spec: isRecord(value.spec) ? value.spec : {}
    }
}

function normalizeList<T>(input: unknown, normalize: (item: unknown) => T | null): T[] {
    if (!Array.isArray(input)) return []
    return input
        .map((item) => normalize(item))
        .filter((item): item is T => item !== null)
}

function normalizeCatalogs(data: unknown): Catalogs {
    if (!isRecord(data)) {
        return {
            categories: [],
            locations: [],
            vendors: [],
            models: []
        }
    }

    return {
        categories: normalizeList(data.categories, normalizeCategory),
        locations: normalizeList(data.locations, normalizeLocation),
        vendors: normalizeList(data.vendors, normalizeVendor),
        models: normalizeList(data.models, normalizeModel)
    }
}

export async function getAssetCatalogs(): Promise<ApiResponse<Catalogs>> {
    const response = await apiJson<ApiResponse<unknown>>(`${API_BASE}/v1/assets/catalogs`, {
        headers: getAssetHeaders()
    })

    return {
        ...response,
        data: normalizeCatalogs(response.data)
    }
}

export async function createCategory(input: CategoryInput): Promise<ApiResponse<{ category: AssetCategory; versionId: string; specDefs?: CategorySpecDef[] }>> {
    return apiJson<ApiResponse<{ category: AssetCategory; versionId: string; specDefs?: CategorySpecDef[] }>>(`${API_BASE}/v1/asset-categories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAssetHeaders() },
        body: JSON.stringify(input)
    })
}

export async function updateCategory(id: string, patch: Partial<CategoryInput>): Promise<ApiResponse<AssetCategory>> {
    return apiJson<ApiResponse<AssetCategory>>(`${API_BASE}/v1/assets/catalogs/categories/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getAssetHeaders() },
        body: JSON.stringify(patch)
    })
}

export async function deleteCategory(id: string): Promise<ApiResponse<{ id: string }>> {
    return apiJson<ApiResponse<{ id: string }>>(`${API_BASE}/v1/assets/catalogs/categories/${id}`, {
        method: 'DELETE',
        headers: { ...getAssetHeaders() }
    })
}

export async function createVendor(input: VendorInput): Promise<ApiResponse<Vendor>> {
    return apiJson<ApiResponse<Vendor>>(`${API_BASE}/v1/assets/catalogs/vendors`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAssetHeaders() },
        body: JSON.stringify(input)
    })
}

export async function updateVendor(id: string, patch: Partial<VendorInput>): Promise<ApiResponse<Vendor>> {
    return apiJson<ApiResponse<Vendor>>(`${API_BASE}/v1/assets/catalogs/vendors/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getAssetHeaders() },
        body: JSON.stringify(patch)
    })
}

export async function deleteVendor(id: string): Promise<ApiResponse<{ id: string }>> {
    return apiJson<ApiResponse<{ id: string }>>(`${API_BASE}/v1/assets/catalogs/vendors/${id}`, {
        method: 'DELETE',
        headers: { ...getAssetHeaders() }
    })
}

export async function createModel(input: ModelInput): Promise<ApiResponse<AssetModel>> {
    return apiJson<ApiResponse<AssetModel>>(`${API_BASE}/v1/assets/catalogs/models`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAssetHeaders() },
        body: JSON.stringify(input)
    })
}

export async function updateModel(id: string, patch: Partial<ModelInput>): Promise<ApiResponse<AssetModel>> {
    return apiJson<ApiResponse<AssetModel>>(`${API_BASE}/v1/assets/catalogs/models/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getAssetHeaders() },
        body: JSON.stringify(patch)
    })
}

export async function deleteModel(id: string): Promise<ApiResponse<{ id: string }>> {
    return apiJson<ApiResponse<{ id: string }>>(`${API_BASE}/v1/assets/catalogs/models/${id}`, {
        method: 'DELETE',
        headers: { ...getAssetHeaders() }
    })
}

export async function listLocations(): Promise<ApiResponse<Location[]>> {
    const response = await apiJson<ApiResponse<unknown>>(`${API_BASE}/v1/assets/catalogs/locations`, {
        headers: { ...getAssetHeaders() }
    })
    return { ...response, data: normalizeList(response.data, normalizeLocation) }
}

export async function createLocation(input: LocationInput): Promise<ApiResponse<Location>> {
    return apiJson<ApiResponse<Location>>(`${API_BASE}/v1/assets/catalogs/locations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAssetHeaders() },
        body: JSON.stringify(input)
    })
}

export async function updateLocation(id: string, patch: Partial<LocationInput>): Promise<ApiResponse<Location>> {
    return apiJson<ApiResponse<Location>>(`${API_BASE}/v1/assets/catalogs/locations/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getAssetHeaders() },
        body: JSON.stringify(patch)
    })
}

export async function deleteLocation(id: string): Promise<ApiResponse<{ id: string }>> {
    return apiJson<ApiResponse<{ id: string }>>(`${API_BASE}/v1/assets/catalogs/locations/${id}`, {
        method: 'DELETE',
        headers: { ...getAssetHeaders() }
    })
}

export async function listStatusCatalogs(): Promise<ApiResponse<AssetStatusCatalog[]>> {
    return apiJson<ApiResponse<AssetStatusCatalog[]>>(`${API_BASE}/v1/assets/catalogs/statuses`, {
        headers: { ...getAssetHeaders() }
    })
}

export async function createStatusCatalog(input: StatusCatalogInput): Promise<ApiResponse<AssetStatusCatalog>> {
    return apiJson<ApiResponse<AssetStatusCatalog>>(`${API_BASE}/v1/assets/catalogs/statuses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAssetHeaders() },
        body: JSON.stringify(input)
    })
}

export async function updateStatusCatalog(id: string, patch: Partial<StatusCatalogInput>): Promise<ApiResponse<AssetStatusCatalog>> {
    return apiJson<ApiResponse<AssetStatusCatalog>>(`${API_BASE}/v1/assets/catalogs/statuses/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getAssetHeaders() },
        body: JSON.stringify(patch)
    })
}

export async function deleteStatusCatalog(id: string): Promise<ApiResponse<{ id: string }>> {
    return apiJson<ApiResponse<{ id: string }>>(`${API_BASE}/v1/assets/catalogs/statuses/${id}`, {
        method: 'DELETE',
        headers: { ...getAssetHeaders() }
    })
}

export async function getCategorySpecDefs(categoryId: string): Promise<ApiResponse<CategorySpecDef[]>> {
    return apiJson<ApiResponse<CategorySpecDef[]>>(`${API_BASE}/v1/asset-categories/${categoryId}/spec-defs`, {
        headers: { ...getAssetHeaders() }
    })
}

export async function getCategorySpecVersions(categoryId: string): Promise<ApiResponse<CategorySpecVersion[]>> {
    return apiJson<ApiResponse<CategorySpecVersion[]>>(`${API_BASE}/v1/asset-categories/${categoryId}/spec-versions`, {
        headers: { ...getAssetHeaders() }
    })
}

export async function createCategorySpecVersion(categoryId: string): Promise<ApiResponse<{ version: CategorySpecVersion; specDefs: CategorySpecDef[] }>> {
    return apiJson<ApiResponse<{ version: CategorySpecVersion; specDefs: CategorySpecDef[] }>>(`${API_BASE}/v1/asset-categories/${categoryId}/spec-versions`, {
        method: 'POST',
        headers: { ...getAssetHeaders() }
    })
}

export async function publishSpecVersion(versionId: string): Promise<ApiResponse<{ version: CategorySpecVersion; warnings: SpecPublishWarning[]; sync: SpecPublishSyncSummary }>> {
    return apiJson<ApiResponse<{ version: CategorySpecVersion; warnings: SpecPublishWarning[]; sync: SpecPublishSyncSummary }>>(`${API_BASE}/v1/spec-versions/${versionId}/publish`, {
        method: 'POST',
        headers: { ...getAssetHeaders() }
    })
}

export async function getSpecDefsByVersion(versionId: string): Promise<ApiResponse<CategorySpecDef[]>> {
    return apiJson<ApiResponse<CategorySpecDef[]>>(`${API_BASE}/v1/spec-versions/${versionId}/defs`, {
        headers: { ...getAssetHeaders() }
    })
}

export async function createSpecDefForVersion(versionId: string, input: CategorySpecDefInput): Promise<ApiResponse<CategorySpecDef>> {
    return apiJson<ApiResponse<CategorySpecDef>>(`${API_BASE}/v1/spec-versions/${versionId}/defs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAssetHeaders() },
        body: JSON.stringify(input)
    })
}

export async function applyCategorySpecTemplate(categoryId: string): Promise<ApiResponse<CategorySpecDef[]>> {
    return apiJson<ApiResponse<CategorySpecDef[]>>(`${API_BASE}/v1/asset-categories/${categoryId}/spec-defs/apply-template`, {
        method: 'POST',
        headers: { ...getAssetHeaders() }
    })
}

export async function createCategorySpecDef(
    categoryId: string,
    input: CategorySpecDefInput
): Promise<ApiResponse<CategorySpecDef>> {
    return apiJson<ApiResponse<CategorySpecDef>>(`${API_BASE}/v1/asset-categories/${categoryId}/spec-defs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAssetHeaders() },
        body: JSON.stringify(input)
    })
}

export async function updateSpecDef(
    specDefId: string,
    patch: Partial<CategorySpecDefInput>
): Promise<ApiResponse<CategorySpecDef>> {
    return apiJson<ApiResponse<CategorySpecDef>>(`${API_BASE}/v1/spec-defs/${specDefId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getAssetHeaders() },
        body: JSON.stringify(patch)
    })
}

export async function deleteSpecDef(specDefId: string): Promise<ApiResponse<{ id: string }>> {
    return apiJson<ApiResponse<{ id: string }>>(`${API_BASE}/v1/spec-defs/${specDefId}`, {
        method: 'DELETE',
        headers: { ...getAssetHeaders() }
    })
}

export async function searchAssetModels(params: { categoryId?: string; specFilters?: Record<string, unknown> }): Promise<ApiResponse<AssetModel[]>> {
    const query = new URLSearchParams()
    if (params.categoryId) query.set('categoryId', params.categoryId)
    if (params.specFilters && Object.keys(params.specFilters).length > 0) {
        query.set('specFilters', JSON.stringify(params.specFilters))
    }
    const suffix = query.toString() ? `?${query.toString()}` : ''
    const response = await apiJson<ApiResponse<unknown>>(`${API_BASE}/v1/asset-models${suffix}`, {
        headers: { ...getAssetHeaders() }
    })

    return {
        ...response,
        data: normalizeList(response.data, normalizeModel)
    }
}
