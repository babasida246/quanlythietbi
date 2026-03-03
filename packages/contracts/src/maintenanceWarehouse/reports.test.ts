import { describe, it, expect } from 'vitest'
import type { FefoLotRow, StockOnHandRow, ValuationResult } from './reports.js'

describe('maintenanceWarehouse reports contracts', () => {
    it('defines stock on hand row shape', () => {
        const row: StockOnHandRow = {
            partId: 'part-1',
            partCode: 'P-001',
            partName: 'SSD',
            warehouseId: 'wh-1',
            warehouseName: 'Main',
            onHand: 5,
            minLevel: 1
        }
        expect(row.onHand).toBe(5)
    })

    it('defines valuation result shape', () => {
        const result: ValuationResult = {
            total: 100,
            currency: 'USD',
            items: []
        }
        expect(result.currency).toBe('USD')
    })

    it('defines FEFO lot shape', () => {
        const lot: FefoLotRow = {
            lotId: 'lot-1',
            lotNumber: 'LOT-001',
            partId: 'part-1',
            partCode: 'P-001',
            partName: 'SSD',
            warehouseId: 'wh-1',
            warehouseName: 'Main',
            onHand: 3,
            status: 'warning'
        }
        expect(lot.status).toBe('warning')
    })
})
