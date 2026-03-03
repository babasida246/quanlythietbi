import type { ChatRequest, ChatResponse, QualitySignals } from './types.js'
import type { ILogger } from '@qltb/contracts'

export class QualityChecker {
    constructor(private logger: ILogger) { }

    async assess(response: ChatResponse, request: ChatRequest): Promise<QualitySignals> {
        const signals: QualitySignals = {
            completeness: this.checkCompleteness(response, request),
            consistency: this.checkConsistency(response),
            format: this.checkFormat(response),
            confidence: this.estimateConfidence(response),
            overall: 0
        }

        // Weighted average
        signals.overall =
            signals.completeness * 0.4 +
            signals.consistency * 0.3 +
            (signals.format ? 1 : 0) * 0.2 +
            signals.confidence * 0.1

        this.logger.info('Quality assessed', {
            signals,
            responseLength: response.content.length,
            correlationId: request.metadata.correlationId
        })

        return signals
    }

    private checkCompleteness(response: ChatResponse, request: ChatRequest): number {
        // Simple heuristic: response length vs request complexity
        const responseLength = response.content.length
        const requestLength = request.messages
            .map(m => m.content)
            .join(' ').length

        // Short but valid answers (e.g., "4" for "2+2?") are acceptable
        if (responseLength > 0 && responseLength < 20) return 0.3 // Very short answer
        if (responseLength < 50) return 0.6 // Brief
        if (responseLength > requestLength * 2) return 0.9 // Detailed
        return 0.8 // Adequate
    }

    private checkConsistency(response: ChatResponse): number {
        // Check for contradictions (simple keyword matching)
        const text = response.content.toLowerCase()
        const contradictions = [
            { positive: 'yes', negative: 'no' },
            { positive: 'true', negative: 'false' },
            { positive: 'should', negative: 'should not' }
        ]

        for (const pair of contradictions) {
            if (text.includes(pair.positive) && text.includes(pair.negative)) {
                return 0.5 // Possible contradiction
            }
        }

        return 1.0 // No obvious contradictions
    }

    private checkFormat(response: ChatResponse): boolean {
        // Basic format check: non-empty content
        return response.content.trim().length > 0
    }

    private estimateConfidence(response: ChatResponse): number {
        // Heuristic: presence of hedging language = lower confidence
        const text = response.content.toLowerCase()
        const hedgeWords = ['maybe', 'perhaps', 'possibly', 'might', 'could be']
        const hedgeCount = hedgeWords.filter(w => text.includes(w)).length

        if (hedgeCount > 3) return 0.5
        if (hedgeCount > 1) return 0.7
        return 0.9
    }
}
