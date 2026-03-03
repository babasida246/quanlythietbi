import type { FastifyInstance } from 'fastify'
import type { InventoryService } from '@qltb/application'
import type { InventoryItemRecord } from '@qltb/contracts'
import { getUserContext, requirePermission } from '../assets/assets.helpers.js'
import {
    inventoryScanSchema,
    inventorySessionCreateSchema,
    inventorySessionIdSchema,
    inventorySessionListSchema
} from './inventory.schemas.js'
import { z } from 'zod'

interface InventoryRoutesOptions {
    inventoryService: InventoryService
}

export async function inventoryRoutes(
    fastify: FastifyInstance,
    opts: InventoryRoutesOptions
): Promise<void> {
    const inventoryService = opts.inventoryService

    fastify.post('/inventory/sessions', async (request, reply) => {
        const ctx = requirePermission(request, 'inventory:create')
        const body = inventorySessionCreateSchema.parse(request.body)
        const session = await inventoryService.createSession(body, ctx)
        return reply.status(201).send({ data: session })
    })

    fastify.get('/inventory/sessions', async (request, reply) => {
        getUserContext(request)
        const query = inventorySessionListSchema.parse(request.query)
        const result = await inventoryService.listSessions(query)
        return reply.send({
            data: result.items,
            meta: { total: result.total, page: result.page, limit: result.limit }
        })
    })

    fastify.get('/inventory/sessions/:id', async (request, reply) => {
        getUserContext(request)
        const { id } = inventorySessionIdSchema.parse(request.params)
        const session = await inventoryService.getSession(id)
        const items = await inventoryService.listItems(id)
        return reply.send({ data: { session, items } })
    })

    fastify.post('/inventory/sessions/:id/scan', async (request, reply) => {
        const ctx = requirePermission(request, 'inventory:create')
        const { id } = inventorySessionIdSchema.parse(request.params)
        const body = inventoryScanSchema.parse(request.body)
        const item = await inventoryService.scanAsset({ ...body, sessionId: id }, ctx)
        return reply.send({ data: item })
    })

    fastify.post('/inventory/sessions/:id/close', async (request, reply) => {
        requirePermission(request, 'inventory:manage')
        const { id } = inventorySessionIdSchema.parse(request.params)
        const result = await inventoryService.closeSession(id)
        return reply.send({ data: result })
    })

    fastify.post('/inventory/sessions/:id/start', async (request, reply) => {
        const ctx = requirePermission(request, 'inventory:create')
        const { id } = inventorySessionIdSchema.parse(request.params)
        const session = await inventoryService.startSession(id, ctx)
        return reply.send({ data: session })
    })

    fastify.delete('/inventory/sessions/:id/scans/:itemId', async (request, reply) => {
        const ctx = requirePermission(request, 'inventory:create')
        const { id } = inventorySessionIdSchema.parse(request.params)
        const { itemId } = z.object({ itemId: z.string().uuid() }).parse(request.params)
        await inventoryService.undoScan(id, itemId, ctx)
        return reply.status(204).send()
    })

    fastify.get('/inventory/sessions/:id/report', async (request, reply) => {
        getUserContext(request)
        const { id } = inventorySessionIdSchema.parse(request.params)
        const session = await inventoryService.getSession(id)
        const items: InventoryItemRecord[] = await inventoryService.listItems(id)
        const counts = items.reduce<Record<string, number>>((acc, item) => {
            acc[item.status] = (acc[item.status] ?? 0) + 1
            return acc
        }, {})
        return reply.send({ data: { session, counts } })
    })
}
