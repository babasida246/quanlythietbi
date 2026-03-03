import Fastify from 'fastify'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { setupRoutes } from './setup.routes.js'

type SetupServiceMock = {
    getStatus: ReturnType<typeof vi.fn>
    isSetupLocked: ReturnType<typeof vi.fn>
    runMigrations: ReturnType<typeof vi.fn>
    runSeed: ReturnType<typeof vi.fn>
    createFirstAdmin: ReturnType<typeof vi.fn>
    finalizeSetup: ReturnType<typeof vi.fn>
}

function createServiceMock(overrides: Partial<SetupServiceMock> = {}): SetupServiceMock {
    return {
        getStatus: vi.fn(async () => ({
            initialized: false,
            version: '1.0.0',
            api: { ok: true, build: '1.0.0' },
            db: { ok: true },
            migrations: { applied: 0, pending: 0, ok: true, total: 0 },
            seed: { ok: false },
            adminExists: false
        })),
        isSetupLocked: vi.fn(async () => false),
        runMigrations: vi.fn(async () => ({ applied: 1, skipped: 0, total: 1 })),
        runSeed: vi.fn(async () => ({ ok: true, lastRunAt: new Date().toISOString() })),
        createFirstAdmin: vi.fn(async () => ({
            userId: 'admin-1',
            email: 'admin@example.com',
            username: 'admin',
            role: 'admin'
        })),
        finalizeSetup: vi.fn(async () => ({
            completedAt: new Date().toISOString(),
            completedBy: 'admin@example.com',
            version: '1.0.0'
        })),
        ...overrides
    }
}

async function createTestApp(service: SetupServiceMock) {
    const app = Fastify()
    await app.register(setupRoutes, {
        prefix: '/api/setup',
        pgClient: {} as any,
        service
    })
    return app
}

afterEach(() => {
    vi.restoreAllMocks()
})

describe('setup routes', () => {
    it('returns uninitialized status', async () => {
        const service = createServiceMock()
        const app = await createTestApp(service)

        const response = await app.inject({
            method: 'GET',
            url: '/api/setup/status'
        })

        expect(response.statusCode).toBe(200)
        const body = response.json()
        expect(body.success).toBe(true)
        expect(body.data.initialized).toBe(false)

        await app.close()
    })

    it('returns initialized status', async () => {
        const service = createServiceMock({
            getStatus: vi.fn(async () => ({
                initialized: true,
                version: '1.0.0',
                api: { ok: true, build: '1.0.0' },
                db: { ok: true },
                migrations: { applied: 10, pending: 0, ok: true, total: 10 },
                seed: { ok: true, lastRunAt: '2026-02-15T00:00:00.000Z' },
                adminExists: true
            }))
        })
        const app = await createTestApp(service)

        const response = await app.inject({
            method: 'GET',
            url: '/api/setup/status'
        })

        expect(response.statusCode).toBe(200)
        const body = response.json()
        expect(body.data.initialized).toBe(true)
        expect(body.data.adminExists).toBe(true)

        await app.close()
    })

    it('rejects weak password for admin creation', async () => {
        const service = createServiceMock()
        const app = await createTestApp(service)

        const response = await app.inject({
            method: 'POST',
            url: '/api/setup/admin',
            payload: {
                fullName: 'System Admin',
                email: 'admin@example.com',
                password: '123456'
            }
        })

        expect(response.statusCode).toBe(400)
        const body = response.json()
        expect(body.success).toBe(false)
        expect(body.error.code).toBe('VALIDATION_ERROR')
        expect(service.createFirstAdmin).not.toHaveBeenCalled()

        await app.close()
    })

    it('returns conflict when admin email already exists', async () => {
        const service = createServiceMock({
            createFirstAdmin: vi.fn(async () => {
                throw new Error('Email already exists')
            })
        })
        const app = await createTestApp(service)

        const response = await app.inject({
            method: 'POST',
            url: '/api/setup/admin',
            payload: {
                fullName: 'System Admin',
                email: 'admin@example.com',
                password: 'StrongPass!123'
            }
        })

        expect(response.statusCode).toBe(409)
        const body = response.json()
        expect(body.success).toBe(false)
        expect(body.error.code).toBe('CONFLICT')

        await app.close()
    })

    it('fails finalize when preconditions are not met', async () => {
        const service = createServiceMock({
            finalizeSetup: vi.fn(async () => {
                throw new Error('Admin account does not exist')
            })
        })
        const app = await createTestApp(service)

        const response = await app.inject({
            method: 'POST',
            url: '/api/setup/finalize',
            payload: {}
        })

        expect(response.statusCode).toBe(400)
        const body = response.json()
        expect(body.success).toBe(false)
        expect(body.error.message).toContain('Admin account does not exist')

        await app.close()
    })

    it('blocks setup actions after initialization', async () => {
        const service = createServiceMock({
            isSetupLocked: vi.fn(async () => true)
        })
        const app = await createTestApp(service)

        const response = await app.inject({
            method: 'POST',
            url: '/api/setup/migrate'
        })

        expect(response.statusCode).toBe(403)
        const body = response.json()
        expect(body.success).toBe(false)
        expect(body.error.code).toBe('AUTHORIZATION_ERROR')

        await app.close()
    })
})

