export interface AttachmentRecord {
    id: string
    assetId: string
    fileName: string
    mimeType?: string | null
    storageKey: string
    sizeBytes?: number | null
    version: number
    uploadedBy?: string | null
    correlationId?: string | null
    createdAt: Date
}

export interface AttachmentInput {
    assetId: string
    fileName: string
    mimeType?: string | null
    storageKey: string
    sizeBytes?: number | null
    version: number
    uploadedBy?: string | null
    correlationId?: string | null
}

export interface IAttachmentRepo {
    add(input: AttachmentInput): Promise<AttachmentRecord>
    listByAsset(assetId: string): Promise<AttachmentRecord[]>
    getById(id: string): Promise<AttachmentRecord | null>
    delete?(id: string): Promise<boolean>
}
