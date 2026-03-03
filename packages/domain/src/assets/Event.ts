import type { AssetEventType } from './types.js'

export interface AssetEventProps {
    id: string
    assetId: string
    eventType: AssetEventType
    payload?: Record<string, unknown>
    actorUserId?: string | null
    correlationId?: string | null
    createdAt?: Date
}

export class AssetEvent {
    public id: string
    public assetId: string
    public eventType: AssetEventType
    public payload: Record<string, unknown>
    public actorUserId?: string | null
    public correlationId?: string | null
    public createdAt: Date

    constructor(props: AssetEventProps) {
        this.id = props.id
        this.assetId = props.assetId
        this.eventType = props.eventType
        this.payload = props.payload ?? {}
        this.actorUserId = props.actorUserId ?? null
        this.correlationId = props.correlationId ?? null
        this.createdAt = props.createdAt ?? new Date()
    }
}
