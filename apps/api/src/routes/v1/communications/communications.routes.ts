import type { FastifyInstance } from 'fastify'
import type { PgClient } from '@qltb/infra-postgres'
import { z } from 'zod'

import { getUserContext } from '../assets/assets.helpers.js'
import { createApiError, createErrorResponse, createSuccessResponse } from '../../../shared/utils/response.utils.js'

interface CommunicationRoutesOptions {
    pgClient: PgClient
}

type InboxThread = {
    id: string
    title: string
    status: string
    ownerId: string
    messageCount: number
    updatedAt: string
    lastMessageAt: string | null
    lastMessage: string | null
}

const listQuerySchema = z.object({
    limit: z.coerce.number().int().min(1).max(100).default(20),
    offset: z.coerce.number().int().min(0).default(0)
})

const notificationParamsSchema = z.object({
    id: z.string().min(1).max(120)
})

const inboxParamsSchema = z.object({
    id: z.string().uuid()
})

const replyBodySchema = z.object({
    content: z.string().trim().min(1).max(4000)
})

const notificationReads = new Map<string, Set<string>>()

function requestIdOf(request: { id: string | number }): string {
    return typeof request.id === 'string' ? request.id : String(request.id)
}

function rememberReadNotification(userId: string, notificationId: string): void {
    const existing = notificationReads.get(userId)
    if (existing) {
        existing.add(notificationId)
        return
    }
    notificationReads.set(userId, new Set([notificationId]))
}

function isReadNotification(userId: string, notificationId: string): boolean {
    return notificationReads.get(userId)?.has(notificationId) ?? false
}

export async function communicationRoutes(
    fastify: FastifyInstance,
    opts: CommunicationRoutesOptions
): Promise<void> {
    const { pgClient } = opts

    fastify.get('/notifications', async (request, reply) => {
        const requestId = requestIdOf(request)
        const ctx = getUserContext(request)
        const parsedQuery = listQuerySchema.safeParse(request.query ?? {})
        if (!parsedQuery.success) {
            reply
                .status(400)
                .send(createErrorResponse(createApiError.validation('Invalid query parameters'), requestId))
            return
        }

        const { limit, offset } = parsedQuery.data
        const rows = await pgClient.query<{
            id: string
            type: string
            title: string
            body: string
            status: string
            created_at: string
            due_at: string | null
        }>(
            `
            WITH reminder_rows AS (
                SELECT
                    r.id::text AS id,
                    'reminder'::text AS type,
                    r.reminder_type AS title,
                    COALESCE(r.channel, 'ui') AS body,
                    r.status AS status,
                    r.created_at,
                    r.due_at
                FROM public.reminders r
            ),
            workflow_rows AS (
                SELECT
                    w.id::text AS id,
                    'workflow'::text AS type,
                    w.request_type AS title,
                    w.title AS body,
                    w.status AS status,
                    w.created_at,
                    w.due_at
                FROM public.wf_requests w
                WHERE w.requester_id = $1 OR lower(COALESCE($2, '')) IN ('admin', 'super_admin', 'it_asset_manager', 'manager')
            )
            SELECT *
            FROM (
                SELECT * FROM reminder_rows
                UNION ALL
                SELECT * FROM workflow_rows
            ) data
            ORDER BY COALESCE(due_at, created_at) DESC
            LIMIT $3
            OFFSET $4
            `,
            [ctx.userId, ctx.role, limit, offset]
        )

        const notifications = rows.rows.map((row) => {
            const read =
                isReadNotification(ctx.userId, row.id) ||
                row.status === 'done' ||
                row.status === 'sent' ||
                row.status === 'canceled'

            return {
                id: row.id,
                type: row.type,
                title: row.title,
                body: row.body,
                status: row.status,
                createdAt: row.created_at,
                dueAt: row.due_at,
                read
            }
        })

        reply.send(
            createSuccessResponse(
                {
                    items: notifications,
                    total: notifications.length,
                    limit,
                    offset
                },
                requestId
            )
        )
    })

    fastify.post('/notifications/:id/read', async (request, reply) => {
        const requestId = requestIdOf(request)
        const ctx = getUserContext(request)
        const parsedParams = notificationParamsSchema.safeParse(request.params)
        if (!parsedParams.success) {
            reply
                .status(400)
                .send(createErrorResponse(createApiError.validation('Invalid notification id'), requestId))
            return
        }

        rememberReadNotification(ctx.userId, parsedParams.data.id)
        reply.send(
            createSuccessResponse(
                {
                    id: parsedParams.data.id,
                    read: true,
                    readAt: new Date().toISOString()
                },
                requestId
            )
        )
    })

    fastify.get('/inbox', async (request, reply) => {
        const requestId = requestIdOf(request)
        const ctx = getUserContext(request)
        const parsedQuery = listQuerySchema.safeParse(request.query ?? {})
        if (!parsedQuery.success) {
            reply
                .status(400)
                .send(createErrorResponse(createApiError.validation('Invalid query parameters'), requestId))
            return
        }

        const { limit, offset } = parsedQuery.data
        const canViewAll = ['admin', 'super_admin', 'it_asset_manager', 'manager'].includes(ctx.role)
        const rows = await pgClient.query<{
            id: string
            title: string
            status: string
            user_id: string
            message_count: number
            updated_at: string
            last_message_at: string | null
            last_message: string | null
        }>(
            `
            SELECT
                c.id::text AS id,
                c.title,
                c.status,
                c.user_id,
                COALESCE(c.message_count, 0) AS message_count,
                c.updated_at,
                latest.created_at AS last_message_at,
                latest.content AS last_message
            FROM public.conversations c
            LEFT JOIN LATERAL (
                SELECT m.created_at, m.content
                FROM public.messages m
                WHERE m.conversation_id = c.id
                ORDER BY m.created_at DESC
                LIMIT 1
            ) latest ON TRUE
            WHERE ($1::boolean = true OR c.user_id = $2)
            ORDER BY COALESCE(latest.created_at, c.updated_at, c.created_at) DESC
            LIMIT $3
            OFFSET $4
            `,
            [canViewAll, ctx.userId, limit, offset]
        )

        const items: InboxThread[] = rows.rows.map((row) => ({
            id: row.id,
            title: row.title,
            status: row.status,
            ownerId: row.user_id,
            messageCount: row.message_count,
            updatedAt: row.updated_at,
            lastMessageAt: row.last_message_at,
            lastMessage: row.last_message
        }))

        reply.send(
            createSuccessResponse(
                {
                    items,
                    total: items.length,
                    limit,
                    offset
                },
                requestId
            )
        )
    })

    fastify.get('/inbox/:id', async (request, reply) => {
        const requestId = requestIdOf(request)
        const ctx = getUserContext(request)
        const parsedParams = inboxParamsSchema.safeParse(request.params)
        if (!parsedParams.success) {
            reply
                .status(400)
                .send(createErrorResponse(createApiError.validation('Invalid inbox id'), requestId))
            return
        }

        const id = parsedParams.data.id
        const canViewAll = ['admin', 'super_admin', 'it_asset_manager', 'manager'].includes(ctx.role)
        const threadResult = await pgClient.query<{
            id: string
            title: string
            status: string
            user_id: string
            message_count: number
            created_at: string
            updated_at: string
        }>(
            `
            SELECT
                c.id::text AS id,
                c.title,
                c.status,
                c.user_id,
                COALESCE(c.message_count, 0) AS message_count,
                c.created_at,
                c.updated_at
            FROM public.conversations c
            WHERE c.id = $1
              AND ($2::boolean = true OR c.user_id = $3)
            LIMIT 1
            `,
            [id, canViewAll, ctx.userId]
        )

        const thread = threadResult.rows[0]
        if (!thread) {
            reply
                .status(404)
                .send(createErrorResponse(createApiError.notFound('Inbox thread', id), requestId))
            return
        }

        const messagesResult = await pgClient.query<{
            id: string
            role: string
            content: string
            model: string | null
            provider: string | null
            created_at: string
        }>(
            `
            SELECT id::text, role, content, model, provider, created_at
            FROM public.messages
            WHERE conversation_id = $1
            ORDER BY created_at ASC
            `,
            [id]
        )

        reply.send(
            createSuccessResponse(
                {
                    thread: {
                        id: thread.id,
                        title: thread.title,
                        status: thread.status,
                        ownerId: thread.user_id,
                        messageCount: thread.message_count,
                        createdAt: thread.created_at,
                        updatedAt: thread.updated_at
                    },
                    messages: messagesResult.rows.map((row) => ({
                        id: row.id,
                        role: row.role,
                        content: row.content,
                        model: row.model,
                        provider: row.provider,
                        createdAt: row.created_at
                    }))
                },
                requestId
            )
        )
    })

    fastify.post('/inbox/:id/reply', async (request, reply) => {
        const requestId = requestIdOf(request)
        const ctx = getUserContext(request)
        const parsedParams = inboxParamsSchema.safeParse(request.params)
        if (!parsedParams.success) {
            reply
                .status(400)
                .send(createErrorResponse(createApiError.validation('Invalid inbox id'), requestId))
            return
        }

        const parsedBody = replyBodySchema.safeParse(request.body)
        if (!parsedBody.success) {
            reply
                .status(400)
                .send(createErrorResponse(createApiError.validation('Invalid reply payload'), requestId))
            return
        }

        const id = parsedParams.data.id
        const canViewAll = ['admin', 'super_admin', 'it_asset_manager', 'manager'].includes(ctx.role)
        const threadResult = await pgClient.query<{ id: string }>(
            `
            SELECT c.id::text AS id
            FROM public.conversations c
            WHERE c.id = $1
              AND ($2::boolean = true OR c.user_id = $3)
            LIMIT 1
            `,
            [id, canViewAll, ctx.userId]
        )

        if (threadResult.rows.length === 0) {
            reply
                .status(404)
                .send(createErrorResponse(createApiError.notFound('Inbox thread', id), requestId))
            return
        }

        const inserted = await pgClient.query<{
            id: string
            role: string
            content: string
            created_at: string
        }>(
            `
            INSERT INTO public.messages (
                conversation_id,
                role,
                content,
                model,
                provider,
                metadata,
                created_at
            )
            VALUES ($1, 'user', $2, NULL, NULL, '{}'::jsonb, NOW())
            RETURNING id::text, role, content, created_at
            `,
            [id, parsedBody.data.content]
        )

        await pgClient.query(
            `
            UPDATE public.conversations
            SET
                message_count = COALESCE(message_count, 0) + 1,
                updated_at = NOW()
            WHERE id = $1
            `,
            [id]
        )

        reply.status(201).send(
            createSuccessResponse(
                {
                    id: inserted.rows[0].id,
                    role: inserted.rows[0].role,
                    content: inserted.rows[0].content,
                    createdAt: inserted.rows[0].created_at
                },
                requestId
            )
        )
    })
}
