/**
 * Organizations (OU) Routes
 * CRUD + hierarchy for organizational units
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import type { OrganizationService } from '@qltb/application'
import { requirePermission } from '../assets/assets.helpers.js'
import {
    orgIdParamSchema,
    orgListQuerySchema,
    createOrgSchema,
    updateOrgSchema
} from './organizations.schema.js'

export async function organizationsRoute(
    fastify: FastifyInstance,
    opts: { organizationService: OrganizationService }
): Promise<void> {
    const { organizationService } = opts

    // GET /organizations
    fastify.get('/organizations', async (request: FastifyRequest, reply: FastifyReply) => {
        requirePermission(request, 'assets:read')
        const parse = orgListQuerySchema.safeParse(request.query)
        if (!parse.success) {
            return reply.status(400).send({ success: false, error: 'Validation failed', details: parse.error.errors })
        }
        const result = await organizationService.list(parse.data)
        return reply.send({ success: true, data: result.items, meta: { total: result.total } })
    })

    // GET /organizations/:id
    fastify.get('/organizations/:id', async (request: FastifyRequest, reply: FastifyReply) => {
        requirePermission(request, 'assets:read')
        const parse = orgIdParamSchema.safeParse(request.params)
        if (!parse.success) {
            return reply.status(400).send({ success: false, error: 'Invalid ID' })
        }
        try {
            const org = await organizationService.getById(parse.data.id)
            return reply.send({ success: true, data: org })
        } catch (err) {
            return reply.status(404).send({ success: false, error: String(err) })
        }
    })

    // POST /organizations
    fastify.post('/organizations', async (request: FastifyRequest, reply: FastifyReply) => {
        requirePermission(request, 'admin:manage')
        const parse = createOrgSchema.safeParse(request.body)
        if (!parse.success) {
            return reply.status(400).send({ success: false, error: 'Validation failed', details: parse.error.errors })
        }
        try {
            const org = await organizationService.create(parse.data)
            return reply.status(201).send({ success: true, data: org })
        } catch (err) {
            return reply.status(400).send({ success: false, error: String(err) })
        }
    })

    // PATCH /organizations/:id
    fastify.patch('/organizations/:id', async (request: FastifyRequest, reply: FastifyReply) => {
        requirePermission(request, 'admin:manage')
        const paramParse = orgIdParamSchema.safeParse(request.params)
        if (!paramParse.success) {
            return reply.status(400).send({ success: false, error: 'Invalid ID' })
        }
        const bodyParse = updateOrgSchema.safeParse(request.body)
        if (!bodyParse.success) {
            return reply.status(400).send({ success: false, error: 'Validation failed', details: bodyParse.error.errors })
        }
        try {
            const org = await organizationService.update(paramParse.data.id, bodyParse.data)
            return reply.send({ success: true, data: org })
        } catch (err) {
            return reply.status(400).send({ success: false, error: String(err) })
        }
    })

    // DELETE /organizations/:id
    fastify.delete('/organizations/:id', async (request: FastifyRequest, reply: FastifyReply) => {
        requirePermission(request, 'admin:manage')
        const parse = orgIdParamSchema.safeParse(request.params)
        if (!parse.success) {
            return reply.status(400).send({ success: false, error: 'Invalid ID' })
        }
        try {
            await organizationService.delete(parse.data.id)
            return reply.send({ success: true })
        } catch (err) {
            return reply.status(404).send({ success: false, error: String(err) })
        }
    })
}
