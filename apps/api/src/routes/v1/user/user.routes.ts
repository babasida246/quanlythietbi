/**
 * User Settings Routes
 * GET  /api/v1/user/me/settings  — load current user's theme settings
 * PUT  /api/v1/user/me/settings  — save current user's theme settings
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import type { PgClient } from '@qltb/infra-postgres'
import { z } from 'zod'

const themeSettingsSchema = z.object({
    preset: z.string().optional(),
    customizer: z.record(z.unknown()).optional()
})

export async function userRoute(
    fastify: FastifyInstance,
    opts: { pgClient: PgClient }
): Promise<void> {
    const { pgClient } = opts

    // GET /user/me/settings
    fastify.get('/user/me/settings', async (request: FastifyRequest, reply: FastifyReply) => {
        const userId = request.user?.id
        if (!userId) {
            return reply.status(401).send({ success: false, error: 'Unauthorized' })
        }

        const result = await pgClient.query<{ theme_settings: unknown }>(
            'SELECT theme_settings FROM users WHERE id = $1',
            [userId]
        )

        return reply.send({
            success: true,
            data: result.rows[0]?.theme_settings ?? null
        })
    })

    // PUT /user/me/settings
    fastify.put('/user/me/settings', async (request: FastifyRequest, reply: FastifyReply) => {
        const userId = request.user?.id
        if (!userId) {
            return reply.status(401).send({ success: false, error: 'Unauthorized' })
        }

        const parse = themeSettingsSchema.safeParse(request.body)
        if (!parse.success) {
            return reply.status(400).send({ success: false, error: 'Validation failed', details: parse.error.errors })
        }

        await pgClient.query(
            'UPDATE users SET theme_settings = $1, updated_at = NOW() WHERE id = $2',
            [JSON.stringify(parse.data), userId]
        )

        return reply.send({ success: true, data: parse.data })
    })
}
