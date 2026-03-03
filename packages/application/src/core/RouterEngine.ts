import { ComplexityDetector, type Complexity } from '@qltb/domain'
import { ModelTier } from '@qltb/contracts'
import type { ChatRequest } from './types.js'
import type { ILogger } from '@qltb/contracts'

export class RouterEngine {
    private complexityDetector = new ComplexityDetector()

    constructor(private logger: ILogger) { }

    async selectTier(request: ChatRequest): Promise<ModelTier> {
        // Detect complexity
        const complexity = this.complexityDetector.detect({
            messages: request.messages
        })

        // Base tier from complexity
        let tier = this.mapComplexityToTier(complexity)

        // Adjust by metadata
        tier = this.adjustByMetadata(tier, request.metadata)

        this.logger.info('Tier selected', {
            complexity,
            tier,
            importance: request.metadata.importance
        })

        return tier
    }

    private mapComplexityToTier(complexity: Complexity): ModelTier {
        switch (complexity) {
            case 'simple':
                return ModelTier.T0_FREE
            case 'medium':
                return ModelTier.T0_FREE // Still try free first
            case 'complex':
                return ModelTier.T1_PAID_CHEAP // Complex → start at T1
        }
    }

    private adjustByMetadata(
        baseTier: ModelTier,
        metadata: ChatRequest['metadata']
    ): ModelTier {
        let tier = baseTier

        // Importance override
        if (metadata.importance === 'critical') {
            tier = Math.max(tier, ModelTier.T2_PAID_MEDIUM)
        } else if (metadata.importance === 'high') {
            tier = Math.max(tier, ModelTier.T1_PAID_CHEAP)
        }

        // Time-based adjustment (night shift = higher tier)
        const hour = metadata.timestamp.getHours()
        if (hour >= 22 || hour <= 6) {
            tier = Math.min(tier + 1, ModelTier.T3_PAID_PREMIUM)
        }

        return tier as ModelTier
    }
}
