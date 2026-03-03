import { DomainError } from '../core/errors/index.js'

export const RepairStatusValues = ['open', 'diagnosing', 'waiting_parts', 'repaired', 'closed', 'canceled'] as const
export type RepairStatus = typeof RepairStatusValues[number]

export const RepairSeverityValues = ['low', 'medium', 'high', 'critical'] as const
export type RepairSeverity = typeof RepairSeverityValues[number]

export const RepairTypeValues = ['internal', 'vendor'] as const
export type RepairType = typeof RepairTypeValues[number]

export const StockDocTypeValues = ['receipt', 'issue', 'adjust', 'transfer'] as const
export type StockDocType = typeof StockDocTypeValues[number]

export const StockDocStatusValues = ['draft', 'submitted', 'approved', 'posted', 'canceled'] as const
export type StockDocStatus = typeof StockDocStatusValues[number]

export const MovementTypeValues = ['in', 'out', 'adjust_in', 'adjust_out', 'transfer_in', 'transfer_out', 'reserve', 'release'] as const
export type MovementType = typeof MovementTypeValues[number]

export const PartActionValues = ['replace', 'add', 'remove', 'upgrade'] as const
export type PartAction = typeof PartActionValues[number]

export function assertStockDocLines(lines: Array<{ qty: number }>): void {
    if (!lines || lines.length === 0) {
        throw DomainError.businessRule('Stock document requires at least one line', 'stockDocument.lines')
    }
}

export function assertStockAvailable(onHand: number, reserved: number, qty: number): void {
    const available = onHand - reserved
    if (available < qty) {
        throw DomainError.businessRule('Insufficient stock available', 'stock.available')
    }
}

export function assertTransferTarget(targetWarehouseId?: string | null): void {
    if (!targetWarehouseId) {
        throw DomainError.validation('Target warehouse required for transfer', 'targetWarehouseId')
    }
}

export function assertRepairPartStockLink(warehouseId?: string | null, stockDocumentId?: string | null): void {
    if (warehouseId && !stockDocumentId) {
        throw DomainError.businessRule('Repair part linked to warehouse must have stock document', 'repairPart.stockDocumentId')
    }
}
