import { describe, it, expect } from 'vitest'
import { QualityChecker } from './QualityChecker.js'
import { ModelTier } from '@qltb/contracts'
import { createMessage } from '@qltb/domain'

const mockLogger = {
    info: () => { },
    warn: () => { },
    error: () => { },
    debug: () => { }
}

describe('QualityChecker', () => {
    const checker = new QualityChecker(mockLogger)

    it('rates short response as low quality', async () => {
        const response = {
            id: 'resp-1',
            content: 'OK',
            finishReason: 'stop',
            usage: {
                promptTokens: 10,
                completionTokens: 2,
                totalTokens: 12,
                totalCost: 0.001
            },
            metadata: {
                tierUsed: ModelTier.T0_FREE,
                escalated: false,
                qualityScore: 0
            }
        }

        const request = {
            messages: [createMessage({ role: 'user', content: 'Explain quantum physics' })],
            metadata: {
                userId: 'user-1',
                correlationId: 'corr-1',
                importance: 'medium' as const,
                timestamp: new Date()
            }
        }

        const signals = await checker.assess(response, request)
        expect(signals.completeness).toBeLessThan(0.5)
    })

    it('rates detailed response as high quality', async () => {
        const response = {
            id: 'resp-1',
            content: 'Quantum physics is the study of... '.repeat(20),
            finishReason: 'stop',
            usage: {
                promptTokens: 10,
                completionTokens: 100,
                totalTokens: 110,
                totalCost: 0.01
            },
            metadata: {
                tierUsed: ModelTier.T1_PAID_CHEAP,
                escalated: false,
                qualityScore: 0
            }
        }

        const request = {
            messages: [createMessage({ role: 'user', content: 'Explain quantum physics' })],
            metadata: {
                userId: 'user-1',
                correlationId: 'corr-1',
                importance: 'medium' as const,
                timestamp: new Date()
            }
        }

        const signals = await checker.assess(response, request)
        expect(signals.completeness).toBeGreaterThan(0.7)
    })
})
