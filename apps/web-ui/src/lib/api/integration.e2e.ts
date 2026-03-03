/**
 * API Integration Tests
 * These tests verify the API endpoints work correctly against the running server
 * 
 * Prerequisites:
 * - API server running at http://localhost:3000
 * - Admin user created: admin@netopsai.com / Admin@123
 * 
 * Run with: pnpm vitest run src/lib/api/integration.test.ts
 * 
 * NOTE: These tests are designed to run in an environment with network access
 * to the API server. They will be skipped in CI/isolated test environments.
 */
import { describe, it, expect, beforeAll } from 'vitest'

const API_BASE = 'http://localhost:3000/api'

// Check if API is available
async function isApiAvailable(): Promise<boolean> {
    try {
        const response = await fetch(`${API_BASE}/v1/health`, { 
            signal: AbortSignal.timeout(1000) 
        })
        return response.ok
    } catch {
        return false
    }
}

describe('API Integration Tests', () => {
    let accessToken: string = ''
    let refreshToken: string = ''
    let apiAvailable = false

    beforeAll(async () => {
        apiAvailable = await isApiAvailable()
        if (!apiAvailable) {
            console.log('⚠️ API server not available - integration tests will be skipped')
        }
    })

    describe('Health Check', () => {
        it('should return health status', async () => {
            if (!apiAvailable) return
            
            const response = await fetch(`${API_BASE}/v1/health`)
            expect(response.ok).toBe(true)
            
            const data = await response.json()
            expect(data.success).toBe(true)
            expect(data.data.status).toBe('healthy')
        })
    })

    describe('Authentication Flow', () => {
        it('should login successfully with valid credentials', async () => {
            if (!apiAvailable) return
            
            const response = await fetch(`${API_BASE}/v1/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: 'admin@netopsai.com',
                    password: 'Admin@123'
                })
            })

            expect(response.ok).toBe(true)
            
            const data = await response.json()
            expect(data.success).toBe(true)
            expect(data.data).toHaveProperty('accessToken')
            expect(data.data).toHaveProperty('refreshToken')
            expect(data.data.user.email).toBe('admin@netopsai.com')

            // Store tokens for subsequent tests
            accessToken = data.data.accessToken
            refreshToken = data.data.refreshToken
        })

        it('should reject login with invalid credentials', async () => {
            if (!apiAvailable) return
            
            const response = await fetch(`${API_BASE}/v1/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: 'invalid@email.com',
                    password: 'wrongpassword'
                })
            })

            expect(response.ok).toBe(false)
            expect(response.status).toBe(401)
        })

        it('should refresh token using refreshToken (camelCase)', async () => {
            if (!apiAvailable || !refreshToken) return

            const response = await fetch(`${API_BASE}/v1/auth/refresh`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ refreshToken }) // camelCase
            })

            expect(response.ok).toBe(true)
            
            const data = await response.json()
            expect(data.success).toBe(true)
            expect(data.data).toHaveProperty('accessToken')
            expect(data.data).toHaveProperty('refreshToken')

            // Update tokens
            accessToken = data.data.accessToken
            refreshToken = data.data.refreshToken
        })

        it('should get current user with valid token', async () => {
            if (!apiAvailable || !accessToken) return

            const response = await fetch(`${API_BASE}/v1/auth/me`, {
                method: 'GET',
                headers: { 
                    'Authorization': `Bearer ${accessToken}`
                }
            })

            expect(response.ok).toBe(true)
            
            const data = await response.json()
            expect(data.success).toBe(true)
            expect(data.data.email).toBe('admin@netopsai.com')
        })

        it('should reject request without token', async () => {
            if (!apiAvailable) return
            
            const response = await fetch(`${API_BASE}/v1/auth/me`, {
                method: 'GET'
            })

            expect(response.ok).toBe(false)
            expect(response.status).toBe(401)
        })
    })

    describe('Conversations API', () => {
        let conversationId: string

        it('should list conversations', async () => {
            if (!apiAvailable || !accessToken) return

            const response = await fetch(`${API_BASE}/v1/conversations?page=1&limit=10`, {
                headers: { 'Authorization': `Bearer ${accessToken}` }
            })

            expect(response.ok).toBe(true)
            
            const data = await response.json()
            expect(data).toHaveProperty('data')
            expect(data).toHaveProperty('meta')
        })

        it('should create a conversation', async () => {
            if (!apiAvailable || !accessToken) return

            const response = await fetch(`${API_BASE}/v1/conversations`, {
                method: 'POST',
                headers: { 
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ title: 'Test Conversation' })
            })

            expect(response.ok).toBe(true)
            
            const data = await response.json()
            expect(data.success).toBe(true)
            expect(data.data).toHaveProperty('id')
            
            conversationId = data.data.id
        })

        it('should get a specific conversation', async () => {
            if (!apiAvailable || !accessToken || !conversationId) return

            const response = await fetch(`${API_BASE}/v1/conversations/${conversationId}`, {
                headers: { 'Authorization': `Bearer ${accessToken}` }
            })

            expect(response.ok).toBe(true)
            
            const data = await response.json()
            expect(data.success).toBe(true)
            expect(data.data.id).toBe(conversationId)
        })

        it('should delete a conversation', async () => {
            if (!apiAvailable || !accessToken || !conversationId) return

            const response = await fetch(`${API_BASE}/v1/conversations/${conversationId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${accessToken}` }
            })

            expect(response.ok).toBe(true)
        })
    })

    describe('Admin API', () => {
        it('should list users (admin only)', async () => {
            if (!apiAvailable || !accessToken) return

            const response = await fetch(`${API_BASE}/v1/admin/users`, {
                headers: { 'Authorization': `Bearer ${accessToken}` }
            })

            expect(response.ok).toBe(true)
            
            const data = await response.json()
            expect(data).toHaveProperty('data')
        })

        it('should list audit logs', async () => {
            if (!apiAvailable || !accessToken) return

            const response = await fetch(`${API_BASE}/v1/admin/audit-logs?limit=10`, {
                headers: { 'Authorization': `Bearer ${accessToken}` }
            })

            expect(response.ok).toBe(true)
            
            const data = await response.json()
            expect(data).toHaveProperty('data')
        })
    })

    describe('Models API', () => {
        it('should list models', async () => {
            if (!apiAvailable || !accessToken) return

            const response = await fetch(`${API_BASE}/v1/models`, {
                headers: { 'Authorization': `Bearer ${accessToken}` }
            })

            expect(response.ok).toBe(true)
            
            const data = await response.json()
            expect(data).toHaveProperty('data')
        })
    })

    describe('Providers API', () => {
        it('should list providers', async () => {
            if (!apiAvailable || !accessToken) return

            const response = await fetch(`${API_BASE}/v1/providers`, {
                headers: { 'Authorization': `Bearer ${accessToken}` }
            })

            expect(response.ok).toBe(true)
            
            const data = await response.json()
            expect(data).toHaveProperty('data')
        })
    })

    describe('URL Format Verification', () => {
        const testCases = [
            { path: '/v1/health', method: 'GET', auth: false },
            { path: '/v1/auth/login', method: 'POST', auth: false },
            { path: '/v1/auth/refresh', method: 'POST', auth: false },
            { path: '/v1/auth/me', method: 'GET', auth: true },
            { path: '/v1/conversations', method: 'GET', auth: true },
            { path: '/v1/admin/users', method: 'GET', auth: true },
            { path: '/v1/models', method: 'GET', auth: true },
            { path: '/v1/providers', method: 'GET', auth: true },
        ]

        testCases.forEach(({ path, method, auth }) => {
            it(`should accept ${method} ${path}`, async () => {
                if (!apiAvailable) return
                if (auth && !accessToken) return

                const headers: Record<string, string> = {}
                if (auth) {
                    headers['Authorization'] = `Bearer ${accessToken}`
                }
                if (method === 'POST') {
                    headers['Content-Type'] = 'application/json'
                }

                const response = await fetch(`${API_BASE}${path}`, {
                    method,
                    headers,
                    body: method === 'POST' ? JSON.stringify({}) : undefined
                })

                // Should not return 404 (Not Found) - this means the route exists
                expect(response.status).not.toBe(404)
            })
        })
    })
})
