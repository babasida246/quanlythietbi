/**
 * Workflow Automation Repository
 * Manages automation rules, execution logs, notifications
 */
import type { PgClient } from '../PgClient.js'

export interface AutomationRule {
    id: string
    name: string
    description: string | null
    triggerType: string
    triggerConfig: Record<string, unknown>
    conditions: unknown[]
    actions: unknown[]
    isActive: boolean
    priority: number
    createdBy: string | null
    createdAt: Date
    updatedAt: Date
}

export interface AutomationLog {
    id: string
    ruleId: string
    triggerEvent: Record<string, unknown>
    actionsExecuted: unknown[]
    status: string
    errorMessage: string | null
    startedAt: Date
    completedAt: Date | null
    correlationId: string | null
}

export interface NotificationRule {
    id: string
    name: string
    eventType: string
    channel: string
    recipients: unknown[]
    template: string | null
    isActive: boolean
    createdAt: Date
    updatedAt: Date
}

export interface Notification {
    id: string
    ruleId: string | null
    userId: string | null
    title: string
    body: string | null
    channel: string
    status: string
    metadata: Record<string, unknown>
    createdAt: Date
    readAt: Date | null
    sentAt: Date | null
}

export interface ScheduledTask {
    id: string
    name: string
    taskType: string
    cronExpression: string
    config: Record<string, unknown>
    isActive: boolean
    lastRunAt: Date | null
    nextRunAt: Date | null
    lastStatus: string | null
    createdAt: Date
    updatedAt: Date
}

export class AutomationRuleRepo {
    constructor(private pg: PgClient) { }

    async create(input: Omit<AutomationRule, 'id' | 'createdAt' | 'updatedAt'>): Promise<AutomationRule> {
        const result = await this.pg.query(
            `INSERT INTO workflow_automation_rules (name, description, trigger_type, trigger_config, conditions, actions, is_active, priority, created_by)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             RETURNING *`,
            [input.name, input.description, input.triggerType, JSON.stringify(input.triggerConfig),
            JSON.stringify(input.conditions), JSON.stringify(input.actions), input.isActive, input.priority, input.createdBy]
        )
        return this.mapRow(result.rows[0])
    }

    async update(id: string, patch: Partial<Omit<AutomationRule, 'id' | 'createdAt' | 'updatedAt'>>): Promise<AutomationRule | null> {
        const sets: string[] = []
        const params: unknown[] = []
        let idx = 1

        if (patch.name !== undefined) { sets.push(`name = $${idx++}`); params.push(patch.name) }
        if (patch.description !== undefined) { sets.push(`description = $${idx++}`); params.push(patch.description) }
        if (patch.triggerType !== undefined) { sets.push(`trigger_type = $${idx++}`); params.push(patch.triggerType) }
        if (patch.triggerConfig !== undefined) { sets.push(`trigger_config = $${idx++}`); params.push(JSON.stringify(patch.triggerConfig)) }
        if (patch.conditions !== undefined) { sets.push(`conditions = $${idx++}`); params.push(JSON.stringify(patch.conditions)) }
        if (patch.actions !== undefined) { sets.push(`actions = $${idx++}`); params.push(JSON.stringify(patch.actions)) }
        if (patch.isActive !== undefined) { sets.push(`is_active = $${idx++}`); params.push(patch.isActive) }
        if (patch.priority !== undefined) { sets.push(`priority = $${idx++}`); params.push(patch.priority) }

        if (sets.length === 0) return await this.getById(id)

        sets.push(`updated_at = NOW()`)
        params.push(id)

        const result = await this.pg.query(
            `UPDATE workflow_automation_rules SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
            params
        )
        return result.rows.length ? this.mapRow(result.rows[0]) : null
    }

    async getById(id: string): Promise<AutomationRule | null> {
        const result = await this.pg.query(`SELECT * FROM workflow_automation_rules WHERE id = $1`, [id])
        return result.rows.length ? this.mapRow(result.rows[0]) : null
    }

    async list(filters: { triggerType?: string; isActive?: boolean; page?: number; limit?: number }): Promise<{ items: AutomationRule[]; total: number }> {
        const conditions: string[] = []
        const params: unknown[] = []
        if (filters.triggerType) { params.push(filters.triggerType); conditions.push(`trigger_type = $${params.length}`) }
        if (filters.isActive !== undefined) { params.push(filters.isActive); conditions.push(`is_active = $${params.length}`) }
        const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
        const page = Math.max(1, filters.page ?? 1)
        const limit = Math.min(Math.max(1, filters.limit ?? 20), 100)
        const offset = (page - 1) * limit

        const countResult = await this.pg.query(`SELECT COUNT(*) AS count FROM workflow_automation_rules ${where}`, params)
        const total = parseInt(countResult.rows[0]?.count ?? '0', 10)

        params.push(limit, offset)
        const result = await this.pg.query(
            `SELECT * FROM workflow_automation_rules ${where} ORDER BY priority DESC, created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
            params
        )
        return { items: result.rows.map((r: any) => this.mapRow(r)), total }
    }

    async delete(id: string): Promise<boolean> {
        const result = await this.pg.query(`DELETE FROM workflow_automation_rules WHERE id = $1`, [id])
        return (result.rowCount ?? 0) > 0
    }

    async getActiveByTrigger(triggerType: string): Promise<AutomationRule[]> {
        const result = await this.pg.query(
            `SELECT * FROM workflow_automation_rules WHERE trigger_type = $1 AND is_active = true ORDER BY priority DESC`,
            [triggerType]
        )
        return result.rows.map((r: any) => this.mapRow(r))
    }

    private mapRow(row: any): AutomationRule {
        return {
            id: row.id,
            name: row.name,
            description: row.description,
            triggerType: row.trigger_type,
            triggerConfig: row.trigger_config ?? {},
            conditions: row.conditions ?? [],
            actions: row.actions ?? [],
            isActive: row.is_active,
            priority: row.priority,
            createdBy: row.created_by,
            createdAt: row.created_at,
            updatedAt: row.updated_at
        }
    }
}

export class AutomationLogRepo {
    constructor(private pg: PgClient) { }

    async create(input: Omit<AutomationLog, 'id' | 'startedAt'>): Promise<AutomationLog> {
        const result = await this.pg.query(
            `INSERT INTO workflow_automation_logs (rule_id, trigger_event, actions_executed, status, error_message, completed_at, correlation_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
            [input.ruleId, JSON.stringify(input.triggerEvent), JSON.stringify(input.actionsExecuted),
            input.status, input.errorMessage, input.completedAt, input.correlationId]
        )
        return this.mapRow(result.rows[0])
    }

    async updateStatus(id: string, status: string, error?: string): Promise<AutomationLog | null> {
        const result = await this.pg.query(
            `UPDATE workflow_automation_logs SET status = $1, error_message = $2, completed_at = CASE WHEN $1 IN ('completed','failed') THEN NOW() ELSE completed_at END WHERE id = $3 RETURNING *`,
            [status, error ?? null, id]
        )
        return result.rows.length ? this.mapRow(result.rows[0]) : null
    }

    async listByRule(ruleId: string, limit = 20): Promise<AutomationLog[]> {
        const result = await this.pg.query(
            `SELECT * FROM workflow_automation_logs WHERE rule_id = $1 ORDER BY started_at DESC LIMIT $2`,
            [ruleId, limit]
        )
        return result.rows.map((r: any) => this.mapRow(r))
    }

    private mapRow(row: any): AutomationLog {
        return {
            id: row.id,
            ruleId: row.rule_id,
            triggerEvent: row.trigger_event ?? {},
            actionsExecuted: row.actions_executed ?? [],
            status: row.status,
            errorMessage: row.error_message,
            startedAt: row.started_at,
            completedAt: row.completed_at,
            correlationId: row.correlation_id
        }
    }
}

export class NotificationRepo {
    constructor(private pg: PgClient) { }

    async create(input: { ruleId?: string; userId?: string; title: string; body?: string; channel?: string; metadata?: Record<string, unknown> }): Promise<Notification> {
        const result = await this.pg.query(
            `INSERT INTO notifications (rule_id, user_id, title, body, channel, metadata)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
            [input.ruleId ?? null, input.userId ?? null, input.title, input.body ?? null,
            input.channel ?? 'ui', JSON.stringify(input.metadata ?? {})]
        )
        return this.mapRow(result.rows[0])
    }

    async listByUser(userId: string, filters: { status?: string; page?: number; limit?: number }): Promise<{ items: Notification[]; total: number; unread: number }> {
        const page = Math.max(1, filters.page ?? 1)
        const limit = Math.min(Math.max(1, filters.limit ?? 20), 100)
        const offset = (page - 1) * limit

        const conditions = ['user_id = $1']
        const params: unknown[] = [userId]
        if (filters.status) { params.push(filters.status); conditions.push(`status = $${params.length}`) }
        const where = `WHERE ${conditions.join(' AND ')}`

        const countResult = await this.pg.query(`SELECT COUNT(*) AS count FROM notifications ${where}`, params)
        const total = parseInt(countResult.rows[0]?.count ?? '0', 10)

        const unreadResult = await this.pg.query(
            `SELECT COUNT(*) AS count FROM notifications WHERE user_id = $1 AND status IN ('pending','sent')`,
            [userId]
        )
        const unread = parseInt(unreadResult.rows[0]?.count ?? '0', 10)

        params.push(limit, offset)
        const result = await this.pg.query(
            `SELECT * FROM notifications ${where} ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
            params
        )
        return { items: result.rows.map((r: any) => this.mapRow(r)), total, unread }
    }

    async markRead(id: string): Promise<Notification | null> {
        const result = await this.pg.query(
            `UPDATE notifications SET status = 'read', read_at = NOW() WHERE id = $1 RETURNING *`,
            [id]
        )
        return result.rows.length ? this.mapRow(result.rows[0]) : null
    }

    async markAllRead(userId: string): Promise<number> {
        const result = await this.pg.query(
            `UPDATE notifications SET status = 'read', read_at = NOW() WHERE user_id = $1 AND status IN ('pending','sent')`,
            [userId]
        )
        return result.rowCount ?? 0
    }

    private mapRow(row: any): Notification {
        return {
            id: row.id,
            ruleId: row.rule_id,
            userId: row.user_id,
            title: row.title,
            body: row.body,
            channel: row.channel,
            status: row.status,
            metadata: row.metadata ?? {},
            createdAt: row.created_at,
            readAt: row.read_at,
            sentAt: row.sent_at
        }
    }
}

export class ScheduledTaskRepo {
    constructor(private pg: PgClient) { }

    async create(input: Omit<ScheduledTask, 'id' | 'createdAt' | 'updatedAt' | 'lastRunAt' | 'nextRunAt' | 'lastStatus'>): Promise<ScheduledTask> {
        const result = await this.pg.query(
            `INSERT INTO scheduled_tasks (name, task_type, cron_expression, config, is_active)
             VALUES ($1, $2, $3, $4, $5) RETURNING *`,
            [input.name, input.taskType, input.cronExpression, JSON.stringify(input.config), input.isActive]
        )
        return this.mapRow(result.rows[0])
    }

    async list(filters: { isActive?: boolean }): Promise<ScheduledTask[]> {
        const conditions: string[] = []
        const params: unknown[] = []
        if (filters.isActive !== undefined) { params.push(filters.isActive); conditions.push(`is_active = $${params.length}`) }
        const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
        const result = await this.pg.query(`SELECT * FROM scheduled_tasks ${where} ORDER BY name`, params)
        return result.rows.map((r: any) => this.mapRow(r))
    }

    async updateLastRun(id: string, status: string): Promise<void> {
        await this.pg.query(
            `UPDATE scheduled_tasks SET last_run_at = NOW(), last_status = $1, updated_at = NOW() WHERE id = $2`,
            [status, id]
        )
    }

    async delete(id: string): Promise<boolean> {
        const result = await this.pg.query(`DELETE FROM scheduled_tasks WHERE id = $1`, [id])
        return (result.rowCount ?? 0) > 0
    }

    private mapRow(row: any): ScheduledTask {
        return {
            id: row.id,
            name: row.name,
            taskType: row.task_type,
            cronExpression: row.cron_expression,
            config: row.config ?? {},
            isActive: row.is_active,
            lastRunAt: row.last_run_at,
            nextRunAt: row.next_run_at,
            lastStatus: row.last_status,
            createdAt: row.created_at,
            updatedAt: row.updated_at
        }
    }
}
