export interface SparePartRecord {
    id: string
    partCode: string
    name: string
    category?: string | null
    uom?: string | null
    manufacturer?: string | null
    model?: string | null
    spec: Record<string, unknown>
    minLevel: number
    createdAt: Date
}

export interface SparePartCreateInput {
    partCode: string
    name: string
    category?: string | null
    uom?: string | null
    manufacturer?: string | null
    model?: string | null
    spec?: Record<string, unknown>
    minLevel?: number
}

export type SparePartUpdatePatch = Partial<SparePartCreateInput>

export interface SparePartListFilters {
    q?: string
    page?: number
    limit?: number
}

export interface SparePartPage {
    items: SparePartRecord[]
    total: number
    page: number
    limit: number
}

export interface ISparePartRepo {
    list(filters: SparePartListFilters): Promise<SparePartPage>
    getById(id: string): Promise<SparePartRecord | null>
    create(input: SparePartCreateInput): Promise<SparePartRecord>
    update(id: string, patch: SparePartUpdatePatch): Promise<SparePartRecord | null>
    delete(id: string): Promise<boolean>
}
