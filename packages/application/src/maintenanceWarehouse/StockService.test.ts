import { describe, it, expect, vi } from 'vitest'
import { StockService } from './StockService.js'
import type { IStockRepo } from '@qltb/contracts'

describe('StockService', () => {
    it('delegates stock view to repo', async () => {
        const stock: IStockRepo = {
            get: vi.fn(),
            upsert: vi.fn(),
            listView: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, limit: 20 })
        }
        const service = new StockService(stock)
        const result = await service.listView({}, { userId: 'u1', correlationId: 'c1' })

        expect(stock.listView).toHaveBeenCalledWith({})
        expect(result.total).toBe(0)
    })
})
