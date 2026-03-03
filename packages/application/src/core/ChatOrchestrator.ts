import { AppError } from '@qltb/domain'
import { ModelTier } from '@qltb/contracts'
import type { ILogger } from '@qltb/contracts'
import { PolicyEngine } from './PolicyEngine.js'
import { RouterEngine } from './RouterEngine.js'
import { QualityChecker } from './QualityChecker.js'
import { ExecutorEngine } from './ExecutorEngine.js'
import type { ChatRequest, ChatResponse } from './types.js'
import { TIER_THRESHOLDS } from './types.js'

export class ChatOrchestrator {
    constructor(
        private policyEngine: PolicyEngine,
        private routerEngine: RouterEngine,
        private qualityChecker: QualityChecker,
        private executorEngine: ExecutorEngine,
        private logger: ILogger
    ) { }

    async execute(request: ChatRequest): Promise<ChatResponse> {
        const ctx = {
            correlationId: request.metadata.correlationId,
            userId: request.metadata.userId
        }

        this.logger.info('Chat orchestration started', ctx)

        try {
            // Step 1: Policy checks
            await this.policyEngine.checkBudget(request.metadata.userId)
            await this.policyEngine.checkRateLimit(request.metadata.userId)

            if (request.tools?.length) {
                await this.policyEngine.checkToolPermissions(
                    request.metadata.userId,
                    request.tools.map(t => t.name)
                )
            }

            // Step 2: Route to initial tier
            const initialTier = await this.routerEngine.selectTier(request)
            this.logger.info('Initial tier selected', { ...ctx, tier: initialTier })

            // Step 3: Execute with escalation loop
            const { response, finalTier } = await this.executeWithEscalation(
                request,
                initialTier
            )

            // Step 4: Track spend
            this.policyEngine.trackSpend(
                request.metadata.userId,
                response.usage.totalCost
            )

            this.logger.info('Chat orchestration completed', {
                ...ctx,
                finalTier,
                cost: response.usage.totalCost,
                escalated: finalTier > initialTier
            })

            return response

        } catch (error) {
            this.logger.error('Chat orchestration failed', { ...ctx, error })
            throw this.mapError(error, ctx.correlationId)
        }
    }

    private async executeWithEscalation(
        request: ChatRequest,
        startTier: ModelTier
    ): Promise<{ response: ChatResponse; finalTier: ModelTier }> {
        let currentTier = startTier

        while (currentTier <= ModelTier.T3_PAID_PREMIUM) {
            try {
                // Execute at current tier
                const response = await this.executorEngine.execute(request, currentTier)

                // Check quality
                const quality = await this.qualityChecker.assess(response, request)
                response.metadata.qualityScore = quality.overall

                // Accept if quality meets threshold
                if (quality.overall >= TIER_THRESHOLDS[currentTier]) {
                    return { response, finalTier: currentTier }
                }

                // Otherwise, escalate
                this.logger.warn('Quality below threshold, escalating', {
                    currentTier,
                    quality: quality.overall,
                    threshold: TIER_THRESHOLDS[currentTier]
                })

                currentTier++
            } catch (error) {
                this.logger.error('Executor failed at tier', {
                    tier: currentTier,
                    error: error instanceof Error ? error.message : String(error),
                    stack: error instanceof Error ? error.stack : undefined
                })
                currentTier++
            }
        }

        throw AppError.internal('Failed at all model tiers')
    }

    private mapError(error: unknown, correlationId: string): AppError {
        if (error instanceof AppError) {
            error.correlationId = correlationId
            return error
        }

        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        const errorString = error instanceof Error ? error.toString() : String(error)

        return new AppError(
            'INTERNAL_ERROR',
            errorMessage,
            { originalError: errorString },
            correlationId,
            500
        )
    }
}
