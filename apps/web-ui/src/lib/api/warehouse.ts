import { API_BASE, apiJson, apiJsonData } from './httpClient'
import { buildQuery, getAssetHeaders, type Asset } from './assets'
import type {
    StockDocStatus, MovementType, RepairStatus, RepairSeverity, RepairType,
    WarehouseRecord, StockDocumentLineRecord, StockDocumentLineInput, StockDocumentDetail,
    RepairOrderRecord, RepairOrderPartRecord, RepairOrderDetail, RepairOrderSummary
} from '@qltb/contracts'

export type StockDocType = 'receipt' | 'issue' | 'adjust' | 'transfer' | 'return'
export type { StockDocStatus, MovementType, RepairStatus, RepairSeverity, RepairType }
export type StockDocumentRecord = Omit<import('@qltb/contracts').StockDocumentRecord, 'docType'> & { docType: StockDocType }
export type { StockDocumentLineRecord, StockDocumentDetail }
export type { WarehouseRecord }
export type { RepairOrderRecord, RepairOrderPartRecord, RepairOrderDetail, RepairOrderSummary }
export type StockDocumentLine = StockDocumentLineInput & {
    id?: string
    resolvedModelName?: string | null
    resolvedModelUom?: string | null
    resolvedCategoryName?: string | null
}

export type SparePartRecord = {
    id: string
    partCode: string
    name: string
    category?: string | null
    categoryId?: string | null
    categoryName?: string | null
    modelId?: string | null
    modelName?: string | null
    uom?: string | null
    manufacturer?: string | null
    model?: string | null
    spec: Record<string, unknown>
    minLevel: number
    unitCost?: number | null
    createdAt: string
}

export type StockViewRecord = {
    warehouseId: string
    warehouseCode: string
    warehouseName: string
    modelId: string
    partCode: string
    partName: string
    onHand: number
    reserved: number
    available: number
    uom?: string | null
    minLevel: number
}

export type StockOnHandRow = {
    partId: string
    partCode: string
    partName: string
    warehouseId: string
    warehouseName: string
    onHand: number
    uom?: string | null
    minLevel: number
}

export type StockAvailableRow = {
    partId: string
    partCode: string
    partName: string
    warehouseId: string
    warehouseName: string
    onHand: number
    reserved: number
    available: number
    uom?: string | null
    minLevel: number
}

export type ReorderAlertRow = {
    partId: string
    partCode: string
    partName: string
    warehouseId: string
    warehouseName: string
    onHand: number
    minLevel: number
    uom?: string | null
}

export type FefoLotRow = {
    lotId: string
    lotNumber: string
    partId: string
    partCode: string
    partName: string
    warehouseId: string
    warehouseName: string
    manufactureDate?: string | null
    expiryDate?: string | null
    daysUntilExpiry?: number | null
    onHand: number
    uom?: string | null
    status: 'expired' | 'critical' | 'warning' | 'normal'
}

export type ValuationResult = {
    total: number
    currency: string
    items: Array<{
        partId: string
        partCode: string
        partName: string
        onHand: number
        avgCost: number
        value: number
    }>
}


export type StockMovementRecord = {
    id: string
    warehouseId: string
    partId: string
    movementType: MovementType
    qty: number
    unitCost?: number | null
    refType?: string | null
    refId?: string | null
    actorUserId?: string | null
    correlationId?: string | null
    createdAt: string
}

export type RepairOrderEvent = {
    id: string
    eventType: string
    payload: Record<string, unknown>
    createdAt: string
}


export type OrgUnitOption = {
    id: string
    name: string
    path: string
    depth: number
}

export type StockDocumentCreateInput = {
    docType: StockDocType
    code?: string
    warehouseId?: string | null
    targetWarehouseId?: string | null
    docDate?: string
    refType?: string | null
    refId?: string | null
    note?: string | null
    supplier?: string | null
    submitterName?: string | null
    receiverName?: string | null
    department?: string | null
    recipientOuId?: string | null
    /** Destination location for issue documents */
    locationId?: string | null
    itemGroup?: string | null
    equipmentGroupId?: string | null
    lines: StockDocumentLine[]
}

export type StockDocumentUpdateInput = {
    docDate?: string
    note?: string | null
    warehouseId?: string | null
    targetWarehouseId?: string | null
    supplier?: string | null
    submitterName?: string | null
    receiverName?: string | null
    department?: string | null
    recipientOuId?: string | null
    /** Destination location for issue documents */
    locationId?: string | null
    itemGroup?: string | null
    equipmentGroupId?: string | null
    lines: StockDocumentLine[]
}

/** Lightweight asset record used in the issue-line picker */
export type WarehouseAssetOption = {
    id: string
    assetCode: string
    serialNo: string | null
    modelName: string | null
    categoryName: string | null
}

type ApiResponse<T> = { data: T; meta?: { total?: number; page?: number; limit?: number } }

export async function listOrgUnits(): Promise<ApiResponse<OrgUnitOption[]>> {
    return apiJson<ApiResponse<OrgUnitOption[]>>(`${API_BASE}/v1/org-units`, {
        headers: getAssetHeaders()
    })
}

export async function listWarehouses(): Promise<ApiResponse<WarehouseRecord[]>> {
    return apiJson<ApiResponse<WarehouseRecord[]>>(`${API_BASE}/v1/warehouses`, {
        headers: getAssetHeaders()
    })
}

export async function createWarehouse(input: { code: string; name: string; locationId?: string | null }): Promise<ApiResponse<WarehouseRecord>> {
    return apiJson<ApiResponse<WarehouseRecord>>(`${API_BASE}/v1/warehouses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAssetHeaders() },
        body: JSON.stringify(input)
    })
}

export async function updateWarehouse(id: string, patch: { code?: string; name?: string; locationId?: string | null }): Promise<ApiResponse<WarehouseRecord>> {
    return apiJson<ApiResponse<WarehouseRecord>>(`${API_BASE}/v1/warehouses/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getAssetHeaders() },
        body: JSON.stringify(patch)
    })
}

export async function deleteWarehouse(id: string): Promise<void> {
    await apiJson<void>(`${API_BASE}/v1/warehouses/${id}`, {
        method: 'DELETE',
        headers: getAssetHeaders()
    })
}

export async function listWarehouseAssets(
    warehouseId: string,
    params: { page?: number; limit?: number; status?: string } = {}
): Promise<ApiResponse<Asset[]>> {
    const query = buildQuery(params)
    return apiJson<ApiResponse<Asset[]>>(`${API_BASE}/v1/warehouses/${warehouseId}/assets${query}`, {
        headers: getAssetHeaders()
    })
}

/** List in-stock assets at a specific warehouse (for issue-line asset picker) */
export async function listStockAssets(
    warehouseId: string,
    q?: string
): Promise<WarehouseAssetOption[]> {
    const params: Record<string, string> = { warehouseId }
    if (q) params.q = q
    const query = buildQuery(params)
    const res = await apiJson<ApiResponse<WarehouseAssetOption[]>>(`${API_BASE}/v1/stock/assets${query}`, {
        headers: getAssetHeaders()
    })
    return res.data
}

export type SparePartSearchResult = {
    id: string; partCode: string; name: string;
    category: string | null; uom: string | null;
    manufacturer: string | null; model: string | null; unitCost: number
}

export async function searchSpareParts(q: string, limit = 15): Promise<SparePartSearchResult[]> {
    const qs = new URLSearchParams({ q, limit: String(limit) }).toString()
    const res = await apiJson<ApiResponse<SparePartSearchResult[]>>(
        `${API_BASE}/v1/spare-parts/search?${qs}`, { headers: getAssetHeaders() }
    )
    return res.data ?? []
}

export async function listSpareParts(params: { q?: string; page?: number; limit?: number } = {}): Promise<ApiResponse<SparePartRecord[]>> {
    const query = buildQuery(params)
    return apiJson<ApiResponse<SparePartRecord[]>>(`${API_BASE}/v1/spare-parts${query}`, {
        headers: getAssetHeaders()
    })
}

export async function createSparePart(input: {
    partCode: string
    name: string
    category?: string | null
    uom?: string | null
    manufacturer?: string | null
    model?: string | null
    spec?: Record<string, unknown>
    minLevel?: number
}): Promise<ApiResponse<SparePartRecord>> {
    return apiJson<ApiResponse<SparePartRecord>>(`${API_BASE}/v1/spare-parts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAssetHeaders() },
        body: JSON.stringify(input)
    })
}

export async function updateSparePart(id: string, patch: Partial<{
    partCode: string
    name: string
    category?: string | null
    uom?: string | null
    manufacturer?: string | null
    model?: string | null
    spec?: Record<string, unknown>
    minLevel?: number
}>): Promise<ApiResponse<SparePartRecord>> {
    return apiJson<ApiResponse<SparePartRecord>>(`${API_BASE}/v1/spare-parts/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getAssetHeaders() },
        body: JSON.stringify(patch)
    })
}

export async function deleteSparePart(id: string): Promise<void> {
    await apiJson<void>(`${API_BASE}/v1/spare-parts/${id}`, {
        method: 'DELETE',
        headers: getAssetHeaders()
    })
}

export async function exportSparePartsCsv(): Promise<string> {
    const res = await fetch(`${API_BASE}/v1/spare-parts/export/csv`, {
        headers: getAssetHeaders()
    })
    if (!res.ok) throw new Error('Export failed')
    return res.text()
}

export async function importSparePartsCsv(csv: string): Promise<ApiResponse<{ created: number; errors: string[] }>> {
    return apiJson<ApiResponse<{ created: number; errors: string[] }>>(`${API_BASE}/v1/spare-parts/import/csv`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain', ...getAssetHeaders() },
        body: csv
    })
}

export async function listStockView(params: { warehouseId?: string; q?: string; belowMin?: boolean; page?: number; limit?: number } = {}): Promise<ApiResponse<StockViewRecord[]>> {
    const query = buildQuery({
        warehouseId: params.warehouseId,
        q: params.q,
        belowMin: params.belowMin ? 'true' : undefined,
        page: params.page,
        limit: params.limit
    })
    return apiJson<ApiResponse<StockViewRecord[]>>(`${API_BASE}/v1/stock/view${query}`, {
        headers: getAssetHeaders()
    })
}

export async function getStockAvailable(warehouseId: string, partId: string): Promise<{ onHand: number; reserved: number; available: number }> {
    const query = buildQuery({ warehouseId, partId })
    const res = await apiJson<ApiResponse<{ onHand: number; reserved: number; available: number }>>(`${API_BASE}/v1/stock/check${query}`, {
        headers: getAssetHeaders()
    })
    return res.data ?? { onHand: 0, reserved: 0, available: 0 }
}

export async function listStockDocuments(
    params: { docType?: string; docTypes?: string[]; status?: StockDocumentRecord['status']; warehouseId?: string; itemGroup?: string; from?: string; to?: string; page?: number; limit?: number } = {}
): Promise<ApiResponse<StockDocumentRecord[]>> {
    const { docTypes, ...rest } = params
    const base = buildQuery(rest)
    const extra = docTypes && docTypes.length ? `${base ? '&' : '?'}docTypes=${docTypes.join(',')}` : ''
    return apiJson<ApiResponse<StockDocumentRecord[]>>(`${API_BASE}/v1/stock-documents${base}${extra}`, {
        headers: getAssetHeaders()
    })
}

export async function getStockDocument(id: string): Promise<ApiResponse<StockDocumentDetail>> {
    return apiJson<ApiResponse<StockDocumentDetail>>(`${API_BASE}/v1/stock-documents/${id}`, {
        headers: getAssetHeaders()
    })
}

export async function createStockDocument(input: StockDocumentCreateInput): Promise<ApiResponse<StockDocumentDetail>> {
    return apiJson<ApiResponse<StockDocumentDetail>>(`${API_BASE}/v1/stock-documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAssetHeaders() },
        body: JSON.stringify(input)
    })
}

export async function updateStockDocument(id: string, input: StockDocumentUpdateInput): Promise<ApiResponse<StockDocumentDetail>> {
    return apiJson<ApiResponse<StockDocumentDetail>>(`${API_BASE}/v1/stock-documents/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getAssetHeaders() },
        body: JSON.stringify(input)
    })
}

export async function submitStockDocument(id: string): Promise<ApiResponse<StockDocumentRecord>> {
    return apiJson<ApiResponse<StockDocumentRecord>>(`${API_BASE}/v1/stock-documents/${id}/submit`, {
        method: 'POST',
        headers: getAssetHeaders()
    })
}

export async function approveStockDocument(id: string): Promise<ApiResponse<StockDocumentRecord>> {
    return apiJson<ApiResponse<StockDocumentRecord>>(`${API_BASE}/v1/stock-documents/${id}/approve`, {
        method: 'POST',
        headers: getAssetHeaders()
    })
}

export async function postStockDocument(id: string): Promise<ApiResponse<StockDocumentRecord>> {
    return apiJson<ApiResponse<StockDocumentRecord>>(`${API_BASE}/v1/stock-documents/${id}/post`, {
        method: 'POST',
        headers: getAssetHeaders()
    })
}

export async function cancelStockDocument(id: string): Promise<ApiResponse<StockDocumentRecord>> {
    return apiJson<ApiResponse<StockDocumentRecord>>(`${API_BASE}/v1/stock-documents/${id}/cancel`, {
        method: 'POST',
        headers: getAssetHeaders()
    })
}

export async function listRepairOrders(
    params: {
        assetId?: string
        ciId?: string
        status?: RepairOrderRecord['status']
        q?: string
        from?: string
        to?: string
        page?: number
        limit?: number
    } = {}
): Promise<ApiResponse<RepairOrderRecord[]>> {
    const query = buildQuery(params)
    return apiJson<ApiResponse<RepairOrderRecord[]>>(`${API_BASE}/v1/repair-orders${query}`, {
        headers: getAssetHeaders()
    })
}

export async function getRepairOrderSummary(
    params: {
        assetId?: string
        ciId?: string
        status?: RepairOrderRecord['status']
        q?: string
        from?: string
        to?: string
    } = {}
): Promise<ApiResponse<RepairOrderSummary>> {
    const query = buildQuery(params)
    return apiJson<ApiResponse<RepairOrderSummary>>(`${API_BASE}/v1/repair-orders/summary${query}`, {
        headers: getAssetHeaders()
    })
}

export async function getRepairOrder(id: string): Promise<ApiResponse<RepairOrderDetail>> {
    return apiJson<ApiResponse<RepairOrderDetail>>(`${API_BASE}/v1/repair-orders/${id}`, {
        headers: getAssetHeaders()
    })
}

export async function createRepairOrder(input: {
    assetId: string
    title: string
    description?: string
    severity: RepairOrderRecord['severity']
    repairType: RepairOrderRecord['repairType']
    technicianName?: string
    vendorId?: string
    laborCost?: number
    downtimeMinutes?: number
}): Promise<ApiResponse<RepairOrderRecord>> {
    return apiJson<ApiResponse<RepairOrderRecord>>(`${API_BASE}/v1/repair-orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAssetHeaders() },
        body: JSON.stringify(input)
    })
}

export async function updateRepairOrder(
    id: string,
    patch: Partial<{
        title: string
        description: string | null
        severity: RepairOrderRecord['severity']
        status: RepairOrderRecord['status']
        diagnosis: string | null
        resolution: string | null
        repairType: RepairOrderRecord['repairType']
        technicianName: string | null
        vendorId: string | null
        laborCost: number
        partsCost: number
        downtimeMinutes: number
    }>
): Promise<ApiResponse<RepairOrderRecord>> {
    return apiJson<ApiResponse<RepairOrderRecord>>(`${API_BASE}/v1/repair-orders/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getAssetHeaders() },
        body: JSON.stringify(patch)
    })
}

export async function changeRepairOrderStatus(
    id: string,
    status: RepairOrderRecord['status']
): Promise<ApiResponse<RepairOrderRecord>> {
    return apiJson<ApiResponse<RepairOrderRecord>>(`${API_BASE}/v1/repair-orders/${id}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAssetHeaders() },
        body: JSON.stringify({ status })
    })
}

export async function addRepairOrderPart(
    id: string,
    input: {
        partId?: string
        partName?: string
        warehouseId?: string
        action: RepairOrderPartRecord['action']
        qty: number
        unitCost?: number
        serialNo?: string
        note?: string
    }
): Promise<ApiResponse<RepairOrderDetail>> {
    return apiJson<ApiResponse<RepairOrderDetail>>(`${API_BASE}/v1/repair-orders/${id}/parts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAssetHeaders() },
        body: JSON.stringify(input)
    })
}

export async function listRepairOrderEvents(id: string, params: { limit?: number } = {}): Promise<ApiResponse<RepairOrderEvent[]>> {
    const query = buildQuery(params)
    return apiJson<ApiResponse<RepairOrderEvent[]>>(`${API_BASE}/v1/repair-orders/${id}/events${query}`, {
        headers: getAssetHeaders()
    })
}

export async function listStockMovements(params: { partId?: string; warehouseId?: string; from?: string; to?: string; page?: number; limit?: number } = {}): Promise<ApiResponse<StockMovementRecord[]>> {
    const query = buildQuery(params)
    return apiJson<ApiResponse<StockMovementRecord[]>>(`${API_BASE}/v1/stock/ledger${query}`, {
        headers: getAssetHeaders()
    })
}

export async function reportStockOnHand(params: { warehouseId?: string; itemId?: string; limit?: number } = {}): Promise<StockOnHandRow[]> {
    const query = buildQuery(params)
    return apiJsonData<StockOnHandRow[]>(`${API_BASE}/v1/reports/stock-on-hand${query}`, {
        headers: getAssetHeaders()
    })
}

export async function reportStockAvailable(params: { warehouseId?: string; itemId?: string; limit?: number } = {}): Promise<StockAvailableRow[]> {
    const query = buildQuery(params)
    return apiJsonData<StockAvailableRow[]>(`${API_BASE}/v1/reports/stock-available${query}`, {
        headers: getAssetHeaders()
    })
}

export async function reportReorderAlerts(params: { warehouseId?: string; itemId?: string; limit?: number } = {}): Promise<ReorderAlertRow[]> {
    const query = buildQuery(params)
    return apiJsonData<ReorderAlertRow[]>(`${API_BASE}/v1/reports/reorder-alerts${query}`, {
        headers: getAssetHeaders()
    })
}

export async function reportFefoLots(params: { warehouseId?: string; daysThreshold?: number; limit?: number } = {}): Promise<FefoLotRow[]> {
    const query = buildQuery(params)
    return apiJsonData<FefoLotRow[]>(`${API_BASE}/v1/reports/fefo-lots${query}`, {
        headers: getAssetHeaders()
    })
}

export async function reportValuation(params: { warehouseId?: string; currencyId?: string; limit?: number } = {}): Promise<ValuationResult> {
    const query = buildQuery(params)
    return apiJsonData<ValuationResult>(`${API_BASE}/v1/reports/valuation${query}`, { headers: getAssetHeaders() })
}

// ── Ops Attachments (stock documents & asset models) ──────────────────────────

export type OpsAttachment = {
    id: string
    entityType: string
    entityId: string
    fileName: string
    mimeType: string | null
    storageKey: string
    sizeBytes: number | null
    version: number
    uploadedBy: string | null
    createdAt: string
}

function makeOpsAttachmentUrl(entityPrefix: string, entityId: string, suffix = ''): string {
    return `${API_BASE}/v1/${entityPrefix}/${entityId}/attachments${suffix}`
}

async function uploadOpsAttachment(entityPrefix: string, entityId: string, file: File): Promise<OpsAttachment> {
    const formData = new FormData()
    formData.append('file', file)
    const res = await fetch(makeOpsAttachmentUrl(entityPrefix, entityId), {
        method: 'POST',
        headers: getAssetHeaders(),
        body: formData
    })
    if (!res.ok) throw new Error(await res.text())
    const json = await res.json()
    return json.data
}

async function listOpsAttachments(entityPrefix: string, entityId: string): Promise<OpsAttachment[]> {
    const res = await fetch(makeOpsAttachmentUrl(entityPrefix, entityId), { headers: getAssetHeaders() })
    if (!res.ok) throw new Error(await res.text())
    const json = await res.json()
    return json.data ?? []
}

function getOpsAttachmentDownloadUrl(entityPrefix: string, entityId: string, attachmentId: string): string {
    return makeOpsAttachmentUrl(entityPrefix, entityId, `/${attachmentId}/download`)
}

async function deleteOpsAttachment(entityPrefix: string, entityId: string, attachmentId: string): Promise<void> {
    const res = await fetch(makeOpsAttachmentUrl(entityPrefix, entityId, `/${attachmentId}`), {
        method: 'DELETE',
        headers: getAssetHeaders()
    })
    if (!res.ok) throw new Error(await res.text())
}

// Stock document attachments (invoices, delivery notes, etc.)
export const uploadStockDocAttachment = (docId: string, file: File) =>
    uploadOpsAttachment('stock-documents', docId, file)
export const listStockDocAttachments = (docId: string) =>
    listOpsAttachments('stock-documents', docId)
export const getStockDocAttachmentUrl = (docId: string, attachmentId: string) =>
    getOpsAttachmentDownloadUrl('stock-documents', docId, attachmentId)
export const deleteStockDocAttachment = (docId: string, attachmentId: string) =>
    deleteOpsAttachment('stock-documents', docId, attachmentId)

// Asset model attachments (product images, spec sheets, etc.)
export const uploadAssetModelAttachment = (modelId: string, file: File) =>
    uploadOpsAttachment('asset-models', modelId, file)
export const listAssetModelAttachments = (modelId: string) =>
    listOpsAttachments('asset-models', modelId)
export const getAssetModelAttachmentUrl = (modelId: string, attachmentId: string) =>
    getOpsAttachmentDownloadUrl('asset-models', modelId, attachmentId)
export const deleteAssetModelAttachment = (modelId: string, attachmentId: string) =>
    deleteOpsAttachment('asset-models', modelId, attachmentId)
