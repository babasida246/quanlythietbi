import type { FastifyInstance } from 'fastify'
import type { StockReportService } from '@qltb/application'
import { z } from 'zod'
import { getUserContext } from '../assets/assets.helpers.js'

const reportsQuerySchema = z.object({
    warehouseId: z.string().uuid().optional(),
    itemId: z.string().uuid().optional(),
    locationId: z.string().uuid().optional(),
    daysThreshold: z.coerce.number().int().min(1).max(365).optional().default(30),
    currencyId: z.string().uuid().optional(),
    limit: z.coerce.number().int().min(1).max(1000).optional().default(100)
})

interface ReportsRoutesOptions {
    stockReportService: StockReportService
}

export async function reportsRoutes(
    fastify: FastifyInstance,
    opts: ReportsRoutesOptions
): Promise<void> {
    const stockReportService = opts.stockReportService

    fastify.get('/reports/test', async (request, reply) => {
        getUserContext(request)
        return reply.send({ message: 'Test route works', query: request.query })
    })

    // Stock on Hand Report
    fastify.get('/reports/stock-on-hand', async (request, reply) => {
        const ctx = getUserContext(request)
        const query = reportsQuerySchema.parse(request.query)
        const rows = await stockReportService.stockOnHand({
            warehouseId: query.warehouseId,
            partId: query.itemId,
            limit: query.limit
        }, ctx)

        return reply.send(rows)
    })

    // Stock Available Report (Stock - Reservations)
    fastify.get('/reports/stock-available', async (request, reply) => {
        const ctx = getUserContext(request)
        const query = reportsQuerySchema.parse(request.query)
        const rows = await stockReportService.stockAvailable({
            warehouseId: query.warehouseId,
            partId: query.itemId,
            limit: query.limit
        }, ctx)

        return reply.send(rows)
    })

    // Reorder Alerts Report
    fastify.get('/reports/reorder-alerts', async (request, reply) => {
        const ctx = getUserContext(request)
        const query = reportsQuerySchema.parse(request.query)
        const rows = await stockReportService.reorderAlerts({
            warehouseId: query.warehouseId,
            partId: query.itemId,
            limit: query.limit
        }, ctx)

        return reply.send(rows)
    })

    // FEFO Lots Report (First Expired, First Out)
    fastify.get('/reports/fefo-lots', async (request, reply) => {
        const ctx = getUserContext(request)
        const query = reportsQuerySchema.parse(request.query)
        const rows = await stockReportService.fefoLots({
            warehouseId: query.warehouseId,
            daysThreshold: query.daysThreshold,
            limit: query.limit
        }, ctx)

        return reply.send(rows)
    })

    // Inventory Valuation Report
    fastify.get('/reports/valuation', async (request, reply) => {
        const ctx = getUserContext(request)
        const query = reportsQuerySchema.parse(request.query)
        const result = await stockReportService.valuation({
            warehouseId: query.warehouseId,
            currencyId: query.currencyId,
            limit: query.limit
        }, ctx)

        return reply.send(result)
    })
}
