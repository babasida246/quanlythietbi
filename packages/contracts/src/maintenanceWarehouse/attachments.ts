export type OpsAttachmentEntityType = 'repair_order' | 'stock_document'

export interface OpsAttachmentRecord {
    id: string
    entityType: OpsAttachmentEntityType
    entityId: string
    fileName: string
    mimeType?: string | null
    storageKey: string
    sizeBytes?: number | null
    version: number
    uploadedBy?: string | null
    correlationId?: string | null
    createdAt: Date
}

export interface OpsAttachmentInput {
    entityType: OpsAttachmentEntityType
    entityId: string
    fileName: string
    mimeType?: string | null
    storageKey: string
    sizeBytes?: number | null
    version: number
    uploadedBy?: string | null
    correlationId?: string | null
}

export interface IOpsAttachmentRepo {
    add(input: OpsAttachmentInput): Promise<OpsAttachmentRecord>
    listByEntity(entityType: OpsAttachmentEntityType, entityId: string): Promise<OpsAttachmentRecord[]>
    getById(id: string): Promise<OpsAttachmentRecord | null>
}
