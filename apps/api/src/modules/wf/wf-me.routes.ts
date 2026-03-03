/**
 * Workflow Module – Requester (self-service) Routes
 * Prefix: /wf   (registered under /api/v1 in assets.module.ts)
 *
 * GET  /wf/me/requests              list my own requests
 * POST /wf/me/requests              create draft
 * GET  /wf/me/requests/:id          get detail + timeline
 * POST /wf/me/requests/:id/submit   submit for approval
 * POST /wf/me/requests/:id/withdraw withdraw submitted/in_review → back to draft
 * POST /wf/me/requests/:id/cancel   cancel entirely
 * POST /wf/me/requests/:id/comment  add comment/note
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { WfService } from './wf.service.js';
import { WfError } from './wf.service.js';
import { requirePermission, getUserContext } from '../../routes/v1/assets/assets.helpers.js';
import {
    createWfRequestSchema,
    cancelWfRequestSchema,
    withdrawWfRequestSchema,
    commentWfRequestSchema,
    wfRequestListQuerySchema,
    idParamSchema,
} from './wf.schemas.js';

function handleWfError(err: unknown, reply: FastifyReply) {
    if (err instanceof WfError) {
        return reply.status(err.statusCode).send({ success: false, error: err.message });
    }
    throw err;
}

export async function wfMeRoutes(
    fastify: FastifyInstance,
    options: { wfService: WfService }
): Promise<void> {
    const { wfService } = options;

    // GET /wf/me/requests
    fastify.get('/wf/me/requests', async (request: FastifyRequest, reply: FastifyReply) => {
        const { userId } = requirePermission(request, 'requests:read');
        const parse = wfRequestListQuerySchema.safeParse(request.query);
        if (!parse.success) {
            return reply.status(400).send({ success: false, error: 'Validation failed', details: parse.error.errors });
        }
        const result = await wfService.listRequests({ ...parse.data, requesterId: userId });
        return reply.send({ success: true, ...result });
    });

    // POST /wf/me/requests
    fastify.post('/wf/me/requests', async (request: FastifyRequest, reply: FastifyReply) => {
        const { userId } = requirePermission(request, 'requests:create');
        const parse = createWfRequestSchema.safeParse(request.body);
        if (!parse.success) {
            return reply.status(400).send({ success: false, error: 'Validation failed', details: parse.error.errors });
        }
        try {
            const result = await wfService.createRequest({ ...parse.data, requesterId: userId });
            return reply.status(201).send({ success: true, data: result });
        } catch (err) {
            return handleWfError(err, reply);
        }
    });

    // GET /wf/me/requests/:id
    fastify.get('/wf/me/requests/:id', async (request: FastifyRequest, reply: FastifyReply) => {
        const { userId } = requirePermission(request, 'requests:read');
        const param = idParamSchema.safeParse(request.params);
        if (!param.success) {
            return reply.status(400).send({ success: false, error: 'Invalid ID' });
        }
        try {
            const result = await wfService.getRequest(param.data.id);
            // Only requester or admin can read their own requests (simple owner check)
            const ctx = getUserContext(request);
            if (result.requesterId !== userId && ctx.role !== 'admin' && ctx.role !== 'super_admin') {
                return reply.status(403).send({ success: false, error: 'Access denied' });
            }
            return reply.send({ success: true, data: result });
        } catch (err) {
            return handleWfError(err, reply);
        }
    });

    // POST /wf/me/requests/:id/submit
    fastify.post('/wf/me/requests/:id/submit', async (request: FastifyRequest, reply: FastifyReply) => {
        const { userId } = requirePermission(request, 'requests:create');
        const param = idParamSchema.safeParse(request.params);
        if (!param.success) {
            return reply.status(400).send({ success: false, error: 'Invalid ID' });
        }
        try {
            const result = await wfService.submitRequest({ requestId: param.data.id, actorId: userId });
            return reply.send({ success: true, data: result });
        } catch (err) {
            return handleWfError(err, reply);
        }
    });

    // POST /wf/me/requests/:id/withdraw  (pull back a submitted/in_review request → draft)
    fastify.post('/wf/me/requests/:id/withdraw', async (request: FastifyRequest, reply: FastifyReply) => {
        const { userId } = requirePermission(request, 'requests:create');
        const param = idParamSchema.safeParse(request.params);
        if (!param.success) {
            return reply.status(400).send({ success: false, error: 'Invalid ID' });
        }
        const parse = withdrawWfRequestSchema.safeParse(request.body);
        if (!parse.success) {
            return reply.status(400).send({ success: false, error: 'Validation failed', details: parse.error.errors });
        }
        try {
            const result = await wfService.withdrawRequest({
                requestId: param.data.id,
                actorId: userId,
                reason: parse.data.reason,
            });
            return reply.send({ success: true, data: result });
        } catch (err) {
            return handleWfError(err, reply);
        }
    });

    // POST /wf/me/requests/:id/cancel
    fastify.post('/wf/me/requests/:id/cancel', async (request: FastifyRequest, reply: FastifyReply) => {
        const { userId } = requirePermission(request, 'requests:create');
        const param = idParamSchema.safeParse(request.params);
        if (!param.success) {
            return reply.status(400).send({ success: false, error: 'Invalid ID' });
        }
        const parse = cancelWfRequestSchema.safeParse(request.body);
        if (!parse.success) {
            return reply.status(400).send({ success: false, error: 'Validation failed', details: parse.error.errors });
        }
        try {
            const result = await wfService.cancelRequest({
                requestId: param.data.id,
                actorId: userId,
                reason: parse.data.reason,
            });
            return reply.send({ success: true, data: result });
        } catch (err) {
            return handleWfError(err, reply);
        }
    });

    // POST /wf/me/requests/:id/comment
    fastify.post('/wf/me/requests/:id/comment', async (request: FastifyRequest, reply: FastifyReply) => {
        const { userId } = requirePermission(request, 'requests:read');
        const param = idParamSchema.safeParse(request.params);
        if (!param.success) {
            return reply.status(400).send({ success: false, error: 'Invalid ID' });
        }
        const parse = commentWfRequestSchema.safeParse(request.body);
        if (!parse.success) {
            return reply.status(400).send({ success: false, error: 'Validation failed', details: parse.error.errors });
        }
        try {
            await wfService.addComment({
                requestId: param.data.id,
                actorId: userId,
                comment: parse.data.comment,
            });
            return reply.send({ success: true });
        } catch (err) {
            return handleWfError(err, reply);
        }
    });
}
