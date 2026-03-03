import { describe, it, expect } from 'vitest'
import type { OpsAttachmentRecord } from './attachments.js'

describe('maintenanceWarehouse attachments contracts', () => {
    it('defines ops attachment record shape', () => {
        const record: OpsAttachmentRecord = {
            id: 'att-1',
            entityType: 'repair_order',
            entityId: 'repair-1',
            fileName: 'photo.jpg',
            storageKey: 'repairs/repair-1/photo.jpg',
            version: 1,
            createdAt: new Date()
        }
        expect(record.entityType).toBe('repair_order')
    })
})
