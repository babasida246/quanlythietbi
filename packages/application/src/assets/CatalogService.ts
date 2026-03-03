import { AppError } from '@qltb/domain'
import type {
    AssetCategoryCreateInput,
    AssetCategoryRecord,
    AssetCategoryUpdatePatch,
    AssetModelCreateInput,
    AssetModelRecord,
    AssetModelUpdatePatch,
    AssetModelSearchFilters,
    CatalogsResult,
    CategorySpecDefRecord,
    ICatalogRepo,
    ICategorySpecRepo,
    ICategorySpecVersionRepo,
    ICacheRepo,
    IOpsEventRepo,
    LocationCreateInput,
    LocationRecord,
    LocationUpdatePatch,
    VendorCreateInput,
    VendorRecord,
    VendorUpdatePatch
} from '@qltb/contracts'
import { matchCategoryTemplate } from './categorySpecTemplates.js'
import { validateModelSpec } from './catalogSpecValidation.js'
import { applyComputedSpec } from './categorySpecExtractor.js'
import { normalizeSpecValues } from './categorySpecNormalize.js'

const DEFAULT_TTL = 300
const CACHE_KEY = 'assets:catalogs'
export interface CatalogServiceContext {
    userId: string
    correlationId: string
}

export class CatalogService {
    constructor(
        private catalogs: ICatalogRepo,
        private specs: ICategorySpecRepo,
        private versions: ICategorySpecVersionRepo,
        private cache?: ICacheRepo,
        private opsEvents?: IOpsEventRepo,
        private ttlSeconds: number = DEFAULT_TTL
    ) { }

    async listCatalogs(): Promise<CatalogsResult> {
        if (this.cache) {
            const cached = await this.cache.get<CatalogsResult>(CACHE_KEY)
            if (cached) return cached
        }
        const [categories, locations, vendors, models] = await Promise.all([
            this.catalogs.listCategories(),
            this.catalogs.listLocations(),
            this.catalogs.listVendors(),
            this.catalogs.listModels()
        ])
        const result: CatalogsResult = { categories, locations, vendors, models }
        if (this.cache) {
            await this.cache.set(CACHE_KEY, result, this.ttlSeconds)
        }
        return result
    }

    async listCategories(): Promise<AssetCategoryRecord[]> {
        return this.catalogs.listCategories()
    }

    async listVendors(): Promise<VendorRecord[]> {
        return this.catalogs.listVendors()
    }

    async listLocations(): Promise<LocationRecord[]> {
        return this.catalogs.listLocations()
    }

    async searchModels(filters: AssetModelSearchFilters): Promise<AssetModelRecord[]> {
        const categoryId = filters.categoryId ?? null
        let specFilters = filters.specFilters ?? {}
        if (categoryId && Object.keys(specFilters).length > 0) {
            const defs = await this.specs.listByCategory(categoryId)
            const allowed = new Set(defs.filter(def => def.isFilterable).map(def => def.key))
            specFilters = Object.fromEntries(
                Object.entries(specFilters).filter(([key, value]) =>
                    allowed.has(key) && value !== undefined && value !== null && value !== ''
                )
            )
        }
        return this.catalogs.searchModels({ categoryId, specFilters })
    }

    async createVendor(input: VendorCreateInput): Promise<VendorRecord> {
        const created = await this.catalogs.createVendor(input)
        await this.invalidateCache()
        return created
    }

    async updateVendor(id: string, patch: VendorUpdatePatch): Promise<VendorRecord> {
        const updated = await this.catalogs.updateVendor(id, patch)
        if (!updated) throw AppError.notFound('Vendor not found')
        await this.invalidateCache()
        return updated
    }

    async deleteVendor(id: string): Promise<void> {
        const deleted = await this.catalogs.deleteVendor(id)
        if (!deleted) throw AppError.notFound('Vendor not found')
        await this.invalidateCache()
    }

    async createCategory(
        input: AssetCategoryCreateInput,
        ctx?: CatalogServiceContext
    ): Promise<{ category: AssetCategoryRecord; versionId: string; specDefs?: CategorySpecDefRecord[] }> {
        const template = matchCategoryTemplate(input.name)
        const result = await this.specs.withTransaction(async ({ catalogs, specs, versions }) => {
            const category = await catalogs.createCategory(input)
            const version = await versions.create(category.id, 1, 'active', ctx?.userId ?? null)
            const specDefs = template ? await specs.bulkInsert(version.id, template) : []
            return { category, versionId: version.id, specDefs }
        })
        await this.invalidateCache()
        if (ctx && this.opsEvents) {
            await this.opsEvents.append({
                entityType: 'asset_category',
                entityId: result.category.id,
                eventType: 'SPEC_VERSION_CREATED',
                payload: { version: 1, status: 'active' },
                actorUserId: ctx.userId,
                correlationId: ctx.correlationId
            })
            if (result.specDefs && result.specDefs.length > 0) {
                await this.opsEvents.append({
                    entityType: 'asset_category',
                    entityId: result.category.id,
                    eventType: 'SPEC_DEF_CHANGED',
                    payload: { action: 'template_applied', count: result.specDefs.length },
                    actorUserId: ctx.userId,
                    correlationId: ctx.correlationId
                })
            }
        }
        return result
    }

    async updateCategory(id: string, patch: AssetCategoryUpdatePatch): Promise<AssetCategoryRecord> {
        const updated = await this.catalogs.updateCategory(id, patch)
        if (!updated) throw AppError.notFound('Category not found')
        await this.invalidateCache()
        return updated
    }

    async deleteCategory(id: string): Promise<void> {
        const deleted = await this.catalogs.deleteCategory(id)
        if (!deleted) throw AppError.notFound('Category not found')
        await this.invalidateCache()
    }

    async createModel(input: AssetModelCreateInput): Promise<AssetModelRecord> {
        let spec = input.spec ?? {}
        let specVersionId = input.specVersionId ?? null
        if (input.categoryId) {
            const resolved = await this.resolveSpecVersion(input.categoryId, specVersionId)
            specVersionId = resolved.versionId
            spec = this.prepareSpec(resolved.defs, input.model, spec)
            validateModelSpec(resolved.defs, spec)
        }
        const created = await this.catalogs.createModel({ ...input, spec, specVersionId })
        await this.invalidateCache()
        return created
    }

    async updateModel(id: string, patch: AssetModelUpdatePatch): Promise<AssetModelRecord> {
        const existing = await this.catalogs.getModelById(id)
        if (!existing) throw AppError.notFound('Model not found')
        const nextCategoryId = patch.categoryId ?? existing.categoryId ?? null
        const nextModelName = patch.model ?? existing.model
        const specProvided = patch.spec !== undefined
        const shouldValidate = specProvided || patch.categoryId !== undefined || patch.specVersionId !== undefined
        let nextSpec = specProvided ? (patch.spec ?? {}) : existing.spec ?? {}
        let nextSpecVersionId = patch.specVersionId ?? existing.specVersionId ?? null
        if (nextCategoryId && shouldValidate) {
            const resolved = await this.resolveSpecVersion(nextCategoryId, nextSpecVersionId)
            nextSpecVersionId = resolved.versionId
            nextSpec = this.prepareSpec(resolved.defs, nextModelName, nextSpec)
            validateModelSpec(resolved.defs, nextSpec)
        } else if (!nextCategoryId) {
            nextSpecVersionId = null
        }
        const updated = await this.catalogs.updateModel(id, {
            ...patch,
            spec: shouldValidate ? nextSpec : patch.spec,
            specVersionId: shouldValidate ? nextSpecVersionId : patch.specVersionId
        })
        if (!updated) throw AppError.notFound('Model not found')
        await this.invalidateCache()
        return updated
    }

    async deleteModel(id: string): Promise<void> {
        const deleted = await this.catalogs.deleteModel(id)
        if (!deleted) throw AppError.notFound('Model not found')
        await this.invalidateCache()
    }

    async createLocation(input: LocationCreateInput): Promise<LocationRecord> {
        const created = await this.catalogs.createLocation({
            name: input.name,
            parentId: input.parentId ?? null,
            path: '/'
        })
        const path = await this.buildLocationPath(input.parentId ?? null, created.id)
        const updated = await this.catalogs.updateLocation(created.id, { path })
        if (!updated) throw AppError.internal('Failed to update location')
        await this.invalidateCache()
        return updated
    }

    async updateLocation(id: string, patch: LocationUpdatePatch): Promise<LocationRecord> {
        const existing = await this.catalogs.getLocationById(id)
        if (!existing) throw AppError.notFound('Location not found')
        if (patch.parentId !== undefined && patch.parentId === id) {
            throw AppError.badRequest('Location cannot be its own parent')
        }
        const parentId = patch.parentId !== undefined ? patch.parentId : existing.parentId ?? null
        const path = patch.parentId !== undefined ? await this.buildLocationPath(parentId ?? null, id) : undefined
        const updated = await this.catalogs.updateLocation(id, {
            name: patch.name,
            parentId: patch.parentId,
            path
        })
        if (!updated) throw AppError.internal('Failed to update location')
        await this.invalidateCache()
        return updated
    }

    async deleteLocation(id: string): Promise<void> {
        const deleted = await this.catalogs.deleteLocation(id)
        if (!deleted) throw AppError.notFound('Location not found')
        await this.invalidateCache()
    }

    private async resolveSpecVersion(
        categoryId: string,
        specVersionId?: string | null
    ): Promise<{ versionId: string; defs: CategorySpecDefRecord[] }> {
        let versionId = specVersionId ?? null
        if (!versionId) {
            const active = await this.versions.getActiveByCategory(categoryId)
            if (!active) {
                throw AppError.notFound('Active spec version not found')
            }
            versionId = active.id
        }
        const defs = await this.specs.listByVersion(versionId)
        return { versionId, defs }
    }

    private prepareSpec(
        defs: CategorySpecDefRecord[],
        modelName: string,
        spec: Record<string, unknown>
    ): Record<string, unknown> {
        const withComputed = applyComputedSpec(modelName, defs, spec)
        return normalizeSpecValues(defs, withComputed)
    }

    private async buildLocationPath(parentId: string | null, id: string): Promise<string> {
        if (!parentId) return `/${id}`
        const parent = await this.catalogs.getLocationById(parentId)
        if (!parent) throw AppError.notFound('Parent location not found')
        const base = parent.path.endsWith('/') ? parent.path.slice(0, -1) : parent.path
        return `${base}/${id}`
    }

    private async invalidateCache(): Promise<void> {
        if (!this.cache) return
        await this.cache.delete(CACHE_KEY)
    }
}
