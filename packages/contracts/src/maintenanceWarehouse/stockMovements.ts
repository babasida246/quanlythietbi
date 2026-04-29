export type MovementType =
    | 'in'
    | 'out'
    | 'adjust_in'
    | 'adjust_out'
    | 'transfer_in'
    | 'transfer_out'
    | 'reserve'
    | 'release'

export interface StockMovementRecord {
    id: string
    warehouseId: string
    modelId: string
    movementType: MovementType
    qty: number
    unitCost?: number | null
    refType?: string | null
    refId?: string | null
    actorUserId?: string | null
    correlationId?: string | null
    createdAt: Date
}

export interface StockMovementInput {
    warehouseId: string
    modelId: string
    movementType: MovementType
    qty: number
    unitCost?: number | null
    refType?: string | null
    refId?: string | null
    actorUserId?: string | null
    correlationId?: string | null
}

export interface StockMovementFilters {
    modelId?: string
    warehouseId?: string
    from?: string
    to?: string
    page?: number
    limit?: number
}

export interface StockMovementPage {
    items: StockMovementRecord[]
    total: number
    page: number
    limit: number
}

export interface StockRecord {
    id: string
    warehouseId: string
    modelId: string
    onHand: number
    reserved: number
    updatedAt: Date
}

export interface StockUpsertInput {
    warehouseId: string
    modelId: string
    onHand: number
    reserved: number
}

export interface StockViewRecord {
    warehouseId: string
    warehouseCode: string
    warehouseName: string
    modelId: string
    partCode: string
    partName: string
    brand?: string | null
    categoryName?: string | null
    onHand: number
    reserved: number
    available: number
    uom?: string | null
    minLevel: number
}

export interface StockViewFilters {
    warehouseId?: string
    q?: string
    belowMin?: boolean
    page?: number
    limit?: number
}

export interface StockViewPage {
    items: StockViewRecord[]
    total: number
    page: number
    limit: number
}

export interface IStockRepo {
    get(warehouseId: string, modelId: string): Promise<StockRecord | null>
    getForUpdate(warehouseId: string, modelId: string): Promise<StockRecord | null>
    upsert(input: StockUpsertInput): Promise<StockRecord>
    adjustStock(warehouseId: string, modelId: string, delta: number): Promise<StockRecord>
    reserve(warehouseId: string, modelId: string, qty: number): Promise<StockRecord>
    release(warehouseId: string, modelId: string, qty: number): Promise<StockRecord>
    commitReserved(warehouseId: string, modelId: string, qty: number): Promise<StockRecord>
    listView(filters: StockViewFilters): Promise<StockViewPage>
}

export interface IMovementRepo {
    addMany(inputs: StockMovementInput[]): Promise<StockMovementRecord[]>
    list(filters: StockMovementFilters): Promise<StockMovementPage>
}

// Aliases for new naming convention
export type IModelStockRepo = IStockRepo
export type IModelMovementRepo = IMovementRepo
