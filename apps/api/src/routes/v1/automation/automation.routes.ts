/**
 * Automation Routes
 * API endpoints for workflow automation rules, notifications, scheduled tasks
 */
import type { FastifyInstance } from 'fastify'
import type { AutomationService } from '@qltb/application'
import { z } from 'zod'
import { getUserContext, requirePermission } from '../assets/assets.helpers.js'

interface AutomationRoutesOptions {
    automationService: AutomationService
}

const automationRuleSchema = z.object({
    name: z.string().min(1).max(200),
    description: z.string().optional(),
    triggerType: z.enum(['warranty_expiring', 'maintenance_due', 'status_change', 'assignment_change', 'schedule', 'threshold', 'custom']),
    triggerConfig: z.record(z.unknown()).optional().default({}),
    conditions: z.array(z.object({
        field: z.string(),
        operator: z.enum(['equals', 'not_equals', 'contains', 'greater_than', 'less_than']),
        value: z.unknown()
    })).optional().default([]),
    actions: z.array(z.object({
        type: z.enum(['notify', 'webhook', 'email', 'status_change']),
        config: z.record(z.unknown())
    })).optional().default([]),
    isActive: z.boolean().optional().default(true),
    priority: z.number().int().optional().default(0)
})

const notificationCreateSchema = z.object({
    userId: z.string().optional(),
    title: z.string().min(1).max(300),
    body: z.string().optional(),
    channel: z.enum(['ui', 'email', 'slack', 'teams', 'webhook']).optional().default('ui'),
    metadata: z.record(z.unknown()).optional().default({})
})

const scheduledTaskSchema = z.object({
    name: z.string().min(1).max(200),
    taskType: z.enum(['warranty_check', 'maintenance_reminder', 'report_generation', 'data_cleanup', 'sync_external', 'custom']),
    cronExpression: z.string().min(1).default('0 8 * * *'),
    config: z.record(z.unknown()).optional().default({}),
    isActive: z.boolean().optional().default(true)
})

export async function automationRoutes(
    fastify: FastifyInstance,
    opts: AutomationRoutesOptions
): Promise<void> {
    const svc = opts.automationService

    // --- Automation Rules ---
    fastify.post('/automation/rules', async (request, reply) => {
        const ctx = requirePermission(request, 'automation:manage')
        const body = automationRuleSchema.parse(request.body)
        const rule = await svc.createRule(body as any, ctx)
        return reply.status(201).send({ data: rule })
    })

    fastify.get('/automation/rules', async (request, reply) => {
        requirePermission(request, 'automation:read')
        const query = request.query as Record<string, string>
        const result = await svc.listRules({
            triggerType: query.triggerType,
            isActive: query.isActive === 'true' ? true : query.isActive === 'false' ? false : undefined
        })
        return reply.send({ data: result, meta: { total: (result as any[]).length } })
    })

    fastify.get('/automation/rules/:id', async (request, reply) => {
        requirePermission(request, 'automation:read')
        const { id } = request.params as { id: string }
        const rule = await svc.getRule(id)
        if (!rule) return reply.status(404).send({ error: 'Rule not found' })
        return reply.send({ data: rule })
    })

    fastify.put('/automation/rules/:id', async (request, reply) => {
        requirePermission(request, 'automation:manage')
        const { id } = request.params as { id: string }
        const body = automationRuleSchema.partial().parse(request.body)
        const rule = await svc.updateRule(id, body)
        if (!rule) return reply.status(404).send({ error: 'Rule not found' })
        return reply.send({ data: rule })
    })

    fastify.delete('/automation/rules/:id', async (request, reply) => {
        requirePermission(request, 'automation:manage')
        const { id } = request.params as { id: string }
        await svc.deleteRule(id)
        return reply.status(204).send()
    })

    // --- Trigger evaluation (manual or webhook) ---
    fastify.post('/automation/trigger', async (request, reply) => {
        const ctx = requirePermission(request, 'automation:manage')
        const body = z.object({
            triggerType: z.string(),
            event: z.record(z.unknown())
        }).parse(request.body)
        const result = await svc.evaluateTrigger(body.triggerType, body.event, ctx)
        return reply.send({ data: result })
    })

    fastify.get('/automation/rules/:id/logs', async (request, reply) => {
        requirePermission(request, 'automation:read')
        const { id } = request.params as { id: string }
        const query = request.query as Record<string, string>
        const logs = await svc.getRuleLogs(id, query.limit ? parseInt(query.limit) : 20)
        return reply.send({ data: logs })
    })

    // --- Notifications ---
    fastify.get('/automation/notifications', async (request, reply) => {
        const ctx = getUserContext(request)
        const query = request.query as Record<string, string>
        const result = await svc.getUserNotifications(ctx.userId, {
            status: query.status,
            page: query.page ? parseInt(query.page) : undefined,
            limit: query.limit ? parseInt(query.limit) : undefined
        })
        const items = Array.isArray(result) ? result : (result as any).items ?? result
        return reply.send({ data: items, meta: { total: Array.isArray(result) ? result.length : (result as any).total, unread: (result as any).unread ?? 0 } })
    })

    fastify.post('/automation/notifications', async (request, reply) => {
        requirePermission(request, 'automation:manage')
        const body = notificationCreateSchema.parse(request.body)
        const notification = await svc.createNotification(body)
        return reply.status(201).send({ data: notification })
    })

    fastify.post('/automation/notifications/:id/read', async (request, reply) => {
        const { id } = request.params as { id: string }
        await svc.markNotificationRead(id)
        return reply.send({ data: { success: true } })
    })

    fastify.post('/automation/notifications/read-all', async (request, reply) => {
        const ctx = getUserContext(request)
        const count = await svc.markAllNotificationsRead(ctx.userId)
        return reply.send({ data: { markedRead: count } })
    })

    // --- Scheduled Tasks ---
    fastify.get('/automation/tasks', async (request, reply) => {
        requirePermission(request, 'automation:read')
        const query = request.query as Record<string, string>
        const tasks = await svc.listTasks({
            isActive: query.isActive === 'true' ? true : query.isActive === 'false' ? false : undefined
        })
        return reply.send({ data: tasks })
    })

    fastify.post('/automation/tasks', async (request, reply) => {
        const ctx = requirePermission(request, 'automation:manage')
        const body = scheduledTaskSchema.parse(request.body)
        const task = await svc.createTask(body)
        return reply.status(201).send({ data: task })
    })

    fastify.delete('/automation/tasks/:id', async (request, reply) => {
        requirePermission(request, 'automation:manage')
        const { id } = request.params as { id: string }
        await svc.deleteTask(id)
        return reply.status(204).send()
    })
}
