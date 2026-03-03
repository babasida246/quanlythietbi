import type {
    AssetCategoryCreateInput,
    AssetCategoryRecord,
    AssetModelCreateInput,
    CategorySpecDefInput,
    CategorySpecDefRecord,
    CatalogsResult,
    ICacheRepo,
    ICatalogRepo,
    ICategorySpecRepo,
    ICategorySpecVersionRepo,
    LocationCreateInput,
    LocationRecord,
    AssetModelRecord,
    VendorCreateInput,
    VendorRecord
} from '@qltb/contracts'

export class FakeCatalogRepo implements ICatalogRepo {
    private vendors = [{ id: 'v1', name: 'Vendor', createdAt: new Date() }]
    private locations: LocationRecord[] = [{ id: 'l1', name: 'HQ', path: '/l1', parentId: null, createdAt: new Date() }]
    private categories = [{ id: 'c1', name: 'Cat', createdAt: new Date() }]
    private models: AssetModelRecord[] = [{ id: 'm1', model: 'Model', spec: {}, createdAt: new Date() }]

    async listVendors() { return this.vendors }
    async listLocations() { return this.locations }
    async listCategories() { return this.categories }
    async listModels() { return this.models }
    async searchModels(filters?: { categoryId?: string | null; specFilters?: Record<string, unknown> }) {
        if (!filters?.categoryId) return this.models
        return this.models.filter(model => model.categoryId === filters.categoryId)
    }
    async getLocationById(id: string) { return this.locations.find(loc => loc.id === id) ?? null }
    async getModelById(id: string) { return this.models.find(model => model.id === id) ?? null }
    async createVendor(input: VendorCreateInput): Promise<VendorRecord> { throw new Error('Not implemented') }
    async updateVendor(id: string, patch: Partial<VendorCreateInput>): Promise<VendorRecord | null> { throw new Error('Not implemented') }
    async deleteVendor(id: string): Promise<boolean> { throw new Error('Not implemented') }
    async createCategory(input: { name: string }) {
        const record = { id: `cat-${this.categories.length + 1}`, name: input.name, createdAt: new Date() }
        this.categories.push(record)
        return record
    }
    seedCategory(record: { id: string; name: string; createdAt?: Date }) {
        this.categories.push({ id: record.id, name: record.name, createdAt: record.createdAt ?? new Date() })
    }
    async updateCategory(id: string, patch: Partial<AssetCategoryCreateInput>): Promise<AssetCategoryRecord | null> { throw new Error('Not implemented') }
    async deleteCategory(id: string): Promise<boolean> { throw new Error('Not implemented') }
    async createModel(input: { model: string }) {
        const record: AssetModelRecord = { id: `m-${this.models.length + 1}`, model: input.model, spec: {}, createdAt: new Date() }
        this.models.push(record)
        return record
    }
    seedModel(record: AssetModelRecord) {
        this.models.push(record)
    }
    async updateModel(id: string, patch: Partial<AssetModelCreateInput>): Promise<AssetModelRecord | null> { throw new Error('Not implemented') }
    async deleteModel(id: string): Promise<boolean> { throw new Error('Not implemented') }
    async createLocation(input: LocationCreateInput) {
        const record: LocationRecord = {
            id: `loc-${this.locations.length + 1}`,
            name: input.name,
            parentId: input.parentId ?? null,
            path: input.path ?? '/',
            createdAt: new Date()
        }
        this.locations.push(record)
        return record
    }
    async updateLocation(id: string, patch: Partial<LocationCreateInput>) {
        const target = this.locations.find(loc => loc.id === id)
        if (!target) return null
        this.locations = this.locations.map(loc => loc.id === id ? { ...loc, ...patch, parentId: patch.parentId ?? loc.parentId } : loc)
        return this.locations.find(loc => loc.id === id) ?? null
    }
    async deleteLocation(id: string): Promise<boolean> { throw new Error('Not implemented') }
}

export class FakeCache implements ICacheRepo {
    private store = new Map<string, string>()
    async get<T>(key: string): Promise<T | null> {
        const raw = this.store.get(key)
        return raw ? (JSON.parse(raw) as T) : null
    }
    async set<T>(key: string, value: T, _ttl: number): Promise<void> {
        this.store.set(key, JSON.stringify(value))
    }
    async delete(key: string): Promise<void> {
        this.store.delete(key)
    }
    async exists(key: string): Promise<boolean> {
        return this.store.has(key)
    }
}

export class FakeSpecVersionRepo implements ICategorySpecVersionRepo {
    versions: Array<{ id: string; categoryId: string; version: number; status: 'draft' | 'active' | 'retired'; createdAt: Date; createdBy?: string | null }> = []
    async listByCategory(categoryId: string) {
        return this.versions.filter(version => version.categoryId === categoryId)
    }
    async getActiveByCategory(categoryId: string) {
        return this.versions.find(version => version.categoryId === categoryId && version.status === 'active') ?? null
    }
    async getById(id: string) {
        return this.versions.find(version => version.id === id) ?? null
    }
    async getLatestVersionNumber(categoryId: string) {
        const versions = this.versions.filter(version => version.categoryId === categoryId)
        if (versions.length === 0) return 0
        return Math.max(...versions.map(version => version.version))
    }
    async create(categoryId: string, version: number, status: 'draft' | 'active' | 'retired', createdBy?: string | null) {
        const record = { id: `ver-${this.versions.length + 1}`, categoryId, version, status, createdBy: createdBy ?? null, createdAt: new Date() }
        this.versions.push(record)
        return record
    }
    async updateStatus(id: string, status: 'draft' | 'active' | 'retired') {
        const target = this.versions.find(version => version.id === id)
        if (!target) return null
        target.status = status
        return target
    }
    async retireOtherActive(categoryId: string, keepId: string) {
        let count = 0
        for (const version of this.versions) {
            if (version.categoryId === categoryId && version.id !== keepId && version.status === 'active') {
                version.status = 'retired'
                count += 1
            }
        }
        return count
    }
}

export class FakeSpecRepo implements ICategorySpecRepo {
    defs: CategorySpecDefRecord[] = []
    constructor(private catalogs: ICatalogRepo, private versions: ICategorySpecVersionRepo) { }
    async listByCategory(categoryId: string): Promise<CategorySpecDefRecord[]> {
        const active = await this.versions.getActiveByCategory(categoryId)
        if (!active) return []
        return this.defs.filter(def => def.versionId === active.id && def.isActive)
    }
    async listByVersion(versionId: string): Promise<CategorySpecDefRecord[]> {
        return this.defs.filter(def => def.versionId === versionId && def.isActive)
    }
    async bulkInsert(versionId: string, defs: CategorySpecDefInput[]): Promise<CategorySpecDefRecord[]> {
        const created = defs.map((def, index) => buildRecord(`spec-${this.defs.length + index + 1}`, versionId, def))
        this.defs.push(...created)
        return created
    }
    async create(input: CategorySpecDefInput & { versionId: string }): Promise<CategorySpecDefRecord> {
        const record = buildRecord(`spec-${this.defs.length + 1}`, input.versionId, input)
        this.defs.push(record)
        return record
    }
    async update(): Promise<CategorySpecDefRecord | null> {
        return null
    }
    async softDelete(): Promise<boolean> {
        return false
    }
    async withTransaction<T>(
        handler: (context: { catalogs: ICatalogRepo; specs: ICategorySpecRepo; versions: ICategorySpecVersionRepo }) => Promise<T>
    ): Promise<T> {
        return handler({ catalogs: this.catalogs, specs: this, versions: this.versions })
    }
}

function buildRecord(id: string, versionId: string, input: CategorySpecDefInput): CategorySpecDefRecord {
    return {
        id,
        versionId,
        key: input.key,
        label: input.label,
        fieldType: input.fieldType,
        unit: input.unit ?? null,
        required: input.required ?? false,
        enumValues: input.enumValues ?? null,
        pattern: input.pattern ?? null,
        minLen: input.minLen ?? null,
        maxLen: input.maxLen ?? null,
        minValue: input.minValue ?? null,
        maxValue: input.maxValue ?? null,
        stepValue: input.stepValue ?? null,
        precision: input.precision ?? null,
        scale: input.scale ?? null,
        normalize: input.normalize ?? null,
        defaultValue: input.defaultValue ?? null,
        helpText: input.helpText ?? null,
        sortOrder: input.sortOrder ?? 0,
        isActive: input.isActive ?? true,
        isReadonly: input.isReadonly ?? false,
        computedExpr: input.computedExpr ?? null,
        isSearchable: input.isSearchable ?? false,
        isFilterable: input.isFilterable ?? false,
        createdAt: new Date(),
        updatedAt: new Date()
    }
}

export const emptyCatalogs: CatalogsResult = {
    categories: [],
    locations: [],
    vendors: [],
    models: []
}
