/**
 * Labels Module - Fastify Routes
 * Moved from apps/api/src/modules/labels/labels.routes.ts
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { LabelsService } from '@qltb/application';
import type { LabelsRepository } from '@qltb/infra-postgres';
import { z } from 'zod';
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
    createDocumentTemplateSchema,
    updateDocumentTemplateSchema,
    documentTemplateListQuerySchema,
    createDocumentTemplateVersionSchema,
    publishDocumentTemplateVersionSchema,
    rollbackDocumentTemplateVersionSchema,
} from './labels.schema.js';

export async function labelsRoute(
    fastify: FastifyInstance,
    opts: { labelsService: LabelsService; labelsRepo?: LabelsRepository }
) {
    const { labelsService, labelsRepo } = opts;

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

    // ==================== Shared Document Template Routes ====================

    fastify.get('/labels/document-templates', {
        schema: { tags: ['Document Templates'], summary: 'List shared document templates' },
        handler: async (request: FastifyRequest, reply: FastifyReply) => {
            const query = documentTemplateListQuerySchema.parse(request.query);
            const result = await labelsService.listDocumentTemplates(query);
            return reply.send({ success: true, data: result.items, meta: { total: result.total, limit: result.limit, offset: result.offset, hasMore: result.hasMore } });
        },
    });

    fastify.get('/labels/document-templates/:id', {
        schema: { tags: ['Document Templates'], summary: 'Get shared document template by ID' },
        handler: async (request: FastifyRequest, reply: FastifyReply) => {
            const { id } = idParamSchema.parse(request.params);
            const template = await labelsService.getDocumentTemplateById(id);
            if (!template) {
                return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Document template not found' } });
            }
            return reply.send({ success: true, data: template });
        },
    });

    fastify.get('/labels/document-templates/:id/versions', {
        schema: { tags: ['Document Templates'], summary: 'List versions of a shared document template' },
        handler: async (request: FastifyRequest, reply: FastifyReply) => {
            const { id } = idParamSchema.parse(request.params);
            try {
                const versions = await labelsService.listDocumentTemplateVersions(id);
                return reply.send({ success: true, data: versions });
            } catch (error) {
                return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: (error as Error).message } });
            }
        },
    });

    fastify.get('/labels/document-templates/:id/published', {
        schema: { tags: ['Document Templates'], summary: 'Get active published version for rendering/printing' },
        handler: async (request: FastifyRequest, reply: FastifyReply) => {
            const { id } = idParamSchema.parse(request.params);
            const version = await labelsService.getActiveDocumentTemplateVersion(id);
            if (!version) {
                return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'No published version found' } });
            }
            return reply.send({ success: true, data: version });
        },
    });

    fastify.post('/labels/document-templates', {
        schema: { tags: ['Document Templates'], summary: 'Create shared document template with initial draft version' },
        handler: async (request: FastifyRequest, reply: FastifyReply) => {
            const actorId = request.user?.id;
            if (!actorId) {
                return reply.status(401).send({ success: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
            }

            const dto = createDocumentTemplateSchema.parse(request.body);
            try {
                const created = await labelsService.createDocumentTemplate(dto, actorId);
                return reply.status(201).send({ success: true, data: created });
            } catch (error) {
                return reply.status(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: (error as Error).message } });
            }
        },
    });

    fastify.put('/labels/document-templates/:id', {
        schema: { tags: ['Document Templates'], summary: 'Update shared document template metadata' },
        handler: async (request: FastifyRequest, reply: FastifyReply) => {
            const actorId = request.user?.id;
            if (!actorId) {
                return reply.status(401).send({ success: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
            }

            const { id } = idParamSchema.parse(request.params);
            const dto = updateDocumentTemplateSchema.parse(request.body);
            try {
                const updated = await labelsService.updateDocumentTemplate(id, dto, actorId);
                return reply.send({ success: true, data: updated });
            } catch (error) {
                const message = (error as Error).message;
                const status = message.includes('not found') ? 404 : 400;
                return reply.status(status).send({ success: false, error: { code: status === 404 ? 'NOT_FOUND' : 'VALIDATION_ERROR', message } });
            }
        },
    });

    fastify.delete('/labels/document-templates/:id', {
        schema: { tags: ['Document Templates'], summary: 'Delete a document template and all its versions' },
        handler: async (request: FastifyRequest, reply: FastifyReply) => {
            const { id } = idParamSchema.parse(request.params);
            try {
                await labelsService.deleteDocumentTemplate(id);
                return reply.status(204).send();
            } catch (error) {
                const message = (error as Error).message;
                const status = message.includes('not found') ? 404 : 400;
                return reply.status(status).send({ success: false, error: { code: status === 404 ? 'NOT_FOUND' : 'DELETE_FAILED', message } });
            }
        },
    });

    fastify.post('/labels/document-templates/:id/versions', {
        schema: { tags: ['Document Templates'], summary: 'Create a new draft version' },
        handler: async (request: FastifyRequest, reply: FastifyReply) => {
            const actorId = request.user?.id;
            if (!actorId) {
                return reply.status(401).send({ success: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
            }

            const { id } = idParamSchema.parse(request.params);
            const dto = createDocumentTemplateVersionSchema.parse(request.body);
            try {
                const version = await labelsService.createDocumentTemplateVersion(id, dto, actorId);
                return reply.status(201).send({ success: true, data: version });
            } catch (error) {
                const message = (error as Error).message;
                const status = message.includes('not found') ? 404 : 400;
                return reply.status(status).send({ success: false, error: { code: status === 404 ? 'NOT_FOUND' : 'VALIDATION_ERROR', message } });
            }
        },
    });

    fastify.post('/labels/document-templates/:id/publish', {
        schema: { tags: ['Document Templates'], summary: 'Publish a version (mark as active)' },
        handler: async (request: FastifyRequest, reply: FastifyReply) => {
            const actorId = request.user?.id;
            if (!actorId) {
                return reply.status(401).send({ success: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
            }

            const { id } = idParamSchema.parse(request.params);
            const { versionId } = publishDocumentTemplateVersionSchema.parse(request.body);
            try {
                const published = await labelsService.publishDocumentTemplateVersion(id, versionId, actorId);
                return reply.send({ success: true, data: published });
            } catch (error) {
                const message = (error as Error).message;
                const status = message.includes('not found') ? 404 : 400;
                return reply.status(status).send({ success: false, error: { code: status === 404 ? 'NOT_FOUND' : 'VALIDATION_ERROR', message } });
            }
        },
    });

    fastify.post('/labels/document-templates/:id/rollback', {
        schema: { tags: ['Document Templates'], summary: 'Rollback by publishing a new version cloned from a previous version' },
        handler: async (request: FastifyRequest, reply: FastifyReply) => {
            const actorId = request.user?.id;
            if (!actorId) {
                return reply.status(401).send({ success: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
            }

            const { id } = idParamSchema.parse(request.params);
            const { versionId, changeNote } = rollbackDocumentTemplateVersionSchema.parse(request.body);
            try {
                const rolledBack = await labelsService.rollbackDocumentTemplateVersion(id, versionId, actorId, changeNote);
                return reply.send({ success: true, data: rolledBack });
            } catch (error) {
                const message = (error as Error).message;
                const status = message.includes('not found') ? 404 : 400;
                return reply.status(status).send({ success: false, error: { code: status === 404 ? 'NOT_FOUND' : 'VALIDATION_ERROR', message } });
            }
        },
    });

    /**
     * POST /api/v1/labels/document-templates/:id/versions/upload-docx
     *
     * Upload a .docx file as a new draft template version.
     * Content-Type: multipart/form-data
     * Fields:
     *   file        (required) — the .docx file
     *   title       (optional) — version title
     *   changeNote  (optional) — description of changes
     *
     * Template syntax to use in Microsoft Word:
     *   {fieldName}           simple substitution
     *   {#items}...{/items}   loop — repeat table row / paragraph per item
     *   {^items}...{/items}   empty-state block
     *   {#flag}...{/flag}     conditional block
     */
    fastify.post('/labels/document-templates/:id/versions/upload-docx', {
        schema: { tags: ['Document Templates'], summary: 'Upload a .docx binary template as a new draft version' },
        handler: async (request: FastifyRequest, reply: FastifyReply) => {
            if (!labelsRepo) {
                return reply.status(503).send({ success: false, error: { code: 'NOT_CONFIGURED', message: 'labelsRepo not available' } });
            }
            const actorId = request.user?.id;
            if (!actorId) {
                return reply.status(401).send({ success: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
            }

            const { id } = z.object({ id: z.string().uuid() }).parse(request.params);

            try {
                const data = await request.file();
                if (!data) {
                    return reply.status(400).send({ success: false, error: { code: 'NO_FILE', message: 'No file uploaded' } });
                }
                if (!data.filename.endsWith('.docx') && data.mimetype !== 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
                    return reply.status(400).send({ success: false, error: { code: 'INVALID_FORMAT', message: 'Only .docx files are accepted' } });
                }

                const binaryContent = await data.toBuffer();
                const title = (data.fields as Record<string, { value: string }>)?.title?.value?.trim() || undefined;
                const changeNote = (data.fields as Record<string, { value: string }>)?.changeNote?.value?.trim() || undefined;

                const version = await labelsRepo.createDocumentTemplateVersionDocx(id, {
                    title,
                    changeNote,
                    binaryContent,
                    createdBy: actorId,
                });

                return reply.send({ success: true, data: version });
            } catch (error) {
                const message = (error as Error).message;
                const status = message.includes('not found') ? 404 : 400;
                return reply.status(status).send({ success: false, error: { code: 'UPLOAD_FAILED', message } });
            }
        },
    });

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
