export interface StockOnHandRow {
    modelId: string
    modelName: string
    brand?: string | null
    warehouseId: string
    warehouseName: string
    onHand: number
    uom?: string | null
    minLevel: number
}

export interface StockAvailableRow {
    modelId: string
    modelName: string
    brand?: string | null
    warehouseId: string
    warehouseName: string
    onHand: number
    reserved: number
    available: number
    uom?: string | null
    minLevel: number
}

export interface ReorderAlertRow {
    modelId: string
    modelName: string
    brand?: string | null
    warehouseId: string
    warehouseName: string
    onHand: number
    minLevel: number
    uom?: string | null
}

export interface FefoLotRow {
    lotId: string
    lotNumber: string
    modelId: string
    modelName: string
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
    modelId: string
    modelName: string
    onHand: number
    avgCost: number
    value: number
}

export interface StockReportFilters {
    warehouseId?: string
    modelId?: string
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
