import { describe, it, expect } from 'vitest'
import type { StockDocumentRecord, StockDocumentLineRecord } from './stockDocuments.js'

describe('maintenanceWarehouse stock documents contracts', () => {
    it('defines stock document record shape', () => {
        const record: StockDocumentRecord = {
            id: 'doc-1',
            docType: 'receipt',
            code: 'SD-2025-000001',
            status: 'draft',
            docDate: '2025-01-01',
            createdAt: new Date(),
            updatedAt: new Date()
        }
        expect(record.status).toBe('draft')
    })

    it('defines stock document line shape', () => {
        const line: StockDocumentLineRecord = {
            id: 'line-1',
            documentId: 'doc-1',
            partId: 'part-1',
            qty: 2
        }
        expect(line.qty).toBe(2)
    })
})
