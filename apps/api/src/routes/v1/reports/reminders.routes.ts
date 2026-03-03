import type { FastifyInstance } from 'fastify'
import type { ReminderService } from '@qltb/application'
import { getUserContext, requirePermission } from '../assets/assets.helpers.js'
import { reminderListSchema, reminderRunSchema } from './reminders.schemas.js'

interface ReminderRoutesOptions {
    reminderService: ReminderService
}

export async function reminderRoutes(
    fastify: FastifyInstance,
    opts: ReminderRoutesOptions
): Promise<void> {
    const reminderService = opts.reminderService

    fastify.get('/assets/reminders', async (request, reply) => {
        getUserContext(request)
        const query = reminderListSchema.parse(request.query)
        const result = await reminderService.listReminders(query)
        return reply.send({
            data: result.items,
            meta: { total: result.total, page: result.page, limit: result.limit }
        })
    })

    fastify.post('/assets/reminders/run', async (request, reply) => {
        const ctx = requirePermission(request, 'admin:settings')
        const body = reminderRunSchema.parse(request.body)
        const days = body.days && body.days.length > 0 ? body.days : [30, 60, 90]
        const result = await reminderService.runWarrantyReminders(days, ctx)
        return reply.send({ data: result })
    })
}
