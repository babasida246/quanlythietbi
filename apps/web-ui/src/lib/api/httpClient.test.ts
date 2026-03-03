import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { authorizedFetch, clearStoredSession, requireAccessToken, setStoredTokens } from './httpClient'
import { sendChatMessage } from './chat'

describe('auth token guard', () => {
    const originalFetch = global.fetch

    beforeEach(() => {
        clearStoredSession()
        vi.restoreAllMocks()
    })

    afterEach(() => {
        clearStoredSession()
        global.fetch = originalFetch
    })

    it('throws when no access token is stored', () => {
        clearStoredSession()
        expect(() => requireAccessToken()).toThrow(/Authentication required/i)
    })

    it('injects bearer token on authorized fetch requests', async () => {
        setStoredTokens('token-123', 'refresh-123')

        const mockFetch = vi.fn(async (_input: any, init?: RequestInit) => {
            return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } })
        })
        global.fetch = mockFetch

        await authorizedFetch('/api/chat/send', { method: 'POST' })

        const [, init] = mockFetch.mock.calls[0]
        const headers = new Headers(init?.headers)
        expect(headers.get('Authorization')).toBe('Bearer token-123')
    })

    it('blocks chat calls when no JWT is available', async () => {
        clearStoredSession()
        await expect(sendChatMessage({ message: 'hello from test' })).rejects.toThrow(/Authentication required/i)
    })
})
