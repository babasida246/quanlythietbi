export interface WarehouseRecord {
    id: string
    code: string
    name: string
    locationId?: string | null
    createdAt: string
}

export interface WarehouseCreateInput {
    code: string
    name: string
    locationId?: string | null
}

export type WarehouseUpdatePatch = Partial<WarehouseCreateInput>

export interface IWarehouseRepo {
    list(): Promise<WarehouseRecord[]>
    getById(id: string): Promise<WarehouseRecord | null>
    create(input: WarehouseCreateInput): Promise<WarehouseRecord>
    update(id: string, patch: WarehouseUpdatePatch): Promise<WarehouseRecord | null>
    delete(id: string): Promise<boolean>
}
