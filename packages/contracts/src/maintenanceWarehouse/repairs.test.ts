import { describe, it, expect } from 'vitest'
import type { RepairOrderRecord, RepairOrderPartRecord } from './repairs.js'

describe('maintenanceWarehouse repairs contracts', () => {
    it('defines repair order record shape', () => {
        const record: RepairOrderRecord = {
            id: 'repair-1',
            assetId: 'asset-1',
            code: 'RO-2025-000001',
            title: 'Replace SSD',
            severity: 'low',
            status: 'open',
            openedAt: new Date(),
            repairType: 'internal',
            createdAt: new Date(),
            updatedAt: new Date()
        }
        expect(record.status).toBe('open')
    })

    it('defines repair part record shape', () => {
        const part: RepairOrderPartRecord = {
            id: 'part-1',
            repairOrderId: 'repair-1',
            action: 'replace',
            qty: 1,
            createdAt: new Date()
        }
        expect(part.action).toBe('replace')
    })
})
