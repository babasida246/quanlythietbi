import { DomainError } from '../core/errors/index.js'
import type { InventoryItemStatus, InventorySessionStatus } from './types.js'

export interface InventorySessionProps {
    id: string
    name: string
    locationId?: string | null
    status: InventorySessionStatus
    startedAt?: Date | null
    closedAt?: Date | null
    createdBy?: string | null
    correlationId?: string | null
    createdAt?: Date
}

export class InventorySession {
    public id: string
    public name: string
    public locationId?: string | null
    public status: InventorySessionStatus
    public startedAt?: Date | null
    public closedAt?: Date | null
    public createdBy?: string | null
    public correlationId?: string | null
    public createdAt: Date

    constructor(props: InventorySessionProps) {
        if (!props.name || props.name.trim().length === 0) {
            throw DomainError.validation('Inventory session name required', 'name')
        }

        this.id = props.id
        this.name = props.name.trim()
        this.locationId = props.locationId ?? null
        this.status = props.status
        this.startedAt = props.startedAt ?? null
        this.closedAt = props.closedAt ?? null
        this.createdBy = props.createdBy ?? null
        this.correlationId = props.correlationId ?? null
        this.createdAt = props.createdAt ?? new Date()
    }
}

export interface InventoryItemProps {
    id: string
    sessionId: string
    assetId?: string | null
    expectedLocationId?: string | null
    scannedLocationId?: string | null
    scannedAt?: Date | null
    status: InventoryItemStatus
    note?: string | null
}

export class InventoryItem {
    public id: string
    public sessionId: string
    public assetId?: string | null
    public expectedLocationId?: string | null
    public scannedLocationId?: string | null
    public scannedAt?: Date | null
    public status: InventoryItemStatus
    public note?: string | null

    constructor(props: InventoryItemProps) {
        this.id = props.id
        this.sessionId = props.sessionId
        this.assetId = props.assetId ?? null
        this.expectedLocationId = props.expectedLocationId ?? null
        this.scannedLocationId = props.scannedLocationId ?? null
        this.scannedAt = props.scannedAt ?? null
        this.status = props.status
        this.note = props.note ?? null
    }
}
