import { describe, it, expect, beforeEach } from 'vitest'
import { PolicyEngine } from './PolicyEngine.js'
import { AppError } from '@qltb/domain'

const mockLogger = {
    info: () => { },
    warn: () => { },
    error: () => { },
    debug: () => { }
}

describe('PolicyEngine', () => {
    let engine: PolicyEngine

    beforeEach(() => {
        engine = new PolicyEngine(
            {
                budgetLimitPerUser: 100,
                rateLimitWindow: 60000,
                rateLimitMax: 10,
                allowedTools: ['echo', 'time_now']
            },
            mockLogger
        )
    })

    it('allows request within budget', async () => {
        await expect(engine.checkBudget('user-1')).resolves.toBeUndefined()
    })

    it('blocks request over budget', async () => {
        engine.trackSpend('user-1', 101)
        await expect(engine.checkBudget('user-1')).rejects.toThrow(AppError)
    })

    it('allows request within rate limit', async () => {
        for (let i = 0; i < 10; i++) {
            await expect(engine.checkRateLimit('user-1')).resolves.toBeUndefined()
        }
    })

    it('blocks request over rate limit', async () => {
        for (let i = 0; i < 10; i++) {
            await engine.checkRateLimit('user-1')
        }
        await expect(engine.checkRateLimit('user-1')).rejects.toThrow(AppError)
    })

    it('allows authorized tools', async () => {
        await expect(
            engine.checkToolPermissions('user-1', ['echo', 'time_now'])
        ).resolves.toBeUndefined()
    })

    it('blocks unauthorized tools', async () => {
        await expect(
            engine.checkToolPermissions('user-1', ['dangerous_tool'])
        ).rejects.toThrow(AppError)
    })
})
