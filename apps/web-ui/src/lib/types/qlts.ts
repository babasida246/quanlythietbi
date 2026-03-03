export interface PurchaseSuggestion {
    modelId: string
    modelName: string
    categoryId: string
    categoryName: string
    currentStock: number
    minStockQty: number
    avgDailyConsumption: number
    avgWeeklyConsumption: number
    leadTimeDays: number
    daysUntilStockout: number
    suggestedQuantity: number
    priority: 'critical' | 'high' | 'medium' | 'low'
    reason: string
}

export type PurchasePlanStatus = 'draft' | 'submitted' | 'approved' | 'rejected' | 'posted' | 'cancelled'

export interface PurchasePlanLine {
    lineNo: number
    modelId?: string
    modelName: string
    categoryId?: string
    quantity: number
    unit?: string
    estimatedCost: number
    suggestionReason?: string
    currentStock?: number
    minStock?: number
    daysUntilStockout?: number
    priority?: 'critical' | 'high' | 'medium' | 'low'
    note?: string
}

export interface PurchasePlanDoc {
    id: string
    docNo: string
    docDate: Date
    fiscalYear: number
    orgUnitId?: string
    orgUnitName?: string
    requiredByDate?: Date
    totalCost: number
    currency: string
    status: PurchasePlanStatus
    createdBy: string
    createdAt: Date
    submittedBy?: string
    submittedAt?: Date
    approvedBy?: string
    approvedAt?: Date
    postedBy?: string
    postedAt?: Date
    purpose?: string
    note?: string
    lines: PurchasePlanLine[]
}

export type AssetIncreaseStatus = 'draft' | 'submitted' | 'approved' | 'rejected' | 'posted' | 'cancelled'

export type IncreaseType = 'purchase' | 'donation' | 'transfer_in' | 'found' | 'other'

export interface AssetIncreaseLine {
    lineNo: number
    assetCode?: string
    assetName: string
    categoryId?: string
    modelId?: string
    serialNumber?: string
    quantity: number
    unit?: string
    originalCost: number
    currentValue?: number
    locationId?: string
    locationName?: string
    custodianId?: string
    custodianName?: string
    acquisitionDate?: Date
    inServiceDate?: Date
    warrantyEndDate?: Date
    specs?: Record<string, unknown>
    note?: string
    assetId?: string
}

export interface AssetIncreaseDoc {
    id: string
    docNo: string
    docDate: Date
    increaseType: IncreaseType
    orgUnitId?: string
    orgUnitName?: string
    vendorId?: string
    vendorName?: string
    invoiceNo?: string
    invoiceDate?: Date
    totalCost?: number
    currency: string
    status: AssetIncreaseStatus
    createdBy: string
    createdAt: Date
    submittedBy?: string
    submittedAt?: Date
    approvedBy?: string
    approvedAt?: Date
    postedBy?: string
    postedAt?: Date
    purchasePlanDocId?: string
    note?: string
    lines: AssetIncreaseLine[]
}
