/**
 * Analytics API Client
 * Dashboard, costs, insights, anomalies
 */
import { API_BASE, apiJson } from './httpClient'
import { getAssetHeaders, buildQuery } from './assets'

type ApiResponse<T> = { data: T; meta?: Record<string, unknown> }

export type AnalyticsSummary = {
    totalAssets: number
    activeAssets: number
    inRepairAssets: number
    retiredAssets: number
    totalCost: number
    avgHealthScore: number
}

export type AnalyticsSnapshot = {
    id: string
    snapshotDate: string
    totalAssets: number
    activeAssets: number
    inRepairAssets: number
    retiredAssets: number
    totalCostValue: number
}

export type CostRecord = {
    id: string
    assetId: string
    costType: string
    amount: number
    currency: string
    recordDate: string
    description: string | null
}

export type PredictiveInsight = {
    healthScore: number
    predictedMaintenanceDays: number | null
    costTrend: string
    recommendations: string[]
}

export type Anomaly = {
    type: string
    assetId: string
    description: string
    severity: string
    detectedAt: string
}

export type DashboardConfig = {
    id: string
    userId: string
    layoutConfig: Record<string, unknown>
    widgets: unknown[]
    createdAt: string
    updatedAt: string
}

// Summary
export async function getAnalyticsSummary(): Promise<ApiResponse<AnalyticsSummary>> {
    return apiJson(`${API_BASE}/v1/analytics/summary`, { headers: getAssetHeaders() })
}

// Snapshots
export async function createSnapshot(): Promise<ApiResponse<AnalyticsSnapshot>> {
    return apiJson(`${API_BASE}/v1/analytics/snapshots`, {
        method: 'POST',
        headers: getAssetHeaders()
    })
}

export async function getSnapshotHistory(days = 30): Promise<ApiResponse<AnalyticsSnapshot[]>> {
    return apiJson(`${API_BASE}/v1/analytics/snapshots?days=${days}`, { headers: getAssetHeaders() })
}

// Costs
export async function addCostRecord(input: Partial<CostRecord>): Promise<ApiResponse<CostRecord>> {
    return apiJson(`${API_BASE}/v1/analytics/costs`, {
        method: 'POST',
        headers: { ...getAssetHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(input)
    })
}

export async function getCostRecords(params: { assetId?: string; costType?: string } = {}): Promise<ApiResponse<CostRecord[]>> {
    const query = buildQuery(params)
    return apiJson(`${API_BASE}/v1/analytics/costs${query}`, { headers: getAssetHeaders() })
}

// Insights
export async function getPredictiveInsights(assetId: string): Promise<ApiResponse<PredictiveInsight>> {
    return apiJson(`${API_BASE}/v1/analytics/insights/asset/${assetId}`, { headers: getAssetHeaders() })
}

// Anomalies
export async function getAnomalies(): Promise<ApiResponse<Anomaly[]>> {
    return apiJson(`${API_BASE}/v1/analytics/anomalies`, { headers: getAssetHeaders() })
}

// Dashboard
export async function getDashboardConfig(): Promise<ApiResponse<DashboardConfig | null>> {
    return apiJson(`${API_BASE}/v1/analytics/dashboard`, { headers: getAssetHeaders() })
}

export async function saveDashboardConfig(config: Partial<DashboardConfig>): Promise<ApiResponse<DashboardConfig>> {
    return apiJson(`${API_BASE}/v1/analytics/dashboard`, {
        method: 'PUT',
        headers: { ...getAssetHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
    })
}
