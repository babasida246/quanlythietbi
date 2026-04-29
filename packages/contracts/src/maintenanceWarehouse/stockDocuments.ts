export type StockDocType = 'receipt' | 'issue' | 'adjust' | 'transfer' | 'return'
export type StockDocStatus = 'draft' | 'submitted' | 'approved' | 'posted' | 'canceled'

export interface StockDocumentRecord {
    id: string
    docType: StockDocType
    code: string
    status: StockDocStatus
    warehouseId?: string | null
    targetWarehouseId?: string | null
    docDate: string
    refType?: string | null
    refId?: string | null
    /** Direct FK to wf_requests(id) — populated when doc is auto-generated from a WF request */
    refRequestId?: string | null
    note?: string | null
    idempotencyKey?: string | null
    /** Supplier/vendor name (used in receipt) */
    supplier?: string | null
    /** Name of person submitting the receipt */
    submitterName?: string | null
    /** Name of person receiving an issue */
    receiverName?: string | null
    /** Deprecated free-text department snapshot (kept for backward compatibility) */
    department?: string | null
    /** Recipient OU (org_units.id) linked to RBAC OU tree */
    recipientOuId?: string | null
    /** Destination location for issue documents (where assets are deployed) */
    locationId?: string | null
    /** Filter nhóm vật tư: 'asset' | 'spare_part' | 'consumable' */
    itemGroup?: string | null
    /** FK to equipment_groups(id) — links document to Nhóm vật tư catalog */
    equipmentGroupId?: string | null
    createdBy?: string | null
    approvedBy?: string | null
    correlationId?: string | null
    createdAt: string
    updatedAt: string
}

export type StockDocLineType = 'qty' | 'serial'

export interface StockDocumentLineRecord {
    id: string
    documentId: string
    lineType: StockDocLineType
    qty: number
    unitCost?: number | null
    serialNo?: string | null
    note?: string | null
    adjustDirection?: 'plus' | 'minus' | null
    /** Additional spec key-value pairs from the spare part catalog */
    specFields?: Record<string, unknown> | null
    /** Spare-part lines use this FK */
    partId?: string | null
    /** Asset lines (receipt): model to use when auto-creating the asset */
    assetModelId?: string | null
    assetCategoryId?: string | null
    assetName?: string | null
    /** Explicit asset code; auto-generated if omitted */
    assetCode?: string | null
    /** Asset lines (issue): the specific in-stock asset to deploy.
     *  Asset lines (receipt): populated after posting with the created asset id. */
    assetId?: string | null
    /** Resolved from asset_models JOIN — display-only, not stored in the line itself */
    resolvedModelName?: string | null
    resolvedModelUom?: string | null
    resolvedCategoryName?: string | null
}

export interface StockDocumentLineInput {
    lineType?: StockDocLineType
    qty: number
    unitCost?: number | null
    serialNo?: string | null
    note?: string | null
    adjustDirection?: 'plus' | 'minus' | null
    /** Additional spec key-value pairs from the spare part catalog */
    specFields?: Record<string, unknown> | null
    /** Spare-part lines only */
    partId?: string | null
    /** Asset lines only */
    assetModelId?: string | null
    assetCategoryId?: string | null
    assetName?: string | null
    assetCode?: string | null
    assetId?: string | null
}

export interface StockDocumentDetail {
    document: StockDocumentRecord
    lines: StockDocumentLineRecord[]
}

export interface StockDocumentCreateInput {
    docType: StockDocType
    code: string
    warehouseId?: string | null
    targetWarehouseId?: string | null
    docDate?: string
    refType?: string | null
    refId?: string | null
    /** Direct FK to wf_requests(id) */
    refRequestId?: string | null
    note?: string | null
    supplier?: string | null
    submitterName?: string | null
    receiverName?: string | null
    department?: string | null
    recipientOuId?: string | null
    /** Destination location for issue documents */
    locationId?: string | null
    /** Filter nhóm vật tư: 'asset' | 'spare_part' | 'consumable' */
    itemGroup?: string | null
    /** FK to equipment_groups(id) */
    equipmentGroupId?: string | null
    createdBy?: string | null
    correlationId?: string | null
}

export interface StockDocumentUpdatePatch {
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
    /** Filter nhóm vật tư: 'asset' | 'spare_part' | 'consumable' */
    itemGroup?: string | null
    /** FK to equipment_groups(id) */
    equipmentGroupId?: string | null
    correlationId?: string | null
}

export interface StockDocumentListFilters {
    docType?: StockDocType
    docTypes?: StockDocType[]
    status?: StockDocStatus
    warehouseId?: string
    itemGroup?: string
    from?: string
    to?: string
    page?: number
    limit?: number
}

export interface StockDocumentPage {
    items: StockDocumentRecord[]
    total: number
    page: number
    limit: number
}

export interface IStockDocumentRepo {
    create(input: StockDocumentCreateInput): Promise<StockDocumentRecord>
    findByRefRequest(requestId: string, docType?: StockDocType): Promise<StockDocumentRecord | null>
    update(id: string, patch: StockDocumentUpdatePatch): Promise<StockDocumentRecord | null>
    getById(id: string): Promise<StockDocumentRecord | null>
    list(filters: StockDocumentListFilters): Promise<StockDocumentPage>
    listLines(documentId: string): Promise<StockDocumentLineRecord[]>
    replaceLines(documentId: string, lines: StockDocumentLineInput[]): Promise<StockDocumentLineRecord[]>
    setStatus(id: string, status: StockDocStatus, approvedBy?: string | null, idempotencyKey?: string | null): Promise<StockDocumentRecord | null>
    /** After posting a receipt, link the auto-created asset back to the line */
    setAssetOnLine(lineId: string, assetId: string): Promise<void>
}
