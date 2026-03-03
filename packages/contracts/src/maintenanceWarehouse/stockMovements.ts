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
    partId: string
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
    partId: string
    movementType: MovementType
    qty: number
    unitCost?: number | null
    refType?: string | null
    refId?: string | null
    actorUserId?: string | null
    correlationId?: string | null
}

export interface StockMovementFilters {
    partId?: string
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
    partId: string
    onHand: number
    reserved: number
    updatedAt: Date
}

export interface StockUpsertInput {
    warehouseId: string
    partId: string
    onHand: number
    reserved: number
}

export interface StockViewRecord {
    warehouseId: string
    warehouseCode: string
    warehouseName: string
    partId: string
    partCode: string
    partName: string
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
    get(warehouseId: string, partId: string): Promise<StockRecord | null>
    getForUpdate(warehouseId: string, partId: string): Promise<StockRecord | null>
    upsert(input: StockUpsertInput): Promise<StockRecord>
    adjustStock(warehouseId: string, partId: string, delta: number): Promise<StockRecord>
    reserve(warehouseId: string, partId: string, qty: number): Promise<StockRecord>
    release(warehouseId: string, partId: string, qty: number): Promise<StockRecord>
    commitReserved(warehouseId: string, partId: string, qty: number): Promise<StockRecord>
    listView(filters: StockViewFilters): Promise<StockViewPage>
}

export interface IMovementRepo {
    addMany(inputs: StockMovementInput[]): Promise<StockMovementRecord[]>
    list(filters: StockMovementFilters): Promise<StockMovementPage>
}
