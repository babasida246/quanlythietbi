import type { FastifyInstance } from 'fastify'
import type { RepairService } from '@qltb/application'
import { z } from 'zod'
import { AppError } from '@qltb/domain'
import { getUserContext, requirePermission } from '../assets/assets.helpers.js'
import {
    repairCreateSchema,
    repairIdParamsSchema,
    repairListSchema,
    repairPartSchema,
    repairSummarySchema,
    repairStatusSchema,
    repairUpdateSchema
} from '../maintenance/maintenance-warehouse.schemas.js'

interface RepairOrderRoutesOptions {
    repairService: RepairService
}

const repairEventsQuerySchema = z.object({
    limit: z.coerce.number().int().min(1).max(200).optional()
})

export async function repairOrderRoutes(
    fastify: FastifyInstance,
    opts: RepairOrderRoutesOptions
): Promise<void> {
    const { repairService } = opts

    fastify.get('/repair-orders', async (request, reply) => {
        getUserContext(request)
        const query = repairListSchema.parse(request.query)
        const result = await repairService.listRepairs(query)
        return reply.send({
            data: result.items,
            meta: { total: result.total, page: result.page, limit: result.limit }
        })
    })

    fastify.get('/repair-orders/summary', async (request, reply) => {
        getUserContext(request)
        const query = repairSummarySchema.parse(request.query)
        const summary = await repairService.getRepairSummary(query)
        return reply.send({ data: summary })
    })

    fastify.get('/repair-orders/:id', async (request, reply) => {
        getUserContext(request)
        const { id } = repairIdParamsSchema.parse(request.params)
        const detail = await repairService.getRepairDetail(id)
        return reply.send({ data: detail })
    })

    fastify.post('/repair-orders', async (request, reply) => {
        const ctx = await requirePermission(request, 'maintenance:create')
        const body = repairCreateSchema.parse(request.body)
        const created = await repairService.createRepairOrder({
            assetId: body.assetId,
            title: body.title,
            description: body.description ?? null,
            severity: body.severity,
            repairType: body.repairType,
            technicianName: body.technicianName ?? null,
            vendorId: body.vendorId ?? null,
            laborCost: body.laborCost ?? null,
            downtimeMinutes: body.downtimeMinutes ?? null
        }, ctx)
        return reply.status(201).send({ data: created })
    })

    fastify.put('/repair-orders/:id', async (request, reply) => {
        const ctx = await requirePermission(request, 'maintenance:manage')
        const { id } = repairIdParamsSchema.parse(request.params)
        const body = repairUpdateSchema.parse(request.body)
        const { status, ...rest } = body

        const patch = {
            ...rest,
            ...(rest.description !== undefined ? { description: rest.description ?? null } : {}),
            ...(rest.diagnosis !== undefined ? { diagnosis: rest.diagnosis ?? null } : {}),
            ...(rest.resolution !== undefined ? { resolution: rest.resolution ?? null } : {}),
            ...(rest.technicianName !== undefined ? { technicianName: rest.technicianName ?? null } : {}),
            ...(rest.vendorId !== undefined ? { vendorId: rest.vendorId ?? null } : {}),
            correlationId: ctx.correlationId
        }

        const hasPatchFields = Object.keys(rest).length > 0
        let currentOrder = null
        if (hasPatchFields) {
            currentOrder = await repairService.updateRepairOrder(id, patch, ctx)
        }

        if (status) {
            const updated = await repairService.changeStatus(id, status, ctx)
            return reply.send({ data: updated })
        }

        if (!currentOrder) {
            throw AppError.badRequest('No update fields provided')
        }
        return reply.send({ data: currentOrder })
    })

    fastify.post('/repair-orders/:id/status', async (request, reply) => {
        const ctx = await requirePermission(request, 'maintenance:manage')
        const { id } = repairIdParamsSchema.parse(request.params)
        const body = repairStatusSchema.parse(request.body)
        const updated = await repairService.changeStatus(id, body.status, ctx)
        return reply.send({ data: updated })
    })

    fastify.post('/repair-orders/:id/parts', async (request, reply) => {
        const ctx = await requirePermission(request, 'maintenance:manage')
        const { id } = repairIdParamsSchema.parse(request.params)
        const body = repairPartSchema.parse(request.body)
        const detail = await repairService.addRepairPart(id, {
            partId: body.partId ?? null,
            partName: body.partName ?? null,
            warehouseId: body.warehouseId ?? null,
            action: body.action,
            qty: body.qty,
            unitCost: body.unitCost ?? null,
            serialNo: body.serialNo ?? null,
            note: body.note ?? null
        }, ctx)
        return reply.status(201).send({ data: detail })
    })

    fastify.get('/repair-orders/:id/events', async (request, reply) => {
        getUserContext(request)
        const { id } = repairIdParamsSchema.parse(request.params)
        const query = repairEventsQuerySchema.parse(request.query)
        const events = await repairService.listEvents(id, query.limit ?? 50)
        return reply.send({ data: events })
    })
}
