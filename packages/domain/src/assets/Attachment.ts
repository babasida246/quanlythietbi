import { DomainError } from '../core/errors/index.js'

export interface AttachmentMetaProps {
    id: string
    assetId: string
    fileName: string
    mimeType?: string | null
    storageKey: string
    sizeBytes?: number | null
    version: number
    uploadedBy?: string | null
    correlationId?: string | null
    createdAt?: Date
}

export class AttachmentMeta {
    public id: string
    public assetId: string
    public fileName: string
    public mimeType?: string | null
    public storageKey: string
    public sizeBytes?: number | null
    public version: number
    public uploadedBy?: string | null
    public correlationId?: string | null
    public createdAt: Date

    constructor(props: AttachmentMetaProps) {
        if (!props.fileName || props.fileName.trim().length === 0) {
            throw DomainError.validation('Attachment file name required', 'fileName')
        }
        if (!props.storageKey || props.storageKey.trim().length === 0) {
            throw DomainError.validation('Attachment storage key required', 'storageKey')
        }

        this.id = props.id
        this.assetId = props.assetId
        this.fileName = props.fileName.trim()
        this.mimeType = props.mimeType ?? null
        this.storageKey = props.storageKey.trim()
        this.sizeBytes = props.sizeBytes ?? null
        this.version = props.version
        this.uploadedBy = props.uploadedBy ?? null
        this.correlationId = props.correlationId ?? null
        this.createdAt = props.createdAt ?? new Date()
    }
}
