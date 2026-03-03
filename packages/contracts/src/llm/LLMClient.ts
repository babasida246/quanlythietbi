import type { Message, ToolCall } from '@qltb/domain'

export interface LLMRequest {
    model: string
    messages: Message[]
    tools?: ToolDefinition[]
    temperature?: number
    maxTokens?: number
    stream?: boolean
}

export interface LLMResponse {
    id: string
    model: string
    content: string
    toolCalls?: ToolCall[]
    finishReason: 'stop' | 'length' | 'tool_calls'
    usage: TokenUsage
}

export interface TokenUsage {
    promptTokens: number
    completionTokens: number
    totalTokens: number
    totalCost: number
}

export interface StreamChunk {
    id: string
    delta: {
        content?: string
        toolCalls?: ToolCall[]
    }
    finishReason?: string
}

export interface ToolDefinition {
    name: string
    description: string
    inputSchema: JSONSchema
}

export interface JSONSchema {
    type: string
    properties?: Record<string, unknown>
    required?: string[]
    [key: string]: unknown
}

export interface LLMClient {
    chat(request: LLMRequest): Promise<LLMResponse>
    chatStream(request: LLMRequest): AsyncIterable<StreamChunk>
    health(): Promise<{ available: boolean; latency: number }>
}
