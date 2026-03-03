import { describe, it, expect, vi } from 'vitest'
import { AttachmentRepo } from './AttachmentRepo.js'
import type { PgClient } from '../PgClient.js'

describe('AttachmentRepo', () => {
    it('adds attachment metadata', async () => {
        const query = vi.fn()
        const pg = { query } as unknown as PgClient
        const repo = new AttachmentRepo(pg)

        query.mockResolvedValueOnce({
            rows: [{
                id: 'att-1',
                asset_id: 'asset-1',
                file_name: 'doc.pdf',
                mime_type: 'application/pdf',
                storage_key: 'uploads/doc.pdf',
                size_bytes: 100,
                version: 1,
                uploaded_by: 'u1',
                correlation_id: 'c1',
                created_at: new Date()
            }]
        })

        const record = await repo.add({
            assetId: 'asset-1',
            fileName: 'doc.pdf',
            mimeType: 'application/pdf',
            storageKey: 'uploads/doc.pdf',
            sizeBytes: 100,
            version: 1,
            uploadedBy: 'u1',
            correlationId: 'c1'
        })

        expect(record.fileName).toBe('doc.pdf')
        expect(query).toHaveBeenCalled()
    })
})
