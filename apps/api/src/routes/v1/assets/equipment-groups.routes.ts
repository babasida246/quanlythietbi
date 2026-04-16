import type { FastifyInstance } from 'fastify'
import { AppError } from '@qltb/domain'
import type { EquipmentGroupService } from '@qltb/application'
import { getUserContext } from './assets.helpers.js'
import {
    equipmentGroupCreateSchema,
    equipmentGroupUpdateSchema,
    equipmentGroupIdParamSchema,
    equipmentGroupFieldCreateSchema,
    equipmentGroupFieldUpdateSchema,
    equipmentGroupFieldIdParamSchema,
} from './equipment-groups.schemas.js'

interface EquipmentGroupRoutesOptions {
    equipmentGroupService: EquipmentGroupService
}

export async function equipmentGroupRoutes(
    fastify: FastifyInstance,
    opts: EquipmentGroupRoutesOptions
): Promise<void> {
    const { equipmentGroupService: svc } = opts

    // GET /equipment-groups/tree — cây phân cấp đầy đủ
    fastify.get('/equipment-groups/tree', async (_request, reply) => {
        const tree = await svc.getTree()
        return reply.send({ success: true, data: tree })
    })

    // GET /equipment-groups — danh sách phẳng
    fastify.get('/equipment-groups', {
        schema: { querystring: { type: 'object', properties: { isActive: { type: 'boolean' } } } }
    }, async (request, reply) => {
        const { isActive } = request.query as { isActive?: boolean }
        const groups = await svc.list(isActive !== undefined ? { isActive } : undefined)
        return reply.send({ success: true, data: groups })
    })

    // GET /equipment-groups/:id
    fastify.get('/equipment-groups/:id', {
        schema: { params: equipmentGroupIdParamSchema }
    }, async (request, reply) => {
        const { id } = request.params as { id: string }
        const group = await svc.getById(id)
        return reply.send({ success: true, data: group })
    })

    // POST /equipment-groups
    fastify.post('/equipment-groups', {
        schema: { body: equipmentGroupCreateSchema }
    }, async (request, reply) => {
        getUserContext(request)
        const group = await svc.create(request.body as Parameters<typeof svc.create>[0])
        return reply.status(201).send({ success: true, data: group })
    })

    // PUT /equipment-groups/:id
    fastify.put('/equipment-groups/:id', {
        schema: { params: equipmentGroupIdParamSchema, body: equipmentGroupUpdateSchema }
    }, async (request, reply) => {
        getUserContext(request)
        const { id } = request.params as { id: string }
        const group = await svc.update(id, request.body as Parameters<typeof svc.update>[1])
        return reply.send({ success: true, data: group })
    })

    // DELETE /equipment-groups/:id
    fastify.delete('/equipment-groups/:id', {
        schema: { params: equipmentGroupIdParamSchema }
    }, async (request, reply) => {
        getUserContext(request)
        const { id } = request.params as { id: string }
        await svc.delete(id)
        return reply.send({ success: true, data: null })
    })

    // ── Fields ─────────────────────────────────────────────────────────────

    // GET /equipment-groups/:id/fields — fields riêng của nhóm
    fastify.get('/equipment-groups/:id/fields', {
        schema: { params: equipmentGroupIdParamSchema }
    }, async (request, reply) => {
        const { id } = request.params as { id: string }
        const fields = await svc.listFields(id)
        return reply.send({ success: true, data: fields })
    })

    // GET /equipment-groups/:id/effective-fields — fields có tính kế thừa cha
    fastify.get('/equipment-groups/:id/effective-fields', {
        schema: { params: equipmentGroupIdParamSchema }
    }, async (request, reply) => {
        const { id } = request.params as { id: string }
        const fields = await svc.getEffectiveFields(id)
        return reply.send({ success: true, data: fields })
    })

    // POST /equipment-groups/:id/fields
    fastify.post('/equipment-groups/:id/fields', {
        schema: { params: equipmentGroupIdParamSchema, body: equipmentGroupFieldCreateSchema }
    }, async (request, reply) => {
        getUserContext(request)
        const { id } = request.params as { id: string }
        const field = await svc.createField(id, request.body as Parameters<typeof svc.createField>[1])
        return reply.status(201).send({ success: true, data: field })
    })

    // PUT /equipment-group-fields/:fieldId
    fastify.put('/equipment-group-fields/:fieldId', {
        schema: { params: equipmentGroupFieldIdParamSchema, body: equipmentGroupFieldUpdateSchema }
    }, async (request, reply) => {
        getUserContext(request)
        const { fieldId } = request.params as { fieldId: string }
        const field = await svc.updateField(fieldId, request.body as Parameters<typeof svc.updateField>[1])
        return reply.send({ success: true, data: field })
    })

    // DELETE /equipment-group-fields/:fieldId
    fastify.delete('/equipment-group-fields/:fieldId', {
        schema: { params: equipmentGroupFieldIdParamSchema }
    }, async (request, reply) => {
        getUserContext(request)
        const { fieldId } = request.params as { fieldId: string }
        await svc.deleteField(fieldId)
        return reply.send({ success: true, data: null })
    })
}
