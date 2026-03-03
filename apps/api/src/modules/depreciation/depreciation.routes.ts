/**
 * Depreciation Module - Fastify Routes
 * Module: 09-DEPRECIATION (Asset Depreciation Management)
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { DepreciationService } from './depreciation.service.js';
import {
    createScheduleSchema,
    updateScheduleSchema,
    stopScheduleSchema,
    runDepreciationSchema,
    postEntriesSchema,
    createAdjustmentSchema,
    previewScheduleSchema,
    scheduleListQuerySchema,
    entryListQuerySchema,
    runListQuerySchema,
    idParamSchema,
    scheduleIdParamSchema,
    entryIdParamSchema,
    runIdParamSchema,
    periodParamSchema,
    settingKeyParamSchema,
    updateSettingSchema,
} from './depreciation.schemas.js';

interface DepreciationRoutesOptions {
    depreciationService: DepreciationService;
}

export async function depreciationRoutes(
    fastify: FastifyInstance,
    options: DepreciationRoutesOptions
) {
    const { depreciationService } = options;

    // ==================== Schedule Routes ====================

    // List all schedules
    fastify.get(
        '/depreciation/schedules',
        {
            schema: {
                tags: ['Depreciation'],
                summary: 'List all depreciation schedules',
            },
        },
        async (request: FastifyRequest, reply: FastifyReply) => {
            const query = scheduleListQuerySchema.parse(request.query);
            const result = await depreciationService.listSchedules(query);
            return reply.send(result);
        }
    );

    // Preview schedule (calculate without saving)
    fastify.post(
        '/depreciation/schedules/preview',
        {
            schema: {
                tags: ['Depreciation'],
                summary: 'Preview depreciation schedule calculation',
            },
        },
        async (request: FastifyRequest, reply: FastifyReply) => {
            const params = previewScheduleSchema.parse(request.body);
            const result = await depreciationService.previewSchedule(params);
            return reply.send(result);
        }
    );

    // Create new schedule
    fastify.post(
        '/depreciation/schedules',
        {
            schema: {
                tags: ['Depreciation'],
                summary: 'Create a new depreciation schedule',
            },
        },
        async (request: FastifyRequest, reply: FastifyReply) => {
            const dto = createScheduleSchema.parse(request.body);
            const result = await depreciationService.createSchedule(dto);
            if (!result.success) {
                return reply.status(400).send({ error: result.error });
            }
            return reply.status(201).send(result.schedule);
        }
    );

    // Get schedule by ID
    fastify.get(
        '/depreciation/schedules/:id',
        {
            schema: {
                tags: ['Depreciation'],
                summary: 'Get depreciation schedule by ID',
            },
        },
        async (request: FastifyRequest, reply: FastifyReply) => {
            const { id } = idParamSchema.parse(request.params);
            const result = await depreciationService.getScheduleDetail(id);
            if (!result) {
                return reply.status(404).send({ error: 'Depreciation schedule not found' });
            }
            return reply.send(result);
        }
    );

    // Get schedule by asset ID
    fastify.get(
        '/depreciation/assets/:id/schedule',
        {
            schema: {
                tags: ['Depreciation'],
                summary: 'Get depreciation schedule for an asset',
            },
        },
        async (request: FastifyRequest, reply: FastifyReply) => {
            const { id } = idParamSchema.parse(request.params);
            const result = await depreciationService.getScheduleByAssetId(id);
            if (!result) {
                return reply.status(404).send({ error: 'No depreciation schedule found for this asset' });
            }
            return reply.send(result);
        }
    );

    // Update schedule
    fastify.patch(
        '/depreciation/schedules/:id',
        {
            schema: {
                tags: ['Depreciation'],
                summary: 'Update depreciation schedule',
            },
        },
        async (request: FastifyRequest, reply: FastifyReply) => {
            const { id } = idParamSchema.parse(request.params);
            const dto = updateScheduleSchema.parse(request.body);
            const result = await depreciationService.updateSchedule(id, dto);
            if (!result.success) {
                return reply.status(400).send({ error: result.error });
            }
            return reply.send(result.schedule);
        }
    );

    // Stop schedule
    fastify.post(
        '/depreciation/schedules/:id/stop',
        {
            schema: {
                tags: ['Depreciation'],
                summary: 'Stop depreciation schedule',
            },
        },
        async (request: FastifyRequest, reply: FastifyReply) => {
            const { id } = idParamSchema.parse(request.params);
            const body = stopScheduleSchema.parse(request.body);
            const result = await depreciationService.stopSchedule({
                scheduleId: id,
                stoppedAt: body.stoppedAt,
                stoppedReason: body.stoppedReason,
                updatedBy: body.updatedBy,
            });
            if (!result.success) {
                return reply.status(400).send({ error: result.error });
            }
            return reply.send(result.schedule);
        }
    );

    // Delete schedule
    fastify.delete(
        '/depreciation/schedules/:id',
        {
            schema: {
                tags: ['Depreciation'],
                summary: 'Delete depreciation schedule (no posted entries)',
            },
        },
        async (request: FastifyRequest, reply: FastifyReply) => {
            const { id } = idParamSchema.parse(request.params);
            const result = await depreciationService.deleteSchedule(id);
            if (!result.success) {
                return reply.status(400).send({ error: result.error });
            }
            return reply.status(204).send();
        }
    );

    // Get entries for a schedule
    fastify.get(
        '/depreciation/schedules/:scheduleId/entries',
        {
            schema: {
                tags: ['Depreciation'],
                summary: 'Get depreciation entries for a schedule',
            },
        },
        async (request: FastifyRequest, reply: FastifyReply) => {
            const { scheduleId } = scheduleIdParamSchema.parse(request.params);
            const result = await depreciationService.getEntriesByScheduleId(scheduleId);
            return reply.send({ data: result });
        }
    );

    // ==================== Entry Routes ====================

    // List all entries
    fastify.get(
        '/depreciation/entries',
        {
            schema: {
                tags: ['Depreciation'],
                summary: 'List all depreciation entries',
            },
        },
        async (request: FastifyRequest, reply: FastifyReply) => {
            const query = entryListQuerySchema.parse(request.query);
            const result = await depreciationService.listEntries(query);
            return reply.send(result);
        }
    );

    // Get pending entries
    fastify.get(
        '/depreciation/entries/pending',
        {
            schema: {
                tags: ['Depreciation'],
                summary: 'Get pending (unposted) depreciation entries',
            },
        },
        async (request: FastifyRequest, reply: FastifyReply) => {
            const { periodYear, periodMonth, organizationId } = request.query as {
                periodYear?: string;
                periodMonth?: string;
                organizationId?: string;
            };
            const result = await depreciationService.getPendingEntries(
                periodYear ? parseInt(periodYear, 10) : undefined,
                periodMonth ? parseInt(periodMonth, 10) : undefined,
                organizationId
            );
            return reply.send({ data: result });
        }
    );

    // Get entry by ID
    fastify.get(
        '/depreciation/entries/:id',
        {
            schema: {
                tags: ['Depreciation'],
                summary: 'Get depreciation entry by ID',
            },
        },
        async (request: FastifyRequest, reply: FastifyReply) => {
            const { id } = idParamSchema.parse(request.params);
            const result = await depreciationService.getEntryDetail(id);
            if (!result) {
                return reply.status(404).send({ error: 'Depreciation entry not found' });
            }
            return reply.send(result);
        }
    );

    // Post entries
    fastify.post(
        '/depreciation/entries/post',
        {
            schema: {
                tags: ['Depreciation'],
                summary: 'Post depreciation entries',
            },
        },
        async (request: FastifyRequest, reply: FastifyReply) => {
            const dto = postEntriesSchema.parse(request.body);
            const result = await depreciationService.postEntries(dto);
            if (!result.success) {
                return reply.status(400).send({ error: result.error });
            }
            return reply.send({ success: true, postedCount: result.postedCount });
        }
    );

    // Create adjustment entry
    fastify.post(
        '/depreciation/entries/adjustment',
        {
            schema: {
                tags: ['Depreciation'],
                summary: 'Create adjustment entry',
            },
        },
        async (request: FastifyRequest, reply: FastifyReply) => {
            const dto = createAdjustmentSchema.parse(request.body);
            const result = await depreciationService.createAdjustment(dto);
            if (!result.success) {
                return reply.status(400).send({ error: result.error });
            }
            return reply.status(201).send(result.entry);
        }
    );

    // Delete entry
    fastify.delete(
        '/depreciation/entries/:id',
        {
            schema: {
                tags: ['Depreciation'],
                summary: 'Delete depreciation entry (unposted only)',
            },
        },
        async (request: FastifyRequest, reply: FastifyReply) => {
            const { id } = idParamSchema.parse(request.params);
            const result = await depreciationService.deleteEntry(id);
            if (!result.success) {
                return reply.status(400).send({ error: result.error });
            }
            return reply.status(204).send();
        }
    );

    // ==================== Run Routes ====================

    // List all runs
    fastify.get(
        '/depreciation/runs',
        {
            schema: {
                tags: ['Depreciation'],
                summary: 'List all depreciation runs',
            },
        },
        async (request: FastifyRequest, reply: FastifyReply) => {
            const query = runListQuerySchema.parse(request.query);
            const result = await depreciationService.listRuns(query);
            return reply.send(result);
        }
    );

    // Run depreciation for a period
    fastify.post(
        '/depreciation/runs',
        {
            schema: {
                tags: ['Depreciation'],
                summary: 'Run depreciation calculation for a period',
            },
        },
        async (request: FastifyRequest, reply: FastifyReply) => {
            const dto = runDepreciationSchema.parse(request.body);
            const result = await depreciationService.runDepreciation(dto);
            if (!result.success) {
                return reply.status(400).send({ error: result.error });
            }
            return reply.status(201).send({
                run: result.run,
                entriesCreated: result.entriesCreated,
                totalAmount: result.totalAmount,
            });
        }
    );

    // Get run by ID
    fastify.get(
        '/depreciation/runs/:id',
        {
            schema: {
                tags: ['Depreciation'],
                summary: 'Get depreciation run by ID',
            },
        },
        async (request: FastifyRequest, reply: FastifyReply) => {
            const { id } = idParamSchema.parse(request.params);
            const result = await depreciationService.getRunById(id);
            if (!result) {
                return reply.status(404).send({ error: 'Depreciation run not found' });
            }
            return reply.send(result);
        }
    );

    // Get entries for a run
    fastify.get(
        '/depreciation/runs/:runId/entries',
        {
            schema: {
                tags: ['Depreciation'],
                summary: 'Get depreciation entries for a run',
            },
        },
        async (request: FastifyRequest, reply: FastifyReply) => {
            const { runId } = runIdParamSchema.parse(request.params);
            const result = await depreciationService.getEntriesByRunId(runId);
            return reply.send({ data: result });
        }
    );

    // ==================== Settings Routes ====================

    // Get all settings
    fastify.get(
        '/depreciation/settings',
        {
            schema: {
                tags: ['Depreciation'],
                summary: 'Get all depreciation settings',
            },
        },
        async (request: FastifyRequest, reply: FastifyReply) => {
            const result = await depreciationService.getSettings();
            return reply.send({ data: result });
        }
    );

    // Get setting by key
    fastify.get(
        '/depreciation/settings/:key',
        {
            schema: {
                tags: ['Depreciation'],
                summary: 'Get depreciation setting by key',
            },
        },
        async (request: FastifyRequest, reply: FastifyReply) => {
            const { key } = settingKeyParamSchema.parse(request.params);
            const result = await depreciationService.getSetting(key);
            if (!result) {
                return reply.status(404).send({ error: 'Setting not found' });
            }
            return reply.send(result);
        }
    );

    // Update setting
    fastify.patch(
        '/depreciation/settings/:key',
        {
            schema: {
                tags: ['Depreciation'],
                summary: 'Update depreciation setting',
            },
        },
        async (request: FastifyRequest, reply: FastifyReply) => {
            const { key } = settingKeyParamSchema.parse(request.params);
            const { settingValue, updatedBy } = updateSettingSchema.parse(request.body);
            const result = await depreciationService.updateSetting(key, settingValue, updatedBy);
            if (!result) {
                return reply.status(404).send({ error: 'Setting not found' });
            }
            return reply.send(result);
        }
    );

    // ==================== Dashboard / Statistics Routes ====================

    // Get dashboard
    fastify.get(
        '/depreciation/dashboard',
        {
            schema: {
                tags: ['Depreciation'],
                summary: 'Get depreciation dashboard statistics',
            },
        },
        async (request: FastifyRequest, reply: FastifyReply) => {
            const { organizationId } = request.query as { organizationId?: string };
            const result = await depreciationService.getDashboard(organizationId);
            return reply.send(result);
        }
    );

    // Get monthly summary
    fastify.get(
        '/depreciation/reports/monthly-summary/:year',
        {
            schema: {
                tags: ['Depreciation'],
                summary: 'Get monthly depreciation summary for a year',
            },
        },
        async (request: FastifyRequest, reply: FastifyReply) => {
            const { year } = request.params as { year: string };
            const { organizationId } = request.query as { organizationId?: string };
            const result = await depreciationService.getMonthlySummary(
                parseInt(year, 10),
                organizationId
            );
            return reply.send({ data: result });
        }
    );

    // Get depreciation by category
    fastify.get(
        '/depreciation/reports/by-category',
        {
            schema: {
                tags: ['Depreciation'],
                summary: 'Get depreciation grouped by category',
            },
        },
        async (request: FastifyRequest, reply: FastifyReply) => {
            const { organizationId } = request.query as { organizationId?: string };
            const result = await depreciationService.getDepreciationByCategory(organizationId);
            return reply.send({ data: result });
        }
    );
}
