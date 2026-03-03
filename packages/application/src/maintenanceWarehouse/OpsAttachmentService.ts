import { AppError } from '@qltb/domain'
import type { IOpsAttachmentRepo, IOpsEventRepo, IRepairOrderRepo, IStockDocumentRepo, OpsAttachmentInput, OpsAttachmentRecord, OpsAttachmentEntityType } from '@qltb/contracts'
import type { MaintenanceWarehouseContext } from './types.js'

export class OpsAttachmentService {
    constructor(
        private attachments: IOpsAttachmentRepo,
        private repairs: IRepairOrderRepo,
        private documents: IStockDocumentRepo,
        private opsEvents?: IOpsEventRepo
    ) { }

    async addAttachment(
        entityType: OpsAttachmentEntityType,
        entityId: string,
        input: Omit<OpsAttachmentInput, 'entityType' | 'entityId' | 'version' | 'uploadedBy' | 'correlationId'>,
        ctx: MaintenanceWarehouseContext
    ): Promise<OpsAttachmentRecord> {
        await this.ensureEntity(entityType, entityId)
        const existing = await this.attachments.listByEntity(entityType, entityId)
        const nextVersion = existing.reduce((max, item) => Math.max(max, item.version), 0) + 1

        const record = await this.attachments.add({
            ...input,
            entityType,
            entityId,
            version: nextVersion,
            uploadedBy: ctx.userId,
            correlationId: ctx.correlationId
        })

        await this.appendEvent(entityType, entityId, 'ATTACHMENT_ADDED', {
            attachmentId: record.id,
            fileName: record.fileName,
            version: record.version
        }, ctx)

        return record
    }

    async listAttachments(entityType: OpsAttachmentEntityType, entityId: string): Promise<OpsAttachmentRecord[]> {
        await this.ensureEntity(entityType, entityId)
        return await this.attachments.listByEntity(entityType, entityId)
    }

    async getAttachment(id: string): Promise<OpsAttachmentRecord> {
        const record = await this.attachments.getById(id)
        if (!record) {
            throw AppError.notFound('Attachment not found')
        }
        return record
    }

    private async ensureEntity(entityType: OpsAttachmentEntityType, entityId: string): Promise<void> {
        if (entityType === 'repair_order') {
            const repair = await this.repairs.getById(entityId)
            if (!repair) {
                throw AppError.notFound('Repair order not found')
            }
            return
        }

        const doc = await this.documents.getById(entityId)
        if (!doc) {
            throw AppError.notFound('Stock document not found')
        }
    }

    private async appendEvent(
        entityType: OpsAttachmentEntityType,
        entityId: string,
        eventType: string,
        payload: Record<string, unknown>,
        ctx: MaintenanceWarehouseContext
    ): Promise<void> {
        if (!this.opsEvents) return
        await this.opsEvents.append({
            entityType,
            entityId,
            eventType,
            payload,
            actorUserId: ctx.userId,
            correlationId: ctx.correlationId
        })
    }
}
