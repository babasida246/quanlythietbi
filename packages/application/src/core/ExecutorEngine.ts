import { randomUUID } from 'crypto'
import { AppError } from '@qltb/domain'
import type { LLMClient, LLMRequest } from '@qltb/contracts'
import { ModelTier } from '@qltb/contracts'
import type { ChatRequest, ChatResponse } from './types.js'
import type { ILogger } from '@qltb/contracts'

export interface ToolRegistry {
    invoke(
        name: string,
        args: any,
        context: { userId: string; correlationId: string; logger?: any }
    ): Promise<{ success: boolean; output?: any; error?: string; duration: number }>
}

export interface ExecutionConfig {
    maxIterations: number
    maxToolCalls: number
    budgetLimit: number
    toolTimeout: number
}

export class ExecutorEngine {
    private config: ExecutionConfig = {
        maxIterations: 5,
        maxToolCalls: 20,
        budgetLimit: 100000,
        toolTimeout: 30000
    }

    constructor(
        private llmClient: LLMClient,
        private logger: ILogger,
        private toolRegistry?: ToolRegistry,
        config?: Partial<ExecutionConfig>
    ) {
        if (config) {
            this.config = { ...this.config, ...config }
        }
    }

    async execute(request: ChatRequest, tier: ModelTier): Promise<ChatResponse> {
        const model = this.selectModelForTier(tier)
        const context = {
            iteration: 0,
            totalTokens: 0,
            toolCallCount: 0
        }

        const messages = [...request.messages]

        while (context.iteration < this.config.maxIterations) {
            context.iteration++

            // Call LLM
            const llmRequest: LLMRequest = {
                model,
                messages,
                tools: request.tools?.map(t => ({
                    name: t.name,
                    description: t.description || '',
                    inputSchema: { type: 'object', ...t.inputSchema }
                })),
                temperature: request.temperature,
                maxTokens: request.maxTokens
            }

            let response
            try {
                response = await this.llmClient.chat(llmRequest)
            } catch (error) {
                this.logger.error('LLM API call failed', {
                    tier,
                    model: this.selectModelForTier(tier),
                    error: error instanceof Error ? error.message : String(error),
                    stack: error instanceof Error ? error.stack : undefined
                })
                throw error
            }

            // Update budget
            context.totalTokens += response.usage.totalTokens
            if (context.totalTokens > this.config.budgetLimit) {
                throw AppError.forbidden('Token budget exceeded')
            }

            // No tool calls? Done
            if (!response.toolCalls?.length) {
                return this.mapToChatResponse(response, tier, false)
            }

            // Check tool call limit
            context.toolCallCount += response.toolCalls.length
            if (context.toolCallCount > this.config.maxToolCalls) {
                throw AppError.forbidden('Too many tool calls')
            }

            // Execute tools if registry is available
            if (this.toolRegistry) {
                const toolResults = await this.executeTools(
                    response.toolCalls,
                    request.metadata
                )

                // Add assistant message to conversation
                messages.push({
                    id: randomUUID(),
                    role: 'assistant',
                    content: response.content,
                    toolCalls: response.toolCalls,
                    tokenCount: response.usage.completionTokens,
                    createdAt: new Date()
                })

                // Add tool results to conversation
                for (const result of toolResults) {
                    messages.push({
                        id: randomUUID(),
                        role: 'tool',
                        content: JSON.stringify(result.output),
                        toolCallId: result.toolCallId,
                        tokenCount: 0,
                        createdAt: new Date()
                    })
                }

                continue // Continue loop for LLM to process results
            }

            // Fallback: Log tool calls if no registry
            this.logger.info('Tool calls requested (no registry)', {
                tools: response.toolCalls.map(tc => tc.function.name),
                iteration: context.iteration
            })

            // Add assistant message to conversation
            messages.push({
                id: randomUUID(),
                role: 'assistant',
                content: response.content,
                toolCalls: response.toolCalls,
                tokenCount: response.usage.completionTokens,
                createdAt: new Date()
            })

            // Return response without tool execution
            return this.mapToChatResponse(response, tier, false)
        }

        throw AppError.internal('Max iterations reached')
    }

    private async executeTools(
        toolCalls: { id: string; type: string; function: { name: string; arguments: string } }[],
        metadata: { userId: string; correlationId: string }
    ): Promise<Array<{ toolCallId: string; output: any }>> {
        const results: Array<{ toolCallId: string; output: any }> = []

        for (const call of toolCalls) {
            try {
                const args = JSON.parse(call.function.arguments)

                const result = await this.toolRegistry!.invoke(
                    call.function.name,
                    args,
                    {
                        userId: metadata.userId,
                        correlationId: metadata.correlationId,
                        logger: this.logger
                    }
                )

                results.push({
                    toolCallId: call.id,
                    output: result.output
                })

                this.logger.info('Tool executed successfully', {
                    tool: call.function.name,
                    duration: result.duration,
                    success: result.success
                })
            } catch (error: any) {
                this.logger.error('Tool execution failed', {
                    tool: call.function.name,
                    error: error.message
                })

                results.push({
                    toolCallId: call.id,
                    output: {
                        error: error.message,
                        success: false
                    }
                })
            }
        }

        return results
    }

    private selectModelForTier(tier: ModelTier): string {
        // Use only free mistral model for all tiers (stable and reliable)
        return 'mistralai/mistral-7b-instruct:free'
    }

    private mapToChatResponse(
        llmResponse: { id: string; content: string; toolCalls?: { id: string; type: string; function: { name: string; arguments: string } }[]; finishReason: string; usage: { promptTokens: number; completionTokens: number; totalTokens: number; totalCost: number } },
        tier: ModelTier,
        escalated: boolean
    ): ChatResponse {
        return {
            id: llmResponse.id,
            content: llmResponse.content,
            toolCalls: llmResponse.toolCalls?.map(tc => ({
                id: tc.id,
                type: tc.type,
                function: tc.function
            })),
            finishReason: llmResponse.finishReason,
            usage: {
                promptTokens: llmResponse.usage.promptTokens,
                completionTokens: llmResponse.usage.completionTokens,
                totalTokens: llmResponse.usage.totalTokens,
                totalCost: llmResponse.usage.totalCost || 0
            },
            metadata: {
                tierUsed: tier,
                escalated,
                qualityScore: 0
            }
        }
    }
}
