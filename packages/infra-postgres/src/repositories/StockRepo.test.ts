import { describe, it, expect, vi } from 'vitest'
import { StockRepo } from './StockRepo.js'
import type { Queryable } from './types.js'

describe('StockRepo', () => {
    it('upserts stock rows', async () => {
        const query = vi.fn().mockResolvedValueOnce({
            rows: [{
                id: 'stock-1',
                warehouse_id: 'wh-1',
                part_id: 'part-1',
                on_hand: 5,
                reserved: 1,
                updated_at: new Date()
            }]
        })
        const pg = { query } as unknown as Queryable
        const repo = new StockRepo(pg)

        const record = await repo.upsert({ warehouseId: 'wh-1', partId: 'part-1', onHand: 5, reserved: 1 })
        expect(record.onHand).toBe(5)
        expect(query).toHaveBeenCalledWith(expect.stringContaining('ON CONFLICT'), expect.any(Array))
    })

    it('lists stock view rows', async () => {
        const query = vi.fn()
        const pg = { query } as unknown as Queryable
        const repo = new StockRepo(pg)

        query
            .mockResolvedValueOnce({ rows: [{ count: '1' }] })
            .mockResolvedValueOnce({
                rows: [{
                    warehouse_id: 'wh-1',
                    warehouse_code: 'WH-01',
                    warehouse_name: 'Main',
                    part_id: 'part-1',
                    part_code: 'P-001',
                    part_name: 'SSD',
                    on_hand: 5,
                    reserved: 1,
                    available: 4,
                    uom: 'pcs',
                    min_level: 1
                }]
            })

        const result = await repo.listView({})
        expect(result.total).toBe(1)
        expect(result.items[0]?.available).toBe(4)
    })
})
