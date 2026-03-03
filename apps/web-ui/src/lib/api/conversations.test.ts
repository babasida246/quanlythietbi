/**
 * Conversations API Tests
 * Tests for conversation endpoints: list, create, get, delete, messages
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
    listConversations,
    createConversation,
    getConversation,
    deleteConversation,
    listMessages,
    sendMessage
} from './conversations'
import { clearStoredSession, setStoredTokens, API_BASE } from './httpClient'

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

describe('Conversations API', () => {
    const originalFetch = global.fetch

    beforeEach(() => {
        localStorageMock.clear()
        setStoredTokens('test-access-token', 'test-refresh-token')
        vi.restoreAllMocks()
    })

    afterEach(() => {
        localStorageMock.clear()
        global.fetch = originalFetch
    })

    describe('listConversations', () => {
        it('should call /v1/conversations with pagination params', async () => {
            const mockResponse = {
                data: [
                    { id: 'conv-1', userId: 'user-1', title: 'Test Conversation', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
                ],
                meta: { page: 1, limit: 20, total: 1, totalPages: 1 }
            }

            const mockFetch = vi.fn(async () =>
                new Response(JSON.stringify(mockResponse), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' }
                })
            )
            global.fetch = mockFetch

            const result = await listConversations(1, 20)

            // Verify URL includes /v1
            expect(mockFetch).toHaveBeenCalledWith(
                `${API_BASE}/v1/conversations?page=1&limit=20`,
                expect.anything()
            )

            expect(result.data).toHaveLength(1)
            expect(result.data[0].id).toBe('conv-1')
        })

        it('should require authentication', async () => {
            clearStoredSession()
            await expect(listConversations()).rejects.toThrow(/Authentication required/i)
        })
    })

    describe('createConversation', () => {
        it('should call /v1/conversations with POST method', async () => {
            const mockConversation = {
                id: 'conv-new',
                userId: 'user-1',
                title: 'New Conversation',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            }

            const mockFetch = vi.fn(async () =>
                new Response(JSON.stringify(mockConversation), {
                    status: 201,
                    headers: { 'Content-Type': 'application/json' }
                })
            )
            global.fetch = mockFetch

            const result = await createConversation({ title: 'New Conversation' })

            expect(mockFetch).toHaveBeenCalledWith(
                `${API_BASE}/v1/conversations`,
                expect.objectContaining({
                    method: 'POST',
                    body: JSON.stringify({ title: 'New Conversation' })
                })
            )

            expect(result.id).toBe('conv-new')
            expect(result.title).toBe('New Conversation')
        })

        it('should require authentication', async () => {
            clearStoredSession()
            await expect(createConversation({ title: 'Test' })).rejects.toThrow(/Authentication required/i)
        })
    })

    describe('getConversation', () => {
        it('should call /v1/conversations/:id', async () => {
            const mockConversation = {
                id: 'conv-123',
                userId: 'user-1',
                title: 'Test Conversation',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            }

            const mockFetch = vi.fn(async () =>
                new Response(JSON.stringify(mockConversation), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' }
                })
            )
            global.fetch = mockFetch

            const result = await getConversation('conv-123')

            expect(mockFetch).toHaveBeenCalledWith(
                `${API_BASE}/v1/conversations/conv-123`,
                expect.anything()
            )

            expect(result.id).toBe('conv-123')
        })
    })

    describe('deleteConversation', () => {
        it('should call /v1/conversations/:id with DELETE method', async () => {
            const mockFetch = vi.fn(async () =>
                new Response(JSON.stringify({ success: true }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' }
                })
            )
            global.fetch = mockFetch

            await deleteConversation('conv-123')

            expect(mockFetch).toHaveBeenCalledWith(
                `${API_BASE}/v1/conversations/conv-123`,
                expect.objectContaining({
                    method: 'DELETE'
                })
            )
        })
    })

    describe('listMessages', () => {
        it('should call /v1/conversations/:id/messages', async () => {
            const mockResponse = {
                data: [
                    { id: 'msg-1', conversationId: 'conv-123', role: 'user', content: 'Hello', createdAt: new Date().toISOString() },
                    { id: 'msg-2', conversationId: 'conv-123', role: 'assistant', content: 'Hi there!', createdAt: new Date().toISOString() }
                ]
            }

            const mockFetch = vi.fn(async () =>
                new Response(JSON.stringify(mockResponse), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' }
                })
            )
            global.fetch = mockFetch

            const result = await listMessages('conv-123', 50)

            expect(mockFetch).toHaveBeenCalledWith(
                `${API_BASE}/v1/conversations/conv-123/messages?limit=50`,
                expect.anything()
            )

            expect(result.data).toHaveLength(2)
        })
    })

    describe('sendMessage', () => {
        it('should call /v1/conversations/:id/messages with POST', async () => {
            const mockMessage = {
                id: 'msg-new',
                conversationId: 'conv-123',
                role: 'user',
                content: 'Test message',
                createdAt: new Date().toISOString()
            }

            const mockFetch = vi.fn(async () =>
                new Response(JSON.stringify(mockMessage), {
                    status: 201,
                    headers: { 'Content-Type': 'application/json' }
                })
            )
            global.fetch = mockFetch

            const result = await sendMessage('conv-123', {
                role: 'user',
                content: 'Test message'
            })

            expect(mockFetch).toHaveBeenCalledWith(
                `${API_BASE}/v1/conversations/conv-123/messages`,
                expect.objectContaining({
                    method: 'POST',
                    body: JSON.stringify({ role: 'user', content: 'Test message' })
                })
            )

            expect(result.content).toBe('Test message')
        })
    })

    describe('URL format validation', () => {
        it('all endpoints should use /v1 prefix', async () => {
            const mockFetch = vi.fn(async () =>
                new Response(JSON.stringify({}), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' }
                })
            )
            global.fetch = mockFetch

            // Test each endpoint
            await listConversations()
            expect((mockFetch as any).mock.calls[0][0]).toContain('/v1/conversations')

            mockFetch.mockClear()
            await createConversation({ title: 'Test' })
            expect((mockFetch as any).mock.calls[0][0]).toBe(`${API_BASE}/v1/conversations`)

            mockFetch.mockClear()
            await getConversation('test-id')
            expect((mockFetch as any).mock.calls[0][0]).toBe(`${API_BASE}/v1/conversations/test-id`)

            mockFetch.mockClear()
            await deleteConversation('test-id')
            expect((mockFetch as any).mock.calls[0][0]).toBe(`${API_BASE}/v1/conversations/test-id`)

            mockFetch.mockClear()
            await listMessages('test-id')
            expect((mockFetch as any).mock.calls[0][0]).toContain('/v1/conversations/test-id/messages')

            mockFetch.mockClear()
            await sendMessage('test-id', { role: 'user', content: 'test' })
            expect((mockFetch as any).mock.calls[0][0]).toBe(`${API_BASE}/v1/conversations/test-id/messages`)
        })
    })
})
