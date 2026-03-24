import type {
    AssetCategoryRecord,
    AssetCategoryCreateInput,
    AssetCategoryUpdatePatch,
    AssetModelRecord,
    AssetModelCreateInput,
    AssetModelUpdatePatch,
    ICatalogRepo,
    LocationRecord,
    LocationCreateInput,
    LocationUpdatePatch,
    VendorRecord,
    VendorCreateInput,
    VendorUpdatePatch
} from '@qltb/contracts'
import type { Queryable } from './types.js'

type VendorRow = { id: string; name: string; tax_code: string | null; phone: string | null; email: string | null; address: string | null; created_at: Date }
type LocationRow = { id: string; name: string; parent_id: string | null; path: string; organization_id: string | null; organization_name: string | null; created_at: Date }
type CategoryRow = { id: string; name: string; created_at: Date }
type ModelRow = {
    id: string
    category_id: string | null
    spec_version_id: string | null
    vendor_id: string | null
    brand: string | null
    model: string
    spec: Record<string, unknown> | null
    created_at: Date
}

type Update = { column: string; value: unknown }

function buildUpdates(patch: Record<string, unknown>, fields: Array<[string, string]>): Update[] {
    const updates: Update[] = []
    for (const [key, column] of fields) {
        const value = patch[key]
        if (value !== undefined) updates.push({ column, value })
    }
    return updates
}

const mapVendor = (row: VendorRow): VendorRecord => ({
    id: row.id,
    name: row.name,
    taxCode: row.tax_code,
    phone: row.phone,
    email: row.email,
    address: row.address,
    createdAt: row.created_at
})

const mapLocation = (row: LocationRow): LocationRecord => ({
    id: row.id,
    name: row.name,
    parentId: row.parent_id,
    path: row.path,
    organizationId: row.organization_id,
    organizationName: row.organization_name,
    createdAt: row.created_at
})

const mapCategory = (row: CategoryRow): AssetCategoryRecord => ({
    id: row.id,
    name: row.name,
    createdAt: row.created_at
})

const mapModel = (row: ModelRow): AssetModelRecord => ({
    id: row.id,
    categoryId: row.category_id,
    specVersionId: row.spec_version_id,
    vendorId: row.vendor_id,
    brand: row.brand,
    model: row.model,
    spec: row.spec ?? {},
    createdAt: row.created_at
})

export class CatalogRepo implements ICatalogRepo {
    constructor(private pg: Queryable) { }

    async listVendors(): Promise<VendorRecord[]> {
        const result = await this.pg.query<VendorRow>('SELECT id, name, tax_code, phone, email, address, created_at FROM vendors ORDER BY name ASC')
        return result.rows.map(mapVendor)
    }

    async listLocations(): Promise<LocationRecord[]> {
        const result = await this.pg.query<LocationRow>(`
            SELECT l.id, l.name, l.parent_id, l.path, l.organization_id, l.created_at,
                   o.name AS organization_name
            FROM locations l
            LEFT JOIN organizations o ON o.id = l.organization_id
            ORDER BY l.path ASC
        `)
        return result.rows.map(mapLocation)
    }

    async listCategories(): Promise<AssetCategoryRecord[]> {
        const result = await this.pg.query<CategoryRow>('SELECT id, name, created_at FROM asset_categories ORDER BY name ASC')
        return result.rows.map(mapCategory)
    }

    async listModels(): Promise<AssetModelRecord[]> {
        const result = await this.pg.query<ModelRow>(
            'SELECT id, category_id, spec_version_id, vendor_id, brand, model, spec, created_at FROM asset_models ORDER BY model ASC'
        )
        return result.rows.map(mapModel)
    }

    async searchModels(filters: { categoryId?: string | null; specFilters?: Record<string, unknown> }): Promise<AssetModelRecord[]> {
        const conditions: string[] = []
        const params: unknown[] = []

        if (filters.categoryId) {
            params.push(filters.categoryId)
            conditions.push(`category_id = $${params.length}`)
        }

        if (filters.specFilters && Object.keys(filters.specFilters).length > 0) {
            params.push(filters.specFilters)
            conditions.push(`spec @> $${params.length}::jsonb`)
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
        const result = await this.pg.query<ModelRow>(
            `SELECT id, category_id, spec_version_id, vendor_id, brand, model, spec, created_at
             FROM asset_models
             ${whereClause}
             ORDER BY model ASC`,
            params
        )
        return result.rows.map(mapModel)
    }

    async getLocationById(id: string): Promise<LocationRecord | null> {
        const result = await this.pg.query<LocationRow>(`
            SELECT l.id, l.name, l.parent_id, l.path, l.organization_id, l.created_at,
                   o.name AS organization_name
            FROM locations l
            LEFT JOIN organizations o ON o.id = l.organization_id
            WHERE l.id = $1
        `, [id])
        return result.rows[0] ? mapLocation(result.rows[0]) : null
    }

    async getModelById(id: string): Promise<AssetModelRecord | null> {
        const result = await this.pg.query<ModelRow>(
            'SELECT id, category_id, spec_version_id, vendor_id, brand, model, spec, created_at FROM asset_models WHERE id = $1',
            [id]
        )
        return result.rows[0] ? mapModel(result.rows[0]) : null
    }

    async createVendor(input: VendorCreateInput): Promise<VendorRecord> {
        const result = await this.pg.query<VendorRow>(
            'INSERT INTO vendors (name, tax_code, phone, email, address) VALUES ($1,$2,$3,$4,$5) RETURNING id, name, tax_code, phone, email, address, created_at',
            [input.name, input.taxCode ?? null, input.phone ?? null, input.email ?? null, input.address ?? null]
        )
        return mapVendor(result.rows[0])
    }

    async updateVendor(id: string, patch: VendorUpdatePatch): Promise<VendorRecord | null> {
        const updates = buildUpdates(patch as Record<string, unknown>, [
            ['name', 'name'],
            ['taxCode', 'tax_code'],
            ['phone', 'phone'],
            ['email', 'email'],
            ['address', 'address']
        ])
        if (updates.length === 0) {
            const existing = await this.pg.query<VendorRow>('SELECT id, name, tax_code, phone, email, address, created_at FROM vendors WHERE id = $1', [id])
            return existing.rows[0] ? mapVendor(existing.rows[0]) : null
        }
        const setClause = updates.map((update, index) => `${update.column} = $${index + 1}`).join(', ')
        const params = updates.map(update => update.value)
        params.push(id)
        const result = await this.pg.query<VendorRow>(`UPDATE vendors SET ${setClause} WHERE id = $${params.length} RETURNING id, name, tax_code, phone, email, address, created_at`, params)
        return result.rows[0] ? mapVendor(result.rows[0]) : null
    }

    async deleteVendor(id: string): Promise<boolean> {
        const result = await this.pg.query('DELETE FROM vendors WHERE id = $1', [id])
        return (result.rowCount ?? 0) > 0
    }

    async createCategory(input: AssetCategoryCreateInput): Promise<AssetCategoryRecord> {
        const result = await this.pg.query<CategoryRow>('INSERT INTO asset_categories (name) VALUES ($1) RETURNING id, name, created_at', [input.name])
        return mapCategory(result.rows[0])
    }

    async updateCategory(id: string, patch: AssetCategoryUpdatePatch): Promise<AssetCategoryRecord | null> {
        const updates = buildUpdates(patch as Record<string, unknown>, [['name', 'name']])
        if (updates.length === 0) {
            const existing = await this.pg.query<CategoryRow>('SELECT id, name, created_at FROM asset_categories WHERE id = $1', [id])
            return existing.rows[0] ? mapCategory(existing.rows[0]) : null
        }
        const setClause = updates.map((update, index) => `${update.column} = $${index + 1}`).join(', ')
        const params = updates.map(update => update.value)
        params.push(id)
        const result = await this.pg.query<CategoryRow>(`UPDATE asset_categories SET ${setClause} WHERE id = $${params.length} RETURNING id, name, created_at`, params)
        return result.rows[0] ? mapCategory(result.rows[0]) : null
    }

    async deleteCategory(id: string): Promise<boolean> {
        const result = await this.pg.query('DELETE FROM asset_categories WHERE id = $1', [id])
        return (result.rowCount ?? 0) > 0
    }

    async createModel(input: AssetModelCreateInput): Promise<AssetModelRecord> {
        const result = await this.pg.query<ModelRow>(
            'INSERT INTO asset_models (category_id, spec_version_id, vendor_id, brand, model, spec) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, category_id, spec_version_id, vendor_id, brand, model, spec, created_at',
            [input.categoryId ?? null, input.specVersionId ?? null, input.vendorId ?? null, input.brand ?? null, input.model, input.spec ?? {}]
        )
        return mapModel(result.rows[0])
    }

    async updateModel(id: string, patch: AssetModelUpdatePatch): Promise<AssetModelRecord | null> {
        const updates = buildUpdates(patch as Record<string, unknown>, [
            ['categoryId', 'category_id'],
            ['specVersionId', 'spec_version_id'],
            ['vendorId', 'vendor_id'],
            ['brand', 'brand'],
            ['model', 'model'],
            ['spec', 'spec']
        ])
        if (updates.length === 0) {
            const existing = await this.pg.query<ModelRow>(
                'SELECT id, category_id, spec_version_id, vendor_id, brand, model, spec, created_at FROM asset_models WHERE id = $1',
                [id]
            )
            return existing.rows[0] ? mapModel(existing.rows[0]) : null
        }
        const setClause = updates.map((update, index) => `${update.column} = $${index + 1}`).join(', ')
        const params = updates.map(update => update.value)
        params.push(id)
        const result = await this.pg.query<ModelRow>(
            `UPDATE asset_models SET ${setClause} WHERE id = $${params.length}
             RETURNING id, category_id, spec_version_id, vendor_id, brand, model, spec, created_at`,
            params
        )
        return result.rows[0] ? mapModel(result.rows[0]) : null
    }

    async deleteModel(id: string): Promise<boolean> {
        const result = await this.pg.query('DELETE FROM asset_models WHERE id = $1', [id])
        return (result.rowCount ?? 0) > 0
    }

    async createLocation(input: LocationCreateInput): Promise<LocationRecord> {
        const result = await this.pg.query<{ id: string }>(
            'INSERT INTO locations (name, parent_id, path, organization_id) VALUES ($1,$2,$3,$4) RETURNING id',
            [input.name, input.parentId ?? null, input.path ?? '/', input.organizationId ?? null]
        )
        return (await this.getLocationById(result.rows[0].id))!
    }

    async updateLocation(id: string, patch: LocationUpdatePatch): Promise<LocationRecord | null> {
        const updates = buildUpdates(patch as Record<string, unknown>, [
            ['name', 'name'],
            ['parentId', 'parent_id'],
            ['path', 'path'],
            ['organizationId', 'organization_id']
        ])
        if (updates.length === 0) return this.getLocationById(id)
        const setClause = updates.map((update, index) => `${update.column} = $${index + 1}`).join(', ')
        const params = updates.map(update => update.value)
        params.push(id)
        await this.pg.query(`UPDATE locations SET ${setClause} WHERE id = $${params.length}`, params)
        return this.getLocationById(id)
    }

    async deleteLocation(id: string): Promise<boolean> {
        const result = await this.pg.query('DELETE FROM locations WHERE id = $1', [id])
        return (result.rowCount ?? 0) > 0
    }
}
