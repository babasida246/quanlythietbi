import { API_BASE, apiJson, apiJsonData } from './httpClient'
import { buildQuery, getAssetHeaders, type Asset } from './assets'
import type { StockDocType, StockDocStatus, MovementType, RepairStatus, RepairSeverity, RepairType } from '@qltb/contracts'

export type { StockDocType, StockDocStatus, MovementType, RepairStatus, RepairSeverity, RepairType }

export type WarehouseRecord = {
    id: string
    code: string
    name: string
    locationId?: string | null
    createdAt: string
}

export type SparePartRecord = {
    id: string
    partCode: string
    name: string
    category?: string | null
    uom?: string | null
    manufacturer?: string | null
    model?: string | null
    spec: Record<string, unknown>
    minLevel: number
    createdAt: string
}

export type StockViewRecord = {
    warehouseId: string
    warehouseCode: string
    warehouseName: string
    partId: string
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

export type StockDocumentRecord = {
    id: string
    docType: StockDocType
    code: string
    status: StockDocStatus
    warehouseId?: string | null
    targetWarehouseId?: string | null
    docDate: string
    refType?: string | null
    refId?: string | null
    note?: string | null
    supplier?: string | null
    submitterName?: string | null
    receiverName?: string | null
    department?: string | null
    createdBy?: string | null
    approvedBy?: string | null
    correlationId?: string | null
    createdAt: string
    updatedAt: string
}

export type StockDocumentLine = {
    id?: string
    documentId?: string
    partId: string
    qty: number
    unitCost?: number | null
    serialNo?: string | null
    note?: string | null
    adjustDirection?: 'plus' | 'minus' | null
    specFields?: Record<string, unknown> | null
}

export type StockDocumentDetail = {
    document: StockDocumentRecord
    lines: StockDocumentLine[]
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

export type RepairOrderRecord = {
    id: string
    assetId: string
    ciId?: string | null
    code: string
    title: string
    description?: string | null
    severity: RepairSeverity
    status: RepairStatus
    openedAt: string
    closedAt?: string | null
    diagnosis?: string | null
    resolution?: string | null
    repairType: RepairType
    technicianName?: string | null
    vendorId?: string | null
    laborCost?: number | null
    partsCost?: number | null
    downtimeMinutes?: number | null
    createdBy?: string | null
    correlationId?: string | null
    createdAt: string
    updatedAt: string
}

export type RepairOrderPartRecord = {
    id: string
    repairOrderId: string
    partId?: string | null
    partName?: string | null
    warehouseId?: string | null
    action: 'replace' | 'add' | 'remove' | 'upgrade'
    qty: number
    unitCost?: number | null
    serialNo?: string | null
    note?: string | null
    stockDocumentId?: string | null
    createdAt: string
}

export type RepairOrderDetail = {
    order: RepairOrderRecord
    parts: RepairOrderPartRecord[]
}

export type RepairOrderEvent = {
    id: string
    eventType: string
    payload: Record<string, unknown>
    createdAt: string
}

export type RepairOrderSummary = {
    total: number
    activeCount: number
    closedCount: number
    canceledCount: number
    totalLaborCost: number
    totalPartsCost: number
    totalCost: number
    totalDowntimeMinutes: number
    avgDowntimeMinutes: number | null
    avgResolutionHours: number | null
    byStatus: Record<RepairOrderRecord['status'], number>
    bySeverity: Record<RepairOrderRecord['severity'], number>
    byType: Record<RepairOrderRecord['repairType'], number>
}

export type StockDocumentCreateInput = {
    docType: StockDocumentRecord['docType']
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
    lines: StockDocumentLine[]
}

type ApiResponse<T> = { data: T; meta?: { total?: number; page?: number; limit?: number } }

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
    params: { docType?: string; status?: StockDocumentRecord['status']; warehouseId?: string; from?: string; to?: string; page?: number; limit?: number } = {}
): Promise<ApiResponse<StockDocumentRecord[]>> {
    const query = buildQuery(params)
    return apiJson<ApiResponse<StockDocumentRecord[]>>(`${API_BASE}/v1/stock-documents${query}`, {
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
