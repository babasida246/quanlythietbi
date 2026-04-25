/**
 * Integration Hub API Client
 * Connectors, sync rules, webhooks, sync logs
 */
import { API_BASE, apiJson, authorizedFetch } from './httpClient'
import { getAssetHeaders } from './assets'

type ApiResponse<T> = { data: T; meta?: Record<string, unknown> }

export type IntegrationConnector = {
    id: string
    name: string
    provider: string
    config: Record<string, unknown>
    credentialsRef: string | null
    isActive: boolean
    lastSyncAt: string | null
    healthStatus: string
    lastHealthCheck: string | null
    createdBy: string
    createdAt: string
    updatedAt: string
}

export type SyncRule = {
    id: string
    connectorId: string
    name: string
    direction: 'inbound' | 'outbound' | 'bidirectional'
    entityType: string
    fieldMappings: unknown[]
    filterConditions: Record<string, unknown>
    scheduleCron: string | null
    isActive: boolean
    lastSyncAt: string | null
    lastSyncStatus: string | null
    lastSyncCount: number
    createdAt: string
}

export type SyncLog = {
    id: string
    syncRuleId: string
    direction: string
    recordsProcessed: number
    recordsCreated: number
    recordsUpdated: number
    recordsFailed: number
    errors: string[]
    startedAt: string
    completedAt: string | null
    status: string
}

export type Webhook = {
    id: string
    connectorId: string | null
    name: string
    url: string
    secret: string | null
    events: string[]
    isActive: boolean
    createdAt: string
}

export type ConnectionTestResult = {
    healthy: boolean
    message: string
    version?: string
    hostCount?: number
}

export type SyncTriggerResult = {
    synced: number
    created: number
    updated: number
    failed: number
    errors: string[]
    durationMs: number
}

// ── Connectors ─────────────────────────────────────────────────────────────────

export async function listConnectors(): Promise<ApiResponse<IntegrationConnector[]>> {
    return apiJson(`${API_BASE}/v1/integrations/connectors`, { headers: getAssetHeaders() })
}

export async function getConnector(id: string): Promise<ApiResponse<IntegrationConnector>> {
    return apiJson(`${API_BASE}/v1/integrations/connectors/${id}`, { headers: getAssetHeaders() })
}

export async function createConnector(input: Partial<IntegrationConnector>): Promise<ApiResponse<IntegrationConnector>> {
    return apiJson(`${API_BASE}/v1/integrations/connectors`, {
        method: 'POST',
        headers: { ...getAssetHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(input)
    })
}

export async function updateConnector(id: string, patch: Partial<IntegrationConnector>): Promise<ApiResponse<IntegrationConnector>> {
    return apiJson(`${API_BASE}/v1/integrations/connectors/${id}`, {
        method: 'PUT',
        headers: { ...getAssetHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(patch)
    })
}

export async function deleteConnector(id: string): Promise<void> {
    await authorizedFetch(`${API_BASE}/v1/integrations/connectors/${id}`, {
        method: 'DELETE',
        headers: getAssetHeaders()
    })
}

export async function testConnection(id: string): Promise<ApiResponse<ConnectionTestResult>> {
    return apiJson(`${API_BASE}/v1/integrations/connectors/${id}/test`, {
        method: 'POST',
        headers: getAssetHeaders()
    })
}

export async function syncNow(id: string, syncRuleId?: string): Promise<ApiResponse<SyncTriggerResult>> {
    return apiJson(`${API_BASE}/v1/integrations/connectors/${id}/sync`, {
        method: 'POST',
        headers: { ...getAssetHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(syncRuleId ? { syncRuleId } : {})
    })
}

// ── Sync Rules ─────────────────────────────────────────────────────────────────

export async function listSyncRules(connectorId: string): Promise<ApiResponse<SyncRule[]>> {
    return apiJson(`${API_BASE}/v1/integrations/connectors/${connectorId}/sync-rules`, { headers: getAssetHeaders() })
}

export async function createSyncRule(connectorId: string, input: Partial<SyncRule>): Promise<ApiResponse<SyncRule>> {
    return apiJson(`${API_BASE}/v1/integrations/connectors/${connectorId}/sync-rules`, {
        method: 'POST',
        headers: { ...getAssetHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(input)
    })
}

export async function deleteSyncRule(id: string): Promise<void> {
    await authorizedFetch(`${API_BASE}/v1/integrations/sync-rules/${id}`, {
        method: 'DELETE',
        headers: getAssetHeaders()
    })
}

export async function listSyncLogs(syncRuleId: string): Promise<ApiResponse<SyncLog[]>> {
    return apiJson(`${API_BASE}/v1/integrations/sync-rules/${syncRuleId}/logs`, { headers: getAssetHeaders() })
}

// ── Webhooks ──────────────────────────────────────────────────────────────────

export async function listWebhooks(): Promise<ApiResponse<Webhook[]>> {
    return apiJson(`${API_BASE}/v1/integrations/webhooks`, { headers: getAssetHeaders() })
}

export async function createWebhook(input: Partial<Webhook>): Promise<ApiResponse<Webhook>> {
    return apiJson(`${API_BASE}/v1/integrations/webhooks`, {
        method: 'POST',
        headers: { ...getAssetHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(input)
    })
}

export async function deleteWebhook(id: string): Promise<void> {
    await authorizedFetch(`${API_BASE}/v1/integrations/webhooks/${id}`, {
        method: 'DELETE',
        headers: getAssetHeaders()
    })
}

// ── Providers ─────────────────────────────────────────────────────────────────

export async function getProviderTypes(): Promise<ApiResponse<string[]>> {
    return apiJson(`${API_BASE}/v1/integrations/providers`, { headers: getAssetHeaders() })
}
