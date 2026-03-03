import { describe, it, expect } from 'vitest'
import { RouterEngine } from './RouterEngine.js'
import { ModelTier } from '@qltb/contracts'
import { createMessage } from '@qltb/domain'

const mockLogger = {
    info: () => { },
    warn: () => { },
    error: () => { },
    debug: () => { }
}

describe('RouterEngine', () => {
    const router = new RouterEngine(mockLogger)

    it('selects T0 for simple requests', async () => {
        // Use daytime timestamp to avoid night shift escalation
        const daytime = new Date()
        daytime.setHours(14, 0, 0, 0) // 2 PM

        const request = {
            messages: [createMessage({ role: 'user', content: 'Hello' })],
            metadata: {
                userId: 'user-1',
                correlationId: 'corr-1',
                importance: 'low' as const,
                timestamp: daytime
            }
        }

        const tier = await router.selectTier(request)
        expect(tier).toBe(ModelTier.T0_FREE)
    })

    it('escalates for critical importance', async () => {
        const request = {
            messages: [createMessage({ role: 'user', content: 'Hello' })],
            metadata: {
                userId: 'user-1',
                correlationId: 'corr-1',
                importance: 'critical' as const,
                timestamp: new Date()
            }
        }

        const tier = await router.selectTier(request)
        expect(tier).toBeGreaterThanOrEqual(ModelTier.T2_PAID_MEDIUM)
    })

    it('adjusts for night shift', async () => {
        const nightTime = new Date()
        nightTime.setHours(23)

        const request = {
            messages: [createMessage({ role: 'user', content: 'Hello' })],
            metadata: {
                userId: 'user-1',
                correlationId: 'corr-1',
                importance: 'medium' as const,
                timestamp: nightTime
            }
        }

        const tier = await router.selectTier(request)
        expect(tier).toBeGreaterThanOrEqual(ModelTier.T1_PAID_CHEAP)
    })
})
