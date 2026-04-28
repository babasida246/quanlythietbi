import { describe, it, expect, vi } from 'vitest'
import { StockReportRepo } from './StockReportRepo.js'
import type { PgClient } from '../PgClient.js'

describe('StockReportRepo', () => {
    it('maps stock on hand rows', async () => {
        const query = vi.fn().mockResolvedValueOnce({
            rows: [{
                model_id: 'model-1',
                model_name: 'SSD 256GB',
                brand: 'Samsung',
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
            modelId: 'model-1',
            modelName: 'SSD 256GB',
            brand: 'Samsung',
            warehouseId: 'wh-1',
            warehouseName: 'Main',
            onHand: 5,
            uom: 'pcs',
            minLevel: 1
        })
        expect(query).toHaveBeenCalledWith(expect.stringContaining('asset_model_stock'), expect.any(Array))
    })

    it('calculates valuation totals', async () => {
        const query = vi.fn().mockResolvedValueOnce({
            rows: [{
                model_id: 'model-1',
                model_name: 'SSD 256GB',
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
