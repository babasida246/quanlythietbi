/**
 * Chat API Tests
 * Tests for chat, stats, models, providers, and orchestration endpoints
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
    // Chat API
    sendChatMessage,
    chatCompletion,
    // Stats API
    getConversationStats,
    getUserStats,
    getDailySummary,
    // Models API
    listModels,
    getModel,
    createModel,
    deleteModel,
    updateModelPriority,
    updateModelConfig,
    getModelPerformance,
    getModelHistory,
    // Providers API
    listProviders,
    createProvider,
    deleteProvider,
    updateProvider,
    getProviderHistory,
    listUsageLogs,
    checkProviderHealth,
    listOpenRouterRemoteModels,
    importOpenRouterModel,
    getOpenRouterAccountActivity,
    getOpenRouterCredits,
    // Orchestration API
    listOrchestrationRules,
    createOrchestrationRule,
    updateOrchestrationRule,
    deleteOrchestrationRule
} from './chat'
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

describe('Chat API', () => {
    const originalFetch = global.fetch

    beforeEach(() => {
        localStorageMock.clear()
        setStoredTokens('test-access-token', 'test-refresh-token')
        clearApiCache()
        vi.restoreAllMocks()
    })

    afterEach(() => {
        localStorageMock.clear()
        global.fetch = originalFetch
    })

    // =========================================================================
    // CHAT ENDPOINTS
    // =========================================================================

    describe('Chat Endpoints', () => {
        describe('sendChatMessage', () => {
            it('should call /v1/chat/messages', async () => {
                const mockResponse = {
                    message: 'Hello! How can I help?',
                    conversationId: 'conv-123',
                    model: 'gpt-4',
                    provider: 'openai',
                    usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30, estimatedCost: 0.001 },
                    latencyMs: 500
                }

                const mockFetch = vi.fn(async () =>
                    new Response(JSON.stringify(mockResponse), {
                        status: 200,
                        headers: { 'Content-Type': 'application/json' }
                    })
                )
                global.fetch = mockFetch

                const result = await sendChatMessage({ message: 'Hello' })

                expect(mockFetch).toHaveBeenCalledWith(
                    `${API_BASE}/v1/chat/messages`,
                    expect.objectContaining({
                        method: 'POST'
                    })
                )

                expect(result.message).toBe('Hello! How can I help?')
            })

            it('should require authentication', async () => {
                clearStoredSession()
                await expect(sendChatMessage({ message: 'test' })).rejects.toThrow(/Authentication required/i)
            })
        })

        describe('chatCompletion', () => {
            it('should call /v1/chat/completions', async () => {
                const mockFetch = vi.fn(async () =>
                    new Response(JSON.stringify({ choices: [{ message: { content: 'Response' } }] }), {
                        status: 200,
                        headers: { 'Content-Type': 'application/json' }
                    })
                )
                global.fetch = mockFetch

                await chatCompletion([{ role: 'user', content: 'Hello' }])

                expect(mockFetch).toHaveBeenCalledWith(
                    `${API_BASE}/v1/chat/completions`,
                    expect.objectContaining({
                        method: 'POST'
                    })
                )
            })
        })
    })

    // =========================================================================
    // STATS ENDPOINTS
    // =========================================================================

    describe('Stats Endpoints', () => {
        describe('getConversationStats', () => {
            it('should call /v1/stats/chat/conversations/:id', async () => {
                const mockFetch = vi.fn(async () =>
                    new Response(JSON.stringify({ data: [] }), {
                        status: 200,
                        headers: { 'Content-Type': 'application/json' }
                    })
                )
                global.fetch = mockFetch

                await getConversationStats('conv-123')

                expect(mockFetch).toHaveBeenCalledWith(
                    `${API_BASE}/v1/stats/chat/conversations/conv-123`,
                    expect.anything()
                )
            })
        })

        describe('getUserStats', () => {
            it('should call /v1/stats/chat/user', async () => {
                const mockFetch = vi.fn(async () =>
                    new Response(JSON.stringify({ data: [] }), {
                        status: 200,
                        headers: { 'Content-Type': 'application/json' }
                    })
                )
                global.fetch = mockFetch

                await getUserStats()

                expect(mockFetch).toHaveBeenCalledWith(
                    `${API_BASE}/v1/stats/chat/user`,
                    expect.anything()
                )
            })

            it('should support date filters', async () => {
                const mockFetch = vi.fn(async () =>
                    new Response(JSON.stringify({ data: [] }), {
                        status: 200,
                        headers: { 'Content-Type': 'application/json' }
                    })
                )
                global.fetch = mockFetch

                await getUserStats({ startDate: '2024-01-01', endDate: '2024-01-31' })

                expect((mockFetch as any).mock.calls[0][0]).toContain('startDate=2024-01-01')
                expect((mockFetch as any).mock.calls[0][0]).toContain('endDate=2024-01-31')
            })
        })

        describe('getDailySummary', () => {
            it('should call /v1/stats/chat/daily', async () => {
                const mockFetch = vi.fn(async () =>
                    new Response(JSON.stringify({ totalTokens: 1000, totalCost: 0.05 }), {
                        status: 200,
                        headers: { 'Content-Type': 'application/json' }
                    })
                )
                global.fetch = mockFetch

                await getDailySummary()

                expect(mockFetch).toHaveBeenCalledWith(
                    `${API_BASE}/v1/stats/chat/daily`,
                    expect.anything()
                )
            })
        })
    })

    // =========================================================================
    // MODELS ENDPOINTS
    // =========================================================================

    describe('Models Endpoints', () => {
        describe('listModels', () => {
            it('should call /v1/models', async () => {
                const mockFetch = vi.fn(async () =>
                    new Response(JSON.stringify({ data: [] }), {
                        status: 200,
                        headers: { 'Content-Type': 'application/json' }
                    })
                )
                global.fetch = mockFetch

                await listModels()

                expect(mockFetch).toHaveBeenCalledWith(
                    `${API_BASE}/v1/models`,
                    expect.anything()
                )
            })

            it('should support filters', async () => {
                const mockFetch = vi.fn(async () =>
                    new Response(JSON.stringify({ data: [] }), {
                        status: 200,
                        headers: { 'Content-Type': 'application/json' }
                    })
                )
                global.fetch = mockFetch

                await listModels({ provider: 'openai', enabled: true })

                expect((mockFetch as any).mock.calls[0][0]).toContain('provider=openai')
                expect((mockFetch as any).mock.calls[0][0]).toContain('enabled=true')
            })
        })

        describe('getModel', () => {
            it('should call /v1/models/:id', async () => {
                const mockFetch = vi.fn(async () =>
                    new Response(JSON.stringify({ id: 'gpt-4' }), {
                        status: 200,
                        headers: { 'Content-Type': 'application/json' }
                    })
                )
                global.fetch = mockFetch

                await getModel('gpt-4')

                expect(mockFetch).toHaveBeenCalledWith(
                    `${API_BASE}/v1/models/gpt-4`,
                    expect.anything()
                )
            })
        })

        describe('createModel', () => {
            it('should call /v1/models with POST', async () => {
                const mockFetch = vi.fn(async () =>
                    new Response(JSON.stringify({ id: 'new-model' }), {
                        status: 201,
                        headers: { 'Content-Type': 'application/json' }
                    })
                )
                global.fetch = mockFetch

                await createModel({
                    id: 'new-model',
                    provider: 'openai',
                    tier: 1,
                    capabilities: {},
                    enabled: true,
                    supportsStreaming: true,
                    supportsFunctions: true,
                    supportsVision: false,
                    priority: 1,
                    status: 'active'
                })

                expect(mockFetch).toHaveBeenCalledWith(
                    `${API_BASE}/v1/models`,
                    expect.objectContaining({
                        method: 'POST'
                    })
                )
            })
        })

        describe('deleteModel', () => {
            it('should call /v1/models/:id with DELETE', async () => {
                const mockFetch = vi.fn(async () =>
                    new Response(JSON.stringify({ message: 'Deleted' }), {
                        status: 200,
                        headers: { 'Content-Type': 'application/json' }
                    })
                )
                global.fetch = mockFetch

                await deleteModel('model-123')

                expect(mockFetch).toHaveBeenCalledWith(
                    `${API_BASE}/v1/models/model-123`,
                    expect.objectContaining({
                        method: 'DELETE'
                    })
                )
            })
        })

        describe('updateModelPriority', () => {
            it('should call /v1/models/:id/priority with PATCH', async () => {
                const mockFetch = vi.fn(async () =>
                    new Response(JSON.stringify({ message: 'Updated' }), {
                        status: 200,
                        headers: { 'Content-Type': 'application/json' }
                    })
                )
                global.fetch = mockFetch

                await updateModelPriority('model-123', 5)

                expect(mockFetch).toHaveBeenCalledWith(
                    `${API_BASE}/v1/models/model-123/priority`,
                    expect.objectContaining({
                        method: 'PATCH'
                    })
                )
            })
        })

        describe('updateModelConfig', () => {
            it('should call /v1/models/:id with PATCH', async () => {
                const mockFetch = vi.fn(async () =>
                    new Response(JSON.stringify({ message: 'Updated' }), {
                        status: 200,
                        headers: { 'Content-Type': 'application/json' }
                    })
                )
                global.fetch = mockFetch

                await updateModelConfig('model-123', { enabled: false })

                expect(mockFetch).toHaveBeenCalledWith(
                    `${API_BASE}/v1/models/model-123`,
                    expect.objectContaining({
                        method: 'PATCH'
                    })
                )
            })
        })

        describe('getModelPerformance', () => {
            it('should call /v1/models/:id/performance', async () => {
                const mockFetch = vi.fn(async () =>
                    new Response(JSON.stringify({ data: [] }), {
                        status: 200,
                        headers: { 'Content-Type': 'application/json' }
                    })
                )
                global.fetch = mockFetch

                await getModelPerformance('model-123', 14)

                expect(mockFetch).toHaveBeenCalledWith(
                    `${API_BASE}/v1/models/model-123/performance?days=14`,
                    expect.anything()
                )
            })
        })

        describe('getModelHistory', () => {
            it('should call /v1/models/:id/history', async () => {
                const mockFetch = vi.fn(async () =>
                    new Response(JSON.stringify({ data: [] }), {
                        status: 200,
                        headers: { 'Content-Type': 'application/json' }
                    })
                )
                global.fetch = mockFetch

                await getModelHistory('model-123', 60)

                expect(mockFetch).toHaveBeenCalledWith(
                    `${API_BASE}/v1/models/model-123/history?days=60`,
                    expect.anything()
                )
            })
        })
    })

    // =========================================================================
    // PROVIDERS ENDPOINTS
    // =========================================================================

    describe('Providers Endpoints', () => {
        describe('listProviders', () => {
            it('should call /v1/providers', async () => {
                const mockFetch = vi.fn(async () =>
                    new Response(JSON.stringify({ data: [] }), {
                        status: 200,
                        headers: { 'Content-Type': 'application/json' }
                    })
                )
                global.fetch = mockFetch

                await listProviders()

                expect(mockFetch).toHaveBeenCalledWith(
                    `${API_BASE}/v1/providers`,
                    expect.anything()
                )
            })
        })

        describe('createProvider', () => {
            it('should call /v1/providers with POST', async () => {
                const mockFetch = vi.fn(async () =>
                    new Response(JSON.stringify({ id: 'new-provider' }), {
                        status: 201,
                        headers: { 'Content-Type': 'application/json' }
                    })
                )
                global.fetch = mockFetch

                await createProvider({ id: 'new-provider', name: 'New Provider' })

                expect(mockFetch).toHaveBeenCalledWith(
                    `${API_BASE}/v1/providers`,
                    expect.objectContaining({
                        method: 'POST'
                    })
                )
            })
        })

        describe('deleteProvider', () => {
            it('should call /v1/providers/:id with DELETE', async () => {
                const mockFetch = vi.fn(async () =>
                    new Response(JSON.stringify({ message: 'Deleted' }), {
                        status: 200,
                        headers: { 'Content-Type': 'application/json' }
                    })
                )
                global.fetch = mockFetch

                await deleteProvider('provider-123')

                expect(mockFetch).toHaveBeenCalledWith(
                    `${API_BASE}/v1/providers/provider-123`,
                    expect.objectContaining({
                        method: 'DELETE'
                    })
                )
            })
        })

        describe('updateProvider', () => {
            it('should call /v1/providers/:id with PATCH', async () => {
                const mockFetch = vi.fn(async () =>
                    new Response(JSON.stringify({ message: 'Updated' }), {
                        status: 200,
                        headers: { 'Content-Type': 'application/json' }
                    })
                )
                global.fetch = mockFetch

                await updateProvider('provider-123', { name: 'Updated Name' })

                expect(mockFetch).toHaveBeenCalledWith(
                    `${API_BASE}/v1/providers/provider-123`,
                    expect.objectContaining({
                        method: 'PATCH'
                    })
                )
            })
        })

        describe('getProviderHistory', () => {
            it('should call /v1/providers/:id/history', async () => {
                const mockFetch = vi.fn(async () =>
                    new Response(JSON.stringify({ data: [] }), {
                        status: 200,
                        headers: { 'Content-Type': 'application/json' }
                    })
                )
                global.fetch = mockFetch

                await getProviderHistory('provider-123', 90)

                expect(mockFetch).toHaveBeenCalledWith(
                    `${API_BASE}/v1/providers/provider-123/history?days=90`,
                    expect.anything()
                )
            })
        })

        describe('listUsageLogs', () => {
            it('should call /v1/usage/logs', async () => {
                const mockFetch = vi.fn(async () =>
                    new Response(JSON.stringify({ data: [] }), {
                        status: 200,
                        headers: { 'Content-Type': 'application/json' }
                    })
                )
                global.fetch = mockFetch

                await listUsageLogs(50)

                expect(mockFetch).toHaveBeenCalledWith(
                    `${API_BASE}/v1/usage/logs?limit=50`,
                    expect.anything()
                )
            })
        })

        describe('checkProviderHealth', () => {
            it('should call /v1/providers/:id/health', async () => {
                const mockFetch = vi.fn(async () =>
                    new Response(JSON.stringify({ status: 'healthy', latencyMs: 100 }), {
                        status: 200,
                        headers: { 'Content-Type': 'application/json' }
                    })
                )
                global.fetch = mockFetch

                await checkProviderHealth('provider-123')

                expect(mockFetch).toHaveBeenCalledWith(
                    `${API_BASE}/v1/providers/provider-123/health`,
                    expect.anything()
                )
            })
        })
    })

    // =========================================================================
    // OPENROUTER ENDPOINTS
    // =========================================================================

    describe('OpenRouter Endpoints', () => {
        describe('listOpenRouterRemoteModels', () => {
            it('should call /v1/providers/openrouter/remote-models', async () => {
                const mockFetch = vi.fn(async () =>
                    new Response(JSON.stringify({ data: [] }), {
                        status: 200,
                        headers: { 'Content-Type': 'application/json' }
                    })
                )
                global.fetch = mockFetch

                await listOpenRouterRemoteModels('gpt', 1, 10)

                expect((mockFetch as any).mock.calls[0][0]).toContain(`${API_BASE}/v1/providers/openrouter/remote-models`)
                expect((mockFetch as any).mock.calls[0][0]).toContain('search=gpt')
            })
        })

        describe('importOpenRouterModel', () => {
            it('should call /v1/providers/openrouter/models/import with POST', async () => {
                const mockFetch = vi.fn(async () =>
                    new Response(JSON.stringify({ id: 'imported-model' }), {
                        status: 200,
                        headers: { 'Content-Type': 'application/json' }
                    })
                )
                global.fetch = mockFetch

                await importOpenRouterModel('gpt-4', 1)

                expect(mockFetch).toHaveBeenCalledWith(
                    `${API_BASE}/v1/providers/openrouter/models/import`,
                    expect.objectContaining({
                        method: 'POST'
                    })
                )
            })
        })

        describe('getOpenRouterAccountActivity', () => {
            it('should call /v1/providers/openrouter/account', async () => {
                const mockFetch = vi.fn(async () =>
                    new Response(JSON.stringify({}), {
                        status: 200,
                        headers: { 'Content-Type': 'application/json' }
                    })
                )
                global.fetch = mockFetch

                await getOpenRouterAccountActivity()

                expect(mockFetch).toHaveBeenCalledWith(
                    `${API_BASE}/v1/providers/openrouter/account`,
                    expect.anything()
                )
            })
        })

        describe('getOpenRouterCredits', () => {
            it('should call /v1/providers/openrouter/credits', async () => {
                const mockFetch = vi.fn(async () =>
                    new Response(JSON.stringify({}), {
                        status: 200,
                        headers: { 'Content-Type': 'application/json' }
                    })
                )
                global.fetch = mockFetch

                await getOpenRouterCredits()

                expect(mockFetch).toHaveBeenCalledWith(
                    `${API_BASE}/v1/providers/openrouter/credits`,
                    expect.anything()
                )
            })
        })
    })

    // =========================================================================
    // ORCHESTRATION ENDPOINTS
    // =========================================================================

    describe('Orchestration Endpoints', () => {
        describe('listOrchestrationRules', () => {
            it('should call /v1/orchestration/rules', async () => {
                const mockFetch = vi.fn(async () =>
                    new Response(JSON.stringify({ data: [] }), {
                        status: 200,
                        headers: { 'Content-Type': 'application/json' }
                    })
                )
                global.fetch = mockFetch

                await listOrchestrationRules(true)

                expect(mockFetch).toHaveBeenCalledWith(
                    `${API_BASE}/v1/orchestration/rules?enabledOnly=true`,
                    expect.anything()
                )
            })
        })

        describe('createOrchestrationRule', () => {
            it('should call /v1/orchestration/rules with POST', async () => {
                const mockFetch = vi.fn(async () =>
                    new Response(JSON.stringify({ id: 'rule-123' }), {
                        status: 201,
                        headers: { 'Content-Type': 'application/json' }
                    })
                )
                global.fetch = mockFetch

                await createOrchestrationRule({
                    name: 'Test Rule',
                    strategy: 'fallback',
                    modelSequence: ['model-1', 'model-2']
                })

                expect(mockFetch).toHaveBeenCalledWith(
                    `${API_BASE}/v1/orchestration/rules`,
                    expect.objectContaining({
                        method: 'POST'
                    })
                )
            })
        })

        describe('updateOrchestrationRule', () => {
            it('should call /v1/orchestration/rules/:id with PATCH', async () => {
                const mockFetch = vi.fn(async () =>
                    new Response(JSON.stringify({ message: 'Updated' }), {
                        status: 200,
                        headers: { 'Content-Type': 'application/json' }
                    })
                )
                global.fetch = mockFetch

                await updateOrchestrationRule('rule-123', { enabled: false })

                expect(mockFetch).toHaveBeenCalledWith(
                    `${API_BASE}/v1/orchestration/rules/rule-123`,
                    expect.objectContaining({
                        method: 'PATCH'
                    })
                )
            })
        })

        describe('deleteOrchestrationRule', () => {
            it('should call /v1/orchestration/rules/:id with DELETE', async () => {
                const mockFetch = vi.fn(async () =>
                    new Response(JSON.stringify({ message: 'Deleted' }), {
                        status: 200,
                        headers: { 'Content-Type': 'application/json' }
                    })
                )
                global.fetch = mockFetch

                await deleteOrchestrationRule('rule-123')

                expect(mockFetch).toHaveBeenCalledWith(
                    `${API_BASE}/v1/orchestration/rules/rule-123`,
                    expect.objectContaining({
                        method: 'DELETE'
                    })
                )
            })
        })
    })

    // =========================================================================
    // URL FORMAT VALIDATION
    // =========================================================================

    describe('URL Format Validation', () => {
        it('all chat endpoints should use /v1 prefix', async () => {
            const mockFetch = vi.fn(async () =>
                new Response(JSON.stringify({ data: [], message: 'ok' }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' }
                })
            )
            global.fetch = mockFetch

            // Chat
            await sendChatMessage({ message: 'test' })
            expect((mockFetch as any).mock.calls[0][0]).toBe(`${API_BASE}/v1/chat/messages`)

            mockFetch.mockClear()
            await chatCompletion([{ role: 'user', content: 'test' }])
            expect((mockFetch as any).mock.calls[0][0]).toBe(`${API_BASE}/v1/chat/completions`)

            // Stats
            mockFetch.mockClear()
            await getConversationStats('conv-1')
            expect((mockFetch as any).mock.calls[0][0]).toBe(`${API_BASE}/v1/stats/chat/conversations/conv-1`)

            mockFetch.mockClear()
            await getUserStats()
            expect((mockFetch as any).mock.calls[0][0]).toBe(`${API_BASE}/v1/stats/chat/user`)

            mockFetch.mockClear()
            await getDailySummary()
            expect((mockFetch as any).mock.calls[0][0]).toBe(`${API_BASE}/v1/stats/chat/daily`)

            // Models
            mockFetch.mockClear()
            await listModels()
            expect((mockFetch as any).mock.calls[0][0]).toBe(`${API_BASE}/v1/models`)

            mockFetch.mockClear()
            await getModel('test-model')
            expect((mockFetch as any).mock.calls[0][0]).toBe(`${API_BASE}/v1/models/test-model`)

            // Providers
            mockFetch.mockClear()
            await listProviders()
            expect((mockFetch as any).mock.calls[0][0]).toBe(`${API_BASE}/v1/providers`)

            // Orchestration
            mockFetch.mockClear()
            await listOrchestrationRules()
            expect((mockFetch as any).mock.calls[0][0]).toContain(`${API_BASE}/v1/orchestration/rules`)
        })
    })
})
