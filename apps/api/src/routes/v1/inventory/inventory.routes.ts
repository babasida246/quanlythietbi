import type { FastifyInstance } from 'fastify'
import type { InventoryService } from '@qltb/application'
import type { InventoryItemRecord } from '@qltb/contracts'
import type { PgClient } from '@qltb/infra-postgres'
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
    pgClient: PgClient
}

/** Enrich inventory items with assetCode from the assets table */
async function enrichItems(
    pool: import('pg').Pool,
    items: InventoryItemRecord[]
): Promise<(InventoryItemRecord & { assetCode?: string | null; assetName?: string | null })[]> {
    const ids = items.map(i => i.assetId).filter(Boolean) as string[]
    if (ids.length === 0) return items
    const result = await pool.query<{ id: string; asset_code: string; name: string | null }>(
        `SELECT a.id, a.asset_code, m.model AS name
         FROM assets a
         LEFT JOIN asset_models m ON m.id = a.model_id
         WHERE a.id = ANY($1::uuid[])`,
        [ids]
    )
    const map = new Map(result.rows.map(r => [r.id, { assetCode: r.asset_code, assetName: r.name }]))
    return items.map(item => ({ ...item, ...(item.assetId ? map.get(item.assetId) : {}) }))
}

export async function inventoryRoutes(
    fastify: FastifyInstance,
    opts: InventoryRoutesOptions
): Promise<void> {
    const inventoryService = opts.inventoryService
    const pool = opts.pgClient.getPool()

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
        const rawItems = await inventoryService.listItems(id)
        const items = await enrichItems(pool, rawItems)
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
        const rawItems: InventoryItemRecord[] = await inventoryService.listItems(id)
        const items = await enrichItems(pool, rawItems)
        const counts = items.reduce<Record<string, number>>((acc, item) => {
            acc[item.status] = (acc[item.status] ?? 0) + 1
            return acc
        }, {})
        return reply.send({ data: { session, items, counts } })
    })

    // ─── Missing assets (in location scope but NOT scanned) ────────────────
    fastify.get('/inventory/sessions/:id/missing', async (request, reply) => {
        getUserContext(request)
        const { id } = inventorySessionIdSchema.parse(request.params)
        const session = await inventoryService.getSession(id)

        // Build WHERE clause: match session location scope if set
        const params: unknown[] = [id]
        const locationCond = session.locationId
            ? `AND a.location_id = $${params.push(session.locationId)}`
            : ''

        const rows = await pool.query<{
            id: string; asset_code: string; name: string | null;
            location_id: string | null; location_name: string | null; status: string
        }>(`
            SELECT a.id, a.asset_code, m.model AS name,
                   a.location_id, l.name AS location_name, a.status
            FROM assets a
            LEFT JOIN asset_models m ON m.id = a.model_id
            LEFT JOIN locations l ON l.id = a.location_id
            WHERE a.status NOT IN ('retired','disposed','lost')
              ${locationCond}
              AND NOT EXISTS (
                  SELECT 1 FROM inventory_items ii
                  WHERE ii.session_id = $1
                    AND ii.asset_id = a.id
              )
            ORDER BY a.asset_code
            LIMIT 500
        `, params)

        return reply.send({
            data: rows.rows.map(r => ({
                id: r.id,
                assetCode: r.asset_code,
                name: r.name,
                locationId: r.location_id,
                locationName: r.location_name,
                status: r.status
            }))
        })
    })
}
