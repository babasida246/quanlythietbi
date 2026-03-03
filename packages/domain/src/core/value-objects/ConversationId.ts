import { randomUUID } from 'crypto'
import { DomainError } from '../errors/index.js'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export default class ConversationId {
    private constructor(public readonly value: string) { }

    static create(value: string): ConversationId {
        if (!UUID_REGEX.test(value)) {
            throw DomainError.validation('Invalid UUID format', 'conversationId')
        }
        return new ConversationId(value)
    }

    static generate(): ConversationId {
        return new ConversationId(randomUUID())
    }

    equals(other: ConversationId): boolean {
        return this.value === other.value
    }

    toString(): string {
        return this.value
    }
}
