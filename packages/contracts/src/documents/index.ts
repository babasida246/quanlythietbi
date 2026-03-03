// Purchase Planning & Asset Input Documents - Type Definitions
// Part of simplified asset management system

export const PurchasePlanStatusValues = ['draft', 'submitted', 'approved', 'rejected', 'posted', 'cancelled'] as const
export type PurchasePlanStatus = typeof PurchasePlanStatusValues[number]

export const AssetIncreaseStatusValues = ['draft', 'submitted', 'approved', 'rejected', 'posted', 'cancelled'] as const
export type AssetIncreaseStatus = typeof AssetIncreaseStatusValues[number]

export const WorkflowDecisionValues = ['approved', 'rejected'] as const
export type WorkflowDecision = typeof WorkflowDecisionValues[number]

export const PurchasePriorityValues = ['high', 'medium', 'low'] as const
export type PurchasePriority = typeof PurchasePriorityValues[number]

export const SuggestionReasonValues = ['low_stock', 'high_consumption', 'manual', 'seasonal'] as const
export type SuggestionReason = typeof SuggestionReasonValues[number]

export const IncreaseTypeValues = ['purchase', 'donation', 'transfer_in', 'found', 'reclass', 'other'] as const
export type IncreaseType = typeof IncreaseTypeValues[number]

// ============================================
// APPROVALS
// ============================================
export interface ApprovalRecord {
    id: string
    entityType: string // 'purchase_plan' | 'asset_increase'
    entityId: string
    stepNo: number
    approverId: string
    approverName?: string | null
    decision?: WorkflowDecision | null
    note?: string | null
    decidedAt?: Date | null
    createdAt: Date
}

export interface ApprovalInput {
    entityType: string
    entityId: string
    stepNo: number
    approverId: string
    approverName?: string | null
}

export interface ApprovalDecisionInput {
    decision: WorkflowDecision
    note?: string | null
}

// ============================================
// PURCHASE PLANS
// ============================================
export interface PurchasePlanDoc {
    id: string
    docNo: string
    docDate: Date
    fiscalYear: number
    orgUnitId?: string | null
    orgUnitName?: string | null
    title: string
    description?: string | null
    totalEstimatedCost?: number | null
    currency: string
    status: PurchasePlanStatus

    createdBy: string
    createdAt: Date
    submittedBy?: string | null
    submittedAt?: Date | null
    approvedBy?: string | null
    approvedAt?: Date | null
    postedBy?: string | null
    postedAt?: Date | null
    cancelledBy?: string | null
    cancelledAt?: Date | null
    updatedAt: Date

    attachments?: unknown[]
    metadata?: Record<string, unknown>

    // Populated relations
    lines?: PurchasePlanLine[]
    approvals?: ApprovalRecord[]
}

export interface PurchasePlanLine {
    id: string
    docId: string
    lineNo: number

    modelId?: string | null
    categoryId?: string | null
    itemDescription: string
    quantity: number
    unit?: string | null
    estimatedUnitCost?: number | null
    estimatedTotalCost?: number | null

    // Suggestion data
    suggestionReason?: SuggestionReason | null
    currentStock?: number | null
    minStock?: number | null
    avgConsumption?: number | null
    daysUntilStockout?: number | null

    fundingSource?: string | null
    purpose?: string | null
    expectedDeliveryDate?: Date | null
    usingDept?: string | null
    priority: PurchasePriority

    specs?: Record<string, unknown>
    note?: string | null

    createdAt: Date

    // Populated
    modelName?: string | null
    categoryName?: string | null
}

export interface PurchasePlanDocInput {
    docDate: Date
    fiscalYear: number
    orgUnitId?: string | null
    orgUnitName?: string | null
    title: string
    description?: string | null
    currency?: string
}

export interface PurchasePlanLineInput {
    lineNo: number
    modelId?: string | null
    categoryId?: string | null
    itemDescription: string
    quantity: number
    unit?: string | null
    estimatedUnitCost?: number | null

    suggestionReason?: SuggestionReason | null
    currentStock?: number | null
    minStock?: number | null
    avgConsumption?: number | null
    daysUntilStockout?: number | null

    fundingSource?: string | null
    purpose?: string | null
    expectedDeliveryDate?: Date | null
    usingDept?: string | null
    priority?: PurchasePriority

    specs?: Record<string, unknown>
    note?: string | null
}

export interface PurchasePlanCreateInput extends PurchasePlanDocInput {
    lines: PurchasePlanLineInput[]
}

export interface PurchasePlanUpdateInput {
    docDate?: Date
    orgUnitId?: string | null
    orgUnitName?: string | null
    title?: string
    description?: string | null
    lines?: PurchasePlanLineInput[]
}

// ============================================
// ASSET INCREASE DOCUMENTS
// ============================================
export interface AssetIncreaseDoc {
    id: string
    docNo: string
    docDate: Date

    increaseType: IncreaseType
    orgUnitId?: string | null
    orgUnitName?: string | null

    vendorId?: string | null
    vendorName?: string | null
    invoiceNo?: string | null
    invoiceDate?: Date | null

    totalCost?: number | null
    currency: string

    status: AssetIncreaseStatus

    createdBy: string
    createdAt: Date
    submittedBy?: string | null
    submittedAt?: Date | null
    approvedBy?: string | null
    approvedAt?: Date | null
    postedBy?: string | null
    postedAt?: Date | null
    cancelledBy?: string | null
    cancelledAt?: Date | null
    updatedAt: Date

    purchasePlanDocId?: string | null

    note?: string | null
    attachments?: unknown[]
    metadata?: Record<string, unknown>

    // Populated
    lines?: AssetIncreaseLine[]
    approvals?: ApprovalRecord[]
}

export interface AssetIncreaseLine {
    id: string
    docId: string
    lineNo: number

    assetCode?: string | null
    assetName: string
    categoryId?: string | null
    modelId?: string | null

    serialNumber?: string | null
    quantity: number
    unit?: string | null

    originalCost: number
    currentValue?: number | null

    locationId?: string | null
    locationName?: string | null
    custodianId?: string | null
    custodianName?: string | null

    acquisitionDate?: Date | null
    inServiceDate?: Date | null
    warrantyEndDate?: Date | null

    specs?: Record<string, unknown>
    note?: string | null

    // After posting
    assetId?: string | null

    createdAt: Date

    // Populated
    categoryName?: string | null
    modelName?: string | null
}

export interface AssetIncreaseDocInput {
    docDate: Date
    increaseType: IncreaseType
    orgUnitId?: string | null
    orgUnitName?: string | null
    vendorId?: string | null
    invoiceNo?: string | null
    invoiceDate?: Date | null
    currency?: string
    purchasePlanDocId?: string | null
    note?: string | null
}

export interface AssetIncreaseLineInput {
    lineNo: number
    assetCode?: string | null
    assetName: string
    categoryId?: string | null
    modelId?: string | null
    serialNumber?: string | null
    quantity?: number
    unit?: string | null
    originalCost: number
    currentValue?: number | null
    locationId?: string | null
    locationName?: string | null
    custodianId?: string | null
    custodianName?: string | null
    acquisitionDate?: Date | null
    inServiceDate?: Date | null
    warrantyEndDate?: Date | null
    specs?: Record<string, unknown>
    note?: string | null
}

export interface AssetIncreaseCreateInput extends AssetIncreaseDocInput {
    lines: AssetIncreaseLineInput[]
}

export interface AssetIncreaseUpdateInput {
    docDate?: Date
    increaseType?: IncreaseType
    orgUnitId?: string | null
    orgUnitName?: string | null
    vendorId?: string | null
    invoiceNo?: string | null
    invoiceDate?: Date | null
    note?: string | null
    lines?: AssetIncreaseLineInput[]
}

// ============================================
// PURCHASE SUGGESTIONS
// ============================================
export interface PurchaseSuggestion {
    modelId: string
    modelName: string
    categoryId?: string | null
    categoryName?: string | null

    currentStock: number
    minStock: number
    avgDailyConsumption: number
    avgWeeklyConsumption: number
    leadTimeDays: number

    daysUntilStockout: number
    suggestedQty: number
    reason: SuggestionReason
    priority: PurchasePriority
    urgency: number // 0-100
}

// ============================================
// REPOSITORY INTERFACES
// ============================================
export interface IPurchasePlanRepo {
    create(input: PurchasePlanCreateInput, createdBy: string): Promise<PurchasePlanDoc>
    getById(id: string): Promise<PurchasePlanDoc | null>
    getByDocNo(docNo: string): Promise<PurchasePlanDoc | null>
    update(id: string, input: PurchasePlanUpdateInput): Promise<PurchasePlanDoc>
    updateStatus(id: string, status: PurchasePlanStatus, actor: string): Promise<void>
    list(filters: {
        status?: PurchasePlanStatus
        fiscalYear?: number
        orgUnitId?: string
        page?: number
        limit?: number
    }): Promise<{ items: PurchasePlanDoc[]; total: number }>
}

export interface IAssetIncreaseRepo {
    create(input: AssetIncreaseCreateInput, createdBy: string): Promise<AssetIncreaseDoc>
    getById(id: string): Promise<AssetIncreaseDoc | null>
    getByDocNo(docNo: string): Promise<AssetIncreaseDoc | null>
    update(id: string, input: AssetIncreaseUpdateInput): Promise<AssetIncreaseDoc>
    updateStatus(id: string, status: AssetIncreaseStatus, actor: string): Promise<void>
    list(filters: {
        status?: AssetIncreaseStatus
        increaseType?: IncreaseType
        fromDate?: Date
        toDate?: Date
        page?: number
        limit?: number
    }): Promise<{ items: AssetIncreaseDoc[]; total: number }>
}

export interface IApprovalRepo {
    create(input: ApprovalInput): Promise<ApprovalRecord>
    getByEntity(entityType: string, entityId: string): Promise<ApprovalRecord[]>
    getPendingForApprover(approverId: string): Promise<ApprovalRecord[]>
    updateDecision(id: string, input: ApprovalDecisionInput, actorId?: string): Promise<ApprovalRecord>
}
