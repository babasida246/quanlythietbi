import { describe, it, expect } from 'vitest'
import { CategorySpecVersion } from './CategorySpecVersion.js'

describe('CategorySpecVersion', () => {
    it('rejects invalid version', () => {
        expect(() => new CategorySpecVersion({
            id: 'ver-1',
            categoryId: 'cat-1',
            version: 0,
            status: 'draft'
        })).toThrow('Version must be a positive integer')
    })

    it('creates a valid version', () => {
        const version = new CategorySpecVersion({
            id: 'ver-1',
            categoryId: 'cat-1',
            version: 1,
            status: 'active'
        })
        expect(version.status).toBe('active')
    })
})
