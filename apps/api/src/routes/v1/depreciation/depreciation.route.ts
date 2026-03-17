/**
 * Depreciation Module - Fastify Routes (Clean Architecture)
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { DepreciationService } from '@qltb/application';
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
    runIdParamSchema,
    settingKeyParamSchema,
    updateSettingSchema,
} from './depreciation.schema.js';

export async function depreciationRoute(
    fastify: FastifyInstance,
    opts: { depreciationService: DepreciationService }
): Promise<void> {
    const { depreciationService } = opts;

    // ==================== Schedule Routes ====================

    fastify.get('/depreciation/schedules', async (request: FastifyRequest, reply: FastifyReply) => {
        const query = scheduleListQuerySchema.parse(request.query);
        const result = await depreciationService.listSchedules(query);
        return reply.send(result);
    });

    fastify.post('/depreciation/schedules/preview', async (request: FastifyRequest, reply: FastifyReply) => {
        const params = previewScheduleSchema.parse(request.body);
        const result = await depreciationService.previewSchedule(params);
        return reply.send(result);
    });

    fastify.post('/depreciation/schedules', async (request: FastifyRequest, reply: FastifyReply) => {
        const dto = createScheduleSchema.parse(request.body);
        const result = await depreciationService.createSchedule(dto);
        if (!result.success) {
            return reply.status(400).send({ error: result.error });
        }
        return reply.status(201).send(result.schedule);
    });

    fastify.get('/depreciation/schedules/:id', async (request: FastifyRequest, reply: FastifyReply) => {
        const { id } = idParamSchema.parse(request.params);
        const result = await depreciationService.getScheduleDetail(id);
        if (!result) {
            return reply.status(404).send({ error: 'Depreciation schedule not found' });
        }
        return reply.send(result);
    });

    fastify.get('/depreciation/assets/:id/schedule', async (request: FastifyRequest, reply: FastifyReply) => {
        const { id } = idParamSchema.parse(request.params);
        const result = await depreciationService.getScheduleByAssetId(id);
        if (!result) {
            return reply.status(404).send({ error: 'No depreciation schedule found for this asset' });
        }
        return reply.send(result);
    });

    fastify.patch('/depreciation/schedules/:id', async (request: FastifyRequest, reply: FastifyReply) => {
        const { id } = idParamSchema.parse(request.params);
        const dto = updateScheduleSchema.parse(request.body);
        const result = await depreciationService.updateSchedule(id, dto);
        if (!result.success) {
            return reply.status(400).send({ error: result.error });
        }
        return reply.send(result.schedule);
    });

    fastify.post('/depreciation/schedules/:id/stop', async (request: FastifyRequest, reply: FastifyReply) => {
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
    });

    fastify.delete('/depreciation/schedules/:id', async (request: FastifyRequest, reply: FastifyReply) => {
        const { id } = idParamSchema.parse(request.params);
        const result = await depreciationService.deleteSchedule(id);
        if (!result.success) {
            return reply.status(400).send({ error: result.error });
        }
        return reply.status(204).send();
    });

    fastify.get('/depreciation/schedules/:scheduleId/entries', async (request: FastifyRequest, reply: FastifyReply) => {
        const { scheduleId } = scheduleIdParamSchema.parse(request.params);
        const result = await depreciationService.getEntriesByScheduleId(scheduleId);
        return reply.send({ data: result });
    });

    // ==================== Entry Routes ====================

    fastify.get('/depreciation/entries', async (request: FastifyRequest, reply: FastifyReply) => {
        const query = entryListQuerySchema.parse(request.query);
        const result = await depreciationService.listEntries(query);
        return reply.send(result);
    });

    fastify.get('/depreciation/entries/pending', async (request: FastifyRequest, reply: FastifyReply) => {
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
    });

    fastify.get('/depreciation/entries/:id', async (request: FastifyRequest, reply: FastifyReply) => {
        const { id } = idParamSchema.parse(request.params);
        const result = await depreciationService.getEntryDetail(id);
        if (!result) {
            return reply.status(404).send({ error: 'Depreciation entry not found' });
        }
        return reply.send(result);
    });

    fastify.post('/depreciation/entries/post', async (request: FastifyRequest, reply: FastifyReply) => {
        const dto = postEntriesSchema.parse(request.body);
        const result = await depreciationService.postEntries(dto);
        if (!result.success) {
            return reply.status(400).send({ error: result.error });
        }
        return reply.send({ success: true, postedCount: result.postedCount });
    });

    fastify.post('/depreciation/entries/adjustment', async (request: FastifyRequest, reply: FastifyReply) => {
        const dto = createAdjustmentSchema.parse(request.body);
        const result = await depreciationService.createAdjustment(dto);
        if (!result.success) {
            return reply.status(400).send({ error: result.error });
        }
        return reply.status(201).send(result.entry);
    });

    fastify.delete('/depreciation/entries/:id', async (request: FastifyRequest, reply: FastifyReply) => {
        const { id } = idParamSchema.parse(request.params);
        const result = await depreciationService.deleteEntry(id);
        if (!result.success) {
            return reply.status(400).send({ error: result.error });
        }
        return reply.status(204).send();
    });

    // ==================== Run Routes ====================

    fastify.get('/depreciation/runs', async (request: FastifyRequest, reply: FastifyReply) => {
        const query = runListQuerySchema.parse(request.query);
        const result = await depreciationService.listRuns(query);
        return reply.send(result);
    });

    fastify.post('/depreciation/runs', async (request: FastifyRequest, reply: FastifyReply) => {
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
    });

    fastify.get('/depreciation/runs/:id', async (request: FastifyRequest, reply: FastifyReply) => {
        const { id } = idParamSchema.parse(request.params);
        const result = await depreciationService.getRunById(id);
        if (!result) {
            return reply.status(404).send({ error: 'Depreciation run not found' });
        }
        return reply.send(result);
    });

    fastify.get('/depreciation/runs/:runId/entries', async (request: FastifyRequest, reply: FastifyReply) => {
        const { runId } = runIdParamSchema.parse(request.params);
        const result = await depreciationService.getEntriesByRunId(runId);
        return reply.send({ data: result });
    });

    // ==================== Settings Routes ====================

    fastify.get('/depreciation/settings', async (request: FastifyRequest, reply: FastifyReply) => {
        const result = await depreciationService.getSettings();
        return reply.send({ data: result });
    });

    fastify.get('/depreciation/settings/:key', async (request: FastifyRequest, reply: FastifyReply) => {
        const { key } = settingKeyParamSchema.parse(request.params);
        const result = await depreciationService.getSetting(key);
        if (!result) {
            return reply.status(404).send({ error: 'Setting not found' });
        }
        return reply.send(result);
    });

    fastify.patch('/depreciation/settings/:key', async (request: FastifyRequest, reply: FastifyReply) => {
        const { key } = settingKeyParamSchema.parse(request.params);
        const { settingValue, updatedBy } = updateSettingSchema.parse(request.body);
        const result = await depreciationService.updateSetting(key, settingValue, updatedBy);
        if (!result) {
            return reply.status(404).send({ error: 'Setting not found' });
        }
        return reply.send(result);
    });

    // ==================== Dashboard / Statistics ====================

    fastify.get('/depreciation/dashboard', async (request: FastifyRequest, reply: FastifyReply) => {
        const { organizationId } = request.query as { organizationId?: string };
        const result = await depreciationService.getDashboard(organizationId);
        return reply.send(result);
    });

    fastify.get('/depreciation/reports/monthly-summary/:year', async (request: FastifyRequest, reply: FastifyReply) => {
        const { year } = request.params as { year: string };
        const { organizationId } = request.query as { organizationId?: string };
        const result = await depreciationService.getMonthlySummary(parseInt(year, 10), organizationId);
        return reply.send({ data: result });
    });

    fastify.get('/depreciation/reports/by-category', async (request: FastifyRequest, reply: FastifyReply) => {
        const { organizationId } = request.query as { organizationId?: string };
        const result = await depreciationService.getDepreciationByCategory(organizationId);
        return reply.send({ data: result });
    });
}
