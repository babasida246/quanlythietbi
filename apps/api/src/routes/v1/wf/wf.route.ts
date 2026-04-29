/**
 * Workflow Module - Combined Routes (Clean Architecture)
 * Merges me-routes, inbox-routes, and admin-routes into one Fastify plugin
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { WfService, AssetFlowService } from '@qltb/application';
import { WfError } from '@qltb/application';
import { requirePermission, getUserContext } from '../assets/assets.helpers.js';
import {
    createWfRequestSchema,
    cancelWfRequestSchema,
    withdrawWfRequestSchema,
    commentWfRequestSchema,
    wfRequestListQuerySchema,
    approveWfApprovalSchema,
    rejectWfApprovalSchema,
    delegateWfApprovalSchema,
    requestInfoSchema,
    inboxQuerySchema,
    createWfDefinitionSchema,
    idParamSchema,
} from './wf.schema.js';

function handleWfError(err: unknown, reply: FastifyReply) {
    // Keep domain-specific workflow failures in a stable API shape.
    if (err instanceof WfError) {
        return reply.status(err.statusCode).send({ success: false, error: err.message });
    }
    // Unique constraint violation — concurrent approval race condition (PG error code 23505)
    if (typeof err === 'object' && err !== null && (err as { code?: string }).code === '23505') {
        return reply.status(409).send({
            success: false,
            error: 'Yêu cầu này đã được xử lý bởi người dùng khác. Vui lòng tải lại trang và thử lại.',
        });
    }
    throw err;
}

/**
 * Registers workflow requester, approver inbox, and admin endpoints.
 *
 * Route handlers intentionally keep orchestration thin: validate input,
 * authorize action, delegate to service, and map known domain errors.
 */
export async function wfRoute(
    fastify: FastifyInstance,
    opts: { wfService: WfService; assetFlowService: AssetFlowService }
): Promise<void> {
    const { wfService, assetFlowService } = opts;

    // ==================== Requester (me) routes ====================

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
            const ctx = getUserContext(request);
            // Request owners can view their own request; elevated roles can inspect all.
            if (result.requesterId !== userId && ctx.role !== 'root' && ctx.role !== 'admin' && ctx.role !== 'super_admin') {
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

    // POST /wf/me/requests/:id/withdraw
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

    // ==================== Approver Inbox routes ====================

    // GET /wf/inbox
    fastify.get('/wf/inbox', async (request: FastifyRequest, reply: FastifyReply) => {
        const { userId } = requirePermission(request, 'requests:read');
        const { role } = getUserContext(request);
        const parse = inboxQuerySchema.safeParse(request.query);
        if (!parse.success) {
            return reply.status(400).send({ success: false, error: 'Validation failed', details: parse.error.errors });
        }
        const requestStatuses = parse.data.statusGroup === 'submitted'
            ? ['submitted']
            : parse.data.statusGroup === 'approved'
                ? ['approved']
                : parse.data.statusGroup === 'all'
                    ? undefined
                    : ['submitted', 'approved'];
        const result = await wfService.listInbox(userId, parse.data.page, parse.data.limit, role, requestStatuses);
        return reply.send({ success: true, ...result });
    });

    // GET /wf/inbox/summary
    fastify.get('/wf/inbox/summary', async (request: FastifyRequest, reply: FastifyReply) => {
        const { userId } = requirePermission(request, 'requests:read');
        const { role } = getUserContext(request);
        const summary = await wfService.getInboxSummary(userId, role);
        return reply.send({ success: true, data: summary });
    });

    // GET /wf/approvals/unassigned
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
            if (result.status === 'approved') {
                // Approval success should not fail the HTTP request if follow-up automation fails.
                await assetFlowService.onRequestApproved(result, userId).catch((error: unknown) => {
                    request.log.warn(
                        { err: error, requestId: result.id, requestType: result.requestType },
                        'Failed to auto-generate stock document after approval'
                    );
                });
            }
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

    // ==================== Admin routes ====================

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
