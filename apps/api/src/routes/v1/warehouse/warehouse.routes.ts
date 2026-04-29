import type { FastifyInstance } from 'fastify'
import type { StockService, WarehouseCatalogService, AssetService } from '@qltb/application'
import { z } from 'zod'
import {
    sparePartCreateSchema,
    sparePartIdParamsSchema,
    sparePartListSchema,
    sparePartUpdateSchema,
    stockViewSchema,
    warehouseCreateSchema,
    warehouseIdParamsSchema,
    warehouseUpdateSchema
} from '../maintenance/maintenance-warehouse.schemas.js'
import { getUserContext, requirePermission } from '../assets/assets.helpers.js'

const stockReserveSchema = z.object({
    warehouseId: z.string().uuid(),
    partId: z.string().uuid(),
    qty: z.coerce.number().int().min(1)
})

const warehouseAssetsQuerySchema = z.object({
    status: z.string().optional(),
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional()
})

interface WarehouseRoutesOptions {
    catalogService: WarehouseCatalogService
    stockService: StockService
    assetService?: AssetService
    pgClient?: { query: <T>(sql: string, params?: unknown[]) => Promise<{ rows: T[] }> }
}

const partsSearchSchema = z.object({
    q: z.string().min(1).max(200),
    limit: z.coerce.number().int().min(1).max(50).default(15)
})

export async function warehouseRoutes(
    fastify: FastifyInstance,
    opts: WarehouseRoutesOptions
): Promise<void> {
    const { catalogService, stockService } = opts

    // ==================== Warehouses ====================

    fastify.get('/warehouses', async (request, reply) => {
        getUserContext(request)
        const records = await catalogService.listWarehouses()
        return reply.send({ data: records })
    })

    fastify.post('/warehouses', async (request, reply) => {
        const ctx = requirePermission(request, 'warehouse:create')
        const body = warehouseCreateSchema.parse(request.body)
        const created = await catalogService.createWarehouse(body, ctx)
        return reply.status(201).send({ data: created })
    })

    fastify.put('/warehouses/:id', async (request, reply) => {
        const ctx = requirePermission(request, 'warehouse:create')
        const { id } = warehouseIdParamsSchema.parse(request.params)
        const body = warehouseUpdateSchema.parse(request.body)
        const updated = await catalogService.updateWarehouse(id, body, ctx)
        return reply.send({ data: updated })
    })

    fastify.delete('/warehouses/:id', async (request, reply) => {
        const ctx = requirePermission(request, 'warehouse:create')
        const { id } = warehouseIdParamsSchema.parse(request.params)
        await catalogService.deleteWarehouse(id, ctx)
        return reply.send({ data: { id } })
    })

    // GET /warehouses/:id/assets — list assets stored in this warehouse
    fastify.get('/warehouses/:id/assets', async (request, reply) => {
        getUserContext(request)
        const { id } = warehouseIdParamsSchema.parse(request.params)
        const query = warehouseAssetsQuerySchema.parse(request.query)
        if (!opts.assetService) {
            return reply.status(503).send({ error: 'Asset service unavailable' })
        }
        const result = await opts.assetService.searchAssets({
            warehouseId: id,
            status: (query.status) as Parameters<typeof opts.assetService.searchAssets>[0]['status'] | undefined,
            page: query.page,
            limit: query.limit
        })
        return reply.send({
            data: result.items,
            meta: { total: result.total, page: result.page, limit: result.limit }
        })
    })

    fastify.get('/spare-parts', async (request, reply) => {
        getUserContext(request)
        const query = sparePartListSchema.parse(request.query)
        const result = await catalogService.listParts(query)
        return reply.send({ data: result.items, meta: { total: result.total, page: result.page, limit: result.limit } })
    })

    fastify.post('/spare-parts', async (request, reply) => {
        const ctx = requirePermission(request, 'warehouse:create')
        const body = sparePartCreateSchema.parse(request.body)
        const created = await catalogService.createPart(body, ctx)
        return reply.status(201).send({ data: created })
    })

    fastify.put('/spare-parts/:id', async (request, reply) => {
        const ctx = requirePermission(request, 'warehouse:create')
        const { id } = sparePartIdParamsSchema.parse(request.params)
        const body = sparePartUpdateSchema.parse(request.body)
        const updated = await catalogService.updatePart(id, body, ctx)
        return reply.send({ data: updated })
    })

    fastify.delete('/spare-parts/:id', async (request, reply) => {
        const ctx = requirePermission(request, 'warehouse:create')
        const { id } = sparePartIdParamsSchema.parse(request.params)
        await catalogService.deletePart(id, ctx)
        return reply.send({ data: { id } })
    })

    fastify.get('/stock/view', async (request, reply) => {
        const ctx = getUserContext(request)
        const query = stockViewSchema.parse(request.query)
        const result = await stockService.listView({
            warehouseId: query.warehouseId,
            q: query.q,
            belowMin: query.belowMin,
            page: query.page,
            limit: query.limit
        }, ctx)
        return reply.send({ data: result.items, meta: { total: result.total, page: result.page, limit: result.limit } })
    })

    // ==================== Stock Reservation ====================

    fastify.post('/stock/reserve', async (request, reply) => {
        const ctx = requirePermission(request, 'warehouse:create')
        const body = stockReserveSchema.parse(request.body)
        const updated = await stockService.reserve(body.warehouseId, body.partId, body.qty, ctx)
        return reply.send({ data: updated })
    })

    fastify.post('/stock/release', async (request, reply) => {
        const ctx = requirePermission(request, 'warehouse:create')
        const body = stockReserveSchema.parse(request.body)
        const updated = await stockService.release(body.warehouseId, body.partId, body.qty, ctx)
        return reply.send({ data: updated })
    })

    fastify.post('/stock/commit', async (request, reply) => {
        const ctx = requirePermission(request, 'warehouse:approve')
        const body = stockReserveSchema.parse(request.body)
        const updated = await stockService.commitReserved(body.warehouseId, body.partId, body.qty, ctx)
        return reply.send({ data: updated })
    })

    // ==================== CSV Export / Import ====================

    fastify.get('/spare-parts/export/csv', async (request, reply) => {
        getUserContext(request)
        const result = await catalogService.listParts({ page: 1, limit: 10000 })
        const rows = result.items
        const header = 'partCode,name,category,uom,manufacturer,model,minLevel,onHand'
        const csvRows = rows.map((r) => {
            const part = r as unknown as Record<string, unknown>;
            return [part['partCode'], part['name'], part['category'], part['uom'], part['manufacturer'], part['model'], part['minLevel'], part['onHand'] ?? '']
                .map(v => `"${String(v ?? '').replace(/"/g, '""')}"`)
                .join(',');
        })
        const csv = [header, ...csvRows].join('\r\n')
        return reply
            .header('Content-Type', 'text/csv; charset=utf-8')
            .header('Content-Disposition', `attachment; filename="spare-parts-${new Date().toISOString().slice(0, 10)}.csv"`)
            .send(csv)
    })

    fastify.post('/spare-parts/import/csv', async (request, reply) => {
        const ctx = requirePermission(request, 'warehouse:create')
        const rawBody = typeof request.body === 'string' ? request.body : String(request.body ?? '')
        const lines = rawBody.split(/\r?\n/).filter(l => l.trim())
        if (lines.length < 2) {
            return reply.status(400).send({ error: 'CSV must have header row and at least one data row' })
        }
        const headerLine = lines[0]
        const headers = headerLine.split(',').map(h => h.replace(/^"|"$/g, '').trim().toLowerCase())
        const results: { created: number; errors: string[] } = { created: 0, errors: [] }
        for (let i = 1; i < lines.length; i++) {
            try {
                const values = lines[i].match(/("(?:[^"]|"")*"|[^,]*)/g)?.map(v => v.replace(/^"|"$/g, '').replace(/""/g, '"').trim()) ?? []
                const row: Record<string, string> = {}
                headers.forEach((h, idx) => { row[h] = values[idx] ?? '' })
                await catalogService.createPart({
                    partCode: row.partcode || `IMPORT-${Date.now()}-${i}`,
                    name: row.name || `Imported item ${i}`,
                    category: row.category || null,
                    uom: row.uom || 'pcs',
                    manufacturer: row.manufacturer || null,
                    model: row.model || null,
                    minLevel: Number(row.minlevel) || 0,
                    spec: undefined
                }, ctx)
                results.created++
            } catch (err) {
                results.errors.push(`Row ${i + 1}: ${err instanceof Error ? err.message : 'Unknown error'}`)
            }
        }
        return reply.send({ data: results })
    })

    // ==================== OU Tree Picker ====================

    fastify.get('/org-units', async (request, reply) => {
        getUserContext(request)
        if (!opts.pgClient) return reply.send({ data: [] })
        const result = await opts.pgClient.query<{ id: string; name: string; path: string; depth: number }>(
            `SELECT id, name, path, depth FROM org_units ORDER BY path`
        )
        return reply.send({ data: result.rows })
    })

    // ==================== OCR Fuzzy Search ====================

    fastify.get('/spare-parts/search', async (request, reply) => {
        getUserContext(request)
        const { q, limit } = partsSearchSchema.parse(request.query)

        if (!opts.pgClient) {
            // Fallback: use catalogService with name filter
            const result = await catalogService.listParts({ page: 1, limit, q })
            return reply.send({ data: result.items })
        }

        // Tokenise the query: split on whitespace, hyphens, slashes
        const rawTokens = q.split(/[\s\-\/,]+/).map(t => t.trim()).filter(t => t.length >= 2)
        if (rawTokens.length === 0) {
            return reply.send({ data: [] })
        }

        // Build WHERE conditions: each token must match at least one field
        const conditions: string[] = []
        const params: string[] = []
        let paramIdx = 1
        for (const token of rawTokens) {
            const like = `%${token}%`
            conditions.push(
                `(am.model ILIKE $${paramIdx} OR am.brand ILIKE $${paramIdx} OR ac.name ILIKE $${paramIdx})`
            )
            params.push(like)
            paramIdx++
        }

        // Exact / prefix boost: whole query phrase
        const exactLike = `%${q}%`
        params.push(exactLike)
        const boostParam = paramIdx

        const sql = `
            SELECT am.id, '' AS part_code, am.model AS name,
                   ac.name AS category, am.unit AS uom,
                   am.brand AS manufacturer, am.model, 0 AS unit_cost
            FROM asset_models am
            LEFT JOIN asset_categories ac ON ac.id = am.category_id
            WHERE (${conditions.join(' OR ')})
            ORDER BY
                CASE WHEN am.model ILIKE $${boostParam} OR am.brand ILIKE $${boostParam} THEN 0 ELSE 1 END,
                length(am.model)
            LIMIT ${limit}
        `
        const result = await opts.pgClient.query<{
            id: string; part_code: string; name: string;
            category: string | null; uom: string | null;
            manufacturer: string | null; model: string | null; unit_cost: string
        }>(sql, params)

        const items = result.rows.map(r => ({
            id: r.id,
            partCode: r.part_code,
            name: r.name,
            category: r.category,
            uom: r.uom,
            manufacturer: r.manufacturer,
            model: r.model,
            unitCost: parseFloat(r.unit_cost ?? '0')
        }))
        return reply.send({ data: items })
    })
}
