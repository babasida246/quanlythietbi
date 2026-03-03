import type { AttachmentInput, AttachmentRecord, IAttachmentRepo } from '@qltb/contracts'
import type { PgClient } from '../PgClient.js'

interface AttachmentRow {
    id: string
    asset_id: string
    file_name: string
    mime_type: string | null
    storage_key: string
    size_bytes: number | null
    version: number
    uploaded_by: string | null
    correlation_id: string | null
    created_at: Date
}

function mapAttachmentRow(row: AttachmentRow): AttachmentRecord {
    return {
        id: row.id,
        assetId: row.asset_id,
        fileName: row.file_name,
        mimeType: row.mime_type,
        storageKey: row.storage_key,
        sizeBytes: row.size_bytes,
        version: row.version,
        uploadedBy: row.uploaded_by,
        correlationId: row.correlation_id,
        createdAt: row.created_at
    }
}

export class AttachmentRepo implements IAttachmentRepo {
    constructor(private pg: PgClient) { }

    async add(input: AttachmentInput): Promise<AttachmentRecord> {
        const result = await this.pg.query<AttachmentRow>(
            `INSERT INTO asset_attachments (
                asset_id,
                file_name,
                mime_type,
                storage_key,
                size_bytes,
                version,
                uploaded_by,
                correlation_id
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
            RETURNING *`,
            [
                input.assetId,
                input.fileName,
                input.mimeType ?? null,
                input.storageKey,
                input.sizeBytes ?? null,
                input.version,
                input.uploadedBy ?? null,
                input.correlationId ?? null
            ]
        )
        return mapAttachmentRow(result.rows[0])
    }

    async listByAsset(assetId: string): Promise<AttachmentRecord[]> {
        const result = await this.pg.query<AttachmentRow>(
            `SELECT * FROM asset_attachments
             WHERE asset_id = $1
             ORDER BY created_at DESC`,
            [assetId]
        )
        return result.rows.map(mapAttachmentRow)
    }

    async getById(id: string): Promise<AttachmentRecord | null> {
        const result = await this.pg.query<AttachmentRow>(
            `SELECT * FROM asset_attachments WHERE id = $1`,
            [id]
        )
        if (result.rows.length === 0) return null
        return mapAttachmentRow(result.rows[0])
    }
}
