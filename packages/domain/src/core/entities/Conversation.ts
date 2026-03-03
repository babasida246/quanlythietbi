import ConversationId from '../value-objects/ConversationId.js'
import UserId from '../value-objects/UserId.js'
import type { Message } from '../value-objects/Message.js'
import { DomainError } from '../errors/index.js'

interface ConversationMetadata {
    createdAt: Date
    updatedAt: Date
    messageCount: number
    tags?: string[]
    department?: string
    importance?: 'low' | 'medium' | 'high' | 'critical'
}

export default class Conversation {
    constructor(
        public readonly id: ConversationId,
        public userId: UserId,
        public title: string,
        private messages: Message[],
        public metadata: ConversationMetadata
    ) {
        this.validate()
    }

    private validate(): void {
        if (!this.userId) {
            throw DomainError.validation('UserId required', 'userId')
        }
        if (this.title.length > 200) {
            throw DomainError.validation('Title too long (max 200)', 'title')
        }
    }

    addMessage(message: Message): void {
        this.messages.push(message)
        this.metadata.updatedAt = new Date()
        this.metadata.messageCount = this.messages.length
    }

    updateTitle(newTitle: string): void {
        if (!newTitle || newTitle.trim().length === 0) {
            throw DomainError.validation('Title cannot be empty', 'title')
        }
        if (newTitle.length > 200) {
            throw DomainError.validation('Title too long (max 200)', 'title')
        }
        this.title = newTitle
        this.metadata.updatedAt = new Date()
    }

    getMessages(): readonly Message[] {
        return Object.freeze([...this.messages])
    }

    estimateTokens(): number {
        return this.messages.reduce((sum, m) => sum + m.tokenCount, 0)
    }

    static create(userId: UserId, title: string): Conversation {
        return new Conversation(
            ConversationId.generate(),
            userId,
            title,
            [],
            {
                createdAt: new Date(),
                updatedAt: new Date(),
                messageCount: 0
            }
        )
    }
}
