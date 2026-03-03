import Fastify from 'fastify'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { repairOrderRoutes } from './repair-orders.routes.js'

const REPAIR_ID = '11111111-1111-1111-1111-111111111111'

function makeRepair(overrides: Record<string, unknown> = {}) {
    return {
        id: REPAIR_ID,
        assetId: '22222222-2222-2222-2222-222222222222',
        ciId: null,
        code: 'RO-2026-000001',
        title: 'Replace fan',
        description: null,
        severity: 'medium',
        status: 'open',
        openedAt: new Date('2026-02-23T00:00:00Z'),
        closedAt: null,
        diagnosis: null,
        resolution: null,
        repairType: 'internal',
        technicianName: 'Tech A',
        vendorId: null,
        laborCost: 0,
        partsCost: 0,
        downtimeMinutes: 0,
        createdBy: 'user-1',
        correlationId: 'corr-1',
        createdAt: new Date('2026-02-23T00:00:00Z'),
        updatedAt: new Date('2026-02-23T00:00:00Z'),
        ...overrides
    }
}

function createMockRepairService() {
    return {
        listRepairs: vi.fn().mockResolvedValue({ items: [makeRepair()], total: 1, page: 1, limit: 20 }),
        getRepairSummary: vi.fn().mockResolvedValue({
            total: 3,
            activeCount: 2,
            closedCount: 1,
            canceledCount: 0,
            totalLaborCost: 200,
            totalPartsCost: 150,
            totalCost: 350,
            totalDowntimeMinutes: 180,
            avgDowntimeMinutes: 60,
            avgResolutionHours: 12,
            byStatus: {
                open: 1,
                diagnosing: 1,
                waiting_parts: 0,
                repaired: 0,
                closed: 1,
                canceled: 0
            },
            bySeverity: {
                low: 0,
                medium: 2,
                high: 1,
                critical: 0
            },
            byType: {
                internal: 2,
                vendor: 1
            }
        }),
        getRepairDetail: vi.fn().mockResolvedValue({ order: makeRepair(), parts: [] }),
        createRepairOrder: vi.fn().mockResolvedValue(makeRepair()),
        updateRepairOrder: vi.fn().mockResolvedValue(makeRepair({ title: 'Updated title' })),
        changeStatus: vi.fn().mockResolvedValue(makeRepair({ status: 'closed', closedAt: new Date('2026-02-24T00:00:00Z') })),
        addRepairPart: vi.fn().mockResolvedValue({
            order: makeRepair({ partsCost: 20 }),
            parts: [{
                id: 'part-log-1',
                repairOrderId: REPAIR_ID,
                partId: '33333333-3333-3333-3333-333333333333',
                partName: null,
                warehouseId: '44444444-4444-4444-4444-444444444444',
                action: 'replace',
                qty: 1,
                unitCost: 20,
                serialNo: 'SN-1',
                note: 'swap',
                stockDocumentId: 'sd-1',
                createdAt: new Date('2026-02-23T00:00:00Z')
            }]
        }),
        listEvents: vi.fn().mockResolvedValue([{
            id: 'evt-1',
            eventType: 'REPAIR_CREATED',
            payload: { code: 'RO-2026-000001' },
            createdAt: new Date('2026-02-23T00:00:00Z')
        }])
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

    const repairService = createMockRepairService()
    await app.register(repairOrderRoutes, {
        repairService: repairService as any
    })
    return { app, repairService }
}

afterEach(() => {
    vi.restoreAllMocks()
})

describe('repairOrderRoutes', () => {
    it('lists repair orders', async () => {
        const { app, repairService } = await createTestApp()
        try {
            const response = await app.inject({
                method: 'GET',
                url: '/repair-orders?limit=10&page=1',
                headers: {
                    'x-test-user-id': 'viewer-1',
                    'x-test-user-role': 'viewer'
                }
            })

            expect(response.statusCode).toBe(200)
            expect(repairService.listRepairs).toHaveBeenCalledWith(expect.objectContaining({ limit: 10, page: 1 }))
            expect(response.json().data).toHaveLength(1)
        } finally {
            await app.close()
        }
    })

    it('returns repair summary without colliding with id route', async () => {
        const { app, repairService } = await createTestApp()
        try {
            const response = await app.inject({
                method: 'GET',
                url: '/repair-orders/summary?from=2026-02-01&to=2026-02-28',
                headers: {
                    'x-test-user-id': 'viewer-1',
                    'x-test-user-role': 'viewer'
                }
            })

            expect(response.statusCode).toBe(200)
            expect(repairService.getRepairSummary).toHaveBeenCalledWith(
                expect.objectContaining({ from: '2026-02-01', to: '2026-02-28' })
            )
            expect(response.json().data.totalCost).toBe(350)
        } finally {
            await app.close()
        }
    })

    it('creates repair order for manager alias', async () => {
        const { app, repairService } = await createTestApp()
        try {
            const response = await app.inject({
                method: 'POST',
                url: '/repair-orders',
                headers: {
                    'x-test-user-id': 'manager-1',
                    'x-test-user-role': 'manager',
                    'x-correlation-id': 'corr-create',
                    'content-type': 'application/json'
                },
                payload: {
                    assetId: '22222222-2222-2222-2222-222222222222',
                    title: 'Replace fan',
                    severity: 'medium',
                    repairType: 'internal'
                }
            })

            expect(response.statusCode).toBe(201)
            expect(repairService.createRepairOrder).toHaveBeenCalledWith(
                expect.objectContaining({
                    assetId: '22222222-2222-2222-2222-222222222222',
                    title: 'Replace fan'
                }),
                expect.objectContaining({ userId: 'manager-1', correlationId: 'corr-create' })
            )
        } finally {
            await app.close()
        }
    })

    it('adds repair part and returns detail', async () => {
        const { app, repairService } = await createTestApp()
        try {
            const response = await app.inject({
                method: 'POST',
                url: `/repair-orders/${REPAIR_ID}/parts`,
                headers: {
                    'x-test-user-id': 'manager-1',
                    'x-test-user-role': 'it_asset_manager',
                    'content-type': 'application/json'
                },
                payload: {
                    partId: '33333333-3333-3333-3333-333333333333',
                    warehouseId: '44444444-4444-4444-4444-444444444444',
                    action: 'replace',
                    qty: 1,
                    unitCost: 20,
                    serialNo: 'SN-1',
                    note: 'swap'
                }
            })

            expect(response.statusCode).toBe(201)
            expect(repairService.addRepairPart).toHaveBeenCalledWith(
                REPAIR_ID,
                expect.objectContaining({
                    partId: '33333333-3333-3333-3333-333333333333',
                    warehouseId: '44444444-4444-4444-4444-444444444444',
                    serialNo: 'SN-1'
                }),
                expect.objectContaining({ userId: 'manager-1' })
            )
            expect(response.json().data.order.partsCost).toBe(20)
        } finally {
            await app.close()
        }
    })

    it('changes status and lists events', async () => {
        const { app, repairService } = await createTestApp()
        try {
            const headers = {
                'x-test-user-id': 'manager-1',
                'x-test-user-role': 'it_asset_manager'
            }

            const statusResponse = await app.inject({
                method: 'POST',
                url: `/repair-orders/${REPAIR_ID}/status`,
                headers: { ...headers, 'content-type': 'application/json' },
                payload: { status: 'closed' }
            })
            expect(statusResponse.statusCode).toBe(200)
            expect(repairService.changeStatus).toHaveBeenCalledWith(
                REPAIR_ID,
                'closed',
                expect.objectContaining({ userId: 'manager-1' })
            )

            const eventsResponse = await app.inject({
                method: 'GET',
                url: `/repair-orders/${REPAIR_ID}/events?limit=10`,
                headers
            })
            expect(eventsResponse.statusCode).toBe(200)
            expect(repairService.listEvents).toHaveBeenCalledWith(REPAIR_ID, 10)
        } finally {
            await app.close()
        }
    })
})
