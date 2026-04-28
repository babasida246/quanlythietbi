import { describe, it, expect, vi } from 'vitest'
import { StockDocumentService } from './StockDocumentService.js'
import type {
    IOpsEventRepo,
    IStockDocumentRepo,
    IMovementRepo,
    IWarehouseUnitOfWork,
    StockDocumentLineRecord,
    StockDocumentRecord
} from '@qltb/contracts'

function makeDocument(overrides: Partial<StockDocumentRecord> = {}): StockDocumentRecord {
    return {
        id: 'doc-1',
        docType: 'receipt',
        code: 'SD-001',
        status: 'draft',
        warehouseId: 'wh-1',
        targetWarehouseId: null,
        docDate: '2025-01-01',
        refType: null,
        refId: null,
        note: null,
        createdBy: 'creator-1',
        approvedBy: null,
        correlationId: 'corr-1',
        createdAt: new Date(),
        updatedAt: new Date(),
        ...overrides
    }
}

function createDeps(overrides: Partial<IStockDocumentRepo> = {}) {
    const documents: IStockDocumentRepo = {
        create: vi.fn().mockResolvedValue(makeDocument()),
        update: vi.fn(),
        getById: vi.fn(),
        list: vi.fn(),
        listLines: vi.fn(),
        replaceLines: vi.fn().mockResolvedValue([]),
        setStatus: vi.fn(),
        setAssetOnLine: vi.fn(),
        findByRefRequest: vi.fn(),
        ...overrides
    }
    const modelStock = {
        get: vi.fn(), getForUpdate: vi.fn(),
        upsert: vi.fn(),
        adjustStock: vi.fn().mockResolvedValue({ id: 's-1', warehouseId: 'wh-1', modelId: 'model-1', onHand: 10, reserved: 0, updatedAt: new Date() }),
        reserve: vi.fn(), release: vi.fn(), commitReserved: vi.fn(), listView: vi.fn()
    }
    const modelMovements = { addMany: vi.fn(), list: vi.fn() } as unknown as IMovementRepo
    const unitOfWork = {
        withTransaction: vi.fn(async (handler: (tx: any) => Promise<unknown>) => {
            const tx = {
                documents,
                modelStock,
                modelMovements,
                repairs: {},
                repairParts: {},
                assets: { create: vi.fn().mockResolvedValue({ id: 'asset-1', assetCode: 'TBI-2026-000001' }), getById: vi.fn(), update: vi.fn() }
            }
            return await handler(tx)
        })
    } as unknown as IWarehouseUnitOfWork
    const opsEvents = { append: vi.fn() } as unknown as IOpsEventRepo
    return { documents, modelStock, modelMovements, unitOfWork, opsEvents }
}

function makeLine(overrides: Partial<StockDocumentLineRecord> = {}): StockDocumentLineRecord {
    return {
        id: 'line-1',
        documentId: 'doc-1',
        lineType: 'qty',
        assetModelId: 'model-1',
        qty: 1,
        unitCost: null,
        serialNo: null,
        note: null,
        adjustDirection: null,
        ...overrides
    }
}

describe('StockDocumentService', () => {
    it('creates documents and lines', async () => {
        const doc = makeDocument()
        const { documents, modelMovements, unitOfWork, opsEvents } = createDeps({
            create: vi.fn().mockResolvedValue(doc)
        })
        const service = new StockDocumentService(documents, modelMovements, unitOfWork, opsEvents)
        const ctx = { userId: 'user-1', correlationId: 'corr-1' }

        const result = await service.createDocument({ docType: 'receipt', code: 'SD-001' }, [], ctx)
        expect(documents.create).toHaveBeenCalled()
        expect(result.document.code).toBe('SD-001')
    })

    it('submits draft document with lines', async () => {
        const submitted = makeDocument({ status: 'submitted' })
        const { documents, modelMovements, unitOfWork, opsEvents } = createDeps({
            getById: vi.fn().mockResolvedValue(makeDocument({ status: 'draft', createdBy: 'creator-1' })),
            listLines: vi.fn().mockResolvedValue([{ assetModelId: 'model-1', lineType: 'qty', qty: 2 }]),
            setStatus: vi.fn().mockResolvedValue(submitted)
        })
        const service = new StockDocumentService(documents, modelMovements, unitOfWork, opsEvents)

        const result = await service.submitDocument('doc-1', { userId: 'approver-1', correlationId: 'corr-1' })

        expect(result.status).toBe('submitted')
        expect(documents.setStatus).toHaveBeenCalledWith('doc-1', 'submitted', null)
        expect(opsEvents.append).toHaveBeenCalledWith(expect.objectContaining({
            eventType: 'STOCK_DOC_SUBMITTED',
            entityId: 'doc-1'
        }))
    })

    it('prevents creator from approving the same document', async () => {
        const { documents, modelMovements, unitOfWork } = createDeps({
            getById: vi.fn().mockResolvedValue(makeDocument({ status: 'submitted', createdBy: 'user-1' })),
            listLines: vi.fn().mockResolvedValue([{ assetModelId: 'model-1', lineType: 'qty', qty: 1 }])
        })
        const service = new StockDocumentService(documents, modelMovements, unitOfWork)

        await expect(service.approveDocument('doc-1', { userId: 'user-1', correlationId: 'corr-1' }))
            .rejects.toMatchObject({ httpStatus: 403 })
        expect(documents.setStatus).not.toHaveBeenCalled()
    })

    it('approves submitted document and stores approver id', async () => {
        const approved = makeDocument({ status: 'approved', approvedBy: 'approver-1' })
        const { documents, modelMovements, unitOfWork, opsEvents } = createDeps({
            getById: vi.fn().mockResolvedValue(makeDocument({ status: 'submitted', createdBy: 'creator-1' })),
            listLines: vi.fn().mockResolvedValue([{ assetModelId: 'model-1', lineType: 'qty', qty: 1 }]),
            setStatus: vi.fn().mockResolvedValue(approved)
        })
        const service = new StockDocumentService(documents, modelMovements, unitOfWork, opsEvents)

        const result = await service.approveDocument('doc-1', { userId: 'approver-1', correlationId: 'corr-1' })

        expect(result.status).toBe('approved')
        expect(result.approvedBy).toBe('approver-1')
        expect(documents.setStatus).toHaveBeenCalledWith('doc-1', 'approved', 'approver-1')
        expect(opsEvents.append).toHaveBeenCalledWith(expect.objectContaining({
            eventType: 'STOCK_DOC_APPROVED',
            entityId: 'doc-1'
        }))
    })

    it('rejects posting non-approved document', async () => {
        const { documents, modelMovements, unitOfWork } = createDeps({
            getById: vi.fn().mockResolvedValue(makeDocument({ status: 'draft' }))
        })
        const service = new StockDocumentService(documents, modelMovements, unitOfWork)

        await expect(service.postDocument('doc-1', { userId: 'poster-1', correlationId: 'corr-1' }))
            .rejects.toMatchObject({ httpStatus: 400, message: 'Only approved documents can be posted' })
    })

    it('prevents creator from posting approved document', async () => {
        const { documents, modelMovements, unitOfWork } = createDeps({
            getById: vi.fn().mockResolvedValue(makeDocument({
                status: 'approved',
                createdBy: 'user-1',
                approvedBy: 'approver-1'
            })),
            listLines: vi.fn().mockResolvedValue([makeLine()])
        })
        const service = new StockDocumentService(documents, modelMovements, unitOfWork)

        await expect(service.postDocument('doc-1', { userId: 'user-1', correlationId: 'corr-1' }))
            .rejects.toMatchObject({ httpStatus: 403 })
    })

    it('posts approved document and preserves approver id', async () => {
        const approvedDoc = makeDocument({
            docType: 'receipt',
            status: 'approved',
            warehouseId: 'wh-1',
            createdBy: 'creator-1',
            approvedBy: 'approver-1'
        })
        const postedDoc = makeDocument({
            docType: 'receipt',
            status: 'posted',
            warehouseId: 'wh-1',
            createdBy: 'creator-1',
            approvedBy: 'approver-1'
        })
        const { documents, modelStock, modelMovements, unitOfWork, opsEvents } = createDeps({
            getById: vi.fn().mockResolvedValue(approvedDoc),
            listLines: vi.fn().mockResolvedValue([makeLine({ qty: 2, unitCost: 10 })]),
            setStatus: vi.fn().mockResolvedValue(postedDoc)
        })
        const service = new StockDocumentService(documents, modelMovements, unitOfWork, opsEvents)

        const result = await service.postDocument('doc-1', { userId: 'poster-1', correlationId: 'corr-1' })

        expect(result.status).toBe('posted')
        expect(result.approvedBy).toBe('approver-1')
        expect(documents.setStatus).toHaveBeenCalledWith('doc-1', 'posted', 'approver-1', null)
        expect(modelStock.adjustStock).toHaveBeenCalled()
        expect(modelMovements.addMany).toHaveBeenCalled()
        expect(opsEvents.append).toHaveBeenCalledWith(expect.objectContaining({
            eventType: 'STOCK_DOC_POSTED',
            entityId: 'doc-1'
        }))
    })

    it('allows canceling approved document before posting', async () => {
        const canceled = makeDocument({ status: 'canceled', approvedBy: 'approver-1' })
        const { documents, modelMovements, unitOfWork, opsEvents } = createDeps({
            getById: vi.fn().mockResolvedValue(makeDocument({ status: 'approved', approvedBy: 'approver-1' })),
            setStatus: vi.fn().mockResolvedValue(canceled)
        })
        const service = new StockDocumentService(documents, modelMovements, unitOfWork, opsEvents)

        const result = await service.cancelDocument('doc-1', { userId: 'poster-1', correlationId: 'corr-1' })

        expect(result.status).toBe('canceled')
        expect(documents.setStatus).toHaveBeenCalledWith('doc-1', 'canceled', 'approver-1')
        expect(opsEvents.append).toHaveBeenCalledWith(expect.objectContaining({
            eventType: 'STOCK_DOC_CANCELED',
            payload: expect.objectContaining({ previousStatus: 'approved' })
        }))
    })

    // ── postDocument extended: delta directions, transfer, adjust, idempotency ──

    it('posts ISSUE → adjustStock with negative delta per line', async () => {
        const issueDoc = makeDocument({
            docType: 'issue',
            status: 'approved',
            warehouseId: 'wh-1',
            createdBy: 'creator-1',
            approvedBy: 'approver-1',
        })
        const issueLines = [
            makeLine({ assetModelId: 'model-1', qty: 5 }),
            makeLine({ id: 'line-2', assetModelId: 'model-2', qty: 2 }),
        ]
        const postedDoc = makeDocument({ ...issueDoc, status: 'posted' })
        const { documents, modelStock, modelMovements, unitOfWork } = createDeps({
            getById: vi.fn().mockResolvedValue(issueDoc),
            listLines: vi.fn().mockResolvedValue(issueLines),
            setStatus: vi.fn().mockResolvedValue(postedDoc),
        })
        const service = new StockDocumentService(documents, modelMovements, unitOfWork)
        await service.postDocument('doc-1', { userId: 'poster-1', correlationId: 'corr-1' })

        expect(modelStock.adjustStock).toHaveBeenCalledWith('wh-1', 'model-1', -5)
        expect(modelStock.adjustStock).toHaveBeenCalledWith('wh-1', 'model-2', -2)
        const movArg = vi.mocked(modelMovements.addMany).mock.calls[0][0]
        expect(movArg.every((m: { movementType: string }) => m.movementType === 'out')).toBe(true)
    })

    it('posts TRANSFER → two stock changes per line (transfer_out + transfer_in)', async () => {
        const transferDoc = makeDocument({
            docType: 'transfer',
            status: 'approved',
            warehouseId: 'wh-1',
            targetWarehouseId: 'wh-2',
            createdBy: 'creator-1',
            approvedBy: 'approver-1',
        })
        const lines = [makeLine({ assetModelId: 'model-1', qty: 3 })]
        const postedDoc = makeDocument({ ...transferDoc, status: 'posted' })
        const { documents, modelStock, modelMovements, unitOfWork } = createDeps({
            getById: vi.fn().mockResolvedValue(transferDoc),
            listLines: vi.fn().mockResolvedValue(lines),
            setStatus: vi.fn().mockResolvedValue(postedDoc),
        })
        const service = new StockDocumentService(documents, modelMovements, unitOfWork)
        await service.postDocument('doc-1', { userId: 'poster-1', correlationId: 'corr-1' })

        // source decremented, dest incremented
        expect(modelStock.adjustStock).toHaveBeenCalledWith('wh-1', 'model-1', -3)
        expect(modelStock.adjustStock).toHaveBeenCalledWith('wh-2', 'model-1', 3)
        const movArg = vi.mocked(modelMovements.addMany).mock.calls[0][0]
        const types = movArg.map((m: { movementType: string }) => m.movementType)
        expect(types).toContain('transfer_out')
        expect(types).toContain('transfer_in')
        expect(movArg).toHaveLength(2)
    })

    it('posts ADJUST minus direction → negative delta, movementType adjust_out', async () => {
        const adjustDoc = makeDocument({
            docType: 'adjust',
            status: 'approved',
            warehouseId: 'wh-1',
            createdBy: 'creator-1',
            approvedBy: 'approver-1',
        })
        const lines = [makeLine({ assetModelId: 'model-1', qty: 4, adjustDirection: 'minus' })]
        const postedDoc = makeDocument({ ...adjustDoc, status: 'posted' })
        const { documents, modelStock, modelMovements, unitOfWork } = createDeps({
            getById: vi.fn().mockResolvedValue(adjustDoc),
            listLines: vi.fn().mockResolvedValue(lines),
            setStatus: vi.fn().mockResolvedValue(postedDoc),
        })
        const service = new StockDocumentService(documents, modelMovements, unitOfWork)
        await service.postDocument('doc-1', { userId: 'poster-1', correlationId: 'corr-1' })

        expect(modelStock.adjustStock).toHaveBeenCalledWith('wh-1', 'model-1', -4)
        const movArg = vi.mocked(modelMovements.addMany).mock.calls[0][0]
        expect(movArg[0]).toMatchObject({ movementType: 'adjust_out', qty: 4 })
    })

    it('returns existing document without transaction when already posted with same idempotency key', async () => {
        const idemKey = 'idem-abc-123'
        const alreadyPosted = makeDocument({
            status: 'posted',
            approvedBy: 'approver-1',
            idempotencyKey: idemKey,
        } as Partial<StockDocumentRecord> & { idempotencyKey: string })
        const { documents, modelMovements, unitOfWork, modelStock } = createDeps({
            getById: vi.fn().mockResolvedValue(alreadyPosted),
        })
        const service = new StockDocumentService(documents, modelMovements, unitOfWork)

        const result = await service.postDocument('doc-1', { userId: 'poster-1', correlationId: 'corr-1' }, idemKey)

        expect(result.status).toBe('posted')
        // Must NOT enter the transaction
        expect(unitOfWork.withTransaction).not.toHaveBeenCalled()
        expect(modelStock.adjustStock).not.toHaveBeenCalled()
    })

    it('passes idempotency key through to setStatus', async () => {
        const key = 'my-key-xyz'
        const approvedDoc = makeDocument({
            docType: 'receipt',
            status: 'approved',
            createdBy: 'creator-1',
            approvedBy: 'approver-1',
        })
        const postedDoc = makeDocument({ status: 'posted', approvedBy: 'approver-1' })
        const { documents, modelMovements, unitOfWork } = createDeps({
            getById: vi.fn().mockResolvedValue(approvedDoc),
            listLines: vi.fn().mockResolvedValue([makeLine()]),
            setStatus: vi.fn().mockResolvedValue(postedDoc),
        })
        const service = new StockDocumentService(documents, modelMovements, unitOfWork)
        await service.postDocument('doc-1', { userId: 'poster-1', correlationId: 'corr-1' }, key)

        expect(documents.setStatus).toHaveBeenCalledWith('doc-1', 'posted', 'approver-1', key)
    })

    it('propagates error from adjustStock (e.g. insufficient stock)', async () => {
        const approvedDoc = makeDocument({
            docType: 'issue',
            status: 'approved',
            createdBy: 'creator-1',
            approvedBy: 'approver-1',
        })
        const { documents, modelStock, modelMovements, unitOfWork } = createDeps({
            getById: vi.fn().mockResolvedValue(approvedDoc),
            listLines: vi.fn().mockResolvedValue([makeLine({ qty: 9999 })]),
        })
        // Make adjustStock inside the transaction fail
        vi.mocked(modelStock.adjustStock).mockRejectedValue(
            Object.assign(new Error('Insufficient stock available'), { statusCode: 400 })
        )
        const service = new StockDocumentService(documents, modelMovements, unitOfWork)

        await expect(service.postDocument('doc-1', { userId: 'poster-1', correlationId: 'corr-1' }))
            .rejects.toThrow('Insufficient stock available')
    })
})
