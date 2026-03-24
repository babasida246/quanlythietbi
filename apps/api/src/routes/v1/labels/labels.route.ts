/**
 * Labels Module - Fastify Routes
 * Moved from apps/api/src/modules/labels/labels.routes.ts
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { LabelsService } from '@qltb/application';
import {
    createTemplateSchema,
    updateTemplateSchema,
    createPrintJobSchema,
    templateListQuerySchema,
    printJobListQuerySchema,
    idParamSchema,
    cloneTemplateSchema,
    previewLabelsSchema,
    validateAssetsSchema,
    updateSettingSchema,
    settingKeyParamSchema,
} from './labels.schema.js';

export async function labelsRoute(
    fastify: FastifyInstance,
    opts: { labelsService: LabelsService }
) {
    const { labelsService } = opts;

    // ==================== Template Routes ====================

    fastify.get('/labels/templates', {
        schema: { tags: ['Label Templates'], summary: 'List all label templates' },
        handler: async (request: FastifyRequest, reply: FastifyReply) => {
            const query = templateListQuerySchema.parse(request.query);
            const result = await labelsService.getTemplates(query);
            return reply.send(result);
        },
    });

    fastify.get('/labels/templates/default', {
        schema: { tags: ['Label Templates'], summary: 'Get default label template' },
        handler: async (request: FastifyRequest, reply: FastifyReply) => {
            const template = await labelsService.getDefaultTemplate();
            if (!template) {
                return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'No default template configured' } });
            }
            return reply.send({ success: true, data: template });
        },
    });

    fastify.get('/labels/templates/:id', {
        schema: { tags: ['Label Templates'], summary: 'Get template by ID' },
        handler: async (request: FastifyRequest, reply: FastifyReply) => {
            const { id } = idParamSchema.parse(request.params);
            const template = await labelsService.getTemplateById(id);
            if (!template) {
                return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Template not found' } });
            }
            return reply.send({ success: true, data: template });
        },
    });

    fastify.post('/labels/templates', {
        schema: { tags: ['Label Templates'], summary: 'Create a new label template' },
        handler: async (request: FastifyRequest, reply: FastifyReply) => {
            const dto = createTemplateSchema.parse(request.body);
            const result = await labelsService.createTemplate(dto);
            if (!result.success) {
                return reply.status(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: result.error } });
            }
            return reply.status(201).send({ success: true, data: result.template });
        },
    });

    fastify.put('/labels/templates/:id', {
        schema: { tags: ['Label Templates'], summary: 'Update a label template' },
        handler: async (request: FastifyRequest, reply: FastifyReply) => {
            const { id } = idParamSchema.parse(request.params);
            const dto = updateTemplateSchema.parse(request.body);
            const result = await labelsService.updateTemplate(id, dto);
            if (!result.success) {
                return reply.status(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: result.error } });
            }
            return reply.send({ success: true, data: result.template });
        },
    });

    fastify.delete('/labels/templates/:id', {
        schema: { tags: ['Label Templates'], summary: 'Delete a label template' },
        handler: async (request: FastifyRequest, reply: FastifyReply) => {
            const { id } = idParamSchema.parse(request.params);
            const result = await labelsService.deleteTemplate(id);
            if (!result.success) {
                return reply.status(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: result.error } });
            }
            return reply.status(204).send();
        },
    });

    fastify.post('/labels/templates/:id/clone', {
        schema: { tags: ['Label Templates'], summary: 'Clone a label template' },
        handler: async (request: FastifyRequest, reply: FastifyReply) => {
            const { id } = idParamSchema.parse(request.params);
            const { name, createdBy } = cloneTemplateSchema.parse(request.body);
            const result = await labelsService.cloneTemplate(id, name, createdBy);
            if (!result.success) {
                return reply.status(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: result.error } });
            }
            return reply.status(201).send({ success: true, data: result.template });
        },
    });

    fastify.post('/labels/templates/:id/set-default', {
        schema: { tags: ['Label Templates'], summary: 'Set template as default' },
        handler: async (request: FastifyRequest, reply: FastifyReply) => {
            const { id } = idParamSchema.parse(request.params);
            const result = await labelsService.setDefaultTemplate(id);
            if (!result.success) {
                return reply.status(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: result.error } });
            }
            return reply.send({ success: true, data: { message: 'Template set as default' } });
        },
    });

    fastify.post('/labels/templates/:id/activate', {
        schema: { tags: ['Label Templates'], summary: 'Activate a template' },
        handler: async (request: FastifyRequest, reply: FastifyReply) => {
            const { id } = idParamSchema.parse(request.params);
            const body = request.body as { updatedBy: string };
            const result = await labelsService.setTemplateActive(id, true, body.updatedBy);
            if (!result.success) {
                return reply.status(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: result.error } });
            }
            return reply.send({ success: true, data: result.template });
        },
    });

    fastify.post('/labels/templates/:id/deactivate', {
        schema: { tags: ['Label Templates'], summary: 'Deactivate a template' },
        handler: async (request: FastifyRequest, reply: FastifyReply) => {
            const { id } = idParamSchema.parse(request.params);
            const body = request.body as { updatedBy: string };
            const result = await labelsService.setTemplateActive(id, false, body.updatedBy);
            if (!result.success) {
                return reply.status(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: result.error } });
            }
            return reply.send({ success: true, data: result.template });
        },
    });

    // ==================== Print Job Routes ====================

    fastify.get('/labels/jobs', {
        schema: { tags: ['Print Jobs'], summary: 'List all print jobs' },
        handler: async (request: FastifyRequest, reply: FastifyReply) => {
            const query = printJobListQuerySchema.parse(request.query);
            const result = await labelsService.getPrintJobs(query);
            return reply.send({ success: true, data: result.items, meta: { total: result.total, limit: result.limit, offset: result.offset, hasMore: result.hasMore } });
        },
    });

    fastify.get('/labels/jobs/:id', {
        schema: { tags: ['Print Jobs'], summary: 'Get print job by ID' },
        handler: async (request: FastifyRequest, reply: FastifyReply) => {
            const { id } = idParamSchema.parse(request.params);
            const job = await labelsService.getPrintJobDetail(id);
            if (!job) {
                return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Print job not found' } });
            }
            return reply.send({ success: true, data: job });
        },
    });

    fastify.get('/labels/jobs/:id/items', {
        schema: { tags: ['Print Jobs'], summary: 'Get print job items' },
        handler: async (request: FastifyRequest, reply: FastifyReply) => {
            const { id } = idParamSchema.parse(request.params);
            const items = await labelsService.getPrintJobItems(id);
            return reply.send({ success: true, data: items });
        },
    });

    fastify.post('/labels/jobs', {
        schema: { tags: ['Print Jobs'], summary: 'Create a new print job' },
        handler: async (request: FastifyRequest, reply: FastifyReply) => {
            const dto = createPrintJobSchema.parse(request.body);
            const result = await labelsService.createPrintJob(dto);
            if (!result.success) {
                return reply.status(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: result.error } });
            }
            return reply.status(201).send({ success: true, data: result.job });
        },
    });

    fastify.post('/labels/jobs/:id/start', {
        schema: { tags: ['Print Jobs'], summary: 'Start processing a print job' },
        handler: async (request: FastifyRequest, reply: FastifyReply) => {
            const { id } = idParamSchema.parse(request.params);
            const result = await labelsService.startPrintJob(id);
            if (!result.success) {
                return reply.status(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: result.error } });
            }
            return reply.send({ success: true, data: result.job });
        },
    });

    fastify.post('/labels/jobs/:id/complete', {
        schema: { tags: ['Print Jobs'], summary: 'Complete a print job' },
        handler: async (request: FastifyRequest, reply: FastifyReply) => {
            const { id } = idParamSchema.parse(request.params);
            const body = request.body as { outputUrl?: string };
            const result = await labelsService.completePrintJob(id, body.outputUrl);
            if (!result.success) {
                return reply.status(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: result.error } });
            }
            return reply.send({ success: true, data: result.job });
        },
    });

    fastify.post('/labels/jobs/:id/cancel', {
        schema: { tags: ['Print Jobs'], summary: 'Cancel a print job' },
        handler: async (request: FastifyRequest, reply: FastifyReply) => {
            const { id } = idParamSchema.parse(request.params);
            const result = await labelsService.cancelPrintJob(id);
            if (!result.success) {
                return reply.status(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: result.error } });
            }
            return reply.send({ success: true, data: result.job });
        },
    });

    fastify.post('/labels/jobs/:id/reprint', {
        schema: { tags: ['Print Jobs'], summary: 'Reprint a completed job' },
        handler: async (request: FastifyRequest, reply: FastifyReply) => {
            const { id } = idParamSchema.parse(request.params);
            const body = request.body as { createdBy: string };
            const result = await labelsService.reprintJob(id, body.createdBy);
            if (!result.success) {
                return reply.status(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: result.error } });
            }
            return reply.status(201).send({ success: true, data: result.job });
        },
    });

    // ==================== Preview & Validation Routes ====================

    fastify.post('/labels/preview', {
        schema: { tags: ['Labels'], summary: 'Generate label preview data' },
        handler: async (request: FastifyRequest, reply: FastifyReply) => {
            const { templateId, assetIds } = previewLabelsSchema.parse(request.body);
            try {
                const previews = await labelsService.generatePreview(templateId, assetIds);
                return reply.send({ success: true, data: previews });
            } catch (error) {
                return reply.status(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: (error as Error).message } });
            }
        },
    });

    fastify.post('/labels/validate', {
        schema: { tags: ['Labels'], summary: 'Validate assets for label generation' },
        handler: async (request: FastifyRequest, reply: FastifyReply) => {
            const { templateId, assetIds } = validateAssetsSchema.parse(request.body);
            try {
                const result = await labelsService.validateAssets(templateId, assetIds);
                return reply.send({ success: true, data: result });
            } catch (error) {
                return reply.status(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: (error as Error).message } });
            }
        },
    });

    // ==================== Settings Routes ====================

    fastify.get('/labels/settings', {
        schema: { tags: ['Label Settings'], summary: 'Get all label settings' },
        handler: async (request: FastifyRequest, reply: FastifyReply) => {
            const settings = await labelsService.getSettings();
            return reply.send({ success: true, data: settings });
        },
    });

    fastify.get('/labels/settings/:key', {
        schema: { tags: ['Label Settings'], summary: 'Get setting by key' },
        handler: async (request: FastifyRequest, reply: FastifyReply) => {
            const { key } = settingKeyParamSchema.parse(request.params);
            const value = await labelsService.getSettingValue(key);
            if (value === undefined) {
                return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Setting not found' } });
            }
            return reply.send({ success: true, data: { key, value } });
        },
    });

    fastify.put('/labels/settings/:key', {
        schema: { tags: ['Label Settings'], summary: 'Update a setting' },
        handler: async (request: FastifyRequest, reply: FastifyReply) => {
            const { key } = settingKeyParamSchema.parse(request.params);
            const { settingValue, updatedBy } = updateSettingSchema.parse(request.body);
            const setting = await labelsService.updateSetting(key, settingValue, updatedBy);
            return reply.send({ success: true, data: setting });
        },
    });

    // ==================== Statistics Route ====================

    fastify.get('/labels/statistics', {
        schema: { tags: ['Labels'], summary: 'Get label statistics' },
        handler: async (request: FastifyRequest, reply: FastifyReply) => {
            const stats = await labelsService.getStatistics();
            return reply.send({ success: true, data: stats });
        },
    });
}
