import Fastify from 'fastify'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { stockDocumentRoutes } from './stock-documents.routes.js'

function makeDocument(overrides: Record<string, unknown> = {}) {
    return {
        id: '11111111-1111-1111-1111-111111111111',
        docType: 'receipt',
        code: 'SD-001',
        status: 'draft',
        warehouseId: '22222222-2222-2222-2222-222222222222',
        targetWarehouseId: null,
        docDate: '2026-02-23',
        refType: null,
        refId: null,
        note: null,
        createdBy: 'creator-1',
        approvedBy: null,
        correlationId: 'corr-1',
        createdAt: new Date('2026-02-23T00:00:00Z'),
        updatedAt: new Date('2026-02-23T00:00:00Z'),
        ...overrides
    }
}

function createMockService() {
    return {
        listDocuments: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, limit: 20 }),
        getDocument: vi.fn().mockResolvedValue({ document: makeDocument(), lines: [] }),
        createDocument: vi.fn().mockResolvedValue({ document: makeDocument(), lines: [] }),
        updateDocument: vi.fn().mockResolvedValue({ document: makeDocument(), lines: [] }),
        submitDocument: vi.fn().mockResolvedValue(makeDocument({ status: 'submitted' })),
        approveDocument: vi.fn().mockResolvedValue(makeDocument({ status: 'approved', approvedBy: 'approver-1' })),
        postDocument: vi.fn().mockResolvedValue(makeDocument({ status: 'posted', approvedBy: 'approver-1' })),
        cancelDocument: vi.fn().mockResolvedValue(makeDocument({ status: 'canceled' })),
        listMovements: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, limit: 20 })
    }
}

async function createTestApp() {
    const app = Fastify()
    app.addHook('onRequest', async (request) => {
        const userId = request.headers['x-test-user-id']
        const role = request.headers['x-test-user-role']
        if (typeof userId === 'string' && typeof role === 'string') {
            ;(request as any).user = { id: userId, role }
        }
    })

    const stockDocumentService = createMockService()
    await app.register(stockDocumentRoutes, {
        stockDocumentService: stockDocumentService as any
    })
    return { app, stockDocumentService }
}

afterEach(() => {
    vi.restoreAllMocks()
})

describe('stockDocumentRoutes', () => {
    it('submits document for it asset manager (manager alias accepted)', async () => {
        const { app, stockDocumentService } = await createTestApp()
        try {
            const response = await app.inject({
                method: 'POST',
                url: '/stock-documents/11111111-1111-1111-1111-111111111111/submit',
                headers: {
                    'x-test-user-id': 'user-1',
                    'x-test-user-role': 'manager',
                    'x-correlation-id': 'corr-submit'
                }
            })

            expect(response.statusCode).toBe(200)
            expect(stockDocumentService.submitDocument).toHaveBeenCalledWith(
                '11111111-1111-1111-1111-111111111111',
                expect.objectContaining({ userId: 'user-1', correlationId: 'corr-submit' })
            )
            expect(response.json().data).toMatchObject({ status: 'submitted' })
        } finally {
            await app.close()
        }
    })

    it('forbids viewer from approving document', async () => {
        const { app, stockDocumentService } = await createTestApp()
        try {
            const response = await app.inject({
                method: 'POST',
                url: '/stock-documents/11111111-1111-1111-1111-111111111111/approve',
                headers: {
                    'x-test-user-id': 'user-2',
                    'x-test-user-role': 'viewer'
                }
            })

            expect(response.statusCode).toBe(403)
            expect(stockDocumentService.approveDocument).not.toHaveBeenCalled()
        } finally {
            await app.close()
        }
    })

    it('approves, posts, and cancels using workflow endpoints', async () => {
        const { app, stockDocumentService } = await createTestApp()
        try {
            const headers = {
                'x-test-user-id': 'manager-1',
                'x-test-user-role': 'it_asset_manager'
            }

            const approveResponse = await app.inject({
                method: 'POST',
                url: '/stock-documents/11111111-1111-1111-1111-111111111111/approve',
                headers
            })
            expect(approveResponse.statusCode).toBe(200)
            expect(stockDocumentService.approveDocument).toHaveBeenCalledWith(
                '11111111-1111-1111-1111-111111111111',
                expect.objectContaining({ userId: 'manager-1' })
            )

            const postResponse = await app.inject({
                method: 'POST',
                url: '/stock-documents/11111111-1111-1111-1111-111111111111/post',
                headers
            })
            expect(postResponse.statusCode).toBe(200)
            expect(stockDocumentService.postDocument).toHaveBeenCalled()

            const cancelResponse = await app.inject({
                method: 'POST',
                url: '/stock-documents/11111111-1111-1111-1111-111111111111/cancel',
                headers
            })
            expect(cancelResponse.statusCode).toBe(200)
            expect(stockDocumentService.cancelDocument).toHaveBeenCalled()
        } finally {
            await app.close()
        }
    })
})
