import { describe, it, expect } from 'vitest'
import type { WarehouseRecord } from './warehouses.js'

describe('maintenanceWarehouse warehouses contracts', () => {
    it('defines warehouse record shape', () => {
        const record: WarehouseRecord = {
            id: 'wh-1',
            code: 'WH-01',
            name: 'Main',
            createdAt: new Date()
        }
        expect(record.code).toBe('WH-01')
    })
})
