import pg from 'pg'

const { Client } = pg

export const E2E_PREFIX = 'e2e-my-assets'

type SeedAdminRow = {
    id: string
    email: string
    role: string
}

async function withClient<T>(handler: (client: pg.Client) => Promise<T>): Promise<T> {
    const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/qltb'
    const client = new Client({ connectionString })
    await client.connect()
    try {
        return await handler(client)
    } finally {
        await client.end()
    }
}

async function tableExists(client: pg.Client, tableName: string): Promise<boolean> {
    const result = await client.query<{ exists: boolean }>(
        `SELECT to_regclass($1) IS NOT NULL AS exists`,
        [tableName]
    )
    return result.rows[0]?.exists === true
}

export async function seedAll(): Promise<void> {
    await withClient(async (client) => {
        await client.query('BEGIN')
        try {
            const adminLookup = await client.query<SeedAdminRow>(
                `
                SELECT id::text, email, role
                FROM users
                WHERE COALESCE(is_active, true) = true
                  AND COALESCE(status, 'active') = 'active'
                ORDER BY CASE
                    WHEN lower(email) = 'admin@example.com' THEN 0
                    WHEN lower(email) = 'admin@netopsai.local' THEN 1
                    WHEN role IN ('super_admin', 'admin') THEN 2
                    WHEN role IN ('it_asset_manager', 'manager') THEN 3
                    ELSE 9
                END, created_at ASC
                LIMIT 1
                `
            )
            const seedActor = adminLookup.rows[0]?.id ?? adminLookup.rows[0]?.email ?? 'admin@example.com'

            const hasWorkflowRequests = await tableExists(client, 'public.workflow_requests')
            const hasConversations = await tableExists(client, 'public.conversations')
            const hasMessages = await tableExists(client, 'public.messages')

            if (hasWorkflowRequests) {
                const requestExists = await client.query<{ total: number }>(
                    `
                    SELECT COUNT(*)::int AS total
                    FROM public.workflow_requests
                    WHERE payload ->> 'e2ePrefix' = $1
                    `,
                    [E2E_PREFIX]
                )

                if ((requestExists.rows[0]?.total ?? 0) === 0) {
                    await client.query(
                        `
                        INSERT INTO public.workflow_requests (
                            request_type,
                            asset_id,
                            from_dept,
                            to_dept,
                            requested_by,
                            status,
                            payload,
                            created_at,
                            updated_at
                        )
                        VALUES ('move', NULL, 'E2E', 'E2E', $1, 'submitted', $2::jsonb, NOW(), NOW())
                        `,
                        [seedActor, JSON.stringify({ e2ePrefix: E2E_PREFIX, source: 'playwright' })]
                    )
                }
            }

            if (hasConversations) {
                const inboxExists = await client.query<{ total: number }>(
                    `
                    SELECT COUNT(*)::int AS total
                    FROM public.conversations
                    WHERE title = $1
                    `,
                    [`${E2E_PREFIX}-inbox-thread`]
                )

                if ((inboxExists.rows[0]?.total ?? 0) === 0) {
                    const inserted = await client.query<{ id: string }>(
                        `
                        INSERT INTO public.conversations (
                            user_id,
                            title,
                            model,
                            status,
                            message_count,
                            metadata,
                            created_at,
                            updated_at
                        )
                        VALUES ($1, $2, 'seed/model', 'active', 1, $3::jsonb, NOW(), NOW())
                        RETURNING id::text
                        `,
                        [seedActor, `${E2E_PREFIX}-inbox-thread`, JSON.stringify({ e2ePrefix: E2E_PREFIX })]
                    )

                    if (hasMessages) {
                        await client.query(
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
                            VALUES ($1::uuid, 'assistant', $2, 'seed/model', 'seed', $3::jsonb, NOW())
                            `,
                            [inserted.rows[0].id, 'E2E seed message', JSON.stringify({ e2ePrefix: E2E_PREFIX })]
                        )
                    }
                }
            }

            await client.query('COMMIT')
        } catch (error) {
            await client.query('ROLLBACK')
            throw error
        }
    })
}

export async function cleanupAll(): Promise<void> {
    await withClient(async (client) => {
        await client.query('BEGIN')
        try {
            const hasWorkflowRequests = await tableExists(client, 'public.workflow_requests')
            const hasConversations = await tableExists(client, 'public.conversations')
            const hasMessages = await tableExists(client, 'public.messages')

            if (hasMessages && hasConversations) {
                await client.query(
                    `
                    DELETE FROM public.messages
                    WHERE metadata ->> 'e2ePrefix' = $1
                       OR conversation_id IN (
                            SELECT id
                            FROM public.conversations
                            WHERE title = $2
                       )
                    `,
                    [E2E_PREFIX, `${E2E_PREFIX}-inbox-thread`]
                )
            }

            if (hasConversations) {
                await client.query(
                    `
                    DELETE FROM public.conversations
                    WHERE title = $1
                    `,
                    [`${E2E_PREFIX}-inbox-thread`]
                )
            }

            if (hasWorkflowRequests) {
                await client.query(
                    `
                    DELETE FROM public.workflow_requests
                    WHERE payload ->> 'e2ePrefix' = $1
                    `,
                    [E2E_PREFIX]
                )
            }

            await client.query('COMMIT')
        } catch (error) {
            await client.query('ROLLBACK')
            throw error
        }
    })
}
