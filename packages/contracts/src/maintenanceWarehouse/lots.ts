export interface SparePartLotRecord {
    id: string
    warehouseId: string
    partId: string
    lotNumber: string
    serialNo?: string | null
    manufactureDate?: string | null
    expiryDate?: string | null
    onHand: number
    reserved: number
    status: 'active' | 'expired' | 'consumed'
    createdAt: Date
    updatedAt: Date
}

export interface SparePartLotCreateInput {
    warehouseId: string
    partId: string
    lotNumber: string
    serialNo?: string | null
    manufactureDate?: string | null
    expiryDate?: string | null
    onHand: number
}

export interface SparePartLotFilters {
    warehouseId?: string
    partId?: string
    status?: SparePartLotRecord['status']
    q?: string
    page?: number
    limit?: number
}

export interface SparePartLotPage {
    items: SparePartLotRecord[]
    total: number
    page: number
    limit: number
}

export interface ISparePartLotRepo {
    create(input: SparePartLotCreateInput): Promise<SparePartLotRecord>
    getById(id: string): Promise<SparePartLotRecord | null>
    list(filters: SparePartLotFilters): Promise<SparePartLotPage>
    adjustQty(id: string, delta: number): Promise<SparePartLotRecord | null>
    updateStatus(id: string, status: SparePartLotRecord['status']): Promise<SparePartLotRecord | null>
}
