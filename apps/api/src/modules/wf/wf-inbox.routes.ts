/**
 * Workflow Module – Approver Inbox Routes
 * Prefix: /wf   (registered under /api/v1 in assets.module.ts)
 *
 * GET  /wf/inbox                       list pending approvals for current user
 * GET  /wf/inbox/summary               counts (pending / urgent / overdue / unassigned)
 * GET  /wf/approvals/unassigned        list unassigned approval tasks (admin/manager)
 * POST /wf/approvals/:id/approve
 * POST /wf/approvals/:id/reject
 * POST /wf/approvals/:id/claim         claim an unassigned approval
 * POST /wf/approvals/:id/delegate      delegate to another user
 * POST /wf/approvals/:id/request-info  ask requester for more information
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { WfService } from './wf.service.js';
import { WfError } from './wf.service.js';
import { requirePermission, getUserContext } from '../../routes/v1/assets/assets.helpers.js';
import {
    approveWfApprovalSchema,
    rejectWfApprovalSchema,
    delegateWfApprovalSchema,
    requestInfoSchema,
    inboxQuerySchema,
    idParamSchema,
} from './wf.schemas.js';

function handleWfError(err: unknown, reply: FastifyReply) {
    if (err instanceof WfError) {
        return reply.status(err.statusCode).send({ success: false, error: err.message });
    }
    throw err;
}

export async function wfInboxRoutes(
    fastify: FastifyInstance,
    options: { wfService: WfService }
): Promise<void> {
    const { wfService } = options;

    // GET /wf/inbox
    fastify.get('/wf/inbox', async (request: FastifyRequest, reply: FastifyReply) => {
        const { userId } = requirePermission(request, 'requests:read');
        const { role } = getUserContext(request);
        const parse = inboxQuerySchema.safeParse(request.query);
        if (!parse.success) {
            return reply.status(400).send({ success: false, error: 'Validation failed', details: parse.error.errors });
        }
        const result = await wfService.listInbox(userId, parse.data.page, parse.data.limit, role);
        return reply.send({ success: true, ...result });
    });

    // GET /wf/inbox/summary
    fastify.get('/wf/inbox/summary', async (request: FastifyRequest, reply: FastifyReply) => {
        const { userId } = requirePermission(request, 'requests:read');
        const { role } = getUserContext(request);
        const summary = await wfService.getInboxSummary(userId, role);
        return reply.send({ success: true, data: summary });
    });

    // GET /wf/approvals/unassigned  (admin / manager queue)
    fastify.get('/wf/approvals/unassigned', async (request: FastifyRequest, reply: FastifyReply) => {
        requirePermission(request, 'requests:approve');
        const parse = inboxQuerySchema.safeParse(request.query);
        if (!parse.success) {
            return reply.status(400).send({ success: false, error: 'Validation failed', details: parse.error.errors });
        }
        const result = await wfService.listUnassignedApprovals(parse.data.page, parse.data.limit);
        return reply.send({ success: true, ...result });
    });

    // POST /wf/approvals/:id/approve
    fastify.post('/wf/approvals/:id/approve', async (request: FastifyRequest, reply: FastifyReply) => {
        const { userId } = requirePermission(request, 'requests:approve');
        const param = idParamSchema.safeParse(request.params);
        if (!param.success) {
            return reply.status(400).send({ success: false, error: 'Invalid approval ID' });
        }
        const parse = approveWfApprovalSchema.safeParse(request.body);
        if (!parse.success) {
            return reply.status(400).send({ success: false, error: 'Validation failed', details: parse.error.errors });
        }
        try {
            const result = await wfService.approveApproval({
                approvalId: param.data.id,
                actorId: userId,
                comment: parse.data.comment,
            });
            return reply.send({ success: true, data: result });
        } catch (err) {
            return handleWfError(err, reply);
        }
    });

    // POST /wf/approvals/:id/reject
    fastify.post('/wf/approvals/:id/reject', async (request: FastifyRequest, reply: FastifyReply) => {
        const { userId } = requirePermission(request, 'requests:approve');
        const param = idParamSchema.safeParse(request.params);
        if (!param.success) {
            return reply.status(400).send({ success: false, error: 'Invalid approval ID' });
        }
        const parse = rejectWfApprovalSchema.safeParse(request.body);
        if (!parse.success) {
            return reply.status(400).send({ success: false, error: 'Validation failed', details: parse.error.errors });
        }
        try {
            const result = await wfService.rejectApproval({
                approvalId: param.data.id,
                actorId: userId,
                comment: parse.data.comment,
            });
            return reply.send({ success: true, data: result });
        } catch (err) {
            return handleWfError(err, reply);
        }
    });

    // POST /wf/approvals/:id/claim
    fastify.post('/wf/approvals/:id/claim', async (request: FastifyRequest, reply: FastifyReply) => {
        const { userId } = requirePermission(request, 'requests:approve');
        const param = idParamSchema.safeParse(request.params);
        if (!param.success) {
            return reply.status(400).send({ success: false, error: 'Invalid approval ID' });
        }
        try {
            const result = await wfService.claimApproval({ approvalId: param.data.id, actorId: userId });
            return reply.send({ success: true, data: result });
        } catch (err) {
            return handleWfError(err, reply);
        }
    });

    // POST /wf/approvals/:id/delegate
    fastify.post('/wf/approvals/:id/delegate', async (request: FastifyRequest, reply: FastifyReply) => {
        const { userId } = requirePermission(request, 'requests:approve');
        const param = idParamSchema.safeParse(request.params);
        if (!param.success) {
            return reply.status(400).send({ success: false, error: 'Invalid approval ID' });
        }
        const parse = delegateWfApprovalSchema.safeParse(request.body);
        if (!parse.success) {
            return reply.status(400).send({ success: false, error: 'Validation failed', details: parse.error.errors });
        }
        try {
            const result = await wfService.delegateApproval({
                approvalId: param.data.id,
                actorId: userId,
                toUserId: parse.data.toUserId,
                reason: parse.data.reason,
            });
            return reply.send({ success: true, data: result });
        } catch (err) {
            return handleWfError(err, reply);
        }
    });

    // POST /wf/approvals/:id/request-info
    fastify.post('/wf/approvals/:id/request-info', async (request: FastifyRequest, reply: FastifyReply) => {
        const { userId } = requirePermission(request, 'requests:approve');
        const param = idParamSchema.safeParse(request.params);
        if (!param.success) {
            return reply.status(400).send({ success: false, error: 'Invalid approval ID' });
        }
        const parse = requestInfoSchema.safeParse(request.body);
        if (!parse.success) {
            return reply.status(400).send({ success: false, error: 'Validation failed', details: parse.error.errors });
        }
        try {
            await wfService.requestMoreInfo({
                approvalId: param.data.id,
                actorId: userId,
                question: parse.data.question,
            });
            return reply.send({ success: true });
        } catch (err) {
            return handleWfError(err, reply);
        }
    });
}
