import { randomUUID } from 'crypto'
import { DomainError } from '../errors/index.js'

export type MessageRole = 'user' | 'assistant' | 'system' | 'tool'

export interface ToolCall {
    id: string
    type: 'function'
    function: {
        name: string
        arguments: string
    }
}

export interface Message {
    readonly id: string
    readonly role: MessageRole
    readonly content: string
    readonly toolCalls?: ToolCall[]
    readonly toolCallId?: string
    readonly tokenCount: number
    readonly createdAt: Date
}

export class MessageBuilder {
    private role?: MessageRole
    private content?: string
    private toolCalls?: ToolCall[]
    private toolCallId?: string

    withRole(role: MessageRole): this {
        this.role = role
        return this
    }

    withContent(content: string): this {
        this.content = content
        return this
    }

    withToolCalls(calls: ToolCall[]): this {
        this.toolCalls = calls
        return this
    }

    withToolCallId(id: string): this {
        this.toolCallId = id
        return this
    }

    build(): Message {
        if (!this.role) {
            throw DomainError.validation('Message role required', 'role')
        }
        if (!this.content?.trim()) {
            throw DomainError.validation('Message content required', 'content')
        }

        const tokenCount = Math.ceil(this.content.split(/\s+/).length * 1.3)

        return {
            id: randomUUID(),
            role: this.role,
            content: this.content,
            toolCalls: this.toolCalls,
            toolCallId: this.toolCallId,
            tokenCount,
            createdAt: new Date()
        }
    }
}

export function createMessage(props: {
    role: MessageRole
    content: string
    toolCalls?: ToolCall[]
    toolCallId?: string
}): Message {
    const builder = new MessageBuilder()
        .withRole(props.role)
        .withContent(props.content)

    if (props.toolCalls) builder.withToolCalls(props.toolCalls)
    if (props.toolCallId) builder.withToolCallId(props.toolCallId)

    return builder.build()
}
