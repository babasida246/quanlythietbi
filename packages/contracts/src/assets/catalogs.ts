export interface VendorRecord {
    id: string
    name: string
    taxCode?: string | null
    phone?: string | null
    email?: string | null
    address?: string | null
    createdAt: Date
}

export interface LocationRecord {
    id: string
    name: string
    parentId?: string | null
    path: string
    createdAt: Date
}

export interface AssetCategoryRecord {
    id: string
    name: string
    createdAt: Date
}

export interface AssetModelRecord {
    id: string
    categoryId?: string | null
    specVersionId?: string | null
    vendorId?: string | null
    brand?: string | null
    model: string
    spec: Record<string, unknown>
    createdAt: Date
}

export interface VendorCreateInput {
    name: string
    taxCode?: string | null
    phone?: string | null
    email?: string | null
    address?: string | null
}

export type VendorUpdatePatch = Partial<VendorCreateInput>

export interface AssetCategoryCreateInput {
    name: string
}

export type AssetCategoryUpdatePatch = Partial<AssetCategoryCreateInput>

export interface AssetModelCreateInput {
    categoryId?: string | null
    specVersionId?: string | null
    vendorId?: string | null
    brand?: string | null
    model: string
    spec?: Record<string, unknown> | null
}

export type AssetModelUpdatePatch = Partial<AssetModelCreateInput>

export interface AssetModelSearchFilters {
    categoryId?: string | null
    specFilters?: Record<string, unknown>
}

export interface LocationCreateInput {
    name: string
    parentId?: string | null
    path?: string
}

export type LocationUpdatePatch = Partial<LocationCreateInput>

export interface CatalogsResult {
    categories: AssetCategoryRecord[]
    locations: LocationRecord[]
    vendors: VendorRecord[]
    models: AssetModelRecord[]
}

export interface ICatalogRepo {
    listVendors(): Promise<VendorRecord[]>
    listLocations(): Promise<LocationRecord[]>
    listCategories(): Promise<AssetCategoryRecord[]>
    listModels(): Promise<AssetModelRecord[]>
    searchModels(filters: AssetModelSearchFilters): Promise<AssetModelRecord[]>
    getLocationById(id: string): Promise<LocationRecord | null>
    getModelById(id: string): Promise<AssetModelRecord | null>
    createVendor(input: VendorCreateInput): Promise<VendorRecord>
    updateVendor(id: string, patch: VendorUpdatePatch): Promise<VendorRecord | null>
    deleteVendor(id: string): Promise<boolean>
    createCategory(input: AssetCategoryCreateInput): Promise<AssetCategoryRecord>
    updateCategory(id: string, patch: AssetCategoryUpdatePatch): Promise<AssetCategoryRecord | null>
    deleteCategory(id: string): Promise<boolean>
    createModel(input: AssetModelCreateInput): Promise<AssetModelRecord>
    updateModel(id: string, patch: AssetModelUpdatePatch): Promise<AssetModelRecord | null>
    deleteModel(id: string): Promise<boolean>
    createLocation(input: LocationCreateInput): Promise<LocationRecord>
    updateLocation(id: string, patch: LocationUpdatePatch): Promise<LocationRecord | null>
    deleteLocation(id: string): Promise<boolean>
}
