/**
 * Analytics Service
 * Provides analytics, cost tracking, and performance metrics
 */

// --- Interfaces (decoupled from infra) ---
export interface CostRecord {
    id: string
    assetId: string
    costType: string
    amount: number
    currency: string
    description: string | null
    recordedDate: Date
    recordedBy: string | null
    createdAt: Date
}

export interface PerformanceMetric {
    id: string
    assetId: string
    metricType: string
    metricValue: number
    unit: string | null
    metadata: Record<string, unknown>
    recordedAt: Date
}

export interface IAnalyticsRepo {
    createSnapshot(): Promise<unknown>
    getLatestSnapshot(): Promise<unknown>
    getSnapshotHistory(days: number): Promise<unknown[]>
    getSummaryStats(): Promise<unknown>
}

export interface ICostRecordRepo {
    create(input: Omit<CostRecord, 'id' | 'createdAt'>): Promise<CostRecord>
    listByAsset(assetId: string): Promise<CostRecord[]>
    getTotalCostByAsset(assetId: string): Promise<unknown>
    getCostSummary(filters: { startDate?: string; endDate?: string }): Promise<Array<{ costType: string; total: number }>>
}

export interface IPerformanceMetricRepo {
    record(input: Omit<PerformanceMetric, 'id' | 'recordedAt'>): Promise<PerformanceMetric>
    getLatestByAsset(assetId: string): Promise<PerformanceMetric[]>
    getHistory(assetId: string, metricType: string, hours: number): Promise<PerformanceMetric[]>
}

export interface IDashboardConfigRepo {
    getByUser(userId: string): Promise<unknown>
    upsert(userId: string, config: Record<string, unknown>): Promise<unknown>
}

export class AnalyticsService {
    constructor(
        private analytics: IAnalyticsRepo,
        private costs: ICostRecordRepo,
        private metrics: IPerformanceMetricRepo,
        private dashboards: IDashboardConfigRepo
    ) { }

    // --- Snapshots ---
    async createSnapshot() { return this.analytics.createSnapshot() }
    async getLatestSnapshot() { return this.analytics.getLatestSnapshot() }
    async getSnapshotHistory(days = 30) { return this.analytics.getSnapshotHistory(days) }
    async getSummaryStats() { return this.analytics.getSummaryStats() }

    // --- Costs ---
    async recordCost(input: Omit<CostRecord, 'id' | 'createdAt'>) { return this.costs.create(input) }
    async getAssetCosts(assetId: string) { return this.costs.listByAsset(assetId) }
    async getAssetCostSummary(assetId: string) { return this.costs.getTotalCostByAsset(assetId) }
    async getCostOverview(filters: { startDate?: string; endDate?: string }) { return this.costs.getCostSummary(filters) }

    // --- Performance Metrics ---
    async recordMetric(input: Omit<PerformanceMetric, 'id' | 'recordedAt'>) { return this.metrics.record(input) }
    async getAssetMetrics(assetId: string) { return this.metrics.getLatestByAsset(assetId) }
    async getMetricHistory(assetId: string, metricType: string, hours = 24) { return this.metrics.getHistory(assetId, metricType, hours) }

    // --- Dashboard ---
    async getDashboard(userId: string) { return this.dashboards.getByUser(userId) }
    async saveDashboard(userId: string, config: Record<string, unknown>) { return this.dashboards.upsert(userId, config) }

    // --- AI-Powered Insights (Feature 7) ---
    async getPredictiveInsights(assetId: string): Promise<Record<string, unknown>> {
        const costHistory = await this.costs.listByAsset(assetId)
        const latestMetrics = await this.metrics.getLatestByAsset(assetId)

        const totalCost = costHistory.reduce((sum, c) => sum + c.amount, 0)
        const maintenanceCost = costHistory.filter(c => c.costType === 'maintenance' || c.costType === 'repair').reduce((sum, c) => sum + c.amount, 0)

        const uptimeMetric = latestMetrics.find(m => m.metricType === 'uptime')
        const utilizationMetric = latestMetrics.find(m => m.metricType === 'utilization')

        // Simple predictive calculations
        const avgMonthlyCost = costHistory.length > 0
            ? totalCost / Math.max(1, Math.ceil((Date.now() - costHistory[costHistory.length - 1].createdAt.getTime()) / (30 * 24 * 60 * 60 * 1000)))
            : 0

        const maintenanceRatio = totalCost > 0 ? maintenanceCost / totalCost : 0

        return {
            totalCost,
            maintenanceCost,
            avgMonthlyCost,
            maintenanceRatio,
            healthScore: this.calculateHealthScore(uptimeMetric?.metricValue, utilizationMetric?.metricValue, maintenanceRatio),
            predictions: {
                nextMaintenanceEstimate: maintenanceRatio > 0.3 ? 'within_30_days' : 'within_90_days',
                costTrend: avgMonthlyCost > 0 ? (maintenanceRatio > 0.4 ? 'increasing' : 'stable') : 'insufficient_data',
                recommendation: this.generateRecommendation(maintenanceRatio, uptimeMetric?.metricValue)
            }
        }
    }

    async getAnomalies(): Promise<Record<string, unknown>[]> {
        // Detect cost anomalies: recent costs significantly higher than average
        const recentCosts = await this.costs.getCostSummary({ startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] })
        const allCosts = await this.costs.getCostSummary({})
        const anomalies: Record<string, unknown>[] = []

        for (const recent of recentCosts) {
            const baseline = allCosts.find(a => a.costType === recent.costType)
            if (baseline && recent.total > baseline.total * 0.5) {
                anomalies.push({
                    type: 'cost_spike',
                    costType: recent.costType,
                    recentTotal: recent.total,
                    baselineTotal: baseline.total,
                    severity: recent.total > baseline.total * 0.8 ? 'high' : 'medium'
                })
            }
        }
        return anomalies
    }

    private calculateHealthScore(uptime?: number, utilization?: number, maintenanceRatio?: number): number {
        let score = 100
        if (uptime !== undefined) score -= Math.max(0, (99 - uptime) * 2)
        if (utilization !== undefined && utilization > 90) score -= (utilization - 90) * 2
        if (maintenanceRatio !== undefined && maintenanceRatio > 0.3) score -= maintenanceRatio * 50
        return Math.max(0, Math.min(100, Math.round(score)))
    }

    private generateRecommendation(maintenanceRatio: number, uptime?: number): string {
        if (maintenanceRatio > 0.5) return 'Consider replacement - maintenance costs exceed 50% of total cost'
        if (maintenanceRatio > 0.3) return 'Schedule preventive maintenance to reduce repair frequency'
        if (uptime !== undefined && uptime < 95) return 'Investigate recurring downtime issues'
        return 'Asset performing within normal parameters'
    }
}
