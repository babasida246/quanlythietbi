/**
 * Analytics Repository
 * Manages asset analytics, cost tracking, performance metrics, dashboards
 */
import type { PgClient } from '../PgClient.js'

export interface AnalyticsSnapshot {
    id: string
    snapshotDate: Date
    totalAssets: number
    activeAssets: number
    inRepairAssets: number
    disposedAssets: number
    unassignedAssets: number
    warrantyExpiring30d: number
    warrantyExpired: number
    totalMaintenanceTickets: number
    openTickets: number
    avgRepairHours: number | null
    categoryBreakdown: Record<string, number>
    locationBreakdown: Record<string, number>
    vendorBreakdown: Record<string, number>
    createdAt: Date
}

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
    recordedAt: Date
    metadata: Record<string, unknown>
}

export interface DashboardConfig {
    id: string
    userId: string | null
    name: string
    layout: unknown[]
    widgets: unknown[]
    isDefault: boolean
    createdAt: Date
    updatedAt: Date
}

export class AnalyticsRepo {
    constructor(private pg: PgClient) { }

    async createSnapshot(): Promise<AnalyticsSnapshot> {
        const result = await this.pg.query(`
            INSERT INTO asset_analytics_snapshots (
                snapshot_date, total_assets, active_assets, in_repair_assets,
                disposed_assets, unassigned_assets, warranty_expiring_30d,
                warranty_expired, total_maintenance_tickets, open_tickets,
                avg_repair_hours, category_breakdown, location_breakdown, vendor_breakdown
            )
            SELECT
                CURRENT_DATE,
                COALESCE(COUNT(*), 0),
                COALESCE(COUNT(*) FILTER (WHERE status = 'in_use'), 0),
                COALESCE(COUNT(*) FILTER (WHERE status = 'in_repair'), 0),
                COALESCE(COUNT(*) FILTER (WHERE status = 'disposed'), 0),
                COALESCE(COUNT(*) FILTER (WHERE status = 'in_stock'), 0),
                COALESCE(COUNT(*) FILTER (WHERE warranty_end BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days'), 0),
                COALESCE(COUNT(*) FILTER (WHERE warranty_end < CURRENT_DATE), 0),
                0, 0, NULL, '{}', '{}', '{}'
            FROM assets
            ON CONFLICT (snapshot_date) DO UPDATE SET
                total_assets = EXCLUDED.total_assets,
                active_assets = EXCLUDED.active_assets,
                in_repair_assets = EXCLUDED.in_repair_assets,
                disposed_assets = EXCLUDED.disposed_assets,
                unassigned_assets = EXCLUDED.unassigned_assets,
                warranty_expiring_30d = EXCLUDED.warranty_expiring_30d,
                warranty_expired = EXCLUDED.warranty_expired
            RETURNING *
        `)
        return this.mapSnapshotRow(result.rows[0])
    }

    async getLatestSnapshot(): Promise<AnalyticsSnapshot | null> {
        const result = await this.pg.query(
            `SELECT * FROM asset_analytics_snapshots ORDER BY snapshot_date DESC LIMIT 1`
        )
        return result.rows.length ? this.mapSnapshotRow(result.rows[0]) : null
    }

    async getSnapshotHistory(days = 30): Promise<AnalyticsSnapshot[]> {
        const result = await this.pg.query(
            `SELECT * FROM asset_analytics_snapshots WHERE snapshot_date >= CURRENT_DATE - $1::integer ORDER BY snapshot_date ASC`,
            [days]
        )
        return result.rows.map((r: any) => this.mapSnapshotRow(r))
    }

    async getSummaryStats(): Promise<Record<string, unknown>> {
        const assetStats = await this.pg.query(`
            SELECT
                COUNT(*) AS total_assets,
                COUNT(*) FILTER (WHERE status = 'in_use') AS active_assets,
                COUNT(*) FILTER (WHERE status = 'in_stock') AS available_assets,
                COUNT(*) FILTER (WHERE status = 'in_repair') AS in_repair_assets,
                COUNT(*) FILTER (WHERE status = 'disposed') AS disposed_assets,
                COUNT(*) FILTER (WHERE warranty_end < CURRENT_DATE) AS warranty_expired,
                COUNT(*) FILTER (WHERE warranty_end BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days') AS warranty_expiring
            FROM assets
        `)
        const categoryStats = await this.pg.query(`
            SELECT c.name, COUNT(a.id) AS count
            FROM assets a
            LEFT JOIN asset_models m ON a.model_id = m.id
            LEFT JOIN asset_categories c ON m.category_id = c.id
            WHERE c.name IS NOT NULL
            GROUP BY c.name ORDER BY count DESC LIMIT 10
        `)
        const locationStats = await this.pg.query(`
            SELECT l.name, COUNT(a.id) AS count
            FROM assets a LEFT JOIN locations l ON a.location_id = l.id
            WHERE l.name IS NOT NULL
            GROUP BY l.name ORDER BY count DESC LIMIT 10
        `)
        return {
            ...assetStats.rows[0],
            categoryBreakdown: categoryStats.rows,
            locationBreakdown: locationStats.rows
        }
    }

    private mapSnapshotRow(row: any): AnalyticsSnapshot {
        return {
            id: row.id,
            snapshotDate: row.snapshot_date,
            totalAssets: row.total_assets,
            activeAssets: row.active_assets,
            inRepairAssets: row.in_repair_assets,
            disposedAssets: row.disposed_assets,
            unassignedAssets: row.unassigned_assets,
            warrantyExpiring30d: row.warranty_expiring_30d,
            warrantyExpired: row.warranty_expired,
            totalMaintenanceTickets: row.total_maintenance_tickets,
            openTickets: row.open_tickets,
            avgRepairHours: row.avg_repair_hours,
            categoryBreakdown: row.category_breakdown ?? {},
            locationBreakdown: row.location_breakdown ?? {},
            vendorBreakdown: row.vendor_breakdown ?? {},
            createdAt: row.created_at
        }
    }
}

export class CostRecordRepo {
    constructor(private pg: PgClient) { }

    async create(input: Omit<CostRecord, 'id' | 'createdAt'>): Promise<CostRecord> {
        const result = await this.pg.query(
            `INSERT INTO asset_cost_records (asset_id, cost_type, amount, currency, description, recorded_date, recorded_by)
             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
            [input.assetId, input.costType, input.amount, input.currency, input.description, input.recordedDate, input.recordedBy]
        )
        return this.mapRow(result.rows[0])
    }

    async listByAsset(assetId: string): Promise<CostRecord[]> {
        const result = await this.pg.query(
            `SELECT * FROM asset_cost_records WHERE asset_id = $1 ORDER BY recorded_date DESC`, [assetId]
        )
        return result.rows.map((r: any) => this.mapRow(r))
    }

    async getTotalCostByAsset(assetId: string): Promise<{ costType: string; total: number }[]> {
        const result = await this.pg.query(
            `SELECT cost_type, SUM(amount) AS total FROM asset_cost_records WHERE asset_id = $1 GROUP BY cost_type`,
            [assetId]
        )
        return result.rows.map((r: any) => ({ costType: r.cost_type, total: parseFloat(r.total) }))
    }

    async getCostSummary(filters: { startDate?: string; endDate?: string }): Promise<{ costType: string; total: number; count: number }[]> {
        const conditions: string[] = []
        const params: unknown[] = []
        if (filters.startDate) { params.push(filters.startDate); conditions.push(`recorded_date >= $${params.length}`) }
        if (filters.endDate) { params.push(filters.endDate); conditions.push(`recorded_date <= $${params.length}`) }
        const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
        const result = await this.pg.query(
            `SELECT cost_type, SUM(amount) AS total, COUNT(*) AS count FROM asset_cost_records ${where} GROUP BY cost_type ORDER BY total DESC`,
            params
        )
        return result.rows.map((r: any) => ({ costType: r.cost_type, total: parseFloat(r.total), count: parseInt(r.count) }))
    }

    private mapRow(row: any): CostRecord {
        return {
            id: row.id,
            assetId: row.asset_id,
            costType: row.cost_type,
            amount: parseFloat(row.amount),
            currency: row.currency,
            description: row.description,
            recordedDate: row.recorded_date,
            recordedBy: row.recorded_by,
            createdAt: row.created_at
        }
    }
}

export class PerformanceMetricRepo {
    constructor(private pg: PgClient) { }

    async record(input: Omit<PerformanceMetric, 'id' | 'recordedAt'>): Promise<PerformanceMetric> {
        const result = await this.pg.query(
            `INSERT INTO asset_performance_metrics (asset_id, metric_type, metric_value, unit, metadata)
             VALUES ($1, $2, $3, $4, $5) RETURNING *`,
            [input.assetId, input.metricType, input.metricValue, input.unit, JSON.stringify(input.metadata)]
        )
        return this.mapRow(result.rows[0])
    }

    async getLatestByAsset(assetId: string): Promise<PerformanceMetric[]> {
        const result = await this.pg.query(`
            SELECT DISTINCT ON (metric_type) *
            FROM asset_performance_metrics
            WHERE asset_id = $1
            ORDER BY metric_type, recorded_at DESC
        `, [assetId])
        return result.rows.map((r: any) => this.mapRow(r))
    }

    async getHistory(assetId: string, metricType: string, hours = 24): Promise<PerformanceMetric[]> {
        const result = await this.pg.query(
            `SELECT * FROM asset_performance_metrics WHERE asset_id = $1 AND metric_type = $2
             AND recorded_at >= NOW() - ($3::integer || ' hours')::interval
             ORDER BY recorded_at ASC`,
            [assetId, metricType, hours]
        )
        return result.rows.map((r: any) => this.mapRow(r))
    }

    private mapRow(row: any): PerformanceMetric {
        return {
            id: row.id,
            assetId: row.asset_id,
            metricType: row.metric_type,
            metricValue: parseFloat(row.metric_value),
            unit: row.unit,
            recordedAt: row.recorded_at,
            metadata: row.metadata ?? {}
        }
    }
}

export class DashboardConfigRepo {
    constructor(private pg: PgClient) { }

    async upsert(userId: string, config: { name?: string; layout?: unknown[]; widgets?: unknown[]; isDefault?: boolean }): Promise<DashboardConfig> {
        const result = await this.pg.query(
            `INSERT INTO dashboard_configs (user_id, name, layout, widgets, is_default)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (id) DO UPDATE SET
                name = COALESCE(EXCLUDED.name, dashboard_configs.name),
                layout = COALESCE(EXCLUDED.layout, dashboard_configs.layout),
                widgets = COALESCE(EXCLUDED.widgets, dashboard_configs.widgets),
                updated_at = NOW()
             RETURNING *`,
            [userId, config.name ?? 'Default', JSON.stringify(config.layout ?? []),
                JSON.stringify(config.widgets ?? []), config.isDefault ?? false]
        )
        return this.mapRow(result.rows[0])
    }

    async getByUser(userId: string): Promise<DashboardConfig | null> {
        const result = await this.pg.query(
            `SELECT * FROM dashboard_configs WHERE user_id = $1 ORDER BY is_default DESC, created_at DESC LIMIT 1`,
            [userId]
        )
        return result.rows.length ? this.mapRow(result.rows[0]) : null
    }

    private mapRow(row: any): DashboardConfig {
        return {
            id: row.id,
            userId: row.user_id,
            name: row.name,
            layout: row.layout ?? [],
            widgets: row.widgets ?? [],
            isDefault: row.is_default,
            createdAt: row.created_at,
            updatedAt: row.updated_at
        }
    }
}
