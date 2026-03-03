import { DomainError } from '../core/errors/index.js'

export const AssetStatusValues = ['in_stock', 'in_use', 'in_repair', 'retired', 'disposed', 'lost'] as const
export type AssetStatus = typeof AssetStatusValues[number]

export const AssigneeTypeValues = ['person', 'department', 'system'] as const
export type AssigneeType = typeof AssigneeTypeValues[number]

export const MaintenanceSeverityValues = ['low', 'medium', 'high', 'critical'] as const
export type MaintenanceSeverity = typeof MaintenanceSeverityValues[number]

export const MaintenanceStatusValues = ['open', 'in_progress', 'closed', 'canceled'] as const
export type MaintenanceStatus = typeof MaintenanceStatusValues[number]

export const AssetEventTypeValues = [
    'CREATED',
    'UPDATED',
    'ASSIGNED',
    'UNASSIGNED',
    'MOVED',
    'MAINT_OPEN',
    'MAINT_CLOSE',
    'RETIRED',
    'DISPOSED',
    'IMPORTED',
    'INVENTORY_FOUND',
    'INVENTORY_MISSING',
    'INVENTORY_SESSION_STARTED',
    'INVENTORY_SCAN_UNDONE',
    'ATTACHMENT_ADDED',
    'REQUEST_SUBMITTED',
    'REQUEST_APPROVED',
    'REQUEST_REJECTED'
] as const
export type AssetEventType = typeof AssetEventTypeValues[number]

export const InventorySessionStatusValues = ['draft', 'in_progress', 'closed', 'canceled'] as const
export type InventorySessionStatus = typeof InventorySessionStatusValues[number]

export const InventoryItemStatusValues = ['found', 'missing', 'moved', 'unknown'] as const
export type InventoryItemStatus = typeof InventoryItemStatusValues[number]

export const WorkflowRequestTypeValues = ['assign', 'return', 'move', 'repair', 'dispose', 'issue_stock'] as const
export type WorkflowRequestType = typeof WorkflowRequestTypeValues[number]

export const WorkflowRequestStatusValues = ['submitted', 'approved', 'rejected', 'in_progress', 'done', 'canceled'] as const
export type WorkflowRequestStatus = typeof WorkflowRequestStatusValues[number]

export const ReminderTypeValues = ['warranty_expiring', 'maintenance_due'] as const
export type ReminderType = typeof ReminderTypeValues[number]

export const ReminderStatusValues = ['pending', 'sent', 'canceled'] as const
export type ReminderStatus = typeof ReminderStatusValues[number]

const StatusTransitions: Record<AssetStatus, readonly AssetStatus[]> = {
    in_stock: ['in_use', 'in_repair', 'retired', 'disposed', 'lost'],
    in_use: ['in_stock', 'in_repair', 'retired', 'disposed', 'lost'],
    in_repair: ['in_stock', 'in_use', 'retired', 'disposed', 'lost'],
    retired: ['disposed'],
    disposed: [],
    lost: []
}

export function assertAssetCode(value: string): void {
    if (!value || value.trim().length === 0) {
        throw DomainError.validation('Asset code required', 'assetCode')
    }
}

export function assertModelId(value: string): void {
    if (!value || value.trim().length === 0) {
        throw DomainError.validation('Model id required', 'modelId')
    }
}

export function assertVlanId(value: number | null | undefined): void {
    if (value === null || value === undefined) return
    if (!Number.isInteger(value) || value < 1 || value > 4094) {
        throw DomainError.validation('VLAN ID must be between 1 and 4094', 'vlanId')
    }
}

export function canTransitionAssetStatus(from: AssetStatus, to: AssetStatus): boolean {
    return StatusTransitions[from].includes(to)
}

export function assertStatusTransition(from: AssetStatus, to: AssetStatus): void {
    if (!canTransitionAssetStatus(from, to)) {
        throw DomainError.businessRule('Invalid asset status transition', 'asset.status.transition')
    }
}
