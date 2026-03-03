/**
 * Audit Module - Fastify Routes
 * Module: 07-AUDIT (Asset Audit/Inventory Check)
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { AuditService } from './audit.service.js';
import {
    createAuditSchema,
    updateAuditSchema,
    startAuditSchema,
    completeAuditSchema,
    cancelAuditSchema,
    auditItemSchema,
    bulkAuditItemSchema,
    resolveDiscrepancySchema,
    createUnregisteredAssetSchema,
    updateUnregisteredAssetSchema,
    assignAuditorSchema,
    auditListQuerySchema,
    auditItemListQuerySchema,
    discrepancyQuerySchema,
    unregisteredAssetQuerySchema,
    auditIdParamSchema,
    scanAssetSchema,
} from './audit.schemas.js';

interface AuditRoutesOptions {
    auditService: AuditService;
}

export async function auditRoutes(
    fastify: FastifyInstance,
    options: AuditRoutesOptions
) {
    const { auditService } = options;

    // ==================== Audit Session Routes ====================

    // Get all audits
    fastify.get(
        '/audits',
        {
            schema: {
                tags: ['Audits'],
                summary: 'List all audit sessions',
            },
        },
        async (request: FastifyRequest, reply: FastifyReply) => {
            const query = auditListQuerySchema.parse(request.query);
            const result = await auditService.getAudits(query);
            return reply.send(result);
        }
    );

    // Get my assigned audits
    fastify.get(
        '/audits/my-assignments',
        {
            schema: {
                tags: ['Audits'],
                summary: 'Get audits assigned to current user',
            },
        },
        async (request: FastifyRequest, reply: FastifyReply) => {
            const userId = request.user?.id || request.headers['x-user-id'];
            if (!userId) {
                return reply.status(401).send({ error: 'Unauthorized' });
            }
            const result = await auditService.getMyAssignedAudits(userId as string);
            return reply.send({ data: result });
        }
    );

    // Get audit statistics
    fastify.get(
        '/audits/statistics',
        {
            schema: {
                tags: ['Audits'],
                summary: 'Get audit statistics',
            },
        },
        async (request: FastifyRequest, reply: FastifyReply) => {
            const { organizationId } = request.query as { organizationId?: string };
            const result = await auditService.getStatistics(organizationId);
            return reply.send(result);
        }
    );

    // Create new audit
    fastify.post(
        '/audits',
        {
            schema: {
                tags: ['Audits'],
                summary: 'Create a new audit session',
            },
        },
        async (request: FastifyRequest, reply: FastifyReply) => {
            const dto = createAuditSchema.parse(request.body);
            const result = await auditService.createAudit(dto);
            if (!result.success) {
                return reply.status(400).send({ error: result.error });
            }
            return reply.status(201).send(result.audit);
        }
    );

    // Get audit by ID
    fastify.get(
        '/audits/:id',
        {
            schema: {
                tags: ['Audits'],
                summary: 'Get audit session by ID',
            },
        },
        async (request: FastifyRequest, reply: FastifyReply) => {
            const { id } = auditIdParamSchema.parse(request.params);
            const result = await auditService.getAuditDetail(id);
            if (!result) {
                return reply.status(404).send({ error: 'Audit not found' });
            }
            return reply.send(result);
        }
    );

    // Update audit
    fastify.patch(
        '/audits/:id',
        {
            schema: {
                tags: ['Audits'],
                summary: 'Update audit session',
            },
        },
        async (request: FastifyRequest, reply: FastifyReply) => {
            const { id } = auditIdParamSchema.parse(request.params);
            const dto = updateAuditSchema.parse(request.body);
            const userId = request.user?.id || request.headers['x-user-id'];
            const result = await auditService.updateAudit(id, {
                ...dto,
                endDate: dto.endDate || undefined,
                notes: dto.notes || undefined
            }, userId as string);
            if (!result.success) {
                return reply.status(400).send({ error: result.error });
            }
            return reply.send(result.audit);
        }
    );

    // Delete audit
    fastify.delete(
        '/audits/:id',
        {
            schema: {
                tags: ['Audits'],
                summary: 'Delete audit session (draft only)',
            },
        },
        async (request: FastifyRequest, reply: FastifyReply) => {
            const { id } = auditIdParamSchema.parse(request.params);
            const userId = request.user?.id || request.headers['x-user-id'];
            const result = await auditService.deleteAudit(id, userId as string);
            if (!result.success) {
                return reply.status(400).send({ error: result.error });
            }
            return reply.status(204).send();
        }
    );

    // Start audit
    fastify.post(
        '/audits/:id/start',
        {
            schema: {
                tags: ['Audits'],
                summary: 'Start an audit session',
            },
        },
        async (request: FastifyRequest, reply: FastifyReply) => {
            const { id } = auditIdParamSchema.parse(request.params);
            const userId = request.user?.id || request.headers['x-user-id'];
            const result = await auditService.startAudit({
                auditId: id,
                startedBy: userId as string,
            });
            if (!result.success) {
                return reply.status(400).send({ error: result.error });
            }
            return reply.send(result.audit);
        }
    );

    // Submit for review
    fastify.post(
        '/audits/:id/submit-review',
        {
            schema: {
                tags: ['Audits'],
                summary: 'Submit audit for review',
            },
        },
        async (request: FastifyRequest, reply: FastifyReply) => {
            const { id } = auditIdParamSchema.parse(request.params);
            const userId = request.user?.id || request.headers['x-user-id'];
            const result = await auditService.submitForReview(id, userId as string);
            if (!result.success) {
                return reply.status(400).send({ error: result.error });
            }
            return reply.send(result.audit);
        }
    );

    // Check completion status
    fastify.get(
        '/audits/:id/completion-check',
        {
            schema: {
                tags: ['Audits'],
                summary: 'Check if audit can be completed',
            },
        },
        async (request: FastifyRequest, reply: FastifyReply) => {
            const { id } = auditIdParamSchema.parse(request.params);
            const result = await auditService.checkCompletion(id);
            return reply.send(result);
        }
    );

    // Complete audit
    fastify.post(
        '/audits/:id/complete',
        {
            schema: {
                tags: ['Audits'],
                summary: 'Complete an audit session',
            },
        },
        async (request: FastifyRequest, reply: FastifyReply) => {
            const { id } = auditIdParamSchema.parse(request.params);
            const body = request.body as { completionNotes?: string; overrideIncomplete?: boolean };
            const userId = request.user?.id || request.headers['x-user-id'];
            const result = await auditService.completeAudit({
                auditId: id,
                completedBy: userId as string,
                completionNotes: body.completionNotes,
                overrideIncomplete: body.overrideIncomplete,
            });
            if (!result.success) {
                return reply.status(400).send({ error: result.error });
            }
            return reply.send(result.audit);
        }
    );

    // Cancel audit
    fastify.post(
        '/audits/:id/cancel',
        {
            schema: {
                tags: ['Audits'],
                summary: 'Cancel an audit session',
            },
        },
        async (request: FastifyRequest, reply: FastifyReply) => {
            const { id } = auditIdParamSchema.parse(request.params);
            const body = request.body as { reason?: string };
            const userId = request.user?.id || request.headers['x-user-id'];
            const result = await auditService.cancelAudit({
                auditId: id,
                cancelledBy: userId as string,
                reason: body.reason,
            });
            if (!result.success) {
                return reply.status(400).send({ error: result.error });
            }
            return reply.send(result.audit);
        }
    );

    // Get audit progress
    fastify.get(
        '/audits/:id/progress',
        {
            schema: {
                tags: ['Audits'],
                summary: 'Get audit progress details',
            },
        },
        async (request: FastifyRequest, reply: FastifyReply) => {
            const { id } = auditIdParamSchema.parse(request.params);
            const result = await auditService.getProgress(id);
            return reply.send(result);
        }
    );

    // ==================== Audit Items Routes ====================

    // Get audit items
    fastify.get(
        '/audits/:id/items',
        {
            schema: {
                tags: ['Audit Items'],
                summary: 'List items in an audit',
            },
        },
        async (request: FastifyRequest, reply: FastifyReply) => {
            const { id } = auditIdParamSchema.parse(request.params);
            const query = auditItemListQuerySchema.parse(request.query);
            const result = await auditService.getAuditItems(id, query);
            return reply.send(result);
        }
    );

    // Audit single item
    fastify.post(
        '/audits/:id/items',
        {
            schema: {
                tags: ['Audit Items'],
                summary: 'Audit a single item',
            },
        },
        async (request: FastifyRequest, reply: FastifyReply) => {
            const { id } = auditIdParamSchema.parse(request.params);
            const body = auditItemSchema.omit({ auditId: true }).parse(request.body);
            const result = await auditService.auditItem({
                auditId: id,
                ...body,
            });
            if (!result.success) {
                return reply.status(400).send({ error: result.error });
            }
            return reply.status(201).send(result.item);
        }
    );

    // Bulk audit items
    fastify.post(
        '/audits/:id/items/bulk',
        {
            schema: {
                tags: ['Audit Items'],
                summary: 'Audit multiple items at once',
            },
        },
        async (request: FastifyRequest, reply: FastifyReply) => {
            const { id } = auditIdParamSchema.parse(request.params);
            const body = bulkAuditItemSchema.omit({ auditId: true }).parse(request.body);
            const result = await auditService.bulkAuditItems({
                auditId: id,
                ...body,
            });
            return reply.send(result);
        }
    );

    // Scan asset
    fastify.post(
        '/audits/:id/scan',
        {
            schema: {
                tags: ['Audit Items'],
                summary: 'Scan an asset by tag',
            },
        },
        async (request: FastifyRequest, reply: FastifyReply) => {
            const { id } = auditIdParamSchema.parse(request.params);
            const body = scanAssetSchema.omit({ auditId: true }).parse(request.body);
            const result = await auditService.scanAsset(id, body.assetTag, body.scannedBy);
            return reply.send(result);
        }
    );

    // ==================== Discrepancy Routes ====================

    // Get discrepancies
    fastify.get(
        '/audits/:id/discrepancies',
        {
            schema: {
                tags: ['Audit Discrepancies'],
                summary: 'List discrepancies in an audit',
            },
        },
        async (request: FastifyRequest, reply: FastifyReply) => {
            const { id } = auditIdParamSchema.parse(request.params);
            const query = discrepancyQuerySchema.parse(request.query);
            const result = await auditService.getDiscrepancies(id, query);
            return reply.send(result);
        }
    );

    // Resolve discrepancy
    fastify.post(
        '/audits/:id/discrepancies/:itemId/resolve',
        {
            schema: {
                tags: ['Audit Discrepancies'],
                summary: 'Resolve a discrepancy',
            },
        },
        async (request: FastifyRequest, reply: FastifyReply) => {
            const params = request.params as { id: string; itemId: string };
            const body = resolveDiscrepancySchema.omit({ itemId: true }).parse(request.body);
            const result = await auditService.resolveDiscrepancy({
                itemId: params.itemId,
                ...body,
            });
            if (!result.success) {
                return reply.status(400).send({ error: result.error });
            }
            return reply.send(result.item);
        }
    );

    // ==================== Unregistered Assets Routes ====================

    // Get unregistered assets
    fastify.get(
        '/audits/:id/unregistered',
        {
            schema: {
                tags: ['Audit Unregistered Assets'],
                summary: 'List unregistered assets found in audit',
            },
        },
        async (request: FastifyRequest, reply: FastifyReply) => {
            const { id } = auditIdParamSchema.parse(request.params);
            const query = unregisteredAssetQuerySchema.parse(request.query);
            const result = await auditService.getUnregisteredAssets(id, query);
            return reply.send(result);
        }
    );

    // Add unregistered asset
    fastify.post(
        '/audits/:id/unregistered',
        {
            schema: {
                tags: ['Audit Unregistered Assets'],
                summary: 'Add an unregistered asset found during audit',
            },
        },
        async (request: FastifyRequest, reply: FastifyReply) => {
            const { id } = auditIdParamSchema.parse(request.params);
            const body = createUnregisteredAssetSchema.omit({ auditId: true }).parse(request.body);
            try {
                const result = await auditService.addUnregisteredAsset({
                    auditId: id,
                    ...body,
                });
                return reply.status(201).send(result);
            } catch (error) {
                return reply.status(400).send({
                    error: error instanceof Error ? error.message : 'Failed to add unregistered asset',
                });
            }
        }
    );

    // Update unregistered asset
    fastify.patch(
        '/audits/:id/unregistered/:unregisteredId',
        {
            schema: {
                tags: ['Audit Unregistered Assets'],
                summary: 'Update an unregistered asset',
            },
        },
        async (request: FastifyRequest, reply: FastifyReply) => {
            const params = request.params as { id: string; unregisteredId: string };
            const body = updateUnregisteredAssetSchema.parse(request.body);
            const result = await auditService.updateUnregisteredAsset(
                params.unregisteredId,
                {
                    ...body,
                    serialNumber: body.serialNumber || undefined,
                    condition: body.condition || undefined,
                    actionNotes: body.actionNotes || undefined
                }
            );
            if (!result) {
                return reply.status(404).send({ error: 'Unregistered asset not found' });
            }
            return reply.send(result);
        }
    );

    // ==================== Auditor Routes ====================

    // Get auditors
    fastify.get(
        '/audits/:id/auditors',
        {
            schema: {
                tags: ['Audit Auditors'],
                summary: 'List auditors assigned to an audit',
            },
        },
        async (request: FastifyRequest, reply: FastifyReply) => {
            const { id } = auditIdParamSchema.parse(request.params);
            const result = await auditService.getAuditors(id);
            return reply.send({ data: result });
        }
    );

    // Assign auditor
    fastify.post(
        '/audits/:id/auditors',
        {
            schema: {
                tags: ['Audit Auditors'],
                summary: 'Assign an auditor to an audit',
            },
        },
        async (request: FastifyRequest, reply: FastifyReply) => {
            const { id } = auditIdParamSchema.parse(request.params);
            const body = assignAuditorSchema.omit({ auditId: true }).parse(request.body);
            const result = await auditService.assignAuditor({
                auditId: id,
                ...body,
            });
            if (!result.success) {
                return reply.status(400).send({ error: result.error });
            }
            return reply.status(201).send({ success: true });
        }
    );

    // Remove auditor
    fastify.delete(
        '/audits/:id/auditors/:userId',
        {
            schema: {
                tags: ['Audit Auditors'],
                summary: 'Remove an auditor from an audit',
            },
        },
        async (request: FastifyRequest, reply: FastifyReply) => {
            const params = request.params as { id: string; userId: string };
            const result = await auditService.removeAuditor(params.id, params.userId);
            if (!result.success) {
                return reply.status(400).send({ error: result.error });
            }
            return reply.status(204).send();
        }
    );
}
