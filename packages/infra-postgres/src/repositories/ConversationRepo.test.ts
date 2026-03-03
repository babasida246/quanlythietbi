import { describe, it, expect, vi } from 'vitest'
import { Conversation, ConversationId, UserId, createMessage } from '@qltb/domain'
import type { PgClient } from '../PgClient.js'
import { ConversationRepo } from './ConversationRepo.js'

describe('ConversationRepo', () => {
    it('saves conversation and messages inside a transaction', async () => {
        const query = vi.fn().mockResolvedValue({ rows: [] })
        const transaction = vi.fn(async (cb: (client: { query: typeof query }) => Promise<void>) => cb({ query }))
        const pg = { transaction } as unknown as PgClient
        const repo = new ConversationRepo(pg)

        const conversation = Conversation.create(UserId.create('user-1'), 'Thread 1')
        conversation.addMessage(createMessage({ role: 'user', content: 'hello' }))

        await repo.save(conversation)

        expect(transaction).toHaveBeenCalledTimes(1)
        expect(query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO conversations'), expect.any(Array))
        expect(query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO messages'), expect.any(Array))
    })

    it('loads conversation with messages by id', async () => {
        const query = vi.fn()
        const pg = { query } as unknown as PgClient
        const repo = new ConversationRepo(pg)
        const conversationId = '11111111-1111-4111-8111-111111111111'

        query
            .mockResolvedValueOnce({
                rows: [{
                    id: conversationId,
                    user_id: 'user-1',
                    title: 'Thread 1',
                    metadata: {},
                    created_at: new Date(),
                    updated_at: new Date()
                }]
            })
            .mockResolvedValueOnce({
                rows: [{
                    id: 'msg-1',
                    role: 'user',
                    content: 'hello',
                    tool_calls: null,
                    tool_call_id: null,
                    token_count: 1,
                    created_at: new Date()
                }]
            })

        const found = await repo.findById(ConversationId.create(conversationId))
        expect(found).toBeDefined()
        expect(found?.title).toBe('Thread 1')
        expect(found?.getMessages()).toHaveLength(1)
    })

    it('adds message and updates conversation timestamp', async () => {
        const query = vi.fn().mockResolvedValue({ rows: [] })
        const pg = { query } as unknown as PgClient
        const repo = new ConversationRepo(pg)
        const conversationId = '22222222-2222-4222-8222-222222222222'

        const message = createMessage({ role: 'assistant', content: 'ack' })
        await repo.addMessage(ConversationId.create(conversationId), message)

        expect(query).toHaveBeenCalledTimes(2)
        expect(query.mock.calls[0][0]).toContain('INSERT INTO messages')
        expect(query.mock.calls[1][0]).toContain('UPDATE conversations')
    })
})
