import { describe, it, expect } from 'vitest'
import { InventorySession, InventoryItem } from './Inventory.js'
import { DomainError } from '../core/errors/index.js'

describe('Inventory', () => {
    it('requires session name', () => {
        expect(() => new InventorySession({
            id: 's1',
            name: '',
            status: 'draft'
        })).toThrow(DomainError)
    })

    it('constructs inventory item', () => {
        const item = new InventoryItem({
            id: 'i1',
            sessionId: 's1',
            status: 'found'
        })
        expect(item.status).toBe('found')
    })
})
