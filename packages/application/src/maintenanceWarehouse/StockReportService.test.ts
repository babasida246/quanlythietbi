import { describe, it, expect, vi } from 'vitest'
import { StockReportService } from './StockReportService.js'
import type { IStockReportRepo } from '@qltb/contracts'

describe('StockReportService', () => {
    it('delegates stock on hand reporting to repo', async () => {
        const repo: IStockReportRepo = {
            stockOnHand: vi.fn().mockResolvedValue([{ partId: 'p1', partCode: 'P1', partName: 'SSD', warehouseId: 'w1', warehouseName: 'Main', onHand: 1, minLevel: 0 }]),
            stockAvailable: vi.fn(),
            reorderAlerts: vi.fn(),
            fefoLots: vi.fn(),
            valuation: vi.fn()
        }

        const service = new StockReportService(repo)
        const ctx = { userId: 'u1', correlationId: 'c1' }
        const result = await service.stockOnHand({ warehouseId: 'w1' }, ctx)

        expect(repo.stockOnHand).toHaveBeenCalledWith({ warehouseId: 'w1' })
        expect(result).toHaveLength(1)
    })
})
