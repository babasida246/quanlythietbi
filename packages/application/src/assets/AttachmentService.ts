import { AppError } from '@qltb/domain'
import type { AttachmentInput, AttachmentRecord, IAssetEventRepo, IAssetRepo, IAttachmentRepo } from '@qltb/contracts'

export interface AttachmentServiceContext {
    userId: string
    correlationId: string
}

export class AttachmentService {
    constructor(
        private assets: IAssetRepo,
        private attachments: IAttachmentRepo,
        private events: IAssetEventRepo
    ) { }

    async addAttachmentMeta(
        assetId: string,
        input: Omit<AttachmentInput, 'assetId' | 'version' | 'uploadedBy' | 'correlationId'>,
        ctx: AttachmentServiceContext
    ): Promise<AttachmentRecord> {
        await this.requireAsset(assetId)
        const existing = await this.attachments.listByAsset(assetId)
        const nextVersion = existing.reduce((max, item) => Math.max(max, item.version), 0) + 1

        const record = await this.attachments.add({
            ...input,
            assetId,
            version: nextVersion,
            uploadedBy: ctx.userId,
            correlationId: ctx.correlationId
        })

        await this.events.append({
            assetId,
            eventType: 'ATTACHMENT_ADDED',
            payload: {
                attachmentId: record.id,
                fileName: record.fileName,
                version: record.version
            },
            actorUserId: ctx.userId,
            correlationId: ctx.correlationId
        })

        return record
    }

    async listAttachments(assetId: string): Promise<AttachmentRecord[]> {
        await this.requireAsset(assetId)
        return await this.attachments.listByAsset(assetId)
    }

    async getAttachment(attachmentId: string): Promise<AttachmentRecord> {
        const record = await this.attachments.getById(attachmentId)
        if (!record) {
            throw AppError.notFound('Attachment not found')
        }
        return record
    }

    private async requireAsset(assetId: string): Promise<void> {
        const asset = await this.assets.getById(assetId)
        if (!asset) {
            throw AppError.notFound('Asset not found')
        }
    }
}
