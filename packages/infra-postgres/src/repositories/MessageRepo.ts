import type { PgClient } from '../PgClient.js';

// Type definitions for message domain
export type MessageId = string;
export type ConversationId = string;

export interface MessageEntity {
    id: MessageId;
    conversationId: ConversationId;
    role: 'user' | 'assistant' | 'system';
    content: string;
    createdAt: Date;
    updatedAt: Date;
}

// Interface matching use-case expectations
export interface IMessageRepository {
    findById(id: MessageId): Promise<MessageEntity | null>;
    findByConversationId(conversationId: ConversationId): Promise<MessageEntity[]>;
    save(message: MessageEntity): Promise<void>;
    update(message: MessageEntity): Promise<void>;
    delete(id: MessageId): Promise<void>;
}

/**
 * PostgreSQL implementation of Message Repository
 * Maps between domain MessageEntity and database rows
 */
export class MessageRepo implements IMessageRepository {
    constructor(private pg: PgClient) { }

    async findById(id: MessageId): Promise<MessageEntity | null> {
        const result = await this.pg.query(
            `SELECT * FROM messages WHERE id = $1`,
            [id]
        );

        if (result.rows.length === 0) return null;

        return this.toDomain(result.rows[0]);
    }

    async findByConversationId(conversationId: ConversationId): Promise<MessageEntity[]> {
        const result = await this.pg.query(
            `SELECT * FROM messages 
             WHERE conversation_id = $1 
             ORDER BY created_at ASC`,
            [conversationId]
        );

        return result.rows.map(row => this.toDomain(row));
    }

    async save(message: MessageEntity): Promise<void> {
        await this.pg.query(
            `INSERT INTO messages (
                id, conversation_id, role, content, created_at, updated_at
            )
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [
                message.id,
                message.conversationId,
                message.role,
                message.content,
                message.createdAt,
                message.updatedAt,
            ]
        );
    }

    async update(message: MessageEntity): Promise<void> {
        await this.pg.query(
            `UPDATE messages 
             SET content = $2, updated_at = $3
             WHERE id = $1`,
            [
                message.id,
                message.content,
                message.updatedAt,
            ]
        );
    }

    async delete(id: MessageId): Promise<void> {
        await this.pg.query(`DELETE FROM messages WHERE id = $1`, [id]);
    }

    /**
     * Map database row to domain entity (plain object)
     */
    private toDomain(row: any): MessageEntity {
        return {
            id: row.id,
            conversationId: row.conversation_id,
            role: row.role as 'user' | 'assistant' | 'system',
            content: row.content,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        };
    }
}
