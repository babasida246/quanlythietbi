// =============================================
// Module: Reports & Alerts (10-REPORTS)
// Fastify Routes
// =============================================

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { ReportsService, ReportNotFoundError, AlertRuleNotFoundError, AlertHistoryNotFoundError, WidgetNotFoundError, BuiltinModificationError, ReportExportLimitError } from './reports.service.js';
import type { CreateAlertRuleDto } from './reports.types.js';

// Temporarily using mock schemas - TODO: import from @contracts/shared when available
const reportIdParamSchema = z.object({ id: z.string() });
const reportCodeParamSchema = z.object({ code: z.string() });
const alertRuleIdParamSchema = z.object({ id: z.string() });
const alertRuleCodeParamSchema = z.object({ code: z.string() });
const alertHistoryIdParamSchema = z.object({ id: z.string() });
const widgetIdParamSchema = z.object({ id: z.string() });
const userIdParamSchema = z.object({ userId: z.string() });

// Additional mock schemas for missing ones
const reportDefinitionQuerySchema = z.object({});
const reportExecutionQuerySchema = z.object({});
const alertRuleQuerySchema = z.object({});
const alertHistoryQuerySchema = z.object({});
const acknowledgeAlertSchema = z.object({
    acknowledgedBy: z.string()
});
const updateUserAlertPreferencesSchema = z.object({});
const dashboardWidgetQuerySchema = z.object({});
const saveDashboardLayoutSchema = z.object({
    userId: z.string(),
    layout: z.any()
});
const triggerAlertCheckSchema = z.object({});

// Missing body schemas with proper required fields
const createReportDefinitionSchema = z.object({
    name: z.string(),
    reportType: z.enum(['dashboard', 'tabular', 'chart', 'scheduled']),
    dataSource: z.string(),
    fields: z.array(z.any())
});
const updateReportDefinitionSchema = z.object({});
const executeReportSchema = z.object({});
const createAlertRuleSchema = z.object({
    ruleCode: z.string().optional(),
    name: z.string(),
    description: z.string().optional(),
    ruleType: z.enum(['license', 'warranty', 'stock', 'checkout', 'depreciation', 'custom']),
    conditionField: z.string(),
    conditionOperator: z.enum(['eq', 'ne', 'gt', 'lt', 'gte', 'lte', 'in', 'contains']),
    conditionValue: z.any(),
    conditionQuery: z.string().optional(),
    severity: z.enum(['low', 'medium', 'high', 'critical']).optional(),
    channel: z.enum(['email', 'slack', 'webhook', 'sms']).optional(),
    frequency: z.enum(['once', 'daily', 'weekly', 'monthly']).optional(),
    cooldownHours: z.number().optional(),
    recipients: z.array(z.string()).optional(),
    recipientRoles: z.array(z.string()).optional(),
    organizationId: z.string().optional(),
    createdBy: z.string().optional()
});
const updateAlertRuleSchema = z.object({});
const createDashboardWidgetSchema = z.object({
    name: z.string(),
    widgetType: z.enum(['pie_chart', 'bar_chart', 'line_chart', 'stat_card', 'table', 'timeline', 'list', 'map']),
    dataSource: z.string()
});
const updateDashboardWidgetSchema = z.object({});

// Fix userIdParamSchema to use 'userId' instead of 'id'
const getAlertRuleSchema = z.object({ params: z.object({}) });
const getAlertHistorySchema = z.object({ querystring: z.object({}) });
const createWidgetSchema = z.object({ body: z.object({}) });
const updateWidgetSchema = { body: {} }
const deleteWidgetSchema = { params: {} }
const getWidgetsSchema = { querystring: {} }
const getWidgetSchema = { params: {} }
const executeWidgetSchema = { params: {} }

// ==================== ERROR HANDLER ====================

function handleError(error: unknown, reply: FastifyReply): FastifyReply {
    if (error instanceof ReportNotFoundError) {
        return reply.status(404).send({ error: (error as Error).message });
    }
    if (error instanceof AlertRuleNotFoundError) {
        return reply.status(404).send({ error: (error as Error).message });
    }
    if (error instanceof AlertHistoryNotFoundError) {
        return reply.status(404).send({ error: (error as Error).message });
    }
    if (error instanceof WidgetNotFoundError) {
        return reply.status(404).send({ error: (error as Error).message });
    }
    if (error instanceof BuiltinModificationError) {
        return reply.status(403).send({ error: (error as Error).message });
    }
    if (error instanceof ReportExportLimitError) {
        return reply.status(400).send({ error: (error as Error).message });
    }
    if (error instanceof Error) {
        return reply.status(400).send({ error: error.message });
    }
    return reply.status(500).send({ error: 'Internal server error' });
}

// ==================== ROUTES ====================

export async function reportsRoutes(fastify: FastifyInstance, options: { service: ReportsService }): Promise<void> {
    const { service } = options;

    // ==================== REPORT DEFINITIONS ====================

    // GET /reports - List all reports
    fastify.get('/reports', async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const query = reportDefinitionQuerySchema.parse(request.query);
            const result = await service.getAllReportDefinitions(query);
            return reply.send(result);
        } catch (error) {
            return handleError(error, reply);
        }
    });

    // GET /reports/:id - Get report by ID
    fastify.get('/reports/:id', async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const { id } = reportIdParamSchema.parse(request.params);
            const report = await service.getReportDefinitionById(id);
            return reply.send(report);
        } catch (error) {
            return handleError(error, reply);
        }
    });

    // GET /reports/code/:code - Get report by code
    fastify.get('/reports/code/:code', async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const { code } = reportCodeParamSchema.parse(request.params);
            const report = await service.getReportDefinitionByCode(code);
            return reply.send(report);
        } catch (error) {
            return handleError(error, reply);
        }
    });

    // POST /reports - Create report
    fastify.post('/reports', async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const dto = createReportDefinitionSchema.parse(request.body);
            const report = await service.createReportDefinition(dto);
            return reply.status(201).send(report);
        } catch (error) {
            return handleError(error, reply);
        }
    });

    // PUT /reports/:id - Update report
    fastify.put('/reports/:id', async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const { id } = reportIdParamSchema.parse(request.params);
            const dto = updateReportDefinitionSchema.parse(request.body);
            const report = await service.updateReportDefinition(id, dto);
            return reply.send(report);
        } catch (error) {
            return handleError(error, reply);
        }
    });

    // DELETE /reports/:id - Delete report
    fastify.delete('/reports/:id', async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const { id } = reportIdParamSchema.parse(request.params);
            await service.deleteReportDefinition(id);
            return reply.status(204).send();
        } catch (error) {
            return handleError(error, reply);
        }
    });

    // POST /reports/:id/favorite - Toggle favorite
    fastify.post('/reports/:id/favorite', async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const { id } = reportIdParamSchema.parse(request.params);
            // In real implementation, get userId from auth context
            const userId = (request.body as { userId?: string })?.userId || 'system';
            const report = await service.toggleReportFavorite(id, userId);
            return reply.send(report);
        } catch (error) {
            return handleError(error, reply);
        }
    });

    // ==================== REPORT EXECUTIONS ====================

    // GET /reports/executions - List executions
    fastify.get('/reports/executions', async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const query = reportExecutionQuerySchema.parse(request.query);
            const result = await service.getAllReportExecutions(query);
            return reply.send(result);
        } catch (error) {
            return handleError(error, reply);
        }
    });

    // POST /reports/:id/execute - Execute report
    fastify.post('/reports/:id/execute', async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const { id } = reportIdParamSchema.parse(request.params);
            const options = executeReportSchema.parse(request.body || {});
            const result = await service.executeReport(id, options);
            return reply.send(result);
        } catch (error) {
            return handleError(error, reply);
        }
    });

    // POST /reports/scheduled/run - Run scheduled reports
    fastify.post('/reports/scheduled/run', async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const result = await service.runScheduledReports();
            return reply.send(result);
        } catch (error) {
            return handleError(error, reply);
        }
    });

    // ==================== ALERT RULES ====================

    // GET /alerts/rules - List alert rules
    fastify.get('/alerts/rules', async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const query = alertRuleQuerySchema.parse(request.query);
            const result = await service.getAllAlertRules(query);
            return reply.send(result);
        } catch (error) {
            return handleError(error, reply);
        }
    });

    // GET /alerts/rules/active - Get active rules
    fastify.get('/alerts/rules/active', async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const rules = await service.getActiveAlertRules();
            return reply.send(rules);
        } catch (error) {
            return handleError(error, reply);
        }
    });

    // GET /alerts/rules/:id - Get rule by ID
    fastify.get('/alerts/rules/:id', async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const { id } = alertRuleIdParamSchema.parse(request.params);
            const rule = await service.getAlertRuleById(id);
            return reply.send(rule);
        } catch (error) {
            return handleError(error, reply);
        }
    });

    // GET /alerts/rules/code/:code - Get rule by code
    fastify.get('/alerts/rules/code/:code', async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const { code } = alertRuleCodeParamSchema.parse(request.params);
            const rule = await service.getAlertRuleByCode(code);
            return reply.send(rule);
        } catch (error) {
            return handleError(error, reply);
        }
    });

    // POST /alerts/rules - Create rule
    fastify.post('/alerts/rules', async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const dto = createAlertRuleSchema.parse(request.body) as CreateAlertRuleDto;
            const rule = await service.createAlertRule(dto);
            return reply.status(201).send(rule);
        } catch (error) {
            return handleError(error, reply);
        }
    });

    // PUT /alerts/rules/:id - Update rule
    fastify.put('/alerts/rules/:id', async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const { id } = alertRuleIdParamSchema.parse(request.params);
            const dto = updateAlertRuleSchema.parse(request.body);
            const rule = await service.updateAlertRule(id, dto);
            return reply.send(rule);
        } catch (error) {
            return handleError(error, reply);
        }
    });

    // DELETE /alerts/rules/:id - Delete rule
    fastify.delete('/alerts/rules/:id', async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const { id } = alertRuleIdParamSchema.parse(request.params);
            await service.deleteAlertRule(id);
            return reply.status(204).send();
        } catch (error) {
            return handleError(error, reply);
        }
    });

    // POST /alerts/rules/:id/toggle - Toggle rule active status
    fastify.post('/alerts/rules/:id/toggle', async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const { id } = alertRuleIdParamSchema.parse(request.params);
            const userId = (request.body as { userId?: string })?.userId || 'system';
            const rule = await service.toggleAlertRule(id, userId);
            return reply.send(rule);
        } catch (error) {
            return handleError(error, reply);
        }
    });

    // POST /alerts/check - Check and trigger alerts
    fastify.post('/alerts/check', async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const options = triggerAlertCheckSchema.parse(request.body || {});
            const results = await service.checkAndTriggerAlerts(options);
            return reply.send(results);
        } catch (error) {
            return handleError(error, reply);
        }
    });

    // ==================== ALERT HISTORY ====================

    // GET /alerts/history - List alert history
    fastify.get('/alerts/history', async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const query = alertHistoryQuerySchema.parse(request.query);
            const result = await service.getAllAlertHistory(query);
            return reply.send(result);
        } catch (error) {
            return handleError(error, reply);
        }
    });

    // GET /alerts/history/unacknowledged - Get unacknowledged alerts
    fastify.get('/alerts/history/unacknowledged', async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const organizationId = (request.query as { organizationId?: string })?.organizationId;
            const alerts = await service.getUnacknowledgedAlerts(organizationId);
            return reply.send(alerts);
        } catch (error) {
            return handleError(error, reply);
        }
    });

    // GET /alerts/history/:id - Get alert by ID
    fastify.get('/alerts/history/:id', async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const { id } = alertHistoryIdParamSchema.parse(request.params);
            const alert = await service.getAlertHistoryById(id);
            return reply.send(alert);
        } catch (error) {
            return handleError(error, reply);
        }
    });

    // POST /alerts/history/:id/acknowledge - Acknowledge alert
    fastify.post('/alerts/history/:id/acknowledge', async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const { id } = alertHistoryIdParamSchema.parse(request.params);
            const dto = acknowledgeAlertSchema.parse(request.body);
            const alert = await service.acknowledgeAlert(id, dto);
            return reply.send(alert);
        } catch (error) {
            return handleError(error, reply);
        }
    });

    // POST /alerts/history/acknowledge-bulk - Bulk acknowledge
    fastify.post('/alerts/history/acknowledge-bulk', async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const body = request.body as { ids: string[]; acknowledgedBy: string; acknowledgmentNote?: string };
            const dto = acknowledgeAlertSchema.parse({
                acknowledgedBy: body.acknowledgedBy,
                acknowledgmentNote: body.acknowledgmentNote,
            });
            const result = await service.bulkAcknowledgeAlerts(body.ids, dto);
            return reply.send(result);
        } catch (error) {
            return handleError(error, reply);
        }
    });

    // ==================== USER ALERT PREFERENCES ====================

    // GET /alerts/preferences/:userId - Get user preferences
    fastify.get('/alerts/preferences/:userId', async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const { userId } = userIdParamSchema.parse(request.params);
            const prefs = await service.getUserAlertPreferences(userId);
            return reply.send(prefs || { message: 'No preferences set, using defaults' });
        } catch (error) {
            return handleError(error, reply);
        }
    });

    // PUT /alerts/preferences/:userId - Update user preferences
    fastify.put('/alerts/preferences/:userId', async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const { userId } = userIdParamSchema.parse(request.params);
            const dto = updateUserAlertPreferencesSchema.parse(request.body);
            const prefs = await service.updateUserAlertPreferences(userId, dto);
            return reply.send(prefs);
        } catch (error) {
            return handleError(error, reply);
        }
    });

    // POST /alerts/preferences/:userId/mute/:ruleId - Mute rule for user
    fastify.post('/alerts/preferences/:userId/mute/:ruleId', async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const params = request.params as { userId: string; ruleId: string };
            const prefs = await service.muteAlertRule(params.userId, params.ruleId);
            return reply.send(prefs);
        } catch (error) {
            return handleError(error, reply);
        }
    });

    // POST /alerts/preferences/:userId/unmute/:ruleId - Unmute rule for user
    fastify.post('/alerts/preferences/:userId/unmute/:ruleId', async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const params = request.params as { userId: string; ruleId: string };
            const prefs = await service.unmuteAlertRule(params.userId, params.ruleId);
            return reply.send(prefs);
        } catch (error) {
            return handleError(error, reply);
        }
    });

    // ==================== DASHBOARD WIDGETS ====================

    // GET /dashboard/widgets - List widgets
    fastify.get('/dashboard/widgets', async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const query = dashboardWidgetQuerySchema.parse(request.query);
            const result = await service.getAllDashboardWidgets(query);
            return reply.send(result);
        } catch (error) {
            return handleError(error, reply);
        }
    });

    // GET /dashboard/widgets/:id - Get widget by ID
    fastify.get('/dashboard/widgets/:id', async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const { id } = widgetIdParamSchema.parse(request.params);
            const widget = await service.getDashboardWidgetById(id);
            return reply.send(widget);
        } catch (error) {
            return handleError(error, reply);
        }
    });

    // POST /dashboard/widgets - Create widget
    fastify.post('/dashboard/widgets', async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const dto = createDashboardWidgetSchema.parse(request.body);
            const widget = await service.createDashboardWidget(dto);
            return reply.status(201).send(widget);
        } catch (error) {
            return handleError(error, reply);
        }
    });

    // PUT /dashboard/widgets/:id - Update widget
    fastify.put('/dashboard/widgets/:id', async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const { id } = widgetIdParamSchema.parse(request.params);
            const dto = updateDashboardWidgetSchema.parse(request.body);
            const widget = await service.updateDashboardWidget(id, dto);
            return reply.send(widget);
        } catch (error) {
            return handleError(error, reply);
        }
    });

    // DELETE /dashboard/widgets/:id - Delete widget
    fastify.delete('/dashboard/widgets/:id', async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const { id } = widgetIdParamSchema.parse(request.params);
            await service.deleteDashboardWidget(id);
            return reply.status(204).send();
        } catch (error) {
            return handleError(error, reply);
        }
    });

    // ==================== USER DASHBOARD LAYOUTS ====================

    // GET /dashboard/layouts/:userId - Get user layout
    fastify.get('/dashboard/layouts/:userId', async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const { userId } = userIdParamSchema.parse(request.params);
            const dashboardType = (request.query as { dashboardType?: string })?.dashboardType;
            const layout = await service.getUserDashboardLayout(userId, dashboardType);
            return reply.send(layout || { message: 'No custom layout, using default' });
        } catch (error) {
            return handleError(error, reply);
        }
    });

    // PUT /dashboard/layouts - Save user layout
    fastify.put('/dashboard/layouts', async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const body = saveDashboardLayoutSchema.parse(request.body);
            const dto = {
                userId: body.userId || 'default-user', // This should come from auth context
                layout: body.layout
            };
            const layout = await service.saveUserDashboardLayout(dto);
            return reply.send(layout);
        } catch (error) {
            return handleError(error, reply);
        }
    });

    // ==================== STATISTICS ====================

    // GET /reports/stats - Get report statistics
    fastify.get('/reports/stats', async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const organizationId = (request.query as { organizationId?: string })?.organizationId;
            const stats = await service.getReportStats(organizationId);
            return reply.send(stats);
        } catch (error) {
            return handleError(error, reply);
        }
    });

    // GET /alerts/stats - Get alert statistics
    fastify.get('/alerts/stats', async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const organizationId = (request.query as { organizationId?: string })?.organizationId;
            const stats = await service.getAlertStats(organizationId);
            return reply.send(stats);
        } catch (error) {
            return handleError(error, reply);
        }
    });

    // GET /dashboard/stats - Get combined dashboard statistics
    fastify.get('/dashboard/stats', async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const organizationId = (request.query as { organizationId?: string })?.organizationId;
            const stats = await service.getDashboardStats(organizationId);
            return reply.send(stats);
        } catch (error) {
            return handleError(error, reply);
        }
    });
}

export default reportsRoutes;
