import type { PgClient } from '@qltb/infra-postgres'

export interface PurchaseSuggestion {
    modelId: string
    modelName: string
    categoryId: string
    categoryName: string
    currentStock: number
    minStockQty: number
    avgDailyConsumption: number
    avgWeeklyConsumption: number
    leadTimeDays: number
    daysUntilStockout: number
    suggestedQuantity: number
    priority: 'critical' | 'high' | 'medium' | 'low'
    reason: string
}

export interface ConsumptionStats {
    modelId: string
    avgDailyConsumption: number
    avgWeeklyConsumption: number
}

export class PurchaseSuggestionService {
    constructor(private pg: PgClient) { }

    async calculateSuggestions(filters?: {
        categoryId?: string
        orgUnitId?: string
        minPriority?: 'low' | 'medium' | 'high' | 'critical'
    }): Promise<PurchaseSuggestion[]> {
        const conditions: string[] = ['am.min_stock_qty IS NOT NULL', 'am.min_stock_qty > 0']
        const params: unknown[] = []
        let paramCount = 1

        if (filters?.categoryId) {
            conditions.push(`am.category_id = $${paramCount++}`)
            params.push(filters.categoryId)
        }

        const result = await this.pg.query(
            `SELECT 
                am.id as model_id,
                am.model as model_name,
                am.category_id,
                ac.name as category_name,
                COALESCE(am.current_stock_qty, 0) as current_stock_qty,
                am.min_stock_qty,
                COALESCE(am.avg_daily_consumption, 0) as avg_daily_consumption,
                COALESCE(am.avg_weekly_consumption, 0) as avg_weekly_consumption,
                COALESCE(am.lead_time_days, 7) as lead_time_days
            FROM asset_models am
            JOIN asset_categories ac ON am.category_id = ac.id
            WHERE ${conditions.join(' AND ')}
            ORDER BY am.category_id, am.model`,
            params
        )

        const suggestions: PurchaseSuggestion[] = []

        for (const row of result.rows) {
            const currentStock = row.current_stock_qty
            const minStock = row.min_stock_qty
            const avgDaily = row.avg_daily_consumption || 0.1
            const leadTime = row.lead_time_days

            if (currentStock >= minStock) continue

            const shortfall = minStock - currentStock
            const daysUntilStockout = avgDaily > 0 ? currentStock / avgDaily : 999

            const safetyBuffer = avgDaily * leadTime * 1.2
            const reorderPoint = minStock + safetyBuffer
            const suggestedQuantity = Math.max(
                Math.ceil(reorderPoint - currentStock),
                Math.ceil(avgDaily * leadTime * 2)
            )

            let priority: 'critical' | 'high' | 'medium' | 'low'
            let reason: string

            if (daysUntilStockout <= 3) {
                priority = 'critical'
                reason = `Critical: Stock will run out in ${Math.floor(daysUntilStockout)} days`
            } else if (daysUntilStockout <= 7) {
                priority = 'high'
                reason = `High: Stock will run out in ${Math.floor(daysUntilStockout)} days`
            } else if (daysUntilStockout <= 14) {
                priority = 'medium'
                reason = `Medium: Stock below minimum, ${shortfall} units needed`
            } else {
                priority = 'low'
                reason = `Low: Stock below minimum, ${shortfall} units needed`
            }

            const minPriorityLevel = filters?.minPriority ? this.getPriorityLevel(filters.minPriority) : 0
            if (this.getPriorityLevel(priority) >= minPriorityLevel) {
                suggestions.push({
                    modelId: row.model_id,
                    modelName: row.model_name,
                    categoryId: row.category_id,
                    categoryName: row.category_name,
                    currentStock,
                    minStockQty: minStock,
                    avgDailyConsumption: avgDaily,
                    avgWeeklyConsumption: row.avg_weekly_consumption,
                    leadTimeDays: leadTime,
                    daysUntilStockout: Math.floor(daysUntilStockout),
                    suggestedQuantity,
                    priority,
                    reason
                })
            }
        }

        return suggestions.sort((a, b) => {
            const priorityDiff = this.getPriorityLevel(b.priority) - this.getPriorityLevel(a.priority)
            if (priorityDiff !== 0) return priorityDiff
            return a.daysUntilStockout - b.daysUntilStockout
        })
    }

    async updateConsumptionStats(modelId: string, days = 30): Promise<void> {
        const result = await this.pg.query(
            `SELECT 
                COALESCE(SUM(quantity)::numeric / NULLIF($2, 0), 0) as daily,
                COALESCE(SUM(quantity)::numeric / NULLIF($2 / 7.0, 0), 0) as weekly
            FROM asset_consumption_logs
            WHERE model_id = $1 
              AND consumption_date >= CURRENT_DATE - INTERVAL '1 day' * $2`,
            [modelId, days]
        )

        if (result.rows.length > 0) {
            await this.pg.query(
                `UPDATE asset_models 
                 SET avg_daily_consumption = $1,
                     avg_weekly_consumption = $2
                 WHERE id = $3`,
                [result.rows[0].daily, result.rows[0].weekly, modelId]
            )
        }
    }

    async recordConsumption(modelId: string, quantity: number, consumedBy: string, note?: string): Promise<void> {
        await this.pg.transaction(async (client: any) => {
            await client.query(
                `INSERT INTO asset_consumption_logs (model_id, consumption_date, quantity, created_by, note)
                 VALUES ($1, CURRENT_DATE, $2, $3, $4)`,
                [modelId, quantity, consumedBy, note ?? null]
            )

            await client.query(
                `UPDATE asset_models 
                 SET current_stock_qty = GREATEST(0, COALESCE(current_stock_qty, 0) - $1)
                 WHERE id = $2`,
                [quantity, modelId]
            )
        })

        await this.updateConsumptionStats(modelId)
    }

    private getPriorityLevel(priority: 'critical' | 'high' | 'medium' | 'low'): number {
        switch (priority) {
            case 'critical': return 4
            case 'high': return 3
            case 'medium': return 2
            case 'low': return 1
        }
    }
}
