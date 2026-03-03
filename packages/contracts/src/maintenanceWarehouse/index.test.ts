import { describe, it, expect } from 'vitest'
import {
    type WarehouseRecord,
    type SparePartRecord,
    type StockDocumentRecord,
    type StockMovementRecord,
    type RepairOrderRecord,
    type OpsAttachmentRecord
} from './index.js'

describe('maintenanceWarehouse contracts index', () => {
    it('exports core types', () => {
        const warehouse: WarehouseRecord = {
            id: 'wh-1',
            code: 'WH-01',
            name: 'Main',
            createdAt: new Date()
        }
        const part: SparePartRecord = {
            id: 'part-1',
            partCode: 'P-001',
            name: 'SSD',
            spec: {},
            minLevel: 0,
            createdAt: new Date()
        }
        const doc: StockDocumentRecord = {
            id: 'doc-1',
            docType: 'receipt',
            code: 'SD-001',
            status: 'draft',
            docDate: '2025-01-01',
            createdAt: new Date(),
            updatedAt: new Date()
        }
        const movement: StockMovementRecord = {
            id: 'mv-1',
            warehouseId: warehouse.id,
            partId: part.id,
            movementType: 'in',
            qty: 1,
            createdAt: new Date()
        }
        const repair: RepairOrderRecord = {
            id: 'repair-1',
            assetId: 'asset-1',
            code: 'RO-001',
            title: 'Test',
            severity: 'low',
            status: 'open',
            openedAt: new Date(),
            repairType: 'internal',
            createdAt: new Date(),
            updatedAt: new Date()
        }
        const attachment: OpsAttachmentRecord = {
            id: 'att-1',
            entityType: 'stock_document',
            entityId: doc.id,
            fileName: 'doc.pdf',
            storageKey: 'stock/doc.pdf',
            version: 1,
            createdAt: new Date()
        }
        expect(warehouse.id).toBe('wh-1')
        expect(part.id).toBe('part-1')
        expect(doc.id).toBe('doc-1')
        expect(movement.id).toBe('mv-1')
        expect(repair.id).toBe('repair-1')
        expect(attachment.id).toBe('att-1')
    })
})
