import { describe, it, expect, vi } from 'vitest'
import { RepairPartRepo } from './RepairPartRepo.js'
import type { Queryable } from './types.js'

describe('RepairPartRepo', () => {
    it('adds repair parts', async () => {
        const query = vi.fn().mockResolvedValueOnce({
            rows: [{
                id: 'part-1',
                repair_order_id: 'repair-1',
                part_id: 'sp-1',
                part_name: null,
                warehouse_id: 'wh-1',
                action: 'replace',
                qty: 1,
                unit_cost: '12.5',
                serial_no: null,
                note: null,
                stock_document_id: 'doc-1',
                created_at: new Date()
            }]
        })
        const pg = { query } as unknown as Queryable
        const repo = new RepairPartRepo(pg)

        const record = await repo.add('repair-1', { partId: 'sp-1', warehouseId: 'wh-1', action: 'replace', qty: 1 })
        expect(record.stockDocumentId).toBe('doc-1')
    })

    it('lists repair parts', async () => {
        const query = vi.fn().mockResolvedValueOnce({
            rows: [{
                id: 'part-2',
                repair_order_id: 'repair-2',
                part_id: 'sp-2',
                part_name: null,
                warehouse_id: 'wh-1',
                action: 'add',
                qty: 2,
                unit_cost: null,
                serial_no: null,
                note: null,
                stock_document_id: null,
                created_at: new Date()
            }]
        })
        const pg = { query } as unknown as Queryable
        const repo = new RepairPartRepo(pg)

        const result = await repo.listByOrder('repair-2')
        expect(result[0]?.action).toBe('add')
    })
})
