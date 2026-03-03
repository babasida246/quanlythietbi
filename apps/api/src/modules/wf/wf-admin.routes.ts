/**
 * Workflow Module – Admin Routes
 * Prefix: /wf   (registered under /api/v1 in assets.module.ts)
 *
 * GET  /wf/admin/requests              list all requests (manager view)
 * GET  /wf/admin/requests/:id          get any request detail
 * GET  /wf/admin/definitions           list workflow definitions
 * POST /wf/admin/definitions           create new definition
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { WfService } from './wf.service.js';
import { WfError } from './wf.service.js';
import { requirePermission } from '../../routes/v1/assets/assets.helpers.js';
import {
    wfRequestListQuerySchema,
    createWfDefinitionSchema,
    idParamSchema,
} from './wf.schemas.js';

function handleWfError(err: unknown, reply: FastifyReply) {
    if (err instanceof WfError) {
        return reply.status(err.statusCode).send({ success: false, error: err.message });
    }
    throw err;
}

export async function wfAdminRoutes(
    fastify: FastifyInstance,
    options: { wfService: WfService }
): Promise<void> {
    const { wfService } = options;

    // GET /wf/admin/requests
    fastify.get('/wf/admin/requests', async (request: FastifyRequest, reply: FastifyReply) => {
        requirePermission(request, 'requests:approve');
        const parse = wfRequestListQuerySchema.safeParse(request.query);
        if (!parse.success) {
            return reply.status(400).send({ success: false, error: 'Validation failed', details: parse.error.errors });
        }
        const result = await wfService.listRequests(parse.data);
        return reply.send({ success: true, ...result });
    });

    // GET /wf/admin/requests/:id
    fastify.get('/wf/admin/requests/:id', async (request: FastifyRequest, reply: FastifyReply) => {
        requirePermission(request, 'requests:approve');
        const param = idParamSchema.safeParse(request.params);
        if (!param.success) {
            return reply.status(400).send({ success: false, error: 'Invalid ID' });
        }
        try {
            const result = await wfService.getRequest(param.data.id);
            return reply.send({ success: true, data: result });
        } catch (err) {
            return handleWfError(err, reply);
        }
    });

    // GET /wf/admin/definitions
    fastify.get('/wf/admin/definitions', async (request: FastifyRequest, reply: FastifyReply) => {
        requirePermission(request, 'requests:approve');
        const defs = await wfService.listDefinitions();
        return reply.send({ success: true, data: defs });
    });

    // POST /wf/admin/definitions
    fastify.post('/wf/admin/definitions', async (request: FastifyRequest, reply: FastifyReply) => {
        requirePermission(request, 'requests:approve');
        const parse = createWfDefinitionSchema.safeParse(request.body);
        if (!parse.success) {
            return reply.status(400).send({ success: false, error: 'Validation failed', details: parse.error.errors });
        }
        try {
            const result = await wfService.createDefinition(parse.data);
            return reply.status(201).send({ success: true, data: result });
        } catch (err) {
            return handleWfError(err, reply);
        }
    });
}
