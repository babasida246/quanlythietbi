/**
 * Automation Service
 * Evaluates and executes automation rules
 */

// --- Interfaces (decoupled from infra) ---
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

export interface IAutomationRuleRepo {
    create(input: Omit<AutomationRule, 'id' | 'createdAt' | 'updatedAt'>): Promise<AutomationRule>
    update(id: string, patch: Partial<Omit<AutomationRule, 'id' | 'createdAt' | 'updatedAt'>>): Promise<AutomationRule | null>
    list(filters: { triggerType?: string; isActive?: boolean }): Promise<AutomationRule[]>
    getById(id: string): Promise<AutomationRule | null>
    delete(id: string): Promise<boolean>
    getActiveByTrigger(triggerType: string): Promise<AutomationRule[]>
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

export interface IAutomationLogRepo {
    create(input: Omit<AutomationLog, 'id' | 'startedAt'>): Promise<AutomationLog>
    updateStatus(id: string, status: string, errorMessage?: string): Promise<void>
    listByRule(ruleId: string, limit: number): Promise<AutomationLog[]>
}

export interface INotificationRepo {
    create(input: { userId?: string | null; ruleId?: string | null; title: string; body?: string | null; channel: string; metadata?: Record<string, unknown> }): Promise<{ id: string }>
    listByUser(userId: string, filters: { status?: string; page?: number; limit?: number }): Promise<unknown[]>
    markRead(id: string): Promise<void>
    markAllRead(userId: string): Promise<void>
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

export interface IScheduledTaskRepo {
    create(input: Omit<ScheduledTask, 'id' | 'createdAt' | 'updatedAt' | 'lastRunAt' | 'nextRunAt' | 'lastStatus'>): Promise<ScheduledTask>
    list(filters: { isActive?: boolean }): Promise<ScheduledTask[]>
    delete(id: string): Promise<boolean>
}

export interface AutomationContext {
    userId: string
    correlationId: string
}

export class AutomationService {
    constructor(
        private rules: IAutomationRuleRepo,
        private logs: IAutomationLogRepo,
        private notifications: INotificationRepo,
        private tasks: IScheduledTaskRepo
    ) { }

    // --- Automation Rules ---
    async createRule(input: Omit<AutomationRule, 'id' | 'createdAt' | 'updatedAt'>, ctx: AutomationContext) {
        return this.rules.create({ ...input, createdBy: ctx.userId })
    }

    async updateRule(id: string, patch: Partial<Omit<AutomationRule, 'id' | 'createdAt' | 'updatedAt'>>) {
        return this.rules.update(id, patch)
    }

    async listRules(filters: { triggerType?: string; isActive?: boolean }) {
        return this.rules.list(filters)
    }

    async getRule(id: string) {
        return this.rules.getById(id)
    }

    async deleteRule(id: string) {
        return this.rules.delete(id)
    }

    // --- Trigger Evaluation ---
    async evaluateTrigger(triggerType: string, event: Record<string, unknown>, ctx: AutomationContext): Promise<{ executed: number; skipped: number }> {
        const activeRules = await this.rules.getActiveByTrigger(triggerType)
        let executed = 0
        let skipped = 0

        for (const rule of activeRules) {
            const matches = this.evaluateConditions(rule, event)
            if (!matches) {
                skipped++
                continue
            }

            const log = await this.logs.create({
                ruleId: rule.id,
                triggerEvent: event,
                actionsExecuted: [],
                status: 'running',
                errorMessage: null,
                completedAt: null,
                correlationId: ctx.correlationId
            })

            try {
                await this.executeActions(rule, event, ctx)
                await this.logs.updateStatus(log.id, 'completed')
                executed++
            } catch (err) {
                const errorMessage = err instanceof Error ? err.message : String(err)
                await this.logs.updateStatus(log.id, 'failed', errorMessage)
            }
        }

        return { executed, skipped }
    }

    async getRuleLogs(ruleId: string, limit = 20) {
        return this.logs.listByRule(ruleId, limit)
    }

    // --- Notifications ---
    async createNotification(input: { userId?: string | null; ruleId?: string | null; title: string; body?: string | null; channel: string; metadata?: Record<string, unknown> }) {
        return this.notifications.create(input)
    }

    async getUserNotifications(userId: string, filters: { status?: string; page?: number; limit?: number }) {
        return this.notifications.listByUser(userId, filters)
    }

    async markNotificationRead(id: string) {
        return this.notifications.markRead(id)
    }

    async markAllNotificationsRead(userId: string) {
        return this.notifications.markAllRead(userId)
    }

    // --- Scheduled Tasks ---
    async createTask(input: Omit<ScheduledTask, 'id' | 'createdAt' | 'updatedAt' | 'lastRunAt' | 'nextRunAt' | 'lastStatus'>) {
        return this.tasks.create(input)
    }

    async listTasks(filters: { isActive?: boolean }) {
        return this.tasks.list(filters)
    }

    async deleteTask(id: string) {
        return this.tasks.delete(id)
    }

    // --- Internal ---
    private evaluateConditions(rule: AutomationRule, event: Record<string, unknown>): boolean {
        if (!rule.conditions || !Array.isArray(rule.conditions) || rule.conditions.length === 0) {
            return true
        }
        for (const condition of rule.conditions) {
            const cond = condition as { field: string; operator: string; value: unknown }
            const value = event[cond.field]
            switch (cond.operator) {
                case 'equals': if (value !== cond.value) return false; break
                case 'not_equals': if (value === cond.value) return false; break
                case 'contains': if (!String(value).includes(String(cond.value))) return false; break
                case 'greater_than': if (Number(value) <= Number(cond.value)) return false; break
                case 'less_than': if (Number(value) >= Number(cond.value)) return false; break
                default: break
            }
        }
        return true
    }

    private async executeActions(rule: AutomationRule, event: Record<string, unknown>, ctx: AutomationContext): Promise<void> {
        for (const action of rule.actions) {
            const act = action as { type: string; config: Record<string, unknown> }
            switch (act.type) {
                case 'notify':
                    await this.notifications.create({
                        userId: (act.config.userId as string) ?? ctx.userId,
                        title: (act.config.title as string) ?? `Automation: ${rule.name}`,
                        body: act.config.body as string,
                        channel: (act.config.channel as string) ?? 'ui',
                        metadata: { ruleId: rule.id, event }
                    })
                    break
                case 'webhook':
                    // Placeholder for webhook execution
                    break
                case 'email':
                    // Placeholder for email sending
                    break
                default:
                    break
            }
        }
    }
}
