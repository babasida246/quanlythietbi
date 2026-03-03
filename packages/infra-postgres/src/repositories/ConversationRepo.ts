import type { IConversationRepo } from '@qltb/contracts'
import { Conversation, ConversationId, UserId, type Message } from '@qltb/domain'
import type { PgClient } from '../PgClient.js'

export class ConversationRepo implements IConversationRepo {
    constructor(private pg: PgClient) { }

    async save(conversation: Conversation): Promise<void> {
        await this.pg.transaction(async (client) => {
            // Normalize conversation shape so we support both domain implementations
            const convId = (conversation as any).id && (conversation as any).id.value ? (conversation as any).id.value : (conversation as any).id;
            const convUserId = (conversation as any).userId && (conversation as any).userId.value ? (conversation as any).userId.value : (conversation as any).userId;
            const convTitle = conversation.title;
            const convMetadata = conversation.metadata || {
                createdAt: (conversation as any).createdAt || new Date(),
                updatedAt: (conversation as any).updatedAt || new Date(),
                messageCount: (conversation as any).messages ? (conversation as any).messages.length : 0,
            };

            // Upsert conversation
            await client.query(
                `INSERT INTO conversations (id, user_id, title, metadata, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (id) 
         DO UPDATE SET 
           title = EXCLUDED.title,
           metadata = EXCLUDED.metadata,
           updated_at = EXCLUDED.updated_at`,
                [
                    convId,
                    convUserId,
                    convTitle,
                    JSON.stringify(convMetadata),
                    convMetadata.createdAt,
                    convMetadata.updatedAt,
                ]
            )

            // Save messages (support both `.getMessages()` and `.messages` array)
            const messages = typeof (conversation as any).getMessages === 'function'
                ? (conversation as any).getMessages()
                : (conversation as any).messages || [];

            for (const msg of messages) {
                await client.query(
                    `INSERT INTO messages (id, conversation_id, role, content, tool_calls, tool_call_id, token_count, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (id) DO NOTHING`,
                    [
                        msg.id,
                        convId,
                        msg.role,
                        msg.content,
                        msg.toolCalls ? JSON.stringify(msg.toolCalls) : null,
                        msg.toolCallId,
                        msg.tokenCount,
                        msg.createdAt
                    ]
                )
            }
        })
    }

    async findById(id: ConversationId): Promise<Conversation | null> {
        const result = await this.pg.query(
            `SELECT * FROM conversations WHERE id = $1`,
            [(id as any).value ? (id as any).value : id]
        )

        if (result.rows.length === 0) return null

        const row = result.rows[0]
        const messages = await this.loadMessages(id)

        return new Conversation(
            id,
            UserId.create(row.user_id),
            row.title,
            messages,
            {
                createdAt: row.created_at,
                updatedAt: row.updated_at,
                messageCount: messages.length,
                ...row.metadata
            }
        )
    }

    async findByUserId(userId: UserId, limit = 10): Promise<Conversation[]> {
        const result = await this.pg.query(
            `SELECT * FROM conversations 
       WHERE user_id = $1 
       ORDER BY created_at DESC 
       LIMIT $2`,
            [(userId as any).value ? (userId as any).value : userId, limit]
        )

        const conversations: Conversation[] = []
        for (const row of result.rows) {
            const id = ConversationId.create(row.id)
            const messages = await this.loadMessages(id)

            conversations.push(
                new Conversation(
                    id,
                    userId,
                    row.title,
                    messages,
                    {
                        createdAt: row.created_at,
                        updatedAt: row.updated_at,
                        messageCount: messages.length,
                        ...row.metadata
                    }
                )
            )
        }

        return conversations
    }

    async delete(id: ConversationId): Promise<void> {
        await this.pg.query(
            `DELETE FROM conversations WHERE id = $1`,
            [(id as any).value ? (id as any).value : id]
        )
    }

    async addMessage(conversationId: ConversationId, message: Message): Promise<void> {
        await this.pg.query(
            `INSERT INTO messages (id, conversation_id, role, content, tool_calls, tool_call_id, token_count, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [
                message.id,
                (conversationId as any).value ? (conversationId as any).value : conversationId,
                message.role,
                message.content,
                message.toolCalls ? JSON.stringify(message.toolCalls) : null,
                message.toolCallId,
                message.tokenCount,
                message.createdAt
            ]
        )

        // Update conversation timestamp
        await this.pg.query(
            `UPDATE conversations SET updated_at = NOW() WHERE id = $1`,
            [(conversationId as any).value ? (conversationId as any).value : conversationId]
        )
    }

    private async loadMessages(conversationId: ConversationId): Promise<Message[]> {
        const result = await this.pg.query(
            `SELECT * FROM messages 
       WHERE conversation_id = $1 
       ORDER BY created_at ASC`,
            [conversationId.value]
        )

        return result.rows.map(row => ({
            id: row.id,
            role: row.role,
            content: row.content,
            toolCalls: row.tool_calls ? JSON.parse(row.tool_calls) : undefined,
            toolCallId: row.tool_call_id,
            tokenCount: row.token_count,
            createdAt: row.created_at
        }))
    }

    // New methods for summarization support
    async getById(id: string): Promise<any | null> {
        const result = await this.pg.query(
            `SELECT * FROM conversations WHERE id = $1`,
            [id]
        )
        return result.rows[0] || null
    }

    async getMessages(conversationId: string): Promise<Array<{ role: string; content: string }>> {
        const result = await this.pg.query(
            `SELECT role, content FROM messages 
       WHERE conversation_id = $1 
       ORDER BY created_at ASC`,
            [conversationId]
        )
        return result.rows
    }

    async updateSummaryCheckpoint(conversationId: string, checkpoint: number): Promise<void> {
        await this.pg.query(
            `UPDATE conversations 
       SET summary_checkpoint = $2, 
           updated_at = NOW() 
       WHERE id = $1`,
            [conversationId, checkpoint]
        )
    }

    async incrementMessageCount(conversationId: string): Promise<void> {
        await this.pg.query(
            `UPDATE conversations 
       SET message_count = message_count + 1,
           last_message_at = NOW(),
           updated_at = NOW()
       WHERE id = $1`,
            [conversationId]
        )
    }
}
