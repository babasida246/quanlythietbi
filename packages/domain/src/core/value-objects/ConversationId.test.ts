import { describe, it, expect } from 'vitest'
import ConversationId from './ConversationId.js'
import { DomainError } from '../errors/index.js'

describe('ConversationId', () => {
    it('generates valid UUID', () => {
        const id = ConversationId.generate()
        expect(id.value).toMatch(/^[0-9a-f-]{36}$/)
    })

    it('creates from valid UUID', () => {
        const uuid = '550e8400-e29b-41d4-a716-446655440000'
        const id = ConversationId.create(uuid)
        expect(id.value).toBe(uuid)
    })

    it('throws on invalid UUID', () => {
        expect(() => ConversationId.create('invalid')).toThrow(DomainError)
    })

    it('checks equality', () => {
        const id1 = ConversationId.generate()
        const id2 = ConversationId.create(id1.value)
        expect(id1.equals(id2)).toBe(true)
    })
})
