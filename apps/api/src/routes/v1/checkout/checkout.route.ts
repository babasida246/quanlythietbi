/**
 * Checkout Module - API Routes (Clean Architecture)
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { CheckoutService } from '@qltb/application';
import {
    checkoutAssetSchema,
    checkinAssetSchema,
    extendCheckoutSchema,
    transferAssetSchema,
    checkoutListQuerySchema,
    checkoutHistoryQuerySchema,
    extensionListQuerySchema,
    transferListQuerySchema,
    checkoutIdParamSchema,
    assetIdParamSchema,
    userIdParamSchema
} from './checkout.schema.js';

export async function checkoutRoute(
    fastify: FastifyInstance,
    opts: { checkoutService: CheckoutService }
): Promise<void> {
    const { checkoutService } = opts;

    // List checkouts
    fastify.get('/checkouts', async (request: FastifyRequest, reply: FastifyReply) => {
        const query = checkoutListQuerySchema.parse(request.query);

        const normalizedQuery = {
            ...query,
            status: query.status
                ? (Array.isArray(query.status) ? query.status : [query.status])
                : undefined,
            checkoutType: query.checkoutType
                ? (Array.isArray(query.checkoutType) ? query.checkoutType : [query.checkoutType])
                : undefined,
            dueStatus: query.dueStatus
                ? (Array.isArray(query.dueStatus) ? query.dueStatus : [query.dueStatus])
                : undefined
        };

        const result = await checkoutService.listCheckouts(normalizedQuery);
        return reply.send(result);
    });

    // Get checkout by ID
    fastify.get('/checkouts/:id', async (request: FastifyRequest, reply: FastifyReply) => {
        const { id } = checkoutIdParamSchema.parse(request.params);
        const checkout = await checkoutService.getCheckoutWithDetails(id);

        if (!checkout) {
            return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Checkout not found' } });
        }

        return reply.send({ success: true, data: checkout });
    });

    // Checkout an asset
    fastify.post('/checkouts', async (request: FastifyRequest, reply: FastifyReply) => {
        const data = checkoutAssetSchema.parse(request.body);
        const userId = request.user?.id ?? 'system';

        try {
            const checkout = await checkoutService.checkoutAsset({ ...data, checkedOutBy: userId });
            return reply.status(201).send({ success: true, data: checkout });
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to checkout asset';
            return reply.status(400).send({ success: false, error: { code: 'BAD_REQUEST', message } });
        }
    });

    // Checkin an asset
    fastify.post('/checkouts/:id/checkin', async (request: FastifyRequest, reply: FastifyReply) => {
        const { id } = checkoutIdParamSchema.parse(request.params);
        const data = checkinAssetSchema.parse({ ...(request.body as object), checkoutId: id });
        const userId = request.user?.id ?? 'system';

        try {
            const checkout = await checkoutService.checkinAsset({ ...data, checkedInBy: userId });
            return reply.send({ success: true, data: checkout });
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to checkin asset';
            const status = message === 'Checkout record not found' ? 404 : 400;
            return reply.status(status).send({ success: false, error: { code: 'BAD_REQUEST', message } });
        }
    });

    // Extend a checkout
    fastify.post('/checkouts/:id/extend', async (request: FastifyRequest, reply: FastifyReply) => {
        const { id } = checkoutIdParamSchema.parse(request.params);
        const data = extendCheckoutSchema.parse({ ...(request.body as object), checkoutId: id });
        const userId = request.user?.id ?? 'system';

        try {
            const extension = await checkoutService.extendCheckout({ ...data, extendedBy: userId });
            return reply.status(201).send({ success: true, data: extension });
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to extend checkout';
            const status = message === 'Checkout record not found' ? 404 : 400;
            return reply.status(status).send({ success: false, error: { code: 'BAD_REQUEST', message } });
        }
    });

    // List extensions
    fastify.get('/checkouts/extensions', async (request: FastifyRequest, reply: FastifyReply) => {
        const query = extensionListQuerySchema.parse(request.query);
        const result = await checkoutService.listExtensions(query);
        return reply.send({ success: true, data: result });
    });

    // Transfer an asset
    fastify.post('/checkouts/:id/transfer', async (request: FastifyRequest, reply: FastifyReply) => {
        const { id } = checkoutIdParamSchema.parse(request.params);
        const data = transferAssetSchema.parse({ ...(request.body as object), checkoutId: id });
        const userId = request.user?.id ?? 'system';

        try {
            const result = await checkoutService.transferAsset({ ...data, transferredBy: userId });
            return reply.status(201).send({ success: true, data: result });
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to transfer asset';
            const status = message === 'Checkout record not found' ? 404 : 400;
            return reply.status(status).send({ success: false, error: { code: 'BAD_REQUEST', message } });
        }
    });

    // List transfers
    fastify.get('/checkouts/transfers', async (request: FastifyRequest, reply: FastifyReply) => {
        const query = transferListQuerySchema.parse(request.query);
        const result = await checkoutService.listTransfers(query);
        return reply.send({ success: true, data: result });
    });

    // Get checkout history
    fastify.get('/checkouts/history', async (request: FastifyRequest, reply: FastifyReply) => {
        const query = checkoutHistoryQuerySchema.parse(request.query);
        const result = await checkoutService.getHistory(query);
        return reply.send({ success: true, data: result });
    });

    // Get checkout summary
    fastify.get('/checkouts/summary', async (request: FastifyRequest, reply: FastifyReply) => {
        const query = request.query as { organizationId?: string };
        const summary = await checkoutService.getSummary(query.organizationId);
        return reply.send({ success: true, data: summary });
    });

    // Get overdue checkouts
    fastify.get('/checkouts/overdue', async (request: FastifyRequest, reply: FastifyReply) => {
        const overdueCheckouts = await checkoutService.getOverdueCheckouts();
        return reply.send({ success: true, data: overdueCheckouts });
    });

    // Process overdue checkouts
    fastify.post('/checkouts/overdue/process', async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const result = await checkoutService.processOverdueCheckouts();
            return reply.send({ success: true, data: result });
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to process overdue checkouts';
            return reply.status(500).send({ success: false, error: { code: 'INTERNAL_ERROR', message } });
        }
    });

    // Get audit logs for checkout
    fastify.get('/checkouts/:id/audit-logs', async (request: FastifyRequest, reply: FastifyReply) => {
        const { id } = checkoutIdParamSchema.parse(request.params);
        const query = request.query as { limit?: string };
        const limit = query.limit ? parseInt(query.limit, 10) : 50;

        const logs = await checkoutService.getAuditLogs(id, undefined, limit);
        return reply.send({ success: true, data: logs });
    });

    // Get active checkout for asset
    fastify.get('/assets/:assetId/checkout', async (request: FastifyRequest, reply: FastifyReply) => {
        const { assetId } = assetIdParamSchema.parse(request.params);
        const checkout = await checkoutService.getActiveCheckoutByAssetId(assetId);

        if (!checkout) {
            return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'No active checkout found for this asset' } });
        }

        const details = await checkoutService.getCheckoutWithDetails(checkout.id);
        return reply.send({ success: true, data: details });
    });

    // Get checkout history for asset
    fastify.get('/assets/:assetId/checkouts', async (request: FastifyRequest, reply: FastifyReply) => {
        const { assetId } = assetIdParamSchema.parse(request.params);
        const query = checkoutHistoryQuerySchema.parse({ ...request.query as object, assetId });
        const result = await checkoutService.getHistory(query);
        return reply.send({ success: true, data: result });
    });

    // Get checkout history for user
    fastify.get('/users/:userId/checkouts', async (request: FastifyRequest, reply: FastifyReply) => {
        const { userId } = userIdParamSchema.parse(request.params);
        const query = checkoutHistoryQuerySchema.parse({ ...request.query as object, userId });
        const result = await checkoutService.getHistory(query);
        return reply.send({ success: true, data: result });
    });

    // Get checkout audit logs for asset
    fastify.get('/assets/:assetId/checkout-audit-logs', async (request: FastifyRequest, reply: FastifyReply) => {
        const { assetId } = assetIdParamSchema.parse(request.params);
        const query = request.query as { limit?: string };
        const limit = query.limit ? parseInt(query.limit, 10) : 50;

        const logs = await checkoutService.getAuditLogs(undefined, assetId, limit);
        return reply.send({ success: true, data: logs });
    });
}
