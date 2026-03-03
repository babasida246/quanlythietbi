import { describe, it, expect, vi } from 'vitest'
import { StockDocumentRepo } from './StockDocumentRepo.js'
import type { Queryable } from './types.js'

describe('StockDocumentRepo', () => {
    it('creates stock documents', async () => {
        const query = vi.fn().mockResolvedValueOnce({
            rows: [{
                id: 'doc-1',
                doc_type: 'receipt',
                code: 'SD-001',
                status: 'draft',
                warehouse_id: null,
                target_warehouse_id: null,
                doc_date: new Date('2025-01-01'),
                ref_type: null,
                ref_id: null,
                note: null,
                created_by: 'user-1',
                approved_by: null,
                correlation_id: null,
                created_at: new Date(),
                updated_at: new Date()
            }]
        })
        const pg = { query } as unknown as Queryable
        const repo = new StockDocumentRepo(pg)

        const doc = await repo.create({ docType: 'receipt', code: 'SD-001' })
        expect(doc.code).toBe('SD-001')
        expect(query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO stock_documents'), expect.any(Array))
    })

    it('lists stock documents with pagination', async () => {
        const query = vi.fn()
        const pg = { query } as unknown as Queryable
        const repo = new StockDocumentRepo(pg)

        query
            .mockResolvedValueOnce({ rows: [{ count: '1' }] })
            .mockResolvedValueOnce({
                rows: [{
                    id: 'doc-2',
                    doc_type: 'issue',
                    code: 'SD-002',
                    status: 'draft',
                    warehouse_id: 'wh-1',
                    target_warehouse_id: null,
                    doc_date: new Date('2025-02-01'),
                    ref_type: null,
                    ref_id: null,
                    note: null,
                    created_by: null,
                    approved_by: null,
                    correlation_id: null,
                    created_at: new Date(),
                    updated_at: new Date()
                }]
            })

        const result = await repo.list({})
        expect(result.total).toBe(1)
        expect(result.items[0]?.docType).toBe('issue')
    })
})
