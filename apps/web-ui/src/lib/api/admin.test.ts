/**
 * Admin API Tests
 * Tests for admin endpoints: users CRUD, password reset, audit logs
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
    listUsers,
    createUser,
    updateUser,
    deleteUser,
    resetPassword,
    listAuditLogs
} from './admin'
import { clearApiCache, clearStoredSession, setStoredTokens, API_BASE } from './httpClient'

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

describe('Admin API', () => {
    const originalFetch = global.fetch

    beforeEach(() => {
        localStorageMock.clear()
        setStoredTokens('admin-access-token', 'admin-refresh-token')
        clearApiCache()
        vi.restoreAllMocks()
    })

    afterEach(() => {
        localStorageMock.clear()
        global.fetch = originalFetch
    })

    describe('listUsers', () => {
        it('should call /v1/admin/users', async () => {
            const mockResponse = {
                data: [
                    { id: 'user-1', email: 'user1@example.com', name: 'User 1', role: 'user', isActive: true, createdAt: new Date().toISOString() },
                    { id: 'user-2', email: 'user2@example.com', name: 'User 2', role: 'admin', isActive: true, createdAt: new Date().toISOString() }
                ],
                meta: { total: 2 }
            }

            const mockFetch = vi.fn(async () =>
                new Response(JSON.stringify(mockResponse), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' }
                })
            )
            global.fetch = mockFetch

            const result = await listUsers()

            expect(mockFetch).toHaveBeenCalledWith(
                `${API_BASE}/v1/admin/users`,
                expect.anything()
            )

            expect(result.data).toHaveLength(2)
        })

        it('should require authentication', async () => {
            clearStoredSession()
            await expect(listUsers()).rejects.toThrow(/Authentication required/i)
        })
    })

    describe('createUser', () => {
        it('should call /v1/admin/users with POST method', async () => {
            const mockUser = {
                id: 'user-new',
                email: 'newuser@example.com',
                name: 'New User',
                role: 'user',
                isActive: true,
                createdAt: new Date().toISOString()
            }

            const mockFetch = vi.fn(async () =>
                new Response(JSON.stringify(mockUser), {
                    status: 201,
                    headers: { 'Content-Type': 'application/json' }
                })
            )
            global.fetch = mockFetch

            const result = await createUser({
                email: 'newuser@example.com',
                name: 'New User',
                password: 'password123',
                role: 'user'
            })

            expect(mockFetch).toHaveBeenCalledWith(
                `${API_BASE}/v1/admin/users`,
                expect.objectContaining({
                    method: 'POST',
                    body: JSON.stringify({
                        email: 'newuser@example.com',
                        name: 'New User',
                        password: 'password123',
                        role: 'user'
                    })
                })
            )

            expect(result.id).toBe('user-new')
            expect(result.email).toBe('newuser@example.com')
        })
    })

    describe('updateUser', () => {
        it('should call /v1/admin/users/:id with PATCH method', async () => {
            const mockUser = {
                id: 'user-123',
                email: 'updated@example.com',
                name: 'Updated User',
                role: 'admin',
                isActive: true,
                createdAt: new Date().toISOString()
            }

            const mockFetch = vi.fn(async () =>
                new Response(JSON.stringify(mockUser), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' }
                })
            )
            global.fetch = mockFetch

            const result = await updateUser('user-123', { name: 'Updated User', role: 'admin' })

            expect(mockFetch).toHaveBeenCalledWith(
                `${API_BASE}/v1/admin/users/user-123`,
                expect.objectContaining({
                    method: 'PATCH',
                    body: JSON.stringify({ name: 'Updated User', role: 'admin' })
                })
            )

            expect(result.name).toBe('Updated User')
            expect(result.role).toBe('admin')
        })
    })

    describe('deleteUser', () => {
        it('should call /v1/admin/users/:id with DELETE method', async () => {
            const mockFetch = vi.fn(async () =>
                new Response(JSON.stringify({ success: true }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' }
                })
            )
            global.fetch = mockFetch

            const result = await deleteUser('user-123')

            expect(mockFetch).toHaveBeenCalledWith(
                `${API_BASE}/v1/admin/users/user-123`,
                expect.objectContaining({
                    method: 'DELETE'
                })
            )

            expect(result.success).toBe(true)
        })
    })

    describe('resetPassword', () => {
        it('should call /v1/admin/users/:id/reset-password with POST', async () => {
            const mockFetch = vi.fn(async () =>
                new Response(JSON.stringify({ success: true, message: 'Password updated' }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' }
                })
            )
            global.fetch = mockFetch

            const result = await resetPassword('user-123', 'newPassword123')

            expect(mockFetch).toHaveBeenCalledWith(
                `${API_BASE}/v1/admin/users/user-123/reset-password`,
                expect.objectContaining({
                    method: 'POST',
                    body: JSON.stringify({ newPassword: 'newPassword123' })
                })
            )

            expect(result.success).toBe(true)
        })
    })

    describe('listAuditLogs', () => {
        it('should call /v1/admin/audit-logs with pagination', async () => {
            const mockResponse = {
                data: [
                    { id: 'log-1', userId: 'user-1', action: 'login', resource: 'auth', resourceId: null, createdAt: new Date().toISOString() }
                ],
                meta: { total: 1 }
            }

            const mockFetch = vi.fn(async () =>
                new Response(JSON.stringify(mockResponse), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' }
                })
            )
            global.fetch = mockFetch

            const result = await listAuditLogs({ limit: 10, page: 1 })

            expect(mockFetch).toHaveBeenCalledWith(
                `${API_BASE}/v1/admin/audit-logs?limit=10&page=1`,
                expect.anything()
            )

            expect(result.data).toHaveLength(1)
        })

        it('should call without params', async () => {
            const mockFetch = vi.fn(async () =>
                new Response(JSON.stringify({ data: [], meta: {} }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' }
                })
            )
            global.fetch = mockFetch

            await listAuditLogs()

            expect(mockFetch).toHaveBeenCalledWith(
                `${API_BASE}/v1/admin/audit-logs`,
                expect.anything()
            )
        })
    })

    describe('URL format validation', () => {
        it('all admin endpoints should use /v1 prefix', async () => {
            const mockFetch = vi.fn(async () =>
                new Response(JSON.stringify({ data: [], meta: {}, success: true }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' }
                })
            )
            global.fetch = mockFetch

            // Test each endpoint
            await listUsers()
            expect((mockFetch as any).mock.calls[0][0]).toBe(`${API_BASE}/v1/admin/users`)

            mockFetch.mockClear()
            await createUser({ email: 'test@test.com', name: 'Test', password: 'pass' })
            expect((mockFetch as any).mock.calls[0][0]).toBe(`${API_BASE}/v1/admin/users`)

            mockFetch.mockClear()
            await updateUser('test-id', { name: 'Updated' })
            expect((mockFetch as any).mock.calls[0][0]).toBe(`${API_BASE}/v1/admin/users/test-id`)

            mockFetch.mockClear()
            await deleteUser('test-id')
            expect((mockFetch as any).mock.calls[0][0]).toBe(`${API_BASE}/v1/admin/users/test-id`)

            mockFetch.mockClear()
            await resetPassword('test-id', 'newpass')
            expect((mockFetch as any).mock.calls[0][0]).toBe(`${API_BASE}/v1/admin/users/test-id/reset-password`)

            mockFetch.mockClear()
            await listAuditLogs()
            expect((mockFetch as any).mock.calls[0][0]).toBe(`${API_BASE}/v1/admin/audit-logs`)
        })
    })
})
