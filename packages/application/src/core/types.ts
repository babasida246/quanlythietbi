import type { Message } from '@qltb/domain'
import { ModelTier } from '@qltb/contracts'

export interface ChatRequest {
    messages: Message[]
    model?: string
    tools?: ToolDefinitionInput[]
    temperature?: number
    maxTokens?: number
    stream?: boolean
    metadata: RequestMetadata
}

export interface ToolDefinitionInput {
    name: string
    description?: string
    inputSchema?: Record<string, unknown>
}

export interface RequestMetadata {
    userId: string
    correlationId: string
    importance: 'low' | 'medium' | 'high' | 'critical'
    department?: string
    timestamp: Date
}

export interface ChatResponse {
    id: string
    content: string
    toolCalls?: ToolCallOutput[]
    finishReason: string
    usage: {
        promptTokens: number
        completionTokens: number
        totalTokens: number
        totalCost: number
    }
    metadata: {
        tierUsed: ModelTier
        escalated: boolean
        qualityScore: number
    }
}

export interface ToolCallOutput {
    id: string
    type: string
    function: {
        name: string
        arguments: string
    }
}

export interface QualitySignals {
    completeness: number
    consistency: number
    format: boolean
    confidence: number
    overall: number
}

export const TIER_THRESHOLDS: Record<ModelTier, number> = {
    [ModelTier.T0_FREE]: 0.50,
    [ModelTier.T1_PAID_CHEAP]: 0.65,
    [ModelTier.T2_PAID_MEDIUM]: 0.75,
    [ModelTier.T3_PAID_PREMIUM]: 0.85
}
