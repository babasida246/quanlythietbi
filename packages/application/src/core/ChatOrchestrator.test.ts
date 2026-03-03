import { describe, it, expect, beforeEach } from 'vitest'
import { ChatOrchestrator } from './ChatOrchestrator.js'
import { PolicyEngine } from './PolicyEngine.js'
import { RouterEngine } from './RouterEngine.js'
import { QualityChecker } from './QualityChecker.js'
import { ExecutorEngine } from './ExecutorEngine.js'
import { createMessage } from '@qltb/domain'

const mockLogger = {
    info: () => { },
    warn: () => { },
    error: () => { },
    debug: () => { }
}

const mockLLMClient = {
    async chat() {
        return {
            id: 'resp-1',
            model: 'mock',
            content: 'This is a detailed response with good quality. '.repeat(10),
            finishReason: 'stop' as const,
            usage: {
                promptTokens: 10,
                completionTokens: 100,
                totalTokens: 110,
                totalCost: 0.001
            }
        }
    },
    async *chatStream() {
        yield { id: 'chunk-1', delta: { content: 'test' } }
    },
    async health() {
        return { available: true, latency: 100 }
    }
}

describe('ChatOrchestrator', () => {
    let orchestrator: ChatOrchestrator

    beforeEach(() => {
        const policy = new PolicyEngine(
            {
                budgetLimitPerUser: 100,
                rateLimitWindow: 60000,
                rateLimitMax: 100,
                allowedTools: []
            },
            mockLogger
        )

        const router = new RouterEngine(mockLogger)
        const quality = new QualityChecker(mockLogger)
        const executor = new ExecutorEngine(mockLLMClient, mockLogger)

        orchestrator = new ChatOrchestrator(
            policy,
            router,
            quality,
            executor,
            mockLogger
        )
    })

    it('executes chat request successfully', async () => {
        const request = {
            messages: [createMessage({ role: 'user', content: 'Hello' })],
            metadata: {
                userId: 'user-1',
                correlationId: 'corr-1',
                importance: 'medium' as const,
                timestamp: new Date()
            }
        }

        const response = await orchestrator.execute(request)

        expect(response.id).toBeDefined()
        expect(response.content).toBeTruthy()
        expect(response.metadata.tierUsed).toBeDefined()
    })

    it('handles high importance requests', async () => {
        // Test that high importance requests work
        const request = {
            messages: [createMessage({ role: 'user', content: 'Complex question' })],
            metadata: {
                userId: 'user-1',
                correlationId: 'corr-2',
                importance: 'high' as const,
                timestamp: new Date()
            }
        }

        const response = await orchestrator.execute(request)
        expect(response).toBeDefined()
        expect(response.metadata.tierUsed).toBeDefined()
    })
})
