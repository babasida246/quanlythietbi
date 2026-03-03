import { describe, expect, it } from 'vitest'
import { createApiV1AuthHook } from './api-auth.hook.js'

function makeRequest(input: Partial<{
    method: string
    url: string
    headers: Record<string, string>
    user: { id: string; role: string }
}> = {}) {
    const warnCalls: unknown[] = []
    const request = {
        method: input.method ?? 'GET',
        url: input.url ?? '/api/v1/assets',
        headers: input.headers ?? {},
        user: input.user,
        log: {
            warn: (...args: unknown[]) => {
                warnCalls.push(args)
            }
        }
    }
    return {
        request: request as any,
        warnCalls
    }
}

describe('createApiV1AuthHook', () => {
    it('skips auth for auth endpoints', async () => {
        const hook = createApiV1AuthHook()
        const { request } = makeRequest({ url: '/api/v1/auth/login' })
        await expect(hook(request, {} as any)).resolves.toBeUndefined()
    })

    it('rejects legacy x-user-* headers', async () => {
        const hook = createApiV1AuthHook()
        const { request, warnCalls } = makeRequest({
            headers: {
                'x-user-id': 'u-1',
                'x-user-role': 'manager'
            }
        })

        await expect(hook(request, {} as any)).rejects.toMatchObject({ statusCode: 401 })
        expect(request.user).toBeUndefined()
        expect(warnCalls.length).toBe(0)
    })

    it('rejects protected api requests without auth', async () => {
        const hook = createApiV1AuthHook()
        const { request } = makeRequest({ headers: {} })
        await expect(hook(request, {} as any)).rejects.toMatchObject({ statusCode: 401 })
    })
})
