import { describe, it, expect, vi } from 'vitest'
import { StockDocumentService } from '../StockDocumentService.js'
import type {
    IStockDocumentRepo,
    IMovementRepo,
    IWarehouseUnitOfWork,
    StockDocumentRecord,
    StockDocumentLineInput,
} from '@qltb/contracts'
import type { MaintenanceWarehouseContext } from '../types.js'

// ──────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────

const ctx: MaintenanceWarehouseContext = {
    userId: 'poster-user',
    correlationId: 'corr-001',
}

function makeDoc(overrides: Partial<StockDocumentRecord> = {}): StockDocumentRecord {
    return {
        id: 'doc-1',
        docType: 'receipt',
        status: 'approved',
        docDate: '2024-01-01',
        warehouseId: 'wh-1',
        targetWarehouseId: null,
        createdBy: 'creator-user',
        approvedBy: 'approver-user',
        idempotencyKey: null,
        note: null,
        refType: null,
        refId: null,
        supplier: null,
        submitterName: null,
        receiverName: null,
        department: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ...overrides,
    } as unknown as StockDocumentRecord
}

function makeLines(count = 1): StockDocumentLineInput[] {
    return Array.from({ length: count }, (_, i) => ({
        lineType: 'qty' as const,
        assetModelId: `part-${i + 1}`,
        qty: 5,
        unitCost: 100,
        serialNo: null,
        adjustDirection: null,
        note: null,
        specFields: null,
    }))
}

// ──────────────────────────────────────────────────────────────
// Mock factory
// ──────────────────────────────────────────────────────────────

function buildService(docOverride: Partial<StockDocumentRecord> = {}, linesOverride?: StockDocumentLineInput[]) {
    const doc = makeDoc(docOverride)
    const lines = linesOverride ?? makeLines()

    const postedDoc: StockDocumentRecord = { ...doc, status: 'posted', idempotencyKey: null }

    // tx-level mocks
    const txAdjustStock = vi.fn().mockResolvedValue(undefined)
    const txAddMany = vi.fn().mockResolvedValue(undefined)
    const txSetStatus = vi.fn().mockResolvedValue(postedDoc)

    const mockDocuments = {
        getById: vi.fn().mockResolvedValue(doc),
        listLines: vi.fn().mockResolvedValue(lines),
        setStatus: vi.fn().mockResolvedValue({ ...doc, status: 'posted' }),
        replaceLines: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        list: vi.fn(),
        delete: vi.fn(),
        findByRefRequest: vi.fn().mockResolvedValue(null),
        setAssetOnLine: vi.fn().mockResolvedValue(undefined),
    } as unknown as IStockDocumentRepo

    const mockMovements = {
        addMany: vi.fn().mockResolvedValue(undefined),
        list: vi.fn(),
    } as unknown as IMovementRepo

    const mockUoW = {
        withTransaction: vi.fn().mockImplementation((fn: Function) =>
            fn({ modelStock: { adjustStock: txAdjustStock }, modelMovements: { addMany: txAddMany }, documents: { setStatus: txSetStatus } })
        ),
    } as unknown as IWarehouseUnitOfWork

    const service = new StockDocumentService(mockDocuments, mockMovements, mockUoW)

    return { service, mockDocuments, mockMovements, mockUoW, txAdjustStock, txAddMany, txSetStatus, doc, postedDoc }
}

// ──────────────────────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────────────────────

describe('StockDocumentService.postDocument', () => {
    describe('guard conditions', () => {
        it('throws NOT_FOUND when document does not exist', async () => {
            const { service, mockDocuments } = buildService()
            mockDocuments.getById = vi.fn().mockResolvedValue(null)
            await expect(service.postDocument('doc-1', ctx)).rejects.toMatchObject({ httpStatus: 404 })
        })

        it('throws BAD_REQUEST when status is draft (not approved)', async () => {
            const { service } = buildService({ status: 'draft' })
            await expect(service.postDocument('doc-1', ctx)).rejects.toMatchObject({
                httpStatus: 400,
                message: expect.stringMatching(/Only approved documents can be posted/i),
            })
        })

        it('throws BAD_REQUEST when status is submitted', async () => {
            const { service } = buildService({ status: 'submitted' })
            await expect(service.postDocument('doc-1', ctx)).rejects.toMatchObject({ httpStatus: 400 })
        })

        it('throws BAD_REQUEST when approved document is missing approvedBy', async () => {
            const { service } = buildService({ approvedBy: null })
            await expect(service.postDocument('doc-1', ctx)).rejects.toMatchObject({ httpStatus: 400 })
        })

        it('throws FORBIDDEN when creator tries to post their own document', async () => {
            const ctxAsCreator: MaintenanceWarehouseContext = { userId: 'creator-user', correlationId: 'c' }
            const { service } = buildService({ createdBy: 'creator-user' })
            await expect(service.postDocument('doc-1', ctxAsCreator)).rejects.toMatchObject({ httpStatus: 403 })
        })

        it('throws FORBIDDEN when approver tries to post their own approval', async () => {
            const ctxAsApprover: MaintenanceWarehouseContext = { userId: 'approver-user', correlationId: 'c' }
            const { service } = buildService({ approvedBy: 'approver-user' })
            await expect(service.postDocument('doc-1', ctxAsApprover)).rejects.toMatchObject({ httpStatus: 403 })
        })

        it('throws BAD_REQUEST when document has no lines (assertStockDocLines)', async () => {
            const { service, mockDocuments } = buildService()
            mockDocuments.listLines = vi.fn().mockResolvedValue([])
            await expect(service.postDocument('doc-1', ctx)).rejects.toMatchObject({ httpStatus: 400 })
        })
    })

    describe('idempotency', () => {
        it('returns existing posted document when idempotencyKey matches', async () => {
            const key = 'idem-key-42'
            const { service, txAdjustStock } = buildService({ status: 'posted', idempotencyKey: key })

            const result = await service.postDocument('doc-1', ctx, key)

            expect(result.status).toBe('posted')
            // adjustStock must never be called — early return
            expect(txAdjustStock).not.toHaveBeenCalled()
        })

        it('re-posts when idempotencyKey differs from stored key', async () => {
            // status='posted' does NOT match the new key → BAD_REQUEST because not 'approved'
            const { service } = buildService({ status: 'posted', idempotencyKey: 'old-key' })
            await expect(service.postDocument('doc-1', ctx, 'new-key')).rejects.toMatchObject({ httpStatus: 400 })
        })
    })

    describe('receipt posting', () => {
        it('calls adjustStock with positive delta per line', async () => {
            const { service, txAdjustStock } = buildService({ docType: 'receipt' }, makeLines(2))

            await service.postDocument('doc-1', ctx)

            expect(txAdjustStock).toHaveBeenCalledTimes(2)
            expect(txAdjustStock).toHaveBeenCalledWith('wh-1', 'part-1', 5)
            expect(txAdjustStock).toHaveBeenCalledWith('wh-1', 'part-2', 5)
        })

        it('records movements with movementType "in"', async () => {
            const { service, txAddMany } = buildService({ docType: 'receipt' })

            await service.postDocument('doc-1', ctx)

            expect(txAddMany).toHaveBeenCalledTimes(1)
            const [movements] = txAddMany.mock.calls[0] as [Array<{ movementType: string }>]
            expect(movements[0].movementType).toBe('in')
        })

        it('sets document status to posted', async () => {
            const { service, txSetStatus } = buildService({ docType: 'receipt' })

            await service.postDocument('doc-1', ctx)

            expect(txSetStatus).toHaveBeenCalledWith('doc-1', 'posted', 'approver-user', null)
        })

        it('returns the posted document record', async () => {
            const { service, postedDoc } = buildService({ docType: 'receipt' })

            const result = await service.postDocument('doc-1', ctx)

            expect(result.status).toBe('posted')
            expect(result.id).toBe(postedDoc.id)
        })
    })

    describe('issue posting', () => {
        it('calls adjustStock with negative delta for issue lines', async () => {
            const { service, txAdjustStock } = buildService({ docType: 'issue' })

            await service.postDocument('doc-1', ctx)

            const [, , delta] = txAdjustStock.mock.calls[0] as [string, string, number]
            expect(delta).toBe(-5)
        })

        it('records movements with movementType "out"', async () => {
            const { service, txAddMany } = buildService({ docType: 'issue' })

            await service.postDocument('doc-1', ctx)

            const [movements] = txAddMany.mock.calls[0] as [Array<{ movementType: string }>]
            expect(movements[0].movementType).toBe('out')
        })

        it('propagates "Insufficient stock available" error from adjustStock', async () => {
            const { service, mockUoW } = buildService({ docType: 'issue' })
            mockUoW.withTransaction = vi.fn().mockImplementation((fn: Function) =>
                fn({
                    modelStock: {
                        adjustStock: vi.fn().mockRejectedValue(Object.assign(new Error('Insufficient stock available'), { httpStatus: 400 })),
                    },
                    modelMovements: { addMany: vi.fn() },
                    documents: { setStatus: vi.fn() },
                })
            )

            await expect(service.postDocument('doc-1', ctx)).rejects.toMatchObject({
                message: expect.stringMatching(/Insufficient stock available/i),
            })
        })
    })

    describe('adjust posting', () => {
        it('uses positive delta and movementType "adjust_in" when direction is plus', async () => {
            const lines: StockDocumentLineInput[] = [{ lineType: 'qty', assetModelId: 'part-1', qty: 3, adjustDirection: 'plus', unitCost: null, serialNo: null, note: null, specFields: null }]
            const { service, txAdjustStock, txAddMany } = buildService({ docType: 'adjust' }, lines)

            await service.postDocument('doc-1', ctx)

            expect(txAdjustStock).toHaveBeenCalledWith('wh-1', 'part-1', 3)
            const [movements] = txAddMany.mock.calls[0] as [Array<{ movementType: string }>]
            expect(movements[0].movementType).toBe('adjust_in')
        })

        it('uses negative delta and movementType "adjust_out" when direction is minus', async () => {
            const lines: StockDocumentLineInput[] = [{ lineType: 'qty', assetModelId: 'part-1', qty: 3, adjustDirection: 'minus', unitCost: null, serialNo: null, note: null, specFields: null }]
            const { service, txAdjustStock, txAddMany } = buildService({ docType: 'adjust' }, lines)

            await service.postDocument('doc-1', ctx)

            expect(txAdjustStock).toHaveBeenCalledWith('wh-1', 'part-1', -3)
            const [movements] = txAddMany.mock.calls[0] as [Array<{ movementType: string }>]
            expect(movements[0].movementType).toBe('adjust_out')
        })
    })

    describe('transfer posting', () => {
        it('creates two movement changes: transfer_out from source, transfer_in to target', async () => {
            const { service, txAdjustStock, txAddMany } = buildService({
                docType: 'transfer',
                warehouseId: 'wh-src',
                targetWarehouseId: 'wh-dst',
            })

            await service.postDocument('doc-1', ctx)

            expect(txAdjustStock).toHaveBeenCalledTimes(2)
            expect(txAdjustStock).toHaveBeenCalledWith('wh-src', 'part-1', -5)
            expect(txAdjustStock).toHaveBeenCalledWith('wh-dst', 'part-1', 5)

            const [movements] = txAddMany.mock.calls[0] as [Array<{ movementType: string; warehouseId: string }>]
            const types = movements.map((m) => m.movementType)
            expect(types).toContain('transfer_out')
            expect(types).toContain('transfer_in')
        })

        it('throws BAD_REQUEST when targetWarehouseId is missing', async () => {
            const { service } = buildService({
                docType: 'transfer',
                warehouseId: 'wh-src',
                targetWarehouseId: null,
            })

            await expect(service.postDocument('doc-1', ctx)).rejects.toMatchObject({ httpStatus: 400 })
        })
    })
})
