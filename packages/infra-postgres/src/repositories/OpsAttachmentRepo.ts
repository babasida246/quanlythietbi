import type { IOpsAttachmentRepo, OpsAttachmentInput, OpsAttachmentRecord, OpsAttachmentEntityType } from '@qltb/contracts'
import type { Queryable } from './types.js'

type AttachmentRow = {
    id: string
    entity_type: OpsAttachmentEntityType
    entity_id: string
    file_name: string
    mime_type: string | null
    storage_key: string
    size_bytes: number | string | null
    version: number
    uploaded_by: string | null
    correlation_id: string | null
    created_at: Date
}

const mapAttachment = (row: AttachmentRow): OpsAttachmentRecord => ({
    id: row.id,
    entityType: row.entity_type,
    entityId: row.entity_id,
    fileName: row.file_name,
    mimeType: row.mime_type,
    storageKey: row.storage_key,
    sizeBytes: row.size_bytes === null ? null : Number(row.size_bytes),
    version: row.version,
    uploadedBy: row.uploaded_by,
    correlationId: row.correlation_id,
    createdAt: row.created_at
})

export class OpsAttachmentRepo implements IOpsAttachmentRepo {
    constructor(private pg: Queryable) { }

    async add(input: OpsAttachmentInput): Promise<OpsAttachmentRecord> {
        const result = await this.pg.query<AttachmentRow>(
            `INSERT INTO attachments (
                entity_type,
                entity_id,
                file_name,
                mime_type,
                storage_key,
                size_bytes,
                version,
                uploaded_by,
                correlation_id
             ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
             RETURNING id, entity_type, entity_id, file_name, mime_type, storage_key, size_bytes, version,
                       uploaded_by, correlation_id, created_at`,
            [
                input.entityType,
                input.entityId,
                input.fileName,
                input.mimeType ?? null,
                input.storageKey,
                input.sizeBytes ?? null,
                input.version,
                input.uploadedBy ?? null,
                input.correlationId ?? null
            ]
        )
        return mapAttachment(result.rows[0])
    }

    async listByEntity(entityType: OpsAttachmentEntityType, entityId: string): Promise<OpsAttachmentRecord[]> {
        const result = await this.pg.query<AttachmentRow>(
            `SELECT id, entity_type, entity_id, file_name, mime_type, storage_key, size_bytes, version,
                    uploaded_by, correlation_id, created_at
             FROM attachments
             WHERE entity_type = $1 AND entity_id = $2
             ORDER BY created_at DESC`,
            [entityType, entityId]
        )
        return result.rows.map(mapAttachment)
    }

    async getById(id: string): Promise<OpsAttachmentRecord | null> {
        const result = await this.pg.query<AttachmentRow>(
            `SELECT id, entity_type, entity_id, file_name, mime_type, storage_key, size_bytes, version,
                    uploaded_by, correlation_id, created_at
             FROM attachments
             WHERE id = $1`,
            [id]
        )
        return result.rows[0] ? mapAttachment(result.rows[0]) : null
    }

    async delete(id: string): Promise<void> {
        await this.pg.query(`DELETE FROM attachments WHERE id = $1`, [id])
    }
}
