import type { FastifyInstance } from 'fastify'
import type { StockDocumentService } from '@qltb/application'
import { z } from 'zod'
import { getUserContext, requirePermission } from '../assets/assets.helpers.js'
import {
    stockDocumentCreateSchema,
    stockDocumentIdParamsSchema,
    stockDocumentListSchema,
    stockDocumentUpdateSchema,
    stockLedgerSchema
} from '../maintenance/maintenance-warehouse.schemas.js'

interface StockDocumentRoutesOptions {
    stockDocumentService: StockDocumentService
    pgClient?: { query: <T>(sql: string, params?: unknown[]) => Promise<{ rows: T[] }> }
}

async function generateSequentialDocCode(pgClient?: StockDocumentRoutesOptions['pgClient']): Promise<string> {
    const year = new Date().getFullYear()
    if (pgClient) {
        try {
            const result = await pgClient.query<{ nextval: string }>(
                `SELECT nextval('stock_doc_code_seq') AS nextval`
            )
            const seq = result.rows[0]?.nextval ?? '1'
            return `SD-${year}-${seq.padStart(6, '0')}`
        } catch {
            // Sequence may not exist yet — fall back to count-based
        }
    }
    // Fallback: timestamp-based with millisecond precision (collision-resistant)
    const ts = Date.now().toString(36).toUpperCase()
    return `SD-${year}-${ts}`
}

export async function stockDocumentRoutes(
    fastify: FastifyInstance,
    opts: StockDocumentRoutesOptions
): Promise<void> {
    const { stockDocumentService, pgClient } = opts

    fastify.get('/stock-documents', async (request, reply) => {
        getUserContext(request)
        const query = stockDocumentListSchema.parse(request.query)
        const result = await stockDocumentService.listDocuments(query)
        return reply.send({ data: result.items, meta: { total: result.total, page: result.page, limit: result.limit } })
    })

    fastify.get('/stock-documents/:id', async (request, reply) => {
        getUserContext(request)
        const { id } = stockDocumentIdParamsSchema.parse(request.params)
        const detail = await stockDocumentService.getDocument(id)
        return reply.send({ data: detail })
    })

    fastify.post('/stock-documents', async (request, reply) => {
        const ctx = requirePermission(request, 'warehouse:create')
        const body = stockDocumentCreateSchema.parse(request.body)
        const code = body.code?.trim() || await generateSequentialDocCode(pgClient)
        const docDate = body.docDate?.trim() || undefined
        const detail = await stockDocumentService.createDocument({
            docType: body.docType,
            code,
            warehouseId: body.warehouseId ?? null,
            targetWarehouseId: body.targetWarehouseId ?? null,
            docDate,
            refType: body.refType ?? null,
            refId: body.refId ?? null,
            note: body.note ?? null,
            supplier: body.supplier ?? null,
            submitterName: body.submitterName ?? null,
            receiverName: body.receiverName ?? null,
            department: body.department ?? null,
            locationId: body.locationId ?? null
        }, body.lines, ctx)
        return reply.status(201).send({ data: detail })
    })

    fastify.put('/stock-documents/:id', async (request, reply) => {
        const ctx = requirePermission(request, 'warehouse:create')
        const { id } = stockDocumentIdParamsSchema.parse(request.params)
        const body = stockDocumentUpdateSchema.parse(request.body)
        const docDate = body.docDate?.trim() || undefined
        const detail = await stockDocumentService.updateDocument(id, {
            docDate,
            note: body.note ?? null,
            warehouseId: body.warehouseId ?? null,
            targetWarehouseId: body.targetWarehouseId ?? null,
            supplier: body.supplier ?? null,
            submitterName: body.submitterName ?? null,
            receiverName: body.receiverName ?? null,
            department: body.department ?? null,
            locationId: body.locationId ?? null,
            correlationId: ctx.correlationId
        }, body.lines, ctx)
        return reply.send({ data: detail })
    })

    fastify.post('/stock-documents/:id/submit', async (request, reply) => {
        const ctx = requirePermission(request, 'warehouse:create')
        const { id } = stockDocumentIdParamsSchema.parse(request.params)
        const submitted = await stockDocumentService.submitDocument(id, ctx)
        return reply.send({ data: submitted })
    })

    fastify.post('/stock-documents/:id/approve', async (request, reply) => {
        const ctx = requirePermission(request, 'warehouse:approve')
        const { id } = stockDocumentIdParamsSchema.parse(request.params)
        const approved = await stockDocumentService.approveDocument(id, ctx)
        return reply.send({ data: approved })
    })

    fastify.post('/stock-documents/:id/post', async (request, reply) => {
        const ctx = requirePermission(request, 'warehouse:approve')
        const { id } = stockDocumentIdParamsSchema.parse(request.params)
        const idempotencyKey = (request.headers['idempotency-key'] as string) || undefined
        const posted = await stockDocumentService.postDocument(id, ctx, idempotencyKey)
        return reply.send({ data: posted })
    })

    fastify.post('/stock-documents/:id/cancel', async (request, reply) => {
        const ctx = requirePermission(request, 'warehouse:create')
        const { id } = stockDocumentIdParamsSchema.parse(request.params)
        const canceled = await stockDocumentService.cancelDocument(id, ctx)
        return reply.send({ data: canceled })
    })

    fastify.get('/stock/ledger', async (request, reply) => {
        getUserContext(request)
        const query = stockLedgerSchema.parse(request.query)
        const result = await stockDocumentService.listMovements(query)
        return reply.send({ data: result.items, meta: { total: result.total, page: result.page, limit: result.limit } })
    })

    // List assets currently in-stock at a warehouse (for issue document line picker)
    fastify.get('/stock/assets', async (request, reply) => {
        getUserContext(request)
        const query = z.object({
            warehouseId: z.string().uuid(),
            q: z.string().optional()
        }).parse(request.query)
        if (!pgClient) return reply.send({ data: [] })
        type AssetRow = {
            id: string; asset_code: string; serial_no: string | null
            model_name: string | null; category_name: string | null
        }
        const params: unknown[] = [query.warehouseId]
        let qCondition = ''
        if (query.q) {
            params.push(`%${query.q}%`)
            qCondition = ` AND (a.asset_code ILIKE $${params.length} OR a.serial_no ILIKE $${params.length})`
        }
        const result = await pgClient.query<AssetRow>(
            `SELECT a.id, a.asset_code, a.serial_no,
                    m.name AS model_name, c.name AS category_name
             FROM assets a
             LEFT JOIN asset_models m ON m.id = a.model_id
             LEFT JOIN asset_categories c ON c.id = m.category_id
             WHERE a.warehouse_id = $1 AND a.status = 'in_stock'${qCondition}
             ORDER BY a.asset_code ASC
             LIMIT 200`,
            params
        )
        return reply.send({
            data: result.rows.map(r => ({
                id: r.id,
                assetCode: r.asset_code,
                serialNo: r.serial_no,
                modelName: r.model_name,
                categoryName: r.category_name
            }))
        })
    })

    // Real-time stock availability check (used by UI for issue/transfer validation)
    fastify.get('/stock/check', async (request, reply) => {
        getUserContext(request)
        const query = z.object({
            warehouseId: z.string().uuid(),
            partId: z.string().uuid()
        }).parse(request.query)
        if (!pgClient) return reply.send({ data: { onHand: 0, reserved: 0, available: 0 } })
        type StockRow = { on_hand: number; reserved: number }
        const result = await pgClient.query<StockRow>(
            `SELECT on_hand, reserved FROM spare_part_stock
             WHERE warehouse_id = $1 AND part_id = $2`,
            [query.warehouseId, query.partId]
        )
        const row = result.rows[0]
        const onHand = row?.on_hand ?? 0
        const reserved = row?.reserved ?? 0
        const available = Math.max(onHand - reserved, 0)
        return reply.send({ data: { onHand, reserved, available } })
    })
}
