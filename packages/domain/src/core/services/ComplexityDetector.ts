import type { Message } from '../value-objects/Message.js'

export type Complexity = 'simple' | 'medium' | 'complex'

interface ComplexityFactors {
    messageCount: number
    avgMessageLength: number
    hasCodeBlocks: boolean
    requiresMultiStep: boolean
    requiresDeepReasoning: boolean
    isDomainSpecific: boolean
}

export interface ComplexityRequest {
    messages: Message[]
}

export default class ComplexityDetector {
    detect(request: ComplexityRequest): Complexity {
        const factors = this.extractFactors(request.messages)
        const score = this.computeScore(factors)
        return this.mapScoreToComplexity(score)
    }

    private extractFactors(messages: Message[]): ComplexityFactors {
        const allText = messages.map(m => m.content).join('\n')
        const avgLength = allText.length / Math.max(messages.length, 1)

        return {
            messageCount: messages.length,
            avgMessageLength: avgLength,
            hasCodeBlocks: /```/.test(allText),
            requiresMultiStep: this.detectMultiStepKeywords(allText),
            requiresDeepReasoning: this.detectReasoningKeywords(allText),
            isDomainSpecific: this.detectDomainKeywords(allText)
        }
    }

    private computeScore(factors: ComplexityFactors): number {
        let score = 0
        if (factors.messageCount > 10) score += 2
        else if (factors.messageCount > 5) score += 1
        if (factors.avgMessageLength > 500) score += 2
        else if (factors.avgMessageLength > 200) score += 1
        if (factors.hasCodeBlocks) score += 3
        if (factors.requiresMultiStep) score += 4
        if (factors.requiresDeepReasoning) score += 3
        if (factors.isDomainSpecific) score += 3
        return score
    }

    private mapScoreToComplexity(score: number): Complexity {
        if (score <= 3) return 'simple'
        if (score <= 8) return 'medium'
        return 'complex'
    }

    private detectMultiStepKeywords(text: string): boolean {
        const keywords = ['step by step', 'first.*then', 'analyze.*then', 'investigate']
        return keywords.some(kw => new RegExp(kw, 'i').test(text))
    }

    private detectReasoningKeywords(text: string): boolean {
        const keywords = ['why', 'explain', 'reason', 'cause', 'analyze', 'compare']
        return keywords.some(kw => new RegExp(`\\b${kw}\\b`, 'i').test(text))
    }

    private detectDomainKeywords(text: string): boolean {
        const keywords = ['zabbix', 'fortigate', 'mikrotik', 'his', 'lis', 'pacs', 'sql', 'vlan']
        return keywords.some(kw => new RegExp(`\\b${kw}\\b`, 'i').test(text))
    }
}
