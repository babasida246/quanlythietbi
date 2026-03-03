import { describe, it, expect } from 'vitest'
import type { SparePartRecord } from './spareParts.js'

describe('maintenanceWarehouse spare parts contracts', () => {
    it('defines spare part record shape', () => {
        const record: SparePartRecord = {
            id: 'part-1',
            partCode: 'P-001',
            name: 'SSD',
            spec: {},
            minLevel: 0,
            createdAt: new Date()
        }
        expect(record.partCode).toBe('P-001')
    })
})
