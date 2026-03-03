import { describe, it, expect, vi } from 'vitest'
import { OpsAttachmentRepo } from './OpsAttachmentRepo.js'
import type { Queryable } from './types.js'

describe('OpsAttachmentRepo', () => {
    it('adds attachment metadata', async () => {
        const query = vi.fn().mockResolvedValueOnce({
            rows: [{
                id: 'att-1',
                entity_type: 'stock_document',
                entity_id: 'doc-1',
                file_name: 'doc.pdf',
                mime_type: 'application/pdf',
                storage_key: 'stock/doc.pdf',
                size_bytes: '1200',
                version: 1,
                uploaded_by: 'user-1',
                correlation_id: null,
                created_at: new Date()
            }]
        })
        const pg = { query } as unknown as Queryable
        const repo = new OpsAttachmentRepo(pg)

        const record = await repo.add({
            entityType: 'stock_document',
            entityId: 'doc-1',
            fileName: 'doc.pdf',
            storageKey: 'stock/doc.pdf',
            version: 1
        })
        expect(record.sizeBytes).toBe(1200)
    })

    it('lists attachments by entity', async () => {
        const query = vi.fn().mockResolvedValueOnce({
            rows: [{
                id: 'att-2',
                entity_type: 'repair_order',
                entity_id: 'repair-1',
                file_name: 'photo.png',
                mime_type: 'image/png',
                storage_key: 'repairs/photo.png',
                size_bytes: null,
                version: 1,
                uploaded_by: null,
                correlation_id: null,
                created_at: new Date()
            }]
        })
        const pg = { query } as unknown as Queryable
        const repo = new OpsAttachmentRepo(pg)

        const result = await repo.listByEntity('repair_order', 'repair-1')
        expect(result).toHaveLength(1)
    })
})
