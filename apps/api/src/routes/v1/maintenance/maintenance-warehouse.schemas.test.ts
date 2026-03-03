import { describe, it, expect } from 'vitest'
import { repairCreateSchema, stockDocumentCreateSchema, stockDocumentListSchema, warehouseCreateSchema } from './maintenance-warehouse.schemas.js'

describe('maintenance warehouse schemas', () => {
    it('parses warehouse create payload', () => {
        const parsed = warehouseCreateSchema.parse({ code: 'WH-01', name: 'Main' })
        expect(parsed.code).toBe('WH-01')
    })

    it('parses stock document create payload', () => {
        const parsed = stockDocumentCreateSchema.parse({
            docType: 'receipt',
            lines: [{ partId: '123e4567-e89b-12d3-a456-426614174000', qty: 1 }]
        })
        expect(parsed.docType).toBe('receipt')
    })

    it('parses repair create payload', () => {
        const parsed = repairCreateSchema.parse({
            assetId: '123e4567-e89b-12d3-a456-426614174000',
            title: 'Fix',
            severity: 'low',
            repairType: 'internal'
        })
        expect(parsed.title).toBe('Fix')
    })

    it('parses stock document list filters with approval statuses', () => {
        const parsed = stockDocumentListSchema.parse({ status: 'approved', page: 1 })
        expect(parsed.status).toBe('approved')
    })
})
