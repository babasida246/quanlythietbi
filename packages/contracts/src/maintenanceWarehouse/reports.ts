export interface StockOnHandRow {
    partId: string
    partCode: string
    partName: string
    warehouseId: string
    warehouseName: string
    onHand: number
    uom?: string | null
    minLevel: number
}

export interface StockAvailableRow {
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

export interface ReorderAlertRow {
    partId: string
    partCode: string
    partName: string
    warehouseId: string
    warehouseName: string
    onHand: number
    minLevel: number
    uom?: string | null
}

export interface FefoLotRow {
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

export interface ValuationRow {
    partId: string
    partCode: string
    partName: string
    onHand: number
    avgCost: number
    value: number
}

export interface StockReportFilters {
    warehouseId?: string
    partId?: string
    q?: string
    limit?: number
}

export interface FefoReportFilters {
    warehouseId?: string
    daysThreshold?: number
    limit?: number
}

export interface ValuationFilters {
    warehouseId?: string
    currencyId?: string
    limit?: number
}

export interface ValuationResult {
    total: number
    currency: string
    items: ValuationRow[]
}

export interface IStockReportRepo {
    stockOnHand(filters: StockReportFilters): Promise<StockOnHandRow[]>
    stockAvailable(filters: StockReportFilters): Promise<StockAvailableRow[]>
    reorderAlerts(filters: StockReportFilters): Promise<ReorderAlertRow[]>
    fefoLots(filters: FefoReportFilters): Promise<FefoLotRow[]>
    valuation(filters: ValuationFilters): Promise<ValuationResult>
}
