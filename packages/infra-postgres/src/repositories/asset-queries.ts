import type { AssetRecord, AssetSearchFilters } from '@qltb/contracts'

export interface AssetRow {
    id: string
    asset_code: string
    model_id: string | null
    category_id?: string | null
    serial_no: string | null
    mac_address: string | null
    mgmt_ip: string | null
    hostname: string | null
    vlan_id: number | null
    switch_name: string | null
    switch_port: string | null
    location_id: string | null
    warehouse_id: string | null
    status: AssetRecord['status']
    purchase_date: Date | null
    warranty_end: Date | null
    vendor_id: string | null
    notes: string | null
    spec?: unknown
    model_spec?: unknown
    created_at: Date
    updated_at: Date
    model_name?: string | null
    model_brand?: string | null
    category_name?: string | null
    vendor_name?: string | null
    location_name?: string | null
    warehouse_name?: string | null
}

export const BASE_SELECT = `
SELECT
  a.*,
  m.category_id AS category_id,
  m.spec AS model_spec,
  m.model AS model_name,
  m.brand AS model_brand,
  c.name AS category_name,
  COALESCE(v.name, vm.name) AS vendor_name,
  l.name AS location_name,
  w.name AS warehouse_name
FROM assets a
LEFT JOIN asset_models m ON a.model_id = m.id
LEFT JOIN asset_categories c ON m.category_id = c.id
LEFT JOIN vendors v ON v.id = a.vendor_id
LEFT JOIN vendors vm ON vm.id = m.vendor_id
LEFT JOIN locations l ON a.location_id = l.id
LEFT JOIN warehouses w ON a.warehouse_id = w.id`

export function mapAssetRow(row: AssetRow): AssetRecord {
    const specValue = row.spec ?? row.model_spec ?? null
    return {
        id: row.id,
        assetCode: row.asset_code,
        modelId: row.model_id,
        categoryId: row.category_id ?? null,
        serialNo: row.serial_no,
        macAddress: row.mac_address,
        mgmtIp: row.mgmt_ip,
        hostname: row.hostname,
        vlanId: row.vlan_id,
        switchName: row.switch_name,
        switchPort: row.switch_port,
        locationId: row.location_id,
        warehouseId: row.warehouse_id,
        status: row.status,
        purchaseDate: row.purchase_date,
        warrantyEnd: row.warranty_end,
        vendorId: row.vendor_id,
        notes: row.notes,
        spec: typeof specValue === 'object' && specValue !== null ? specValue as Record<string, unknown> : null,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        modelName: row.model_name ?? null,
        modelBrand: row.model_brand ?? null,
        categoryName: row.category_name ?? null,
        vendorName: row.vendor_name ?? null,
        locationName: row.location_name ?? null,
        warehouseName: row.warehouse_name ?? null
    }
}

export function normalizePagination(filters: AssetSearchFilters): { page: number; limit: number; offset: number } {
    const page = Math.max(1, filters.page ?? 1)
    const limit = Math.min(Math.max(1, filters.limit ?? 20), 100)
    const offset = (page - 1) * limit
    return { page, limit, offset }
}

export function buildSearchConditions(filters: AssetSearchFilters): { conditions: string[]; params: unknown[] } {
    const conditions: string[] = []
    const params: unknown[] = []

    if (filters.query) {
        params.push(`%${filters.query}%`)
        const idx = params.length
        conditions.push(`(
            a.asset_code ILIKE $${idx}
            OR a.serial_no ILIKE $${idx}
            OR a.hostname ILIKE $${idx}
            OR a.mgmt_ip::text ILIKE $${idx}
            OR a.mac_address ILIKE $${idx}
        )`)
    }

    if (filters.status) {
        params.push(filters.status)
        conditions.push(`a.status = $${params.length}`)
    }
    if (filters.locationId) {
        params.push(filters.locationId)
        conditions.push(`a.location_id = $${params.length}`)
    }
    if (filters.modelId) {
        params.push(filters.modelId)
        conditions.push(`a.model_id = $${params.length}`)
    }
    if (filters.vendorId) {
        params.push(filters.vendorId)
        conditions.push(`COALESCE(a.vendor_id, m.vendor_id) = $${params.length}`)
    }
    if (filters.categoryId) {
        params.push(filters.categoryId)
        conditions.push(`m.category_id = $${params.length}`)
    }
    if (filters.warehouseId) {
        params.push(filters.warehouseId)
        conditions.push(`a.warehouse_id = $${params.length}`)
    }
    if (filters.organizationId) {
        params.push(filters.organizationId)
        const idx = params.length
        conditions.push(`(
            EXISTS (
                SELECT 1
                FROM locations l2
                WHERE l2.id = a.location_id
                  AND l2.organization_id = $${idx}
            )
            OR EXISTS (
                SELECT 1
                FROM asset_assignments aa
                WHERE aa.asset_id = a.id
                  AND aa.returned_at IS NULL
                  AND aa.organization_id = $${idx}
            )
        )`)
    }
    if (filters.warrantyExpiringDays !== undefined) {
        params.push(filters.warrantyExpiringDays)
        const idx = params.length
        conditions.push(`a.warranty_end IS NOT NULL AND a.warranty_end >= CURRENT_DATE AND a.warranty_end <= (CURRENT_DATE + $${idx} * INTERVAL '1 day')`)
    }

    return { conditions, params }
}

export function resolveSort(sort: AssetSearchFilters['sort']): string {
    switch (sort) {
        case 'asset_code_asc':
            return 'a.asset_code ASC'
        case 'asset_code_desc':
            return 'a.asset_code DESC'
        case 'warranty_end_asc':
            return 'a.warranty_end ASC NULLS LAST'
        default:
            return 'a.created_at DESC'
    }
}
