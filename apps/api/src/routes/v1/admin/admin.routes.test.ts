import Fastify from 'fastify'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { adminRoutes } from './admin.routes.js'

type QueryResult<T = unknown> = {
    rows: T[]
    rowCount?: number
}

function createMockPgClient() {
    const query = vi.fn(async (sql: string, params?: unknown[]): Promise<QueryResult> => {
        const normalizedSql = sql.replace(/\s+/g, ' ').trim().toLowerCase()

        if (normalizedSql.includes('from information_schema.tables')) {
            const tableName = params?.[0]
            return { rows: [{ found: tableName === 'users' || tableName === 'audit_logs' }], rowCount: 1 }
        }

        if (normalizedSql.startsWith('select count(*)::text as total from users')) {
            return { rows: [{ total: '1' }], rowCount: 1 }
        }

        if (normalizedSql.startsWith('select count(*)::text as total from audit_logs')) {
            return { rows: [{ total: '1' }], rowCount: 1 }
        }

        if (normalizedSql.includes('from users') && normalizedSql.includes('order by created_at desc')) {
            return {
                rows: [{
                    id: '11111111-1111-1111-1111-111111111111',
                    email: 'admin@example.com',
                    name: 'Admin',
                    role: 'admin',
                    is_active: true,
                    status: 'active',
                    last_login_at: null,
                    created_at: new Date('2026-01-01T00:00:00Z')
                }],
                rowCount: 1
            }
        }

        if (normalizedSql.includes('from audit_logs') && normalizedSql.includes('order by created_at desc')) {
            return {
                rows: [{
                    id: '33333333-3333-3333-3333-333333333333',
                    correlation_id: 'corr-1',
                    user_id: 'user-1',
                    action: 'admin.user.create',
                    resource: 'users',
                    details: {
                        resourceId: '22222222-2222-2222-2222-222222222222',
                        ipAddress: '127.0.0.1',
                        userAgent: 'vitest'
                    },
                    created_at: new Date('2026-01-03T00:00:00Z')
                }],
                rowCount: 1
            }
        }

        if (normalizedSql.startsWith('insert into users')) {
            return {
                rows: [{
                    id: '22222222-2222-2222-2222-222222222222',
                    email: 'new.admin@example.com',
                    name: 'New Admin',
                    role: 'admin',
                    is_active: true,
                    status: 'active',
                    last_login_at: null,
                    created_at: new Date('2026-01-02T00:00:00Z')
                }],
                rowCount: 1
            }
        }

        if (normalizedSql.startsWith('update users') && normalizedSql.includes('returning id, email, name, role')) {
            return {
                rows: [{
                    id: '22222222-2222-2222-2222-222222222222',
                    email: 'patched@example.com',
                    name: 'Patched User',
                    role: 'admin',
                    is_active: true,
                    status: 'active',
                    last_login_at: null,
                    created_at: new Date('2026-01-02T00:00:00Z')
                }],
                rowCount: 1
            }
        }

        if (normalizedSql.startsWith('update users') && normalizedSql.includes('set is_active = false')) {
            return { rows: [{ id: '22222222-2222-2222-2222-222222222222' }], rowCount: 1 }
        }

        if (normalizedSql.startsWith('update users') && normalizedSql.includes('set password_hash =')) {
            return { rows: [{ id: '22222222-2222-2222-2222-222222222222' }], rowCount: 1 }
        }

        if (normalizedSql.startsWith('insert into audit_logs')) {
            return { rows: [], rowCount: 1 }
        }

        throw new Error(`Unexpected query: ${normalizedSql}`)
    })

    return { query }
}

async function createTestApp() {
    const app = Fastify()
    app.addHook('onRequest', async (request) => {
        const userId = request.headers['x-test-user-id']
        const role = request.headers['x-test-user-role']
        if (typeof userId === 'string' && typeof role === 'string') {
            ;(request as any).user = { id: userId, role }
        }
    })
    const pgClient = createMockPgClient()
    await app.register(adminRoutes, {
        prefix: '/api/v1/admin',
        pgClient: pgClient as any
    })
    return { app, pgClient }
}

afterEach(() => {
    vi.restoreAllMocks()
})

describe('adminRoutes', () => {
    it('forbids non-admin access to list users', async () => {
        const { app } = await createTestApp()
        try {
            const response = await app.inject({
                method: 'GET',
                url: '/api/v1/admin/users',
                headers: {
                    'x-test-user-id': 'user-1',
                    'x-test-user-role': 'viewer'
                }
            })

            expect(response.statusCode).toBe(403)
        } finally {
            await app.close()
        }
    })

    it('lists users for admin', async () => {
        const { app, pgClient } = await createTestApp()
        try {
            const response = await app.inject({
                method: 'GET',
                url: '/api/v1/admin/users?limit=10&page=1',
                headers: {
                    'x-test-user-id': 'user-1',
                    'x-test-user-role': 'admin'
                }
            })

            expect(response.statusCode).toBe(200)
            const body = response.json()
            expect(body.success).toBe(true)
            expect(body.data).toHaveLength(1)
            expect(body.data[0]).toMatchObject({
                email: 'admin@example.com',
                role: 'admin',
                isActive: true
            })
            expect(body.meta?.pagination).toMatchObject({
                page: 1,
                limit: 10,
                total: 1
            })
            expect(pgClient.query).toHaveBeenCalled()
        } finally {
            await app.close()
        }
    })

    it('creates user and writes audit log', async () => {
        const { app, pgClient } = await createTestApp()
        try {
            const response = await app.inject({
                method: 'POST',
                url: '/api/v1/admin/users',
                headers: {
                    'x-test-user-id': 'user-1',
                    'x-test-user-role': 'admin',
                    'content-type': 'application/json'
                },
                payload: {
                    email: 'new.admin@example.com',
                    name: 'New Admin',
                    password: 'Str0ng!Password123',
                    role: 'admin'
                }
            })

            expect(response.statusCode).toBe(201)
            const body = response.json()
            expect(body.success).toBe(true)
            expect(body.data).toMatchObject({
                email: 'new.admin@example.com',
                name: 'New Admin',
                role: 'admin',
                isActive: true
            })

            const sqlCalls = pgClient.query.mock.calls.map(([sql]) => String(sql).toLowerCase())
            expect(sqlCalls.some(sql => sql.includes('insert into users'))).toBe(true)
            expect(sqlCalls.some(sql => sql.includes('insert into audit_logs'))).toBe(true)
        } finally {
            await app.close()
        }
    })

    it('lists audit logs for admin', async () => {
        const { app } = await createTestApp()
        try {
            const response = await app.inject({
                method: 'GET',
                url: '/api/v1/admin/audit-logs?limit=10&page=1',
                headers: {
                    'x-test-user-id': 'user-1',
                    'x-test-user-role': 'admin'
                }
            })

            expect(response.statusCode).toBe(200)
            const body = response.json()
            expect(body.success).toBe(true)
            expect(body.data).toHaveLength(1)
            expect(body.data[0]).toMatchObject({
                action: 'admin.user.create',
                resource: 'users',
                resourceId: '22222222-2222-2222-2222-222222222222',
                ipAddress: '127.0.0.1',
                userAgent: 'vitest'
            })
        } finally {
            await app.close()
        }
    })

    it('prevents self-deactivation and self-delete', async () => {
        const { app } = await createTestApp()
        try {
            const patchResponse = await app.inject({
                method: 'PATCH',
                url: '/api/v1/admin/users/11111111-1111-1111-1111-111111111111',
                headers: {
                    'x-test-user-id': '11111111-1111-1111-1111-111111111111',
                    'x-test-user-role': 'admin',
                    'content-type': 'application/json'
                },
                payload: { isActive: false }
            })
            expect(patchResponse.statusCode).toBe(403)

            const deleteResponse = await app.inject({
                method: 'DELETE',
                url: '/api/v1/admin/users/11111111-1111-1111-1111-111111111111',
                headers: {
                    'x-test-user-id': '11111111-1111-1111-1111-111111111111',
                    'x-test-user-role': 'admin'
                }
            })
            expect(deleteResponse.statusCode).toBe(403)
        } finally {
            await app.close()
        }
    })

    it('resets password for admin with strong password', async () => {
        const { app, pgClient } = await createTestApp()
        try {
            const response = await app.inject({
                method: 'POST',
                url: '/api/v1/admin/users/22222222-2222-2222-2222-222222222222/reset-password',
                headers: {
                    'x-test-user-id': 'user-1',
                    'x-test-user-role': 'admin',
                    'content-type': 'application/json'
                },
                payload: {
                    newPassword: 'An0ther!StrongPassword'
                }
            })

            expect(response.statusCode).toBe(200)
            const body = response.json()
            expect(body.success).toBe(true)
            expect(body.data).toMatchObject({ success: true })

            const sqlCalls = pgClient.query.mock.calls.map(([sql]) => String(sql).toLowerCase())
            expect(sqlCalls.some(sql => sql.includes('set password_hash'))).toBe(true)
            expect(sqlCalls.some(sql => sql.includes('insert into audit_logs'))).toBe(true)
        } finally {
            await app.close()
        }
    })
})
