import type { Conversation, ConversationId, UserId, Message } from '@qltb/domain'

export interface IConversationRepo {
    save(conversation: Conversation): Promise<void>
    findById(id: ConversationId): Promise<Conversation | null>
    findByUserId(userId: UserId, limit?: number): Promise<Conversation[]>
    delete(id: ConversationId): Promise<void>
    addMessage(conversationId: ConversationId, message: Message): Promise<void>
}
