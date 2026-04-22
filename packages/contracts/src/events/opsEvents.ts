export type OpsEntityType =
    | 'repair_order'
    | 'stock_document'
    | 'spare_part'
    | 'warehouse'
    | 'asset_category'
    | 'asset_model'
    | 'cmdb_ci'
    | 'cmdb_rel'
    | 'cmdb_service'
    | 'cmdb_type'
    | 'cmdb_schema'
    | 'cmdb_change'

export interface OpsEventRecord {
    id: string
    entityType: OpsEntityType
    entityId: string
    eventType: string
    payload: Record<string, unknown>
    actorUserId?: string | null
    correlationId?: string | null
    createdAt: Date
}

export type OpsEventInput = Omit<OpsEventRecord, 'id' | 'createdAt'>

export interface IOpsEventRepo {
    append(event: OpsEventInput): Promise<OpsEventRecord>
    listByEntity(entityType: OpsEntityType, entityId: string, limit: number): Promise<OpsEventRecord[]>
    list(): Promise<OpsEventRecord[]>
}
