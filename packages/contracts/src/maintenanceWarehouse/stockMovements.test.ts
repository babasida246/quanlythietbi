import { describe, it, expect } from 'vitest'
import type { StockMovementRecord, StockViewRecord } from './stockMovements.js'

describe('maintenanceWarehouse stock movements contracts', () => {
    it('defines stock movement record shape', () => {
        const record: StockMovementRecord = {
            id: 'mv-1',
            warehouseId: 'wh-1',
            partId: 'part-1',
            movementType: 'in',
            qty: 5,
            createdAt: new Date()
        }
        expect(record.movementType).toBe('in')
    })

    it('defines stock view shape', () => {
        const view: StockViewRecord = {
            warehouseId: 'wh-1',
            warehouseCode: 'WH-01',
            warehouseName: 'Main',
            partId: 'part-1',
            partCode: 'P-001',
            partName: 'SSD',
            onHand: 10,
            reserved: 0,
            available: 10,
            minLevel: 2
        }
        expect(view.available).toBe(10)
    })
})
