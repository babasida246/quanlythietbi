export type { PartAction, RepairSeverity, RepairStatus, RepairType } from '@qltb/domain'
import type { PartAction, RepairSeverity, RepairStatus, RepairType } from '@qltb/domain'

export interface RepairOrderRecord {
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

export interface RepairOrderPartRecord {
    id: string
    repairOrderId: string
    modelId?: string | null
    partName?: string | null
    warehouseId?: string | null
    action: PartAction
    qty: number
    unitCost?: number | null
    serialNo?: string | null
    note?: string | null
    stockDocumentId?: string | null
    createdAt: string
}

export interface RepairOrderCreateInput {
    assetId: string
    ciId?: string | null
    title: string
    description?: string | null
    severity: RepairSeverity
    repairType: RepairType
    technicianName?: string | null
    vendorId?: string | null
    laborCost?: number | null
    downtimeMinutes?: number | null
    createdBy?: string | null
    correlationId?: string | null
}

export interface RepairOrderUpdatePatch {
    title?: string
    description?: string | null
    severity?: RepairSeverity
    status?: RepairStatus
    diagnosis?: string | null
    resolution?: string | null
    repairType?: RepairType
    technicianName?: string | null
    vendorId?: string | null
    laborCost?: number | null
    partsCost?: number | null
    downtimeMinutes?: number | null
    closedAt?: string | null
    correlationId?: string | null
    ciId?: string | null
}

export interface RepairOrderFilters {
    assetId?: string
    ciId?: string
    status?: RepairStatus
    q?: string
    from?: string
    to?: string
    page?: number
    limit?: number
}

export interface RepairOrderPage {
    items: RepairOrderRecord[]
    total: number
    page: number
    limit: number
}

export type RepairOrderSummaryFilters = Omit<RepairOrderFilters, 'page' | 'limit'>

export interface RepairOrderSummary {
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
    byStatus: Record<RepairStatus, number>
    bySeverity: Record<RepairSeverity, number>
    byType: Record<RepairType, number>
}

export interface RepairOrderPartInput {
    modelId?: string | null
    partName?: string | null
    warehouseId?: string | null
    action: PartAction
    qty: number
    unitCost?: number | null
    serialNo?: string | null
    note?: string | null
    stockDocumentId?: string | null
}

export interface RepairOrderDetail {
    order: RepairOrderRecord
    parts: RepairOrderPartRecord[]
}

export interface IRepairOrderRepo {
    create(input: RepairOrderCreateInput): Promise<RepairOrderRecord>
    update(id: string, patch: RepairOrderUpdatePatch): Promise<RepairOrderRecord | null>
    getById(id: string): Promise<RepairOrderRecord | null>
    list(filters: RepairOrderFilters): Promise<RepairOrderPage>
    summary(filters: RepairOrderSummaryFilters): Promise<RepairOrderSummary>
}

export interface IRepairPartRepo {
    add(orderId: string, input: RepairOrderPartInput): Promise<RepairOrderPartRecord>
    listByOrder(orderId: string): Promise<RepairOrderPartRecord[]>
}
