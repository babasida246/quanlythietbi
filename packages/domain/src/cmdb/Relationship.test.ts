import { describe, it, expect } from 'vitest'
import { Relationship, RelationshipType } from './Relationship.js'

describe('cmdb relationships', () => {
    it('validates relationship type', () => {
        const relType = new RelationshipType({ id: 'rt-1', code: 'DEPENDS_ON', name: 'Depends On' })
        expect(relType.code).toBe('DEPENDS_ON')
    })

    it('prevents self-loop by default', () => {
        expect(() => new Relationship({
            id: 'rel-1',
            relTypeId: 'rt-1',
            fromCiId: 'ci-1',
            toCiId: 'ci-1',
            status: 'active'
        })).toThrow()
    })
})
