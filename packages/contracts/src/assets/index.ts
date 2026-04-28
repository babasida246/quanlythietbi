export type {
    AssetStatus,
    AssigneeType,
    MaintenanceSeverity,
    MaintenanceStatus,
    AssetEventType,
    InventorySessionStatus,
    InventoryItemStatus,
} from '@qltb/domain'
import type { AssetStatus, AssigneeType, MaintenanceSeverity, MaintenanceStatus, AssetEventType } from '@qltb/domain'

export const AssetSortValues = ['newest', 'asset_code_asc', 'asset_code_desc', 'warranty_end_asc'] as const
export type AssetSort = typeof AssetSortValues[number]

export interface AssetSearchFilters {
    query?: string
    status?: AssetStatus
    categoryId?: string
    modelId?: string
    vendorId?: string
    locationId?: string
    warehouseId?: string
    organizationId?: string
    warrantyExpiringDays?: number
    page?: number
    limit?: number
    sort?: AssetSort
}

export interface AssetSearchResult {
    items: AssetRecord[]
    total: number
    page: number
    limit: number
}

export interface AssetRecord {
    id: string
    assetCode: string
    modelId?: string | null
    categoryId?: string | null
    serialNo?: string | null
    macAddress?: string | null
    mgmtIp?: string | null
    hostname?: string | null
    vlanId?: number | null
    switchName?: string | null
    switchPort?: string | null
    locationId?: string | null
    warehouseId?: string | null
    status?: AssetStatus
    purchaseDate?: Date | null
    warrantyEnd?: Date | null
    vendorId?: string | null
    modelName?: string | null
    modelBrand?: string | null
    categoryName?: string | null
    vendorName?: string | null
    locationName?: string | null
    warehouseName?: string | null
    notes?: string | null
    spec?: Record<string, unknown> | null
    createdAt: Date
    updatedAt: Date
}

export interface AssetUpsertFields {
    assetCode: string
    modelId: string
    serialNo?: string | null
    macAddress?: string | null
    mgmtIp?: string | null
    hostname?: string | null
    vlanId?: number | null
    switchName?: string | null
    switchPort?: string | null
    locationId?: string | null
    warehouseId?: string | null
    status: AssetStatus
    purchaseDate?: Date | null
    warrantyEnd?: Date | null
    vendorId?: string | null
    notes?: string | null
    spec?: Record<string, unknown> | null
    /** Unit cost / acquisition cost (set from receipt line) */
    unitCost?: number | null
    /** FK to the stock_document_line that created this asset (receipt flow) */
    sourceDocLineId?: string | null
}

export type AssetCreateInput = AssetUpsertFields

export type AssetUpdatePatch = Partial<Omit<AssetUpsertFields, 'assetCode'>> & {
    assetCode?: string
}

export type AssignmentVerificationMethod = 'manual' | 'barcode' | 'ocr'

export interface AssetAssignmentRecord {
    id: string
    assetId: string
    assigneeType: AssigneeType
    assigneeId?: string | null
    assigneeName: string
    assignedAt: Date
    returnedAt?: Date | null
    note?: string | null
    locationId?: string | null
    organizationId?: string | null
    verificationMethod?: AssignmentVerificationMethod | null
    verifiedAt?: Date | null
    wfRequestId?: string | null
}

export interface AssetAssignmentInput {
    assigneeType: AssigneeType
    assigneeId: string
    assigneeName: string
    assignedAt?: Date
    note?: string | null
    locationId?: string | null
    organizationId?: string | null
    verificationMethod?: AssignmentVerificationMethod | null
    verifiedAt?: Date | null
    wfRequestId?: string | null
}

export interface AssignmentReturnOpts {
    note?: string | null
    verificationMethod?: AssignmentVerificationMethod | null
    verifiedAt?: Date | null
    wfRequestId?: string | null
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

export interface MaintenanceTicketRecord {
    id: string
    assetId: string
    title: string
    severity: MaintenanceSeverity
    status: MaintenanceStatus
    openedAt: Date
    closedAt?: Date | null
    diagnosis?: string | null
    resolution?: string | null
    createdBy?: string | null
    correlationId?: string | null
}

export interface MaintenanceTicketInput {
    assetId: string
    title: string
    severity: MaintenanceSeverity
    status?: MaintenanceStatus
    openedAt?: Date
    diagnosis?: string | null
    resolution?: string | null
    createdBy?: string | null
    correlationId?: string | null
}

export interface MaintenanceTicketStatusPatch {
    closedAt?: Date | null
    diagnosis?: string | null
    resolution?: string | null
    correlationId?: string | null
}

export interface AssetEventRecord {
    id: string
    assetId: string
    eventType: AssetEventType
    payload: Record<string, unknown>
    actorUserId?: string | null
    correlationId?: string | null
    createdAt: Date
}

export type AssetEventInput = Omit<AssetEventRecord, 'id' | 'createdAt'>

export interface AssetEventPage {
    items: AssetEventRecord[]
    page: number
    limit: number
}

export interface IAssetRepo {
    create(asset: AssetCreateInput): Promise<AssetRecord>
    update(id: string, patch: AssetUpdatePatch): Promise<AssetRecord>
    getById(id: string): Promise<AssetRecord | null>
    getByAssetCode(assetCode: string): Promise<AssetRecord | null>
    delete(id: string): Promise<boolean>
    search(filters: AssetSearchFilters): Promise<AssetSearchResult>
    bulkUpsert(items: AssetBulkUpsertInput[]): Promise<AssetBulkUpsertResult>
}

export interface IAssignmentRepo {
    assign(assetId: string, assignment: AssetAssignmentInput): Promise<AssetAssignmentRecord>
    return(assetId: string, returnedAt: Date, opts?: AssignmentReturnOpts | string): Promise<AssetAssignmentRecord | null>
    listByAsset(assetId: string): Promise<AssetAssignmentRecord[]>
    getActiveByAsset(assetId: string): Promise<AssetAssignmentRecord | null>
}

export interface IMaintenanceRepo {
    open(ticket: MaintenanceTicketInput): Promise<MaintenanceTicketRecord>
    updateStatus(
        ticketId: string,
        status: MaintenanceStatus,
        patch: MaintenanceTicketStatusPatch
    ): Promise<MaintenanceTicketRecord | null>
    list(filters: { assetId?: string; status?: MaintenanceStatus; page?: number; limit?: number }): Promise<{
        items: MaintenanceTicketRecord[]
        total: number
        page: number
        limit: number
    }>
    getById(ticketId: string): Promise<MaintenanceTicketRecord | null>
}

export interface IAssetEventRepo {
    append(event: AssetEventInput): Promise<AssetEventRecord>
    listByAsset(assetId: string, page: number, limit: number): Promise<AssetEventPage>
}

export interface AssetBulkUpsertInput extends AssetUpsertFields {
    assetCode: string
}

export interface AssetBulkUpsertResult {
    created: number
    updated: number
    items: AssetRecord[]
}

export type AssetImportRow = Omit<AssetUpsertFields, 'status'> & {
    status?: AssetStatus
}

export interface AssetImportPreviewItem {
    row: AssetImportRow
    valid: boolean
    errors: string[]
    existingId?: string
}

export interface AssetImportPreviewResult {
    items: AssetImportPreviewItem[]
    total: number
    validCount: number
    invalidCount: number
}

export interface AssetImportCommitResult {
    created: number
    updated: number
    skipped: number
}

export * from './catalogs.js'
export * from './categorySpecs.js'
export * from './attachments.js'
export * from './inventory.js'
export * from './workflow.js'
export * from './reminders.js'
