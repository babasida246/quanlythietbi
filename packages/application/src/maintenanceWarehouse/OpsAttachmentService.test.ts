import { describe, it, expect, vi } from 'vitest'
import { OpsAttachmentService } from './OpsAttachmentService.js'
import type { IOpsAttachmentRepo, IRepairOrderRepo, IStockDocumentRepo, IOpsEventRepo } from '@qltb/contracts'

describe('OpsAttachmentService', () => {
    it('adds attachments with incremented version', async () => {
        const attachments: IOpsAttachmentRepo = {
            add: vi.fn().mockResolvedValue({
                id: 'att-2',
                entityType: 'repair_order',
                entityId: 'repair-1',
                fileName: 'doc.pdf',
                storageKey: 'repairs/doc.pdf',
                version: 2,
                createdAt: new Date()
            }),
            listByEntity: vi.fn().mockResolvedValue([{
                id: 'att-1',
                entityType: 'repair_order',
                entityId: 'repair-1',
                fileName: 'old.pdf',
                storageKey: 'repairs/old.pdf',
                version: 1,
                createdAt: new Date()
            }]),
            getById: vi.fn()
        }
        const repairs: IRepairOrderRepo = {
            create: vi.fn(),
            update: vi.fn(),
            getById: vi.fn().mockResolvedValue({
                id: 'repair-1',
                assetId: 'asset-1',
                code: 'RO-2025-000001',
                title: 'Fix',
                severity: 'low',
                status: 'open',
                openedAt: new Date(),
                repairType: 'internal',
                createdAt: new Date(),
                updatedAt: new Date()
            }),
            list: vi.fn()
        } as unknown as IRepairOrderRepo
        const documents: IStockDocumentRepo = {
            create: vi.fn(),
            update: vi.fn(),
            getById: vi.fn(),
            list: vi.fn(),
            listLines: vi.fn(),
            replaceLines: vi.fn(),
            setStatus: vi.fn()
        }
        const opsEvents = { append: vi.fn() } as unknown as IOpsEventRepo
        const service = new OpsAttachmentService(attachments, repairs, documents, opsEvents)

        const ctx = { userId: 'user-1', correlationId: 'corr-1' }
        const record = await service.addAttachment('repair_order', 'repair-1', {
            fileName: 'doc.pdf',
            storageKey: 'repairs/doc.pdf'
        }, ctx)

        expect(record.version).toBe(2)
        expect(attachments.add).toHaveBeenCalled()
    })
})
