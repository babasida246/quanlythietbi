/**
 * Auth API Tests
 * Tests for authentication endpoints: login, refresh, logout, me
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { login, refresh, logout, getCurrentUser } from './auth'
import { clearStoredSession, setStoredTokens, getStoredTokens, API_BASE } from './httpClient'

// Mock localStorage for Node environment
const localStorageMock = (() => {
    let store: Record<string, string> = {}
    return {
        getItem: (key: string) => store[key] || null,
        setItem: (key: string, value: string) => { store[key] = value },
        removeItem: (key: string) => { delete store[key] },
        clear: () => { store = {} }
    }
})()

Object.defineProperty(global, 'localStorage', { value: localStorageMock })

describe('Auth API', () => {
    const originalFetch = global.fetch

    beforeEach(() => {
        localStorageMock.clear()
        vi.restoreAllMocks()
    })

    afterEach(() => {
        localStorageMock.clear()
        global.fetch = originalFetch
    })

    describe('login', () => {
        it('should call /v1/auth/login with correct payload', async () => {
            const mockResponse = {
                success: true,
                data: {
                    accessToken: 'access-token-123',
                    refreshToken: 'refresh-token-456',
                    expiresIn: 900,
                    user: {
                        id: 'user-id-1',
                        email: 'test@example.com',
                        name: 'Test User',
                        role: 'user'
                    }
                }
            }

            const mockFetch = vi.fn(async () =>
                new Response(JSON.stringify(mockResponse.data), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' }
                })
            )
            global.fetch = mockFetch

            const result = await login('test@example.com', 'password123')

            // Verify URL includes /v1
            const [url, options] = (mockFetch as any).mock.calls[0]
            expect(url).toBe(`${API_BASE}/v1/auth/login`)
            expect(options.method).toBe('POST')
            expect(options.body).toBe(JSON.stringify({ email: 'test@example.com', password: 'password123' }))

            // Verify response
            expect(result).toHaveProperty('accessToken')
            expect(result).toHaveProperty('refreshToken')
            expect(result.user.email).toBe('test@example.com')
        })

        it('should store tokens after successful login', async () => {
            const mockResponse = {
                accessToken: 'access-token-123',
                refreshToken: 'refresh-token-456',
                expiresIn: 900,
                user: {
                    id: 'user-id-1',
                    email: 'test@example.com',
                    name: 'Test User',
                    role: 'user'
                }
            }

            global.fetch = vi.fn(async () =>
                new Response(JSON.stringify(mockResponse), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' }
                })
            )

            await login('test@example.com', 'password123')

            const { accessToken, refreshToken } = getStoredTokens()
            expect(accessToken).toBe('access-token-123')
            expect(refreshToken).toBe('refresh-token-456')
        })

        it('should throw on login failure', async () => {
            global.fetch = vi.fn(async () =>
                new Response(JSON.stringify({ error: 'Invalid credentials' }), {
                    status: 401,
                    headers: { 'Content-Type': 'application/json' }
                })
            )

            await expect(login('wrong@example.com', 'wrongpass')).rejects.toThrow()
        })
    })

    describe('refresh', () => {
        it('should call /v1/auth/refresh with refreshToken in camelCase', async () => {
            setStoredTokens('old-access', 'refresh-token-456')

            const mockResponse = {
                accessToken: 'new-access-token',
                refreshToken: 'new-refresh-token',
                expiresIn: 900
            }

            const mockFetch = vi.fn(async () =>
                new Response(JSON.stringify(mockResponse), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' }
                })
            )
            global.fetch = mockFetch

            await refresh()

            // Verify URL includes /v1
            const [url, options] = (mockFetch as any).mock.calls[0]
            expect(url).toBe(`${API_BASE}/v1/auth/refresh`)

            // Verify body uses camelCase refreshToken (not snake_case)
            const body = JSON.parse(options.body as string)
            expect(body).toHaveProperty('refreshToken')
            expect(body).not.toHaveProperty('refresh_token')
        })

        it('should update stored tokens after refresh', async () => {
            setStoredTokens('old-access', 'old-refresh')

            global.fetch = vi.fn(async () =>
                new Response(JSON.stringify({
                    accessToken: 'new-access',
                    refreshToken: 'new-refresh'
                }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' }
                })
            )

            await refresh()

            const { accessToken, refreshToken } = getStoredTokens()
            expect(accessToken).toBe('new-access')
            expect(refreshToken).toBe('new-refresh')
        })

        it('should clear session on refresh failure', async () => {
            setStoredTokens('old-access', 'old-refresh')

            global.fetch = vi.fn(async () =>
                new Response(JSON.stringify({ error: 'Invalid token' }), {
                    status: 401,
                    headers: { 'Content-Type': 'application/json' }
                })
            )

            await expect(refresh()).rejects.toThrow()

            const { accessToken, refreshToken } = getStoredTokens()
            expect(accessToken).toBeNull()
            expect(refreshToken).toBeNull()
        })
    })

    describe('logout', () => {
        it('should call /v1/auth/logout and clear session', async () => {
            setStoredTokens('access-token', 'refresh-token')

            const mockFetch = vi.fn(async () =>
                new Response(JSON.stringify({ success: true }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' }
                })
            )
            global.fetch = mockFetch

            await logout()

            // Verify URL includes /v1
            expect(mockFetch).toHaveBeenCalledWith(
                `${API_BASE}/v1/auth/logout`,
                expect.objectContaining({
                    method: 'POST'
                })
            )

            // Verify session is cleared
            const { accessToken, refreshToken } = getStoredTokens()
            expect(accessToken).toBeNull()
            expect(refreshToken).toBeNull()
        })
    })

    describe('getCurrentUser', () => {
        it('should call /v1/auth/me with bearer token', async () => {
            setStoredTokens('access-token-123', 'refresh-token')

            const mockUser = {
                id: 'user-1',
                email: 'user@example.com',
                name: 'Test User',
                role: 'user'
            }

            const mockFetch = vi.fn(async (_url: string, options: RequestInit) => {
                // Verify bearer token is present
                const headers = new Headers(options.headers)
                expect(headers.get('Authorization')).toBe('Bearer access-token-123')

                return new Response(JSON.stringify(mockUser), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' }
                })
            })
            global.fetch = mockFetch as any

            const result = await getCurrentUser()

            // Verify URL includes /v1
            expect(mockFetch).toHaveBeenCalledWith(
                `${API_BASE}/v1/auth/me`,
                expect.objectContaining({
                    method: 'GET'
                })
            )

            expect(result.email).toBe('user@example.com')
        })
    })
})
