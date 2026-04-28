import { API_BASE, apiJson, authorizedFetch } from './httpClient'
import { buildQuery, getAssetHeaders, type AssetStatus, type MaintenanceTicket } from './assets'

export type AssetImportRow = {
    assetCode: string
    modelId: string
    status?: AssetStatus
    locationId?: string
    vendorId?: string
    serialNo?: string
    macAddress?: string
    mgmtIp?: string
    hostname?: string
    vlanId?: number
    switchName?: string
    switchPort?: string
    purchaseDate?: string
    warrantyEnd?: string
    notes?: string
}

export type AssetImportPreview = {
    items: { row: AssetImportRow; valid: boolean; errors: string[]; existingId?: string }[]
    total: number
    validCount: number
    invalidCount: number
}

export type AssetImportCommitResult = { created: number; updated: number; skipped: number }

export type Attachment = {
    id: string
    assetId: string
    fileName: string
    mimeType?: string | null
    storageKey: string
    sizeBytes?: number | null
    version: number
    createdAt: string
}

export type InventorySession = {
    id: string
    name: string
    locationId?: string | null
    status: 'draft' | 'in_progress' | 'closed' | 'canceled'
    createdAt: string
    startedAt?: string | null
    closedAt?: string | null
}

export type InventoryItem = {
    id: string
    sessionId: string
    assetId?: string | null
    assetCode?: string | null
    assetName?: string | null
    expectedLocationId?: string | null
    scannedLocationId?: string | null
    scannedLocationName?: string | null
    scannedAt?: string | null
    status: 'found' | 'missing' | 'moved' | 'unknown'
    note?: string | null
}

export type MissingAsset = {
    id: string
    assetCode: string
    name?: string | null
    locationId?: string | null
    locationName?: string | null
    status: string
}

export type Reminder = {
    id: string
    reminderType: 'warranty_expiring' | 'maintenance_due'
    assetId?: string | null
    dueAt: string
    status: 'pending' | 'sent' | 'canceled'
    channel: string
    createdAt: string
}

type ApiResponse<T> = { data: T; meta?: { total?: number; page?: number; limit?: number } }

export async function previewAssetImport(rows: AssetImportRow[]): Promise<ApiResponse<AssetImportPreview>> {
    return apiJson<ApiResponse<AssetImportPreview>>(`${API_BASE}/v1/assets/import/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAssetHeaders() },
        body: JSON.stringify({ rows })
    })
}

export async function commitAssetImport(rows: AssetImportRow[]): Promise<ApiResponse<AssetImportCommitResult>> {
    return apiJson<ApiResponse<AssetImportCommitResult>>(`${API_BASE}/v1/assets/import/commit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAssetHeaders() },
        body: JSON.stringify({ rows })
    })
}

export async function listMaintenanceTickets(params: { status?: string; page?: number; limit?: number } = {}): Promise<ApiResponse<MaintenanceTicket[]>> {
    const query = buildQuery(params)
    return apiJson<ApiResponse<MaintenanceTicket[]>>(`${API_BASE}/v1/maintenance${query}`, {
        headers: getAssetHeaders()
    })
}

export async function updateMaintenanceTicketStatus(
    ticketId: string,
    input: {
        status: MaintenanceTicket['status']
        diagnosis?: string
        resolution?: string
        closedAt?: string
    }
): Promise<ApiResponse<MaintenanceTicket>> {
    return apiJson<ApiResponse<MaintenanceTicket>>(`${API_BASE}/v1/maintenance/${ticketId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getAssetHeaders() },
        body: JSON.stringify(input)
    })
}

export async function deleteMaintenanceTicket(ticketId: string): Promise<ApiResponse<MaintenanceTicket>> {
    return apiJson<ApiResponse<MaintenanceTicket>>(`${API_BASE}/v1/maintenance/${ticketId}`, {
        method: 'DELETE',
        headers: getAssetHeaders()
    })
}

export async function listInventorySessions(params: { status?: string; page?: number; limit?: number } = {}): Promise<ApiResponse<InventorySession[]>> {
    const query = buildQuery(params)
    return apiJson<ApiResponse<InventorySession[]>>(`${API_BASE}/v1/inventory/sessions${query}`, {
        headers: getAssetHeaders()
    })
}

export async function createInventorySession(input: { name: string; locationId?: string }): Promise<ApiResponse<InventorySession>> {
    return apiJson<ApiResponse<InventorySession>>(`${API_BASE}/v1/inventory/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAssetHeaders() },
        body: JSON.stringify(input)
    })
}

export async function getInventorySessionDetail(id: string): Promise<ApiResponse<{ session: InventorySession; items: InventoryItem[] }>> {
    return apiJson<ApiResponse<{ session: InventorySession; items: InventoryItem[] }>>(`${API_BASE}/v1/inventory/sessions/${id}`, {
        headers: getAssetHeaders()
    })
}

export async function scanInventoryAsset(sessionId: string, input: { assetId?: string; assetCode?: string; scannedLocationId?: string; note?: string }): Promise<ApiResponse<InventoryItem>> {
    return apiJson<ApiResponse<InventoryItem>>(`${API_BASE}/v1/inventory/sessions/${sessionId}/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAssetHeaders() },
        body: JSON.stringify(input)
    })
}

export async function closeInventorySession(sessionId: string): Promise<ApiResponse<{ session: InventorySession; counts: Record<string, number> }>> {
    return apiJson<ApiResponse<{ session: InventorySession; counts: Record<string, number> }>>(`${API_BASE}/v1/inventory/sessions/${sessionId}/close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAssetHeaders() }
    })
}

export async function startInventorySession(sessionId: string): Promise<ApiResponse<InventorySession>> {
    return apiJson<ApiResponse<InventorySession>>(`${API_BASE}/v1/inventory/sessions/${sessionId}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAssetHeaders() }
    })
}

export async function undoInventoryScan(sessionId: string, itemId: string): Promise<void> {
    await authorizedFetch(`${API_BASE}/v1/inventory/sessions/${sessionId}/scans/${itemId}`, {
        method: 'DELETE',
        headers: getAssetHeaders()
    })
}

export async function getInventoryReport(sessionId: string): Promise<ApiResponse<{ session: InventorySession; items: InventoryItem[]; counts: Record<string, number> }>> {
    return apiJson<ApiResponse<{ session: InventorySession; items: InventoryItem[]; counts: Record<string, number> }>>(`${API_BASE}/v1/inventory/sessions/${sessionId}/report`, {
        headers: getAssetHeaders()
    })
}

export async function getMissingInventoryAssets(sessionId: string): Promise<ApiResponse<MissingAsset[]>> {
    return apiJson<ApiResponse<MissingAsset[]>>(`${API_BASE}/v1/inventory/sessions/${sessionId}/missing`, {
        headers: getAssetHeaders()
    })
}

export async function listReminders(params: { status?: string; reminderType?: string; page?: number; limit?: number } = {}): Promise<ApiResponse<Reminder[]>> {
    const query = buildQuery(params)
    return apiJson<ApiResponse<Reminder[]>>(`${API_BASE}/v1/assets/reminders${query}`, {
        headers: getAssetHeaders()
    })
}

export async function runWarrantyReminders(days?: number[]): Promise<ApiResponse<{ created: number }>> {
    return apiJson<ApiResponse<{ created: number }>>(`${API_BASE}/v1/assets/reminders/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAssetHeaders() },
        body: JSON.stringify({ days })
    })
}

export async function listAttachments(assetId: string): Promise<ApiResponse<Attachment[]>> {
    return apiJson<ApiResponse<Attachment[]>>(`${API_BASE}/v1/assets/${assetId}/attachments`, {
        headers: getAssetHeaders()
    })
}

export async function uploadAttachment(assetId: string, file: File): Promise<ApiResponse<Attachment>> {
    const formData = new FormData()
    formData.append('file', file)
    const response = await authorizedFetch(`${API_BASE}/v1/assets/${assetId}/attachments`, {
        method: 'POST',
        headers: getAssetHeaders(),
        body: formData
    })
    if (!response.ok) {
        throw new Error(await response.text())
    }
    return response.json()
}

export function getAttachmentDownloadUrl(assetId: string, attachmentId: string): string {
    return `${API_BASE}/v1/assets/${assetId}/attachments/${attachmentId}/download`
}

export interface VerifyScanResult {
    match: boolean
    asset?: {
        id: string
        assetCode: string
        name: string
        status: string
        modelName?: string | null
    }
    lineId?: string | null
    lineNo?: number | null
    lineStatus?: string | null
    message?: string
}

export async function verifyScan(
    requestId: string,
    scannedCode: string,
    scanType: 'barcode' | 'ocr' | 'manual' = 'barcode'
): Promise<{ success: boolean; data: VerifyScanResult }> {
    return apiJson(`${API_BASE}/v1/assets/verify-scan`, {
        method: 'POST',
        body: JSON.stringify({ requestId, scannedCode, scanType })
    })
}
