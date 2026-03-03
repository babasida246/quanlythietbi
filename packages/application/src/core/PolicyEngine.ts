import { AppError } from '@qltb/domain'
import type { ILogger } from '@qltb/contracts'

export interface PolicyConfig {
    budgetLimitPerUser: number
    rateLimitWindow: number
    rateLimitMax: number
    allowedTools: string[]
}

export interface BudgetInfo {
    userId: string
    currentSpend: number
    limit: number
}

export class PolicyEngine {
    private budgets = new Map<string, number>()
    private rateLimits = new Map<string, { count: number; resetAt: Date }>()

    constructor(
        private config: PolicyConfig,
        private logger: ILogger
    ) { }

    async checkBudget(userId: string): Promise<void> {
        const currentSpend = this.budgets.get(userId) || 0

        if (currentSpend >= this.config.budgetLimitPerUser) {
            this.logger.warn('Budget exceeded', { userId, currentSpend })
            throw AppError.forbidden(`Budget limit exceeded: $${this.config.budgetLimitPerUser}`)
        }
    }

    async checkRateLimit(userId: string): Promise<void> {
        const now = new Date()
        const limit = this.rateLimits.get(userId)

        if (limit && limit.resetAt > now) {
            if (limit.count >= this.config.rateLimitMax) {
                throw AppError.forbidden('Rate limit exceeded. Try again later.')
            }
            limit.count++
        } else {
            this.rateLimits.set(userId, {
                count: 1,
                resetAt: new Date(now.getTime() + this.config.rateLimitWindow)
            })
        }
    }

    async checkToolPermissions(userId: string, tools: string[]): Promise<void> {
        const unauthorized = tools.filter(t => !this.config.allowedTools.includes(t))

        if (unauthorized.length > 0) {
            this.logger.warn('Unauthorized tools requested', { userId, unauthorized })
            throw AppError.forbidden(`Tools not allowed: ${unauthorized.join(', ')}`)
        }
    }

    trackSpend(userId: string, cost: number): void {
        const current = this.budgets.get(userId) || 0
        this.budgets.set(userId, current + cost)
    }

    getBudgetInfo(userId: string): BudgetInfo {
        return {
            userId,
            currentSpend: this.budgets.get(userId) || 0,
            limit: this.config.budgetLimitPerUser
        }
    }
}
