import type { InventoryItemStatus, InventorySessionStatus } from '@qltb/domain'

export interface InventorySessionRecord {
    id: string
    name: string
    locationId?: string | null
    status: InventorySessionStatus
    startedAt?: Date | null
    closedAt?: Date | null
    createdBy?: string | null
    correlationId?: string | null
    createdAt: Date
}

export interface InventorySessionInput {
    name: string
    locationId?: string | null
    status?: InventorySessionStatus
    startedAt?: Date | null
    createdBy?: string | null
    correlationId?: string | null
}

export interface InventorySessionListFilters {
    status?: InventorySessionStatus
    page?: number
    limit?: number
}

export interface InventorySessionPage {
    items: InventorySessionRecord[]
    total: number
    page: number
    limit: number
}

export interface InventoryItemRecord {
    id: string
    sessionId: string
    assetId?: string | null
    expectedLocationId?: string | null
    scannedLocationId?: string | null
    scannedAt?: Date | null
    status: InventoryItemStatus
    note?: string | null
}

export interface InventoryScanInput {
    sessionId: string
    assetId?: string | null
    expectedLocationId?: string | null
    scannedLocationId?: string | null
    scannedAt?: Date | null
    status: InventoryItemStatus
    note?: string | null
}

export interface IInventoryRepo {
    createSession(input: InventorySessionInput): Promise<InventorySessionRecord>
    addScan(input: InventoryScanInput): Promise<InventoryItemRecord>
    closeSession(sessionId: string, closedAt: Date): Promise<InventorySessionRecord | null>
    startSession(sessionId: string, startedAt: Date): Promise<InventorySessionRecord | null>
    deleteItem(itemId: string): Promise<boolean>
    getSession(sessionId: string): Promise<InventorySessionRecord | null>
    listSessions(filters: InventorySessionListFilters): Promise<InventorySessionPage>
    listItems(sessionId: string): Promise<InventoryItemRecord[]>
}
