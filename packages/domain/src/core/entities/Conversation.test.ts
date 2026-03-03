import { describe, it, expect } from 'vitest'
import Conversation from './Conversation.js'
import UserId from '../value-objects/UserId.js'
import { createMessage } from '../value-objects/Message.js'
import { DomainError } from '../errors/index.js'

describe('Conversation', () => {
    it('creates conversation', () => {
        const conv = Conversation.create(UserId.create('user-123'), 'Test')
        expect(conv.title).toBe('Test')
        expect(conv.getMessages()).toHaveLength(0)
    })

    it('adds message', () => {
        const conv = Conversation.create(UserId.create('user-123'), 'Test')
        const msg = createMessage({ role: 'user', content: 'Hello' })
        conv.addMessage(msg)
        expect(conv.getMessages()).toHaveLength(1)
        expect(conv.metadata.messageCount).toBe(1)
    })

    it('estimates tokens', () => {
        const conv = Conversation.create(UserId.create('user-123'), 'Test')
        conv.addMessage(createMessage({ role: 'user', content: 'Hello world' }))
        expect(conv.estimateTokens()).toBeGreaterThan(0)
    })

    it('rejects long title', () => {
        expect(() => {
            Conversation.create(UserId.create('user-123'), 'a'.repeat(256))
        }).toThrow(DomainError)
    })
})
