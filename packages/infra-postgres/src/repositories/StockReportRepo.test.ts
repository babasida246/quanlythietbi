import { describe, it, expect, vi } from 'vitest'
import { StockReportRepo } from './StockReportRepo.js'
import type { PgClient } from '../PgClient.js'

describe('StockReportRepo', () => {
    it('maps stock on hand rows', async () => {
        const query = vi.fn().mockResolvedValueOnce({
            rows: [{
                part_id: 'part-1',
                part_code: 'P-001',
                part_name: 'SSD',
                warehouse_id: 'wh-1',
                warehouse_name: 'Main',
                on_hand: 5,
                uom: 'pcs',
                min_level: 1
            }]
        })
        const pg = { query } as unknown as PgClient
        const repo = new StockReportRepo(pg)

        const rows = await repo.stockOnHand({})
        expect(rows[0]).toEqual({
            partId: 'part-1',
            partCode: 'P-001',
            partName: 'SSD',
            warehouseId: 'wh-1',
            warehouseName: 'Main',
            onHand: 5,
            uom: 'pcs',
            minLevel: 1
        })
        expect(query).toHaveBeenCalledWith(expect.stringContaining('spare_part_stock'), expect.any(Array))
    })

    it('calculates valuation totals', async () => {
        const query = vi.fn().mockResolvedValueOnce({
            rows: [{
                part_id: 'part-1',
                part_code: 'P-001',
                part_name: 'SSD',
                on_hand: 2,
                avg_cost: '10.50',
                value: '21.00'
            }]
        })
        const pg = { query } as unknown as PgClient
        const repo = new StockReportRepo(pg)

        const result = await repo.valuation({})
        expect(result.total).toBeCloseTo(21)
        expect(result.items[0]?.avgCost).toBeCloseTo(10.5)
    })

    it('returns empty list for fefoLots without querying', async () => {
        const query = vi.fn()
        const pg = { query } as unknown as PgClient
        const repo = new StockReportRepo(pg)

        const result = await repo.fefoLots({})
        expect(result).toEqual([])
        expect(query).not.toHaveBeenCalled()
    })
})
