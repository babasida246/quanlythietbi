import { API_BASE, apiJson, apiJsonCached, apiJsonData, apiJsonDataCached, requireAccessToken } from './httpClient'

const ensureAuth = (): void => {
    requireAccessToken()
}

const authJson = <T>(input: string, init: RequestInit = {}) => {
    ensureAuth()
    const headers = new Headers(init.headers || {})
    if (init.body && !headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json')
    }
    return apiJson<T>(input, { ...init, headers })
}

const authJsonCached = <T>(input: string, init: RequestInit = {}, ttlMs = 5000) => {
    ensureAuth()
    const headers = new Headers(init.headers || {})
    if (init.body && !headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json')
    }
    return apiJsonCached<T>(input, { ...init, headers }, { ttlMs, errorTtlMs: 2000 })
}

const authJsonData = <T>(input: string, init: RequestInit = {}) => {
    ensureAuth()
    const headers = new Headers(init.headers || {})
    if (init.body && !headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json')
    }
    return apiJsonData<T>(input, { ...init, headers })
}

const authJsonDataCached = <T>(input: string, init: RequestInit = {}, ttlMs = 5000) => {
    ensureAuth()
    const headers = new Headers(init.headers || {})
    if (init.body && !headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json')
    }
    return apiJsonDataCached<T>(input, { ...init, headers }, { ttlMs, errorTtlMs: 2000 })
}

// ============================================================================
// TYPES
// ============================================================================

export interface ChatMessage {
    role: 'system' | 'user' | 'assistant'
    content: string
}

export interface ChatSendRequest {
    message: string
    conversationId?: string
    model?: string
    temperature?: number
    maxTokens?: number
    systemPrompt?: string
}

export interface ChatSendResponse {
    message: string
    conversationId: string
    model: string
    provider: string
    usage: {
        promptTokens: number
        completionTokens: number
        totalTokens: number
        estimatedCost: number
    }
    latencyMs: number
}

export interface TokenUsageStats {
    conversationId: string
    model: string
    provider: string
    promptTokens: number
    completionTokens: number
    totalTokens: number
    cost: number
    messageCount: number
    date: string
}

export interface UserTokenStats {
    userId: string
    date: string
    model: string
    provider: string
    totalTokens: number
    totalCost: number
    messageCount: number
    conversationCount: number
}

export interface DailySummary {
    totalTokens: number
    totalCost: number
    totalMessages: number
    modelsUsed: number
}

export interface ModelConfig {
    id: string
    displayName?: string
    provider: string
    tier: number
    contextWindow?: number
    maxTokens?: number
    costPer1kInput?: number
    costPer1kOutput?: number
    capabilities: Record<string, any>
    enabled: boolean
    supportsStreaming: boolean
    supportsFunctions: boolean
    supportsVision: boolean
    description?: string
    priority: number
    status: 'active' | 'inactive' | 'deprecated'
    createdAt: string
}

export interface AIProvider {
    id: string
    name: string
    description?: string
    apiEndpoint?: string
    apiKey?: string
    authType?: string
    capabilities: Record<string, any>
    status: 'active' | 'inactive' | 'maintenance'
    rateLimitPerMinute?: number
    creditsRemaining?: number
    tokensUsed?: number
    lastUsageAt?: string
    metadata?: Record<string, any>
    createdAt: string
    updatedAt: string
}

export interface OrchestrationRule {
    id: string
    name: string
    description?: string
    strategy: 'fallback' | 'load_balance' | 'cost_optimize' | 'quality_first' | 'custom'
    modelSequence: string[]
    conditions: Record<string, any>
    enabled: boolean
    priority: number
    metadata?: Record<string, any>
    createdAt: string
    updatedAt: string
}

export interface ModelPerformance {
    model: string
    provider: string
    date: string
    totalRequests: number
    successfulRequests: number
    failedRequests: number
    avgLatencyMs: number
    avgTokensPerRequest: number
    totalCost: number
    qualityScore?: number
}

export interface UsageHistoryEntry {
    date: string
    totalTokens: number
    totalCost: number
    creditsUsed?: number
    messageCount?: number
}

export interface UsageLogEntry {
    conversationId: string
    model: string
    provider: string
    totalTokens: number
    cost: number
    messageCount: number
    date: string
}

export interface ProviderHealth {
    status: 'healthy' | 'degraded' | 'unreachable'
    statusCode: number
    latencyMs: number | null
    message?: string
}

export interface RemoteOpenRouterModel {
    id: string
    name: string
    description?: string
    pricing?: Record<string, any>
    contextLength?: number
    provider: string
}

// ============================================================================
// CHAT API
// ============================================================================

export async function sendChatMessage(data: ChatSendRequest): Promise<ChatSendResponse> {
    return authJsonData(`${API_BASE}/v1/chat/messages`, {
        method: 'POST',
        body: JSON.stringify(data)
    })
}

export async function chatCompletion(
    messages: ChatMessage[],
    options?: {
        model?: string
        temperature?: number
        maxTokens?: number
        conversationId?: string
    }
): Promise<any> {
    return authJsonData(`${API_BASE}/v1/chat/completions`, {
        method: 'POST',
        body: JSON.stringify({
            messages,
            model: options?.model || 'openai/gpt-4o-mini',
            temperature: options?.temperature ?? 0.7,
            maxTokens: options?.maxTokens,
            conversationId: options?.conversationId
        })
    })
}

// ============================================================================
// STATS API
// ============================================================================

export async function getConversationStats(conversationId: string): Promise<{ data: TokenUsageStats[] }> {
    return authJson(`${API_BASE}/v1/stats/chat/conversations/${conversationId}`)
}

export async function getUserStats(filters?: {
    startDate?: string
    endDate?: string
}): Promise<{ data: UserTokenStats[] }> {
    const params = new URLSearchParams()
    if (filters?.startDate) params.append('startDate', filters.startDate)
    if (filters?.endDate) params.append('endDate', filters.endDate)

    const query = params.toString()
    return authJson(`${API_BASE}/v1/stats/chat/user${query ? '?' + query : ''}`)
}

export async function getDailySummary(): Promise<DailySummary> {
    return authJsonDataCached(`${API_BASE}/v1/stats/chat/daily`, {}, 5000)
}

// ============================================================================
// MODELS API
// ============================================================================

export async function listModels(filters?: {
    provider?: string
    tier?: number
    enabled?: boolean
}): Promise<{ data: ModelConfig[] }> {
    const params = new URLSearchParams()
    if (filters?.provider) params.append('provider', filters.provider)
    if (filters?.tier !== undefined) params.append('tier', filters.tier.toString())
    if (filters?.enabled !== undefined) params.append('enabled', filters.enabled.toString())

    const query = params.toString()
    return authJsonCached(`${API_BASE}/v1/models${query ? '?' + query : ''}`, {}, 5000)
}

export async function getModel(modelId: string): Promise<ModelConfig> {
    const id = encodeURIComponent(modelId)
    return authJsonData(`${API_BASE}/v1/models/${id}`)
}

export async function createModel(
    data: Omit<ModelConfig, 'createdAt'> & { provider: string }
): Promise<ModelConfig> {
    return authJsonData(`${API_BASE}/v1/models`, {
        method: 'POST',
        body: JSON.stringify(data)
    })
}

export async function deleteModel(modelId: string): Promise<{ message: string }> {
    const id = encodeURIComponent(modelId)
    return authJsonData(`${API_BASE}/v1/models/${id}`, { method: 'DELETE' })
}

export async function updateModelPriority(modelId: string, priority: number): Promise<{ message: string }> {
    const id = encodeURIComponent(modelId)
    return authJsonData(`${API_BASE}/v1/models/${id}/priority`, {
        method: 'PATCH',
        body: JSON.stringify({ priority })
    })
}

export async function updateModelConfig(
    modelId: string,
    data: Partial<Omit<ModelConfig, 'id' | 'createdAt' | 'provider'>>
): Promise<{ message: string }> {
    const id = encodeURIComponent(modelId)
    return authJsonData(`${API_BASE}/v1/models/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data)
    })
}

export async function getModelPerformance(modelId: string, days = 7): Promise<{ data: ModelPerformance[] }> {
    const id = encodeURIComponent(modelId)
    return authJson(`${API_BASE}/v1/models/${id}/performance?days=${days}`)
}

export async function getModelHistory(modelId: string, days = 30): Promise<{ data: UsageHistoryEntry[] }> {
    const id = encodeURIComponent(modelId)
    return authJson(`${API_BASE}/v1/models/${id}/history?days=${days}`)
}

// ============================================================================
// PROVIDERS API
// ============================================================================

export async function listProviders(): Promise<{ data: AIProvider[] }> {
    return authJsonCached(`${API_BASE}/v1/providers`, {}, 5000)
}

export async function createProvider(
    data: Pick<AIProvider, 'id' | 'name'> & Partial<Omit<AIProvider, 'id' | 'name' | 'createdAt' | 'updatedAt'>>
): Promise<AIProvider> {
    return authJsonData(`${API_BASE}/v1/providers`, {
        method: 'POST',
        body: JSON.stringify(data)
    })
}

export async function deleteProvider(providerId: string): Promise<{ message: string }> {
    return authJsonData(`${API_BASE}/v1/providers/${providerId}`, { method: 'DELETE' })
}

export async function updateProvider(
    providerId: string,
    data: Partial<Omit<AIProvider, 'id' | 'createdAt' | 'updatedAt' | 'metadata'>> & { metadata?: Record<string, any> }
): Promise<{ message: string }> {
    return authJsonData(`${API_BASE}/v1/providers/${providerId}`, {
        method: 'PATCH',
        body: JSON.stringify(data)
    })
}

export async function getProviderHistory(providerId: string, days = 30): Promise<{ data: UsageHistoryEntry[] }> {
    return authJson(`${API_BASE}/v1/providers/${providerId}/history?days=${days}`)
}

export async function listUsageLogs(limit = 100): Promise<{ data: UsageLogEntry[] }> {
    return authJson(`${API_BASE}/v1/usage/logs?limit=${limit}`)
}

export async function checkProviderHealth(providerId: string): Promise<ProviderHealth> {
    return authJsonData(`${API_BASE}/v1/providers/${providerId}/health`)
}

export async function listOpenRouterRemoteModels(search?: string, page?: number, limit?: number): Promise<{ data: RemoteOpenRouterModel[]; meta?: any }> {
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    if (page) params.set('page', page.toString())
    if (limit) params.set('limit', limit.toString())
    const query = params.toString()
    return authJson(`${API_BASE}/v1/providers/openrouter/remote-models${query ? `?${query}` : ''}`)
}

export async function importOpenRouterModel(modelId: string, priority?: number): Promise<ModelConfig> {
    return authJsonData(`${API_BASE}/v1/providers/openrouter/models/import`, {
        method: 'POST',
        body: JSON.stringify({ modelId, priority })
    })
}

export async function getOpenRouterAccountActivity(): Promise<any> {
    return authJsonData(`${API_BASE}/v1/providers/openrouter/account`)
}

export async function getOpenRouterCredits(): Promise<any> {
    return authJsonData(`${API_BASE}/v1/providers/openrouter/credits`)
}

// ============================================================================
// ORCHESTRATION API
// ============================================================================

export async function listOrchestrationRules(enabledOnly = false): Promise<{ data: OrchestrationRule[] }> {
    return authJson(`${API_BASE}/v1/orchestration/rules?enabledOnly=${enabledOnly}`)
}

export async function createOrchestrationRule(data: {
    name: string
    description?: string
    strategy: OrchestrationRule['strategy']
    modelSequence: string[]
    conditions?: Record<string, any>
    enabled?: boolean
    priority?: number
}): Promise<OrchestrationRule> {
    return authJsonData(`${API_BASE}/v1/orchestration/rules`, {
        method: 'POST',
        body: JSON.stringify(data)
    })
}

export async function updateOrchestrationRule(
    ruleId: string,
    data: Partial<Omit<OrchestrationRule, 'id' | 'createdAt' | 'updatedAt'>>
): Promise<{ message: string }> {
    return authJsonData(`${API_BASE}/v1/orchestration/rules/${ruleId}`, {
        method: 'PATCH',
        body: JSON.stringify(data)
    })
}

export async function deleteOrchestrationRule(ruleId: string): Promise<{ message: string }> {
    return authJsonData(`${API_BASE}/v1/orchestration/rules/${ruleId}`, {
        method: 'DELETE'
    })
}
