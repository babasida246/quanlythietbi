import { describe, it, expect, vi } from 'vitest'
import { RelationshipTypeRepo } from './RelationshipTypeRepo.js'
import type { Queryable } from './types.js'

describe('RelationshipTypeRepo', () => {
    it('creates relationship types', async () => {
        const query = vi.fn().mockResolvedValueOnce({
            rows: [{
                id: 'rt-1',
                code: 'DEPENDS_ON',
                name: 'Depends On',
                reverse_name: null,
                allowed_from_type_id: null,
                allowed_to_type_id: null
            }]
        })
        const pg = { query } as unknown as Queryable
        const repo = new RelationshipTypeRepo(pg)

        const created = await repo.create({ code: 'DEPENDS_ON', name: 'Depends On' })
        expect(created.code).toBe('DEPENDS_ON')
    })
})
