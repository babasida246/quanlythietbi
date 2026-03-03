/**
 * Checkout Module - API Routes
 * Fastify routes for asset checkout/checkin management
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { CheckoutService } from './checkout.service.js';
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
} from './checkout.schemas.js';
import type { AuthService } from '../auth/index.js';

// ==================== Route Handler ====================

export async function checkoutRoutes(
    fastify: FastifyInstance,
    checkoutService: CheckoutService,
    authService: AuthService
): Promise<void> {
    // ==================== Checkout Operations ====================

    // List checkouts
    fastify.get('/checkouts', {
        schema: {
            tags: ['Checkouts'],
            summary: 'List all checkouts',
            description: 'Get paginated list of checkouts with optional filters'
        }
    }, async (request: FastifyRequest, reply: FastifyReply) => {
        const query = checkoutListQuerySchema.parse(request.query);

        // Normalize array parameters
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
    fastify.get('/checkouts/:id', {
        schema: {
            tags: ['Checkouts'],
            summary: 'Get checkout by ID',
            description: 'Get detailed information about a specific checkout'
        }
    }, async (request: FastifyRequest, reply: FastifyReply) => {
        const { id } = checkoutIdParamSchema.parse(request.params);
        const checkout = await checkoutService.getCheckoutWithDetails(id);

        if (!checkout) {
            return reply.status(404).send({ error: 'Checkout not found' });
        }

        return reply.send(checkout);
    });

    // Checkout an asset
    fastify.post('/checkouts', {
        schema: {
            tags: ['Checkouts'],
            summary: 'Checkout an asset',
            description: 'Checkout an asset to a user, location, or another asset'
        }
    }, async (request: FastifyRequest, reply: FastifyReply) => {
        const data = checkoutAssetSchema.parse(request.body);
        const userId = (request as unknown as { userId?: string }).userId ?? '00000000-0000-0000-0000-000000000000';

        try {
            const checkout = await checkoutService.checkoutAsset({
                ...data,
                checkedOutBy: userId
            });
            return reply.status(201).send(checkout);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to checkout asset';
            return reply.status(400).send({ error: message });
        }
    });

    // Checkin an asset
    fastify.post('/checkouts/:id/checkin', {
        schema: {
            tags: ['Checkouts'],
            summary: 'Checkin an asset',
            description: 'Check in an asset that is currently checked out'
        }
    }, async (request: FastifyRequest, reply: FastifyReply) => {
        const { id } = checkoutIdParamSchema.parse(request.params);
        const data = checkinAssetSchema.parse({ ...(request.body as object), checkoutId: id });
        const userId = (request as unknown as { userId?: string }).userId ?? '00000000-0000-0000-0000-000000000000';

        try {
            const checkout = await checkoutService.checkinAsset({
                ...data,
                checkedInBy: userId
            });
            return reply.send(checkout);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to checkin asset';
            if (message === 'Checkout record not found') {
                return reply.status(404).send({ error: message });
            }
            return reply.status(400).send({ error: message });
        }
    });

    // ==================== Extension Routes ====================

    // Extend a checkout
    fastify.post('/checkouts/:id/extend', {
        schema: {
            tags: ['Checkouts'],
            summary: 'Extend checkout',
            description: 'Extend the expected return date of a checkout'
        }
    }, async (request: FastifyRequest, reply: FastifyReply) => {
        const { id } = checkoutIdParamSchema.parse(request.params);
        const data = extendCheckoutSchema.parse({ ...(request.body as object), checkoutId: id });
        const userId = (request as unknown as { userId?: string }).userId ?? '00000000-0000-0000-0000-000000000000';

        try {
            const extension = await checkoutService.extendCheckout({
                ...data,
                extendedBy: userId
            });
            return reply.status(201).send(extension);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to extend checkout';
            if (message === 'Checkout record not found') {
                return reply.status(404).send({ error: message });
            }
            return reply.status(400).send({ error: message });
        }
    });

    // List extensions
    fastify.get('/checkouts/extensions', {
        schema: {
            tags: ['Checkouts'],
            summary: 'List extensions',
            description: 'Get paginated list of checkout extensions'
        }
    }, async (request: FastifyRequest, reply: FastifyReply) => {
        const query = extensionListQuerySchema.parse(request.query);
        const result = await checkoutService.listExtensions(query);
        return reply.send(result);
    });

    // ==================== Transfer Routes ====================

    // Transfer an asset
    fastify.post('/checkouts/:id/transfer', {
        schema: {
            tags: ['Checkouts'],
            summary: 'Transfer asset',
            description: 'Transfer an asset from one user to another'
        }
    }, async (request: FastifyRequest, reply: FastifyReply) => {
        const { id } = checkoutIdParamSchema.parse(request.params);
        const data = transferAssetSchema.parse({ ...(request.body as object), checkoutId: id });
        const userId = (request as unknown as { userId?: string }).userId ?? '00000000-0000-0000-0000-000000000000';

        try {
            const result = await checkoutService.transferAsset({
                ...data,
                transferredBy: userId
            });
            return reply.status(201).send(result);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to transfer asset';
            if (message === 'Checkout record not found') {
                return reply.status(404).send({ error: message });
            }
            return reply.status(400).send({ error: message });
        }
    });

    // List transfers
    fastify.get('/checkouts/transfers', {
        schema: {
            tags: ['Checkouts'],
            summary: 'List transfers',
            description: 'Get paginated list of asset transfers'
        }
    }, async (request: FastifyRequest, reply: FastifyReply) => {
        const query = transferListQuerySchema.parse(request.query);
        const result = await checkoutService.listTransfers(query);
        return reply.send(result);
    });

    // ==================== History & Stats Routes ====================

    // Get checkout history
    fastify.get('/checkouts/history', {
        schema: {
            tags: ['Checkouts'],
            summary: 'Get checkout history',
            description: 'Get paginated checkout history with optional filters'
        }
    }, async (request: FastifyRequest, reply: FastifyReply) => {
        const query = checkoutHistoryQuerySchema.parse(request.query);
        const result = await checkoutService.getHistory(query);
        return reply.send(result);
    });

    // Get checkout summary/stats
    fastify.get('/checkouts/summary', {
        schema: {
            tags: ['Checkouts'],
            summary: 'Get checkout summary',
            description: 'Get summary statistics for checkouts'
        }
    }, async (request: FastifyRequest, reply: FastifyReply) => {
        const query = request.query as { organizationId?: string };
        const summary = await checkoutService.getSummary(query.organizationId);
        return reply.send(summary);
    });

    // Get active checkout for asset
    fastify.get('/assets/:assetId/checkout', {
        schema: {
            tags: ['Checkouts'],
            summary: 'Get active checkout for asset',
            description: 'Get the current active checkout for a specific asset'
        }
    }, async (request: FastifyRequest, reply: FastifyReply) => {
        const { assetId } = assetIdParamSchema.parse(request.params);
        const checkout = await checkoutService.getActiveCheckoutByAssetId(assetId);

        if (!checkout) {
            return reply.status(404).send({ error: 'No active checkout found for this asset' });
        }

        const details = await checkoutService.getCheckoutWithDetails(checkout.id);
        return reply.send(details);
    });

    // Get checkout history for asset
    fastify.get('/assets/:assetId/checkouts', {
        schema: {
            tags: ['Checkouts'],
            summary: 'Get checkout history for asset',
            description: 'Get all checkout history for a specific asset'
        }
    }, async (request: FastifyRequest, reply: FastifyReply) => {
        const { assetId } = assetIdParamSchema.parse(request.params);
        const query = checkoutHistoryQuerySchema.parse({
            ...request.query as object,
            assetId
        });
        const result = await checkoutService.getHistory(query);
        return reply.send(result);
    });

    // Get checkout history for user
    fastify.get('/users/:userId/checkouts', {
        schema: {
            tags: ['Checkouts'],
            summary: 'Get checkout history for user',
            description: 'Get all checkout history for a specific user'
        }
    }, async (request: FastifyRequest, reply: FastifyReply) => {
        const { userId } = userIdParamSchema.parse(request.params);
        const query = checkoutHistoryQuerySchema.parse({
            ...request.query as object,
            userId
        });
        const result = await checkoutService.getHistory(query);
        return reply.send(result);
    });

    // ==================== Overdue Routes ====================

    // Get overdue checkouts
    fastify.get('/checkouts/overdue', {
        schema: {
            tags: ['Checkouts'],
            summary: 'Get overdue checkouts',
            description: 'Get list of all overdue checkouts'
        }
    }, async (request: FastifyRequest, reply: FastifyReply) => {
        const overdueCheckouts = await checkoutService.getOverdueCheckouts();
        return reply.send(overdueCheckouts);
    });

    // Process overdue checkouts (admin/system endpoint)
    fastify.post('/checkouts/overdue/process', {
        schema: {
            tags: ['Checkouts'],
            summary: 'Process overdue checkouts',
            description: 'Update overdue status and trigger notifications (admin only)'
        }
    }, async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const result = await checkoutService.processOverdueCheckouts();
            return reply.send(result);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to process overdue checkouts';
            return reply.status(500).send({ error: message });
        }
    });

    // ==================== Audit Log Routes ====================

    // Get audit logs for checkout
    fastify.get('/checkouts/:id/audit-logs', {
        schema: {
            tags: ['Checkouts'],
            summary: 'Get audit logs for checkout',
            description: 'Get audit trail for a specific checkout'
        }
    }, async (request: FastifyRequest, reply: FastifyReply) => {
        const { id } = checkoutIdParamSchema.parse(request.params);
        const query = request.query as { limit?: string };
        const limit = query.limit ? parseInt(query.limit, 10) : 50;

        const logs = await checkoutService.getAuditLogs(id, undefined, limit);
        return reply.send(logs);
    });

    // Get audit logs for asset
    fastify.get('/assets/:assetId/checkout-audit-logs', {
        schema: {
            tags: ['Checkouts'],
            summary: 'Get checkout audit logs for asset',
            description: 'Get checkout audit trail for a specific asset'
        }
    }, async (request: FastifyRequest, reply: FastifyReply) => {
        const { assetId } = assetIdParamSchema.parse(request.params);
        const query = request.query as { limit?: string };
        const limit = query.limit ? parseInt(query.limit, 10) : 50;

        const logs = await checkoutService.getAuditLogs(undefined, assetId, limit);
        return reply.send(logs);
    });
}
